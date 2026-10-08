import { createHash, timingSafeEqual } from "node:crypto";
import { DatabaseError, eqFilter, insertRows, selectRows } from "@/db";
import type { UserRow } from "@/db/schema";
import { routeError } from "@/lib/api-response";
import {
  clearSessionResponse,
  createSessionResponse,
  currentAppUser,
  hashPassword,
  normalizeUsername,
  verifyPassword,
} from "@/lib/server-auth";

export const runtime = "nodejs";

type AuthBody = {
  action?: "login" | "register" | "logout";
  username?: string;
  password?: string;
  displayName?: string;
  role?: string;
  teacherCode?: string;
};

function publicUser(user: Pick<UserRow, "id" | "username" | "displayName" | "role">) {
  return { id: user.id, username: user.username, displayName: user.displayName, role: user.role };
}

function secretsMatch(received: string, expected: string) {
  const left = createHash("sha256").update(received).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

async function handleGet(request: Request) {
  const user = await currentAppUser(request);
  return Response.json({ user: user ? publicUser(user) : null });
}

async function handlePost(request: Request) {
  const body = (await request.json()) as AuthBody;
  if (body.action === "logout") return clearSessionResponse(request);
  if (!body.action || !["login", "register"].includes(body.action)) {
    return Response.json({ error: "지원하지 않는 요청입니다." }, { status: 400 });
  }

  const username = normalizeUsername(body.username ?? "");
  const password = body.password ?? "";
  if (!/^[a-z0-9가-힣_-]{4,24}$/u.test(username)) {
    return Response.json({ error: "아이디는 한글·영문·숫자·밑줄·하이픈으로 4~24자까지 입력해주세요." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 72) {
    return Response.json({ error: "비밀번호는 8~72자로 입력해주세요." }, { status: 400 });
  }

  const [existing] = await selectRows<UserRow>("users", { filters: { username: eqFilter(username) }, limit: 1 });
  if (body.action === "login") {
    const valid = existing && await verifyPassword(password, existing.passwordHash, existing.passwordSalt);
    if (!valid || existing.status !== "active") {
      return Response.json({ error: "아이디 또는 비밀번호가 맞지 않습니다." }, { status: 401 });
    }
    return createSessionResponse(existing.id, { user: publicUser(existing) }, request);
  }

  if (existing) return Response.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
  const displayName = body.displayName?.trim().slice(0, 40) ?? "";
  const role = body.role === "teacher" ? "teacher" : body.role === "student" ? "student" : null;
  if (!displayName) return Response.json({ error: "수업에서 사용할 이름을 입력해주세요." }, { status: 400 });
  if (!role) return Response.json({ error: "선생님 또는 학생 계정을 선택해주세요." }, { status: 400 });
  if (role === "teacher") {
    const expectedCode = process.env.TEACHER_SIGNUP_CODE;
    if (!expectedCode) return Response.json({ error: "선생님 계정 등록 코드가 아직 설정되지 않았습니다." }, { status: 503 });
    if (!secretsMatch(body.teacherCode ?? "", expectedCode)) {
      return Response.json({ error: "선생님 등록 코드가 맞지 않습니다." }, { status: 403 });
    }
  }

  const credentials = await hashPassword(password);
  const id = crypto.randomUUID();
  const [created] = await insertRows<UserRow>("users", {
    id,
    username,
    displayName,
    role,
    status: "active",
    ...credentials,
  }, true);
  return createSessionResponse(id, { user: publicUser(created ?? { id, username, displayName, role }) }, request, 201);
}

export async function GET(request: Request) {
  try {
    return await handleGet(request);
  } catch (error) {
    return routeError(error, "auth:get");
  }
}

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (error) {
    console.error("[auth:post]", error);
    if (error instanceof DatabaseError && error.status === 409) {
      return Response.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
    }
    return routeError(error, "auth:post");
  }
}
