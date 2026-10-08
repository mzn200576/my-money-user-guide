import { eqFilter, inFilter, insertRows, joinClassroom, selectRows } from "@/db";
import type { RoomMemberRow, RoomRow } from "@/db/schema";
import { routeError } from "@/lib/api-response";
import { ROLE_CARDS, SHOCKS } from "@/lib/course-data";
import { DEFAULT_ACTIVE_DISTRIBUTION_ID, DEFAULT_DIVIDEND_DISTRIBUTIONS, sanitizeDividendDistributions } from "@/lib/market";
import { requireAppUser } from "@/lib/server-auth";

export const runtime = "nodejs";

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

async function handleGet(request: Request) {
  const user = await requireAppUser(request);
  const memberships = await selectRows<RoomMemberRow>("room_members", { filters: { userId: eqFilter(user.id) } });
  const joinedIds = memberships.map((item) => item.roomId);
  const owned = await selectRows<RoomRow>("rooms", {
    filters: { ownerId: eqFilter(user.id) },
    order: [{ column: "createdAt", ascending: false }],
    limit: 20,
  });
  const joined = joinedIds.length ? await selectRows<RoomRow>("rooms", {
    filters: { id: inFilter(joinedIds) },
    order: [{ column: "createdAt", ascending: false }],
    limit: 20,
  }) : [];
  const unique = new Map([...owned, ...joined].map((room) => [room.id, room]));
  // A room list needs only navigation fields, never unrevealed shock settings.
  return Response.json({ rooms: [...unique.values()].map(({ id, code, type, title, status, stage, createdAt }) => ({ id, code, type, title, status, stage, createdAt })) });
}

async function handlePost(request: Request) {
  const user = await requireAppUser(request);
  const body = (await request.json()) as { action?: string; type?: string; title?: string; code?: string; nickname?: string; config?: Record<string, unknown> };

  if (body.action === "create") {
    if (!["teacher", "instructor", "admin"].includes(user.role)) {
      return Response.json({ error: "선생님 계정만 수업방을 만들 수 있습니다." }, { status: 403 });
    }
    const type = body.type === "market" ? "market" : "allocation";
    const code = roomCode();
    const requested = body.config ?? {};
    let config: Record<string, unknown>;
    if (type === "allocation") {
      config = {
        rolePool: Array.isArray(requested.rolePool) && requested.rolePool.length ? requested.rolePool.filter((key) => ROLE_CARDS.some((role) => role.key === key)) : ROLE_CARDS.map((role) => role.key),
        shockPool: Array.isArray(requested.shockPool) && requested.shockPool.length ? requested.shockPool.filter((key) => SHOCKS.some((shock) => shock.key === key)) : SHOCKS.map((shock) => shock.key),
        revision: requested.revision !== false,
      };
    } else {
      const requestedDistributions = requested.dividendDistributions;
      const dividendDistributions = sanitizeDividendDistributions(requestedDistributions)
        ?? (requestedDistributions === undefined ? DEFAULT_DIVIDEND_DISTRIBUTIONS : null);
      if (!dividendDistributions) return Response.json({ error: "배당확률분포의 값과 확률 합계를 확인해주세요." }, { status: 400 });
      const validIds = new Set(dividendDistributions.map((distribution) => distribution.id));
      const requestedDistributionId = String(requested.activeDistributionId ?? DEFAULT_ACTIVE_DISTRIBUTION_ID);
      const activeDistributionId = validIds.has(requestedDistributionId) ? requestedDistributionId : dividendDistributions[0].id;
      const tradingMode = ["private", "close_public", "open_book"].includes(String(requested.tradingMode)) ? String(requested.tradingMode) : "close_public";
      const informationMode = ["full_distribution", "expected_only", "hidden"].includes(String(requested.informationMode)) ? String(requested.informationMode) : "full_distribution";
      const requestedInitialCash = Number(requested.initialCash);
      config = {
        rounds: Math.max(1, Math.min(30, Number(requested.rounds) || 10)),
        secondsPerRound: Math.max(30, Math.min(180, Number(requested.secondsPerRound) || 60)),
        initialCash: Number.isFinite(requestedInitialCash) ? Math.max(0, Math.min(1000, requestedInitialCash)) : 50,
        initialShares: Math.max(1, Math.min(100, Math.floor(Number(requested.initialShares) || 5))),
        tradingMode,
        informationMode,
        dividendDistributions,
        activeDistributionId,
      };
    }
    await insertRows<RoomRow>("rooms", {
      id: crypto.randomUUID(),
      code,
      type,
      title: body.title?.trim() || (type === "market" ? "실험자산시장" : "역할별 자산배분"),
      ownerId: user.id,
      config: JSON.stringify(config),
      status: "lobby",
      stage: "lobby",
      experiment: 1,
    });
    return Response.json({ code }, { status: 201 });
  }

  if (body.action === "join") {
    const code = (body.code ?? "").trim().toUpperCase();
    const [room] = await selectRows<RoomRow>("rooms", { filters: { code: eqFilter(code) }, limit: 1 });
    if (!room) return Response.json({ error: "방 코드를 확인해주세요." }, { status: 404 });
    if (room.status === "complete") return Response.json({ error: "이미 종료된 방입니다." }, { status: 409 });
    const allMembers = await selectRows<RoomMemberRow>("room_members", { filters: { roomId: eqFilter(room.id) } });
    const own = allMembers.find((member) => member.userId === user.id);
    if (own) return Response.json({ code, memberId: own.id });
    const nickname = (body.nickname?.trim() || user.displayName || `참여자 ${allMembers.length + 1}`).slice(0, 20);
    let roleKey: string | null = null;
    if (room.type === "allocation") {
      const config = JSON.parse(room.config) as { rolePool?: string[] };
      const pool = config.rolePool?.length ? config.rolePool : ROLE_CARDS.map((role) => role.key);
      const counts = new Map(pool.map((role) => [role, allMembers.filter((member) => member.roleKey === role).length]));
      const minimum = Math.min(...counts.values());
      const candidates = pool.filter((role) => counts.get(role) === minimum);
      roleKey = candidates[crypto.getRandomValues(new Uint8Array(1))[0] % candidates.length];
    }
    const memberId = crypto.randomUUID();
    const savedMemberId = await joinClassroom({
      pMemberId: memberId, pRoomId: room.id, pUserId: user.id, pNickname: nickname, pRoleKey: roleKey,
      pPrivateInfo: room.type === "market" ? `배당 정보 카드 ${((allMembers.length % 10) + 1).toString().padStart(2, "0")}` : null,
    });
    return Response.json({ code, memberId: savedMemberId }, { status: 201 });
  }

  return Response.json({ error: "지원하지 않는 요청입니다." }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    return await handleGet(request);
  } catch (error) {
    return routeError(error, "rooms:get");
  }
}

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (error) {
    return routeError(error, "rooms:post");
  }
}
