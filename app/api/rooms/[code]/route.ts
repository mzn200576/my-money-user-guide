import { applyMarketClose, eqFilter, insertRows, saveMarketOrder, selectRows, updateRows } from "@/db";
import type {
  AllocationSubmissionRow,
  MarketHoldingRow,
  MarketOrderRow,
  MarketTradeRow,
  RoomMemberRow,
  RoomRow,
} from "@/db/schema";
import { routeError } from "@/lib/api-response";
import { ALLOCATION_ASSETS, calculateAllocation, SHOCKS, type AllocationWeights } from "@/lib/course-data";
import { distributionExpectedValue, distributionForRoom, drawDividendValue, informationModeForRoom, tradingModeForRoom } from "@/lib/market";
import { requireAppUser } from "@/lib/server-auth";

type Context = { params: Promise<{ code: string }> };

export const runtime = "nodejs";

async function loadRoom(code: string) {
  const [room] = await selectRows<RoomRow>("rooms", { filters: { code: eqFilter(code.toUpperCase()) }, limit: 1 });
  return room;
}

async function handleGet(request: Request, context: Context) {
  const user = await requireAppUser(request);
  const { code } = await context.params;
  const room = await loadRoom(code);
  if (!room) return Response.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
  const members = await selectRows<RoomMemberRow>("room_members", { filters: { roomId: eqFilter(room.id) }, order: [{ column: "joinedAt" }] });
  const member = members.find((item) => item.userId === user.id) ?? null;
  const isOwner = room.ownerId === user.id;
  if (!isOwner && !member) return Response.json({ error: "먼저 방에 참여해주세요." }, { status: 403 });
  const parsedConfig = JSON.parse(room.config) as Record<string, unknown>;
  const safeConfig = { ...parsedConfig };
  if (room.type === "allocation" && !isOwner && ["lobby", "allocate"].includes(room.stage)) delete safeConfig.shockPool;
  if (room.type === "market" && !isOwner && !["results", "complete"].includes(room.stage)) {
    const informationMode = informationModeForRoom(parsedConfig, room.experiment);
    if (informationMode !== "full_distribution") {
      if (informationMode === "expected_only") safeConfig.expectedDividend = distributionExpectedValue(distributionForRoom(parsedConfig, room.experiment));
      else delete safeConfig.expectedDividend;
      delete safeConfig.dividendDistributions;
      delete safeConfig.activeDistributionId;
      delete safeConfig.experimentDistributionIds;
    }
  }
  const safeRoom = {
    ...room,
    config: safeConfig,
    shockKey: ["shock", "revise", "complete"].includes(room.stage) || isOwner ? room.shockKey : null,
  };
  const response: Record<string, unknown> = {
    room: safeRoom,
    isOwner,
    member,
    memberCount: members.length,
    members: isOwner ? members.map(({ id, nickname, roleKey, joinedAt }) => ({ id, nickname, roleKey, joinedAt })) : undefined,
  };

  if (room.type === "allocation") {
    const submissions = await selectRows<AllocationSubmissionRow>("allocation_submissions", { filters: { roomId: eqFilter(room.id) }, order: [{ column: "createdAt" }] });
    const own = member ? submissions.filter((item) => item.memberId === member.id).map((item) => ({ ...item, weights: JSON.parse(item.weights), risks: JSON.parse(item.risks) })) : [];
    response.submissions = own;
    response.submittedCount = new Set(submissions.filter((item) => item.version === 1).map((item) => item.memberId)).size;
    if (room.shockKey && ["shock", "revise", "complete"].includes(room.stage)) {
      const latest = own.at(-1);
      if (latest && member?.roleKey) response.result = calculateAllocation(latest.weights as AllocationWeights, room.shockKey, member.roleKey);
      const grouped = new Map<string, AllocationWeights[]>();
      for (const participant of members) {
        const latestSubmission = submissions.filter((item) => item.memberId === participant.id).at(-1);
        if (!latestSubmission || !participant.roleKey) continue;
        const items = grouped.get(participant.roleKey) ?? [];
        items.push(JSON.parse(latestSubmission.weights));
        grouped.set(participant.roleKey, items);
      }
      response.classSummary = [...grouped.entries()].map(([roleKey, items]) => ({
        roleKey,
        averages: Object.fromEntries(ALLOCATION_ASSETS.map((asset) => [asset.key, items.reduce((sum, weights) => sum + (weights[asset.key] ?? 0), 0) / items.length])),
      }));
    }
  }

  if (room.type === "market") {
    const holding = member ? (await selectRows<MarketHoldingRow>("market_holdings", { filters: { roomId: eqFilter(room.id), memberId: eqFilter(member.id) }, limit: 1 }))[0] : null;
    const orders = await selectRows<MarketOrderRow>("market_orders", { filters: { roomId: eqFilter(room.id), experiment: eqFilter(room.experiment), round: eqFilter(room.round) }, order: [{ column: "priceCents", ascending: false }] });
    const trades = await selectRows<MarketTradeRow>("market_trades", { filters: { roomId: eqFilter(room.id) }, order: [{ column: "createdAt" }] });
    response.holding = holding;
    response.ownOrder = member ? orders.find((order) => order.memberId === member.id) ?? null : null;
    response.orderCount = orders.length;
    const tradingMode = tradingModeForRoom(parsedConfig, room.experiment);
    const canSeeOrderbook = isOwner || tradingMode === "open_book" || (tradingMode === "close_public" && ["results", "complete"].includes(room.stage));
    response.orderbook = canSeeOrderbook
      ? orders.map((order) => ({ side: order.side, priceCents: order.priceCents, quantity: order.remaining, status: order.status }))
      : [];
    response.trades = trades.map((trade) => ({ experiment: trade.experiment, round: trade.round, priceCents: trade.priceCents, quantity: trade.quantity }));
  }
  return Response.json(response);
}

