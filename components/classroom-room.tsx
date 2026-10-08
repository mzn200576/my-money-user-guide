"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, Copy, Eye, LockKeyhole, Play, RefreshCw, Send, Sparkles, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ALLOCATION_ASSETS, ROLE_CARDS, SHOCKS, type AllocationWeights } from "@/lib/course-data";
import { distributionForRoom } from "@/lib/market";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { readJsonResponse } from "@/lib/client-response";
import { DividendWheel } from "@/components/dividend-wheel";
import { MarketRoom } from "@/components/market-room";

type User = { id: string; displayName: string; role: string };
type MarketReceiptData = {
  openingCashCents: number; tradeCashCents: number; dividendCashCents: number;
  endingCashCents: number; openingShares: number; endingShares: number; filledQuantity: number;
};
export type RoomData = {
  room: { id: string; code: string; type: "allocation" | "market"; title: string; stage: string; status: string; experiment: number; round: number; shockKey: string | null; dividendPaid: number; stageEndsAt: string | null; config: Record<string, unknown> };
  isOwner: boolean;
  member: { id: string; nickname: string; roleKey: string | null; privateInfo: string | null } | null;
  memberCount: number;
  members?: Array<{ id: string; nickname: string; roleKey: string | null }>;
  submissions?: Array<{ version: number; weights: AllocationWeights; risks: string[]; reason: string }>;
  submittedCount?: number;
  result?: AllocationResult;
  classSummary?: Array<{ roleKey: string; averages: AllocationWeights }>;
  holding?: { cashCents: number; shares: number } | null;
  ownOrder?: { side: string; priceCents: number; quantity: number; status: string } | null;
  orderCount?: number;
  orderbook?: Array<{ side: string; priceCents: number; quantity: number; status: string }>;
  trades?: Array<{ experiment: number; round: number; priceCents: number; quantity: number }>;
  marketReceipt?: MarketReceiptData;
  classReceipts?: Array<MarketReceiptData & { memberId: string; nickname: string }>;
};

type AllocationResult = {
  shock: { key: string; label: string; inflation: number };
  role: { key: string; label: string; focus: string; summary: string };
  nominal: number;
  real: number;
  liquidity: number;
  loss: number;
  goalMet: boolean;
  liquidityMet: boolean;
  lossMet: boolean;
  worstValue: number;
  contributions: Array<{ key: string; label: string; contribution: number }>;
};

const initialWeights = Object.fromEntries(ALLOCATION_ASSETS.map((asset, index) => [asset.key, index < 2 ? 20 : 15])) as AllocationWeights;
const riskOptions = ["원금손실", "물가위험", "금리위험", "유동성위험", "기업고유위험", "시장위험"];

