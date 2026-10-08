import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { deleteRows, eqFilter, gtFilter, insertRows, selectRows } from "@/db";
import type { SessionRow, UserRow } from "@/db/schema";

const SESSION_COOKIE = "class_session";
const SESSION_SECONDS = 60 * 60 * 12;
const PBKDF2_ITERATIONS = 100_000;

export function normalizeUsername(value: string) {
  return value.trim().normalize("NFKC").toLowerCase();
}

function readCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: PBKDF2_ITERATIONS }, key, 256);
  return { passwordHash: Buffer.from(bits).toString("hex"), passwordSalt: salt };
}

export async function verifyPassword(password: string, passwordHash: string | null, passwordSalt: string | null) {
  if (!passwordHash || !passwordSalt || !/^[a-f0-9]{64}$/i.test(passwordHash)) return false;
  const expected = Buffer.from(passwordHash, "hex");
  const actual = Buffer.from((await hashPassword(password, passwordSalt)).passwordHash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function currentAppUser(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const [session] = await selectRows<SessionRow>("sessions", {
    filters: { tokenHash: eqFilter(sha256(token)), expiresAt: gtFilter(new Date().toISOString()) },
    limit: 1,
  });
  if (!session) return null;
  const [user] = await selectRows<UserRow>("users", { filters: { id: eqFilter(session.userId) }, limit: 1 });
  return user?.status === "active" ? user : null;
}

export async function requireAppUser(request: Request) {
  const user = await currentAppUser(request);
  if (!user) throw new Response(JSON.stringify({ error: "로그인이 필요합니다." }), { status: 401 });
  return user;
}

export async function createSessionResponse(userId: string, payload: unknown, request: Request, status = 200) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await insertRows<SessionRow>("sessions", { tokenHash: sha256(token), userId, expiresAt });
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return Response.json(payload, {
    status,
    headers: { "Set-Cookie": `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}${secure}` },
  });
}

export async function clearSessionResponse(request: Request, payload: unknown = { ok: true }) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await deleteRows<SessionRow>("sessions", { tokenHash: eqFilter(sha256(token)) });
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return Response.json(payload, {
    headers: { "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}` },
  });
}
