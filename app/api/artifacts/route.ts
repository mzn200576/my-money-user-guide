import { eqFilter, insertRows, selectRows, updateRows } from "@/db";
import type { UserArtifactRow } from "@/db/schema";
import { routeError } from "@/lib/api-response";
import { requireAppUser } from "@/lib/server-auth";

export const runtime = "nodejs";

async function handleGet(request: Request) {
  const user = await requireAppUser(request);
  const type = new URL(request.url).searchParams.get("type");
  const filters: Record<string, string> = { userId: eqFilter(user.id) };
  if (type) filters.type = eqFilter(type);
  const rows = await selectRows<UserArtifactRow>("user_artifacts", { filters, limit: type ? 1 : undefined });
  return Response.json({ artifacts: rows.map((row) => ({ ...row, payload: JSON.parse(row.payload) })) });
}

async function handlePut(request: Request) {
  const user = await requireAppUser(request);
  const body = (await request.json()) as { type?: string; payload?: unknown };
  if (!body.type || body.payload === undefined) return Response.json({ error: "저장할 결과가 없습니다." }, { status: 400 });
  const [existing] = await selectRows<UserArtifactRow>("user_artifacts", {
    filters: { userId: eqFilter(user.id), type: eqFilter(body.type) },
    limit: 1,
  });
  if (existing) {
    await updateRows<UserArtifactRow>("user_artifacts", {
      payload: JSON.stringify(body.payload),
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    }, { id: eqFilter(existing.id) });
  } else {
    await insertRows<UserArtifactRow>("user_artifacts", {
      id: crypto.randomUUID(),
      userId: user.id,
      type: body.type,
      payload: JSON.stringify(body.payload),
    });
  }
  return Response.json({ ok: true });
}

export async function GET(request: Request) {
  try {
    return await handleGet(request);
  } catch (error) {
    return routeError(error, "artifacts:get");
  }
}

export async function PUT(request: Request) {
  try {
    return await handlePut(request);
  } catch (error) {
    return routeError(error, "artifacts:put");
  }
}
