import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";

// Tests the real HTTP adapter and auth routes against a local REST stub.
// This does not execute PostgreSQL functions or verify a deployed Supabase project.
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const cache = new Map();
function load(relative) {
  let path = resolve(root, relative);
  if (!path.endsWith(".ts")) path = path.endsWith("/db") ? `${path}/index.ts` : `${path}.ts`;
  if (cache.has(path)) return cache.get(path).exports;
  const mod = { exports: {} };
  cache.set(path, mod);
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const localRequire = (name) => name.startsWith("@/") ? load(name.slice(2))
    : name.startsWith(".") ? load(resolve(dirname(path), name)) : require(name);
  new Function("require", "module", "exports", code)(localRequire, mod, mod.exports);
  return mod.exports;
}
const db = load("db/index.ts");
const auth = load("app/api/auth/route.ts");
function configured(t) {
  setEnv(t, "SUPABASE_URL", "https://classroom.example.test");
  setEnv(t, "SUPABASE_SECRET_KEY", "sb_secret_local-test-only");
}
function setEnv(t, key, value) {
  const previous = process.env[key];
  process.env[key] = value;
  t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
}

test("room member ordering and projection use created_at for joinedAt", async (t) => {
  configured(t);
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url.searchParams.get("order"), "created_at.asc");
    assert.match(url.searchParams.get("select"), /joinedAt:created_at/);
    assert.equal(url.searchParams.get("room_id"), "eq.room-1");
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.headers.apikey, "sb_secret_local-test-only");
    assert.equal(options.cache, "no-store");
    return Response.json([{ id: "member-1", joinedAt: "2026-10-01T00:00:00Z" }]);
  });
  const [member] = await db.selectRows("room_members", { filters: { roomId: db.eqFilter("room-1") }, order: [{ column: "joinedAt" }] });
  assert.equal(member.joinedAt, "2026-10-01T00:00:00Z");
});

test("login uses the correct route when Supabase URL already includes /rest/v1", async (t) => {
  configured(t);
  setEnv(t, "SUPABASE_URL", "https://classroom.example.test/rest/v1/");
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url.pathname, "/rest/v1/users");
    return Response.json([]);
  });
  const response = await auth.POST(new Request("https://classroom.example.test/api/auth", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", username: "student-check", password: "example-password" }),
  }));
  assert.equal(response.status, 401);
});

test("writes map SQL columns without rewriting user JSON; empty writes are accepted", async (t) => {
  configured(t);
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const record = JSON.parse(options.body);
    assert.equal(record.user_id, "student-1");
    assert.deepEqual(JSON.parse(record.payload), { expectedReturn: 7 });
    return new Response(null, { status: 204 });
  });
  assert.deepEqual(await db.insertRows("user_artifacts", { id: "artifact", userId: "student-1", type: "mpt", payload: JSON.stringify({ expectedReturn: 7 }) }), []);
});

test("malformed and empty query responses become controlled database errors", async (t) => {
  configured(t);
  const replies = [new Response("<html>Unavailable</html>", { status: 502 }), new Response("")];
  t.mock.method(globalThis, "fetch", async () => replies.shift());
  for (let i = 0; i < 2; i++) await assert.rejects(db.selectRows("users"), (error) => error instanceof db.DatabaseError && error.status === 503);
});

test("network failures do not leak request or key details", async (t) => {
  configured(t);
  t.mock.method(globalThis, "fetch", async () => { throw new Error("transport detail"); });
  await assert.rejects(db.selectRows("users"), (error) => error.status === 503 && !error.message.includes("transport"));
});

test("market settlement passes expected version and preserves a conflict response", async (t) => {
  configured(t);
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url.pathname, "/rest/v1/rpc/apply_market_close");
    const body = JSON.parse(options.body);
    assert.equal(body.p_version, 19);
    assert.equal(body.p_holdings[0].cash_cents, 5100);
    return Response.json({ message: "주문이나 참가자가 갱신되었습니다.", code: "PT409" }, { status: 409 });
  });
  await assert.rejects(db.applyMarketClose({ pRoomId: "room", pExperiment: 1, pRound: 2, pVersion: 19, pDividendPaid: 10,
    pHoldings: [{ id: "holding", cashCents: 5100, shares: 5 }], pTrades: [], pOrders: [] }),
  (error) => error.status === 409 && error.details === "PT409");
});

test("unscoped updates and unknown columns never reach the network", async (t) => {
  configured(t);
  const fetch = t.mock.method(globalThis, "fetch", () => { throw new Error("unexpected fetch"); });
  assert.throws(() => db.updateRows("users", { displayName: "x" }, {}));
  await assert.rejects(db.selectRows("users", { order: [{ column: "notAColumn" }] }));
  assert.equal(fetch.mock.callCount(), 0);
});

test("student/teacher signup, password login, session and logout through real routes", async (t) => {
  configured(t);
  setEnv(t, "TEACHER_SIGNUP_CODE", "test-teacher-code");
  t.mock.method(console, "error", () => {});
  const tables = { users: [], sessions: [] };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const name = url.pathname.split("/").at(-1);
    const rows = tables[name];
    assert.ok(rows, `unexpected table ${name}`);
    const matches = (row) => [...url.searchParams].filter(([key]) => !["select", "limit", "order"].includes(key))
      .every(([key, filter]) => filter.startsWith("eq.") ? String(row[key]) === filter.slice(3) : String(row[key]) > filter.slice(3));
    const project = (row) => Object.fromEntries(url.searchParams.get("select").split(",").map((entry) => {
      const [alias, column = alias] = entry.split(":");
      return [alias, row[column]];
    }));
    if (options.method === "GET") return Response.json(rows.filter(matches).map(project));
    if (options.method === "DELETE") {
      tables[name] = rows.filter((row) => !matches(row));
      return new Response(null, { status: 204 });
    }
    const row = { created_at: new Date().toISOString(), ...JSON.parse(options.body) };
    rows.push(row);
    return options.headers.Prefer === "return=representation" ? Response.json([project(row)], { status: 201 }) : new Response(null, { status: 201 });
  });
  async function post(body, cookie = "") {
    return auth.POST(new Request("https://classroom.example.test/api/auth", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(body) }));
  }
  const account = { username: "student-test", password: "classroom-password", displayName: "학생", role: "student" };
  const signup = await post({ action: "register", ...account });
  assert.equal(signup.status, 201);
  assert.equal((await signup.json()).user.username, account.username);
  assert.equal(tables.users[0].email, undefined);
  assert.notEqual(tables.users[0].password_hash, account.password);
  const cookie = signup.headers.get("set-cookie").split(";")[0];
  assert.match(signup.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);
  assert.match(signup.headers.get("set-cookie"), /Secure/);
  assert.equal((await post({ action: "register", ...account })).status, 409);
  assert.equal((await post({ action: "login", ...account, password: "wrong-password" })).status, 401);
  assert.equal((await post({ action: "login", ...account })).status, 200);
  assert.equal((await post({ action: "register", ...account, username: "teacher-test", role: "teacher", teacherCode: "wrong" })).status, 403);
  assert.equal((await post({ action: "register", ...account, username: "teacher-test", role: "teacher", teacherCode: "test-teacher-code" })).status, 201);
  const current = await auth.GET(new Request("https://classroom.example.test/api/auth", { headers: { cookie } }));
  assert.equal((await current.json()).user.username, account.username);
  await post({ action: "logout" }, cookie);
  const loggedOut = await auth.GET(new Request("https://classroom.example.test/api/auth", { headers: { cookie } }));
  assert.equal((await loggedOut.json()).user, null);
});