function randomItem<T>(items: T[]) {
  return items[crypto.getRandomValues(new Uint8Array(1))[0] % items.length];
}

function randomUnit() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
}

async function handlePost(request: Request, context: Context) {
  const user = await requireAppUser(request);
  const { code } = await context.params;
  const room = await loadRoom(code);
  if (!room) return Response.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
  const [member] = await selectRows<RoomMemberRow>("room_members", { filters: { roomId: eqFilter(room.id), userId: eqFilter(user.id) }, limit: 1 });
  const isOwner = room.ownerId === user.id;
  const body = (await request.json()) as {
    action?: string;
    weights?: AllocationWeights;
    risks?: string[];
    reason?: string;
    side?: "buy" | "sell";
    price?: number;
    quantity?: number;
  };

  if (body.action === "allocation_submit") {
    if (!member) return Response.json({ error: "참여자만 제출할 수 있습니다." }, { status: 403 });
    const version = room.stage === "allocate" ? 1 : room.stage === "revise" ? 2 : 0;
    if (!version) return Response.json({ error: "현재는 제출 단계가 아닙니다." }, { status: 409 });
    const weights = body.weights ?? ({} as AllocationWeights);
    const total = ALLOCATION_ASSETS.reduce((sum, asset) => sum + Number(weights[asset.key] ?? 0), 0);
    if (Math.abs(total - 100) > 0.001 || ALLOCATION_ASSETS.some((asset) => (weights[asset.key] ?? 0) < 0 || (weights[asset.key] ?? 0) % 5 !== 0)) {
      return Response.json({ error: "모든 비중은 5포인트 단위이고 합계는 100이어야 합니다." }, { status: 400 });
    }
    try {
      await insertRows<AllocationSubmissionRow>("allocation_submissions", {
        id: crypto.randomUUID(), roomId: room.id, memberId: member.id, version,
        weights: JSON.stringify(weights), risks: JSON.stringify((body.risks ?? []).slice(0, 2)), reason: (body.reason ?? "").slice(0, 300),
      });
    } catch {
      return Response.json({ error: version === 1 ? "최초 배분은 이미 제출했습니다." : "수정안은 한 번만 제출할 수 있습니다." }, { status: 409 });
    }
    return Response.json({ ok: true }, { status: 201 });
  }

  if (body.action === "market_order") {
    if (!member) return Response.json({ error: "참여자만 주문할 수 있습니다." }, { status: 403 });
    if (room.stage !== "trading") return Response.json({ error: "현재 장이 열려 있지 않습니다." }, { status: 409 });
    const priceCents = Math.round(Number(body.price) * 100);
    const quantity = Math.floor(Number(body.quantity));
    if (!["buy", "sell"].includes(body.side ?? "") || !Number.isSafeInteger(priceCents) || !Number.isSafeInteger(quantity) || priceCents <= 0 || quantity <= 0) return Response.json({ error: "가격과 수량을 확인해주세요." }, { status: 400 });
    const [holding] = await selectRows<MarketHoldingRow>("market_holdings", { filters: { roomId: eqFilter(room.id), memberId: eqFilter(member.id) }, limit: 1 });
    if (!holding) return Response.json({ error: "잔고를 찾을 수 없습니다." }, { status: 409 });
    if (body.side === "buy" && priceCents * quantity > holding.cashCents) return Response.json({ error: "주문에 필요한 현금이 부족합니다." }, { status: 400 });
    if (body.side === "sell" && quantity > holding.shares) return Response.json({ error: "보유 주식보다 많이 팔 수 없습니다." }, { status: 400 });
    await saveMarketOrder({
      id: crypto.randomUUID(), roomId: room.id, memberId: member.id, experiment: room.experiment, round: room.round,
      side: body.side!, priceCents, quantity,
    });
    return Response.json({ ok: true });
  }

  if (!isOwner) return Response.json({ error: "방장 권한이 필요합니다." }, { status: 403 });

  if (body.action === "start") {
    const config = JSON.parse(room.config) as { secondsPerRound?: number };
    const stageEndsAt = room.type === "market" ? new Date(Date.now() + (config.secondsPerRound ?? 60) * 1000).toISOString() : null;
    await updateRows<RoomRow>("rooms", { status: "active", stage: room.type === "allocation" ? "allocate" : "trading", stageEndsAt, updatedAt: new Date().toISOString() }, { id: eqFilter(room.id) });
    return Response.json({ ok: true });
  }
  if (body.action === "reveal_shock" && room.type === "allocation") {
    const config = JSON.parse(room.config) as { shockPool?: string[] };
    const pool = (config.shockPool?.length ? config.shockPool : SHOCKS.map((shock) => shock.key)).filter((key) => SHOCKS.some((shock) => shock.key === key));
    await updateRows<RoomRow>("rooms", { stage: "shock", shockKey: randomItem(pool), updatedAt: new Date().toISOString() }, { id: eqFilter(room.id) });
    return Response.json({ ok: true });
  }
  if (body.action === "open_revision" && room.type === "allocation") {
    await updateRows<RoomRow>("rooms", { stage: "revise", updatedAt: new Date().toISOString() }, { id: eqFilter(room.id) });
    return Response.json({ ok: true });
  }
  if (body.action === "complete") {
    await updateRows<RoomRow>("rooms", { stage: "complete", status: "complete", updatedAt: new Date().toISOString() }, { id: eqFilter(room.id) });
    return Response.json({ ok: true });
  }
  if (body.action === "close_market" && room.type === "market") {
    if (room.stage !== "trading") return Response.json({ error: "현재 장이 열려 있지 않습니다." }, { status: 409 });
    const orders = await selectRows<MarketOrderRow>("market_orders", { filters: { roomId: eqFilter(room.id), experiment: eqFilter(room.experiment), round: eqFilter(room.round) } });
    const holdings = await selectRows<MarketHoldingRow>("market_holdings", { filters: { roomId: eqFilter(room.id) } });
    const holdingMap = new Map(holdings.map((holding) => [holding.memberId, { ...holding }]));
    const buys = orders.filter((order) => order.side === "buy").sort((a, b) => b.priceCents - a.priceCents || a.createdAt.localeCompare(b.createdAt));
    const sells = orders.filter((order) => order.side === "sell").sort((a, b) => a.priceCents - b.priceCents || a.createdAt.localeCompare(b.createdAt));
    const trades: Array<{ id: string; buyer: string; seller: string; price: number; quantity: number }> = [];
    let bi = 0;
    let si = 0;
    while (bi < buys.length && si < sells.length) {
      const buy = buys[bi];
      const sell = sells[si];
      if (buy.priceCents < sell.priceCents) break;
      const buyer = holdingMap.get(buy.memberId)!;
      const seller = holdingMap.get(sell.memberId)!;
      const price = Math.round((buy.priceCents + sell.priceCents) / 2);
      const affordable = Math.floor(buyer.cashCents / price);
      const quantity = Math.min(buy.remaining, sell.remaining, affordable, seller.shares);
      if (quantity <= 0) {
        if (affordable <= 0) bi += 1;
        if (seller.shares <= 0) si += 1;
        continue;
      }
      buyer.cashCents -= price * quantity;
      buyer.shares += quantity;
      seller.cashCents += price * quantity;
      seller.shares -= quantity;
      buy.remaining -= quantity;
      sell.remaining -= quantity;
      trades.push({ id: crypto.randomUUID(), buyer: buy.memberId, seller: sell.memberId, price, quantity });
      if (buy.remaining === 0) bi += 1;
      if (sell.remaining === 0) si += 1;
    }
    const marketConfig = JSON.parse(room.config) as Record<string, unknown>;
    const dividendDistribution = distributionForRoom(marketConfig, room.experiment);
    const dividendCents = Math.round(drawDividendValue(dividendDistribution, randomUnit()) * 100);
    if (dividendCents) for (const holding of holdingMap.values()) holding.cashCents += holding.shares * dividendCents;
    await applyMarketClose({
      pRoomId: room.id,
      pVersion: room.version,
      pExperiment: room.experiment,
      pRound: room.round,
      pDividendPaid: dividendCents,
      pHoldings: [...holdingMap.values()].map((holding) => ({ id: holding.id, cashCents: holding.cashCents, shares: holding.shares })),
      pTrades: trades.map((trade) => ({
        id: trade.id,
        buyerMemberId: trade.buyer,
        sellerMemberId: trade.seller,
        priceCents: trade.price,
        quantity: trade.quantity,
      })),
      pOrders: orders.map((order) => ({
        id: order.id,
        remaining: order.remaining,
        status: order.remaining === 0 ? "filled" : order.remaining < order.quantity ? "partial" : "cancelled",
      })),
    });
    return Response.json({ ok: true, tradeCount: trades.length, dividendCents });
  }
  if (body.action === "next_market" && room.type === "market") {
    const config = JSON.parse(room.config) as { rounds?: number; secondsPerRound?: number };
    const maxRounds = config.rounds ?? 10;
    const nextRound = room.round + 1;
    if (nextRound > maxRounds) {
      await updateRows<RoomRow>("rooms", { stage: "complete", status: "complete", updatedAt: new Date().toISOString() }, { id: eqFilter(room.id) });
      return Response.json({ ok: true });
    }
    const stageEndsAt = new Date(Date.now() + (config.secondsPerRound ?? 60) * 1000).toISOString();
    await updateRows<RoomRow>("rooms", { stage: "trading", round: nextRound, dividendPaid: 0, stageEndsAt, updatedAt: new Date().toISOString() }, { id: eqFilter(room.id) });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "지원하지 않는 요청입니다." }, { status: 400 });
}

export async function GET(request: Request, context: Context) {
  try {
    return await handleGet(request, context);
  } catch (error) {
    return routeError(error, "room:get");
  }
}

export async function POST(request: Request, context: Context) {
  try {
    return await handlePost(request, context);
  } catch (error) {
    return routeError(error, "room:post");
  }
}
