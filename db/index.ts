import { getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import * as schema from "./schema";

type FilterValue = string | number | boolean;
type QueryOptions = { filters?: Record<string, FilterValue>; limit?: number; order?: Array<{ column: string; ascending?: boolean }> };
const tables: Record<string, PgTable> = {
  users: schema.users, sessions: schema.sessions, courses: schema.courses, rooms: schema.rooms,
  room_members: schema.roomMembers, allocation_submissions: schema.allocationSubmissions,
  market_holdings: schema.marketHoldings, market_orders: schema.marketOrders,
  market_trades: schema.marketTrades, user_artifacts: schema.userArtifacts,
};

export class DatabaseError extends Error {
  constructor(message: string, public status: number, public details?: string) {
    super(message);
    this.name = "DatabaseError";
  }
}

function columns(table: string) {
  if (!Object.hasOwn(tables, table)) throw new Error("알 수 없는 데이터 테이블입니다.");
  return getTableColumns(tables[table]);
}
function columnName(table: string, key: string) {
  const column = columns(table)[key];
  if (!column) throw new Error("알 수 없는 데이터 항목입니다.");
  return column.name;
}
function mapRecord(table: string, value: unknown): unknown {
  if (Array.isArray(value)) return value.map((record) => mapRecord(table, record));
  if (!value || typeof value !== "object") throw new Error("저장할 데이터를 확인해주세요.");
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)
    .map(([key, item]) => [columnName(table, key), item]));
}
function rpcArguments(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(rpcArguments);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), rpcArguments(item),
  ]));
}

async function requestDatabase(path: string, options: { method?: string; body?: unknown; query?: URLSearchParams; returnRows?: boolean } = {}) {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new DatabaseError("SUPABASE_URL과 SUPABASE_SECRET_KEY를 설정해주세요.", 503);
  const endpoint = new URL(`${url.replace(/\/$/, "")}/rest/v1/${path}`);
  if (options.query) endpoint.search = options.query.toString();
  const headers: Record<string, string> = {
    apikey: key, "Content-Type": "application/json",
    Prefer: options.returnRows ? "return=representation" : "return=minimal",
  };
  // Supabase secret keys are not JWTs. Only legacy JWT keys use Bearer.
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: options.method ?? "GET", headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new DatabaseError("데이터베이스에 연결하지 못했습니다.", 503);
  }
  const text = await response.text();
  let payload: unknown = null;
  if (text.trim()) {
    try { payload = JSON.parse(text); }
    catch { throw new DatabaseError("데이터베이스에서 올바른 응답을 받지 못했습니다.", 503); }
  }
  if (!response.ok) {
    const error = payload as { message?: string; code?: string } | null;
    throw new DatabaseError(error?.message ?? "데이터베이스 요청을 처리하지 못했습니다.", response.status, error?.code);
  }
  return payload;
}

async function tableRequest<T>(table: string, method: string, query: QueryOptions = {}, body?: unknown, returnRows = false): Promise<T[]> {
  const params = new URLSearchParams();
  // Use the schema's actual names: roomMembers.joinedAt is SQL created_at.
  params.set("select", Object.entries(columns(table)).map(([key, column]) => key === column.name ? key : `${key}:${column.name}`).join(","));
  for (const [key, filter] of Object.entries(query.filters ?? {})) params.set(columnName(table, key), String(filter));
  if (query.order?.length) params.set("order", query.order.map(({ column, ascending }) => `${columnName(table, column)}.${ascending === false ? "desc" : "asc"}`).join(","));
  if (query.limit !== undefined) params.set("limit", String(Math.max(0, Math.floor(query.limit))));
  const payload = await requestDatabase(table, {
    method, query: params, body: body === undefined ? undefined : mapRecord(table, body), returnRows,
  });
  if (payload === null && method !== "GET" && !returnRows) return [];
  if (!Array.isArray(payload)) throw new DatabaseError("데이터베이스 조회 결과를 확인하지 못했습니다.", 503);
  return payload as T[];
}

export function eqFilter(value: string | number | boolean) { return `eq.${value}`; }
export function gtFilter(value: string | number) { return `gt.${value}`; }
export function inFilter(values: Array<string | number>) { return `in.(${values.join(",")})`; }
export function selectRows<T>(table: string, query: QueryOptions = {}) { return tableRequest<T>(table, "GET", query); }
export function insertRows<T>(table: string, values: unknown, returnRows = false) { return tableRequest<T>(table, "POST", {}, values, returnRows); }
export function updateRows<T>(table: string, values: unknown, filters: Record<string, FilterValue>, returnRows = false) {
  if (!Object.keys(filters).length) throw new Error("수정할 항목을 지정해주세요.");
  return tableRequest<T>(table, "PATCH", { filters }, values, returnRows);
}
export function deleteRows<T>(table: string, filters: Record<string, FilterValue>, returnRows = false) {
  if (!Object.keys(filters).length) throw new Error("삭제할 항목을 지정해주세요.");
  return tableRequest<T>(table, "DELETE", { filters }, undefined, returnRows);
}

function callDatabaseFunction<T>(name: string, args: unknown): Promise<T> {
  return requestDatabase(`rpc/${name}`, { method: "POST", body: rpcArguments(args) }) as Promise<T>;
}
export function joinClassroom(args: {
  pMemberId: string; pRoomId: string; pUserId: string; pNickname: string;
  pRoleKey: string | null; pPrivateInfo: string | null;
}) {
  return callDatabaseFunction<string>("join_classroom", args);
}
export function saveMarketOrder(order: {
  id: string; roomId: string; memberId: string; experiment: number; round: number;
  side: string; priceCents: number; quantity: number;
}) {
  return callDatabaseFunction<void>("save_market_order", { pOrder: order });
}
export function applyMarketClose(args: {
  pRoomId: string; pExperiment: number; pRound: number; pVersion: number; pDividendPaid: number;
  pHoldings: Array<{ id: string; cashCents: number; shares: number }>;
  pTrades: Array<{ id: string; buyerMemberId: string; sellerMemberId: string; priceCents: number; quantity: number }>;
  pOrders: Array<{ id: string; remaining: number; status: string }>;
}) {
  return callDatabaseFunction<void>("apply_market_close", args);
}