export function ClassroomRoom({ code, onExit }: { code: string; user: User; onExit: () => void }) {
  const [data, setData] = useState<RoomData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const latestLoad = useRef(0);
  const lastAppliedLoad = useRef(0);
  const load = useCallback(async () => {
    const requestId = ++latestLoad.current;
    try {
      const res = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
      const payload = await readJsonResponse<RoomData & { error?: string }>(res);
      if (!res.ok) throw new Error(payload.error ?? "방 상태를 불러오지 못했습니다.");
      if (requestId >= lastAppliedLoad.current) {
        lastAppliedLoad.current = requestId;
        setData(payload);
        setError("");
      }
    } catch (cause) {
      if (requestId === latestLoad.current) setError(cause instanceof Error ? cause.message : "방 상태를 불러오지 못했습니다.");
    }
  }, [code]);
  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 2500);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer); };
  }, [load]);
  const action = async (body: Record<string, unknown>) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const res = await fetch(`/api/rooms/${code}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await readJsonResponse<{ error?: string; warning?: string }>(res);
      if (!res.ok) throw new Error(payload.error ?? "요청을 처리하지 못했습니다.");
      if (payload.warning) setNotice(payload.warning);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다."); }
    finally { setBusy(false); }
  };
  if (!data) return <div className="mx-auto max-w-6xl rounded-2xl border bg-card p-8 text-center"><RefreshCw className="mx-auto mb-3 size-6 animate-spin text-primary" /><p>{error || "수업방을 불러오는 중입니다."}</p><Button variant="ghost" className="mt-4" onClick={onExit}>나가기</Button></div>;
  return (
    <div className="mx-auto max-w-[1280px] space-y-5 fade-up">
      <RoomHeader data={data} onExit={onExit} />
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{notice}</p>}
      {data.room.type === "allocation" ? <AllocationRoom data={data} action={action} busy={busy} /> : <MarketRoom data={data} action={action} busy={busy} />}
      {data.room.type === "market" && data.room.stage === "results" && data.room.stageEndsAt &&
        <DividendWheel key={`${data.room.id}-${data.room.round}-${data.room.stageEndsAt}`}
          distribution={distributionForRoom(data.room.config, data.room.experiment)}
          dividendCents={data.room.dividendPaid} deadline={data.room.stageEndsAt} />}
    </div>
  );
}

function RoomHeader({ data, onExit }: { data: RoomData; onExit: () => void }) {
  return <header className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><Button variant="ghost" size="icon" onClick={onExit} aria-label="방 나가기"><ArrowLeft /></Button><div><div className="flex flex-wrap items-center gap-2"><Badge>{data.room.type === "allocation" ? "2차시 자산배분" : "1차시 실험경제"}</Badge><Badge variant="outline">{stageLabel(data.room.stage)}</Badge>{data.room.stage === "trading" && data.room.stageEndsAt && <Countdown deadline={data.room.stageEndsAt} />}</div><h2 className="mt-2 text-xl font-bold">{data.room.title}</h2></div></div><div className="flex items-center gap-3"><div className="rounded-xl bg-muted px-4 py-2 text-center"><p className="text-xs text-muted-foreground">방 코드</p><p className="number-tabular text-xl font-black tracking-[0.16em]">{data.room.code}</p></div><Button variant="outline" size="icon" aria-label="방 코드 복사" onClick={() => navigator.clipboard?.writeText(data.room.code)}><Copy /></Button><div className="flex items-center gap-2 rounded-xl border px-3 py-3 text-sm"><Users className="size-4 text-primary" /><b>{data.memberCount}</b>명</div></div></header>;
}

function AllocationRoom({ data, action, busy }: { data: RoomData; action: (body: Record<string, unknown>) => Promise<void>; busy: boolean }) {
  if (data.isOwner) return <AllocationHost data={data} action={action} busy={busy} />;
  if (!data.member) return <WaitCard title="참여자 정보가 없습니다" description="수업 홈에서 방 코드로 다시 입장해주세요." />;
  const role = ROLE_CARDS.find((item) => item.key === data.member?.roleKey) ?? ROLE_CARDS[0];
  if (data.room.stage === "lobby") return <WaitCard title={`${role.label} 역할이 배정되었습니다`} description="선생님이 활동을 시작하면 자산배분 화면이 열립니다." role={role} />;
  return <AllocationStudent data={data} action={action} role={role} busy={busy} />;
}

function AllocationHost({ data, action, busy }: { data: RoomData; action: (body: Record<string, unknown>) => Promise<void>; busy: boolean }) {
  const shock = SHOCKS.find((item) => item.key === data.room.shockKey);
  const allowRevision = data.room.config.revision !== false;
  const chart = data.classSummary?.map((group) => ({ name: ROLE_CARDS.find((role) => role.key === group.roleKey)?.label ?? group.roleKey, ...group.averages })) ?? [];
  return <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Eye className="text-primary" />선생님 진행 제어</CardTitle><CardDescription>학생 화면의 단계를 모두 함께 전환합니다.</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="rounded-xl bg-muted p-4"><div className="flex justify-between text-sm"><span>최초 제출 현황</span><b>{data.submittedCount ?? 0}/{data.memberCount}</b></div><Progress className="mt-3" value={data.memberCount ? ((data.submittedCount ?? 0) / data.memberCount) * 100 : 0} /></div>
      {data.room.stage === "lobby" && <Button className="w-full" size="lg" onClick={() => action({ action: "start" })} disabled={busy || data.memberCount === 0}><Play /> 역할 공개·배분 시작</Button>}
      {data.room.stage === "allocate" && <Button className="w-full bg-[#c77a0b] hover:bg-[#a86408]" size="lg" onClick={() => action({ action: "reveal_shock" })} disabled={busy || (data.submittedCount ?? 0) === 0}><Sparkles /> 제출 잠금·충격 추첨</Button>}
      {data.room.stage === "shock" && (allowRevision ? <Button className="w-full" size="lg" onClick={() => action({ action: "open_revision" })} disabled={busy}><RefreshCw /> 수정 기회 열기</Button> : <Button className="w-full" size="lg" onClick={() => action({ action: "complete" })} disabled={busy}><CheckCircle2 /> 활동 종료</Button>)}
      {data.room.stage === "revise" && <Button className="w-full" size="lg" onClick={() => action({ action: "complete" })} disabled={busy}><CheckCircle2 /> 활동 종료</Button>}
      {data.room.stage === "complete" && <div className="rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">활동이 종료되었습니다. 최초안과 수정안이 모두 저장되었습니다.</div>}
      {shock && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold text-amber-700">공개된 시장상황</p><p className="mt-1 text-xl font-black text-amber-950">{shock.label}</p><p className="mt-1 text-sm text-amber-800">물가상승률 {shock.inflation}%</p></div>}
    </CardContent></Card>
    <div className="space-y-5"><Card><CardHeader><CardTitle>참여 현황</CardTitle><CardDescription>학생별 역할은 균등하게 섞어 배정됩니다.</CardDescription></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data.members?.map((member) => <div key={member.id} className="flex items-center justify-between rounded-xl border px-4 py-3"><span className="font-medium">{member.nickname}</span><Badge variant="secondary">{ROLE_CARDS.find((role) => role.key === member.roleKey)?.label ?? "대기"}</Badge></div>)}{!data.members?.length && <p className="col-span-full py-8 text-center text-muted-foreground">방 코드를 공유해 학생을 입장시키세요.</p>}</div></CardContent></Card>
    {chart.length > 0 && <Card><CardHeader><CardTitle>역할별 평균 자산배분</CardTitle><CardDescription>학생 개인 순위 없이 역할 조건에 따른 차이를 비교합니다.</CardDescription></CardHeader><CardContent className="h-[340px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis unit="%" /><Tooltip /><Legend />{ALLOCATION_ASSETS.map((asset, index) => <Bar key={asset.key} dataKey={asset.key} name={asset.label} stackId="a" fill={["#174a8b", "#3e79b7", "#12a0a5", "#f0b138", "#d95463", "#7f62b7"][index]} />)}</BarChart></ResponsiveContainer></CardContent></Card>}</div>
  </div>;
}

function AllocationStudent({ data, action, role, busy }: { data: RoomData; action: (body: Record<string, unknown>) => Promise<void>; role: (typeof ROLE_CARDS)[number]; busy: boolean }) {
  const latest = data.submissions?.at(-1);
  const [weights, setWeights] = useState<AllocationWeights>(latest?.weights ?? initialWeights);
  const [risks, setRisks] = useState<string[]>(latest?.risks ?? []);
  const [reason, setReason] = useState(latest?.reason ?? "");
  const stage = data.room.stage;
  const canSubmit = stage === "allocate" ? !data.submissions?.some((item) => item.version === 1) : stage === "revise" ? !data.submissions?.some((item) => item.version === 2) : false;
  const updateWeight = (key: keyof AllocationWeights, value: number) => {
    const rounded = Math.round(value / 5) * 5;
    const next = { ...weights, [key]: rounded };
    let difference = Object.values(next).reduce((sum, item) => sum + item, 0) - 100;
    const others = ALLOCATION_ASSETS.map((asset) => asset.key).filter((item) => item !== key);
    for (const other of others) {
      if (difference === 0) break;
      const step = Math.sign(difference) * Math.min(5, Math.abs(difference));
      const candidate = next[other] - step;
      if (candidate >= 0 && candidate <= 100) { next[other] = candidate; difference -= step; }
    }
    setWeights(next);
  };
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const result = data.result;
  return <div className="grid gap-5 xl:grid-cols-[0.68fr_1.32fr]">
    <Card className="h-fit border-primary/20"><CardHeader><Badge className="mb-2 w-fit">나의 무작위 역할</Badge><CardTitle className="text-2xl">{role.label}</CardTitle><CardDescription className="text-base leading-7">{role.summary}</CardDescription></CardHeader><CardContent><div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900"><b>판단의 초점</b><p className="mt-1">{role.focus}</p></div>{data.member?.privateInfo && <p className="mt-3 text-sm text-muted-foreground">{data.member.privateInfo}</p>}</CardContent></Card>
    <div className="space-y-5">
      {(stage === "allocate" || stage === "revise") && <Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle>{stage === "allocate" ? "100포인트 최초 배분" : "충격을 본 뒤 한 번 수정"}</CardTitle><CardDescription>공매도·레버리지 없이 5포인트 단위로 배분합니다.</CardDescription></div><div className={`rounded-xl px-4 py-2 text-lg font-black ${total === 100 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{total}/100</div></div></CardHeader><CardContent className="space-y-6">{ALLOCATION_ASSETS.map((asset) => <div key={asset.key} className="grid gap-2 sm:grid-cols-[160px_1fr_58px] sm:items-center"><div><Label className="font-bold">{asset.label}</Label><p className="text-xs text-muted-foreground">{asset.risk}</p></div><Slider value={[weights[asset.key]]} onValueChange={([value]) => updateWeight(asset.key, value)} min={0} max={100} step={5} disabled={!canSubmit} /><span className="number-tabular text-right font-bold">{weights[asset.key]}%</span></div>)}<div className="border-t pt-5"><Label>가장 피하고 싶은 위험 2개</Label><div className="mt-3 flex flex-wrap gap-2">{riskOptions.map((risk) => <label key={risk} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm ${risks.includes(risk) ? "border-primary bg-blue-50 text-primary" : "bg-card"}`}><Checkbox checked={risks.includes(risk)} disabled={!canSubmit || (!risks.includes(risk) && risks.length >= 2)} onCheckedChange={(checked) => setRisks(checked ? [...risks, risk].slice(0, 2) : risks.filter((item) => item !== risk))} />{risk}</label>)}</div></div><div className="space-y-2"><Label htmlFor="reason">선택 이유</Label><Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} disabled={!canSubmit} placeholder="나의 역할과 사용 시점을 고려해 한 문장으로 적어보세요." /></div><Button className="w-full" size="lg" disabled={!canSubmit || total !== 100 || risks.length !== 2 || reason.trim().length < 5 || busy} onClick={() => action({ action: "allocation_submit", weights, risks, reason })}><Send /> {stage === "allocate" ? "최초 배분 제출" : "수정안 제출"}</Button>{!canSubmit && <div className="flex items-center justify-center gap-2 rounded-xl bg-muted py-3 text-sm text-muted-foreground"><LockKeyhole className="size-4" /> 제출이 잠겼습니다. 선생님의 다음 안내를 기다리세요.</div>}</CardContent></Card>}
      {stage === "lobby" && <WaitCard title="선생님의 시작을 기다리는 중" description="역할은 배정되었으며 아직 자산배분 화면이 잠겨 있습니다." />}
      {result && <AllocationResultView result={result} />}
      {stage === "complete" && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"><p className="font-bold">활동을 마쳤습니다.</p><p className="mt-1 text-sm">높은 수익보다 내 역할의 목표·기간·유동성에 맞는지 다시 확인해보세요.</p></div>}
    </div>
  </div>;
}

function AllocationResultView({ result }: { result: AllocationResult }) {
  const checks = [{ label: "목표금액", ok: result.goalMet }, { label: "필요 유동성", ok: result.liquidityMet }, { label: "허용손실", ok: result.lossMet }];
  return <Card className="overflow-hidden"><div className="bg-[#10294e] p-5 text-white"><p className="text-sm text-blue-100/70">공개된 시장상황</p><div className="mt-1 flex items-end justify-between"><h3 className="text-2xl font-black">{result.shock.label}</h3><span className="text-sm">물가 {result.shock.inflation}%</span></div></div><CardContent className="space-y-6 pt-6"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="명목가치" value={result.nominal.toFixed(1)} /><Metric label="실질가치" value={result.real.toFixed(1)} /><Metric label="즉시유동성" value={result.liquidity.toFixed(1)} /><Metric label="최악상황" value={result.worstValue.toFixed(1)} /></div><div className="grid gap-2 sm:grid-cols-3">{checks.map((check) => <div key={check.label} className={`flex items-center justify-between rounded-xl border p-4 ${check.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}><span className="font-semibold">{check.label}</span><b>{check.ok ? "충족" : "미충족"}</b></div>)}</div><div><h4 className="mb-3 font-bold">자산별 손익 기여도</h4><div className="h-[230px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={result.contributions}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis unit="p" /><Tooltip formatter={(value) => `${Number(value).toFixed(2)}포인트`} /><Bar dataKey="contribution" name="손익 기여" fill="#194b8f" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></div></CardContent></Card>;
}

function WaitCard({ title, description, role }: { title: string; description: string; role?: (typeof ROLE_CARDS)[number] }) { return <Card className="mx-auto max-w-2xl"><CardContent className="py-12 text-center"><Clock3 className="mx-auto mb-4 size-10 text-primary" /><h3 className="text-2xl font-bold">{title}</h3><p className="mx-auto mt-2 max-w-lg text-muted-foreground">{description}</p>{role && <div className="mx-auto mt-6 max-w-md rounded-xl bg-blue-50 p-4 text-left text-sm text-blue-900"><b>{role.label}</b><p className="mt-1">{role.summary}</p></div>}</CardContent></Card>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-card p-4"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="number-tabular mt-1 text-xl font-black tracking-tight">{value}</p></div>; }
function stageLabel(stage: string) { return ({ lobby: "대기실", allocate: "최초 배분", shock: "충격 공개", revise: "수정", trading: "거래 중", awaiting_dividend: "배당 결정 대기", results: "배당 결과", complete: "종료" } as Record<string, string>)[stage] ?? stage; }
function Countdown({ deadline }: { deadline: string }) { const [seconds, setSeconds] = useState(() => Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000))); useEffect(() => { const timer = window.setInterval(() => setSeconds(Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000))), 1000); return () => window.clearInterval(timer); }, [deadline]); return <Badge className={seconds <= 10 ? "bg-red-600 text-white" : "bg-amber-100 text-amber-900"}><Clock3 className="mr-1 size-3" />{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</Badge>; }
