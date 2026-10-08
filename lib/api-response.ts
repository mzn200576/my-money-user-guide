import { DatabaseError } from "@/db";

export function routeError(error: unknown, label: string) {
  if (error instanceof Response) return error;
  console.error(`[${label}]`, error);
  if (error instanceof DatabaseError && error.status === 409) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof DatabaseError) {
    return Response.json({ error: "수업 데이터베이스에 연결하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }
  return Response.json({ error: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
}
