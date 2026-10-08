"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, CheckCircle2, CircleDollarSign, Clock3, Copy, Eye, LockKeyhole, Play, RefreshCw, Send, Sparkles, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ALLOCATION_ASSETS, ROLE_CARDS, SHOCKS, type AllocationWeights } from "@/lib/course-data";
import { distributionExpectedValue, distributionForRoom, informationModeForRoom, tradingModeForRoom, type DividendDistribution } from "@/lib/market";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { readJsonResponse } from "@/lib/client-response";

type User = { id: string; displayName: string; role: string };
type RoomData = {
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
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
      const payload = await readJsonResponse<RoomData & { error?: string }>(res);
      if (!res.ok) throw new Error(payload.error ?? "방 상태를 불러오지 못했습니다.");
      setData(payload);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "방 상태를 불러오지 못했습니다."); }
  }, [code]);
  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 2500);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer); };
  }, [load]);
  const action = async (body: Record<string, unknown>) => {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/rooms/${code}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await readJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(payload.error ?? "요청을 처리하지 못했습니다.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다."); }
    finally { setBusy(false); }
  };
  if (!data) return <div className="mx-auto max-w-6xl rounded-2xl border bg-card p-8 text-center"><RefreshCw className="mx-auto mb-3 size-6 animate-spin text-primary" /><p>{error || "수업방을 불러오는 중입니다."}</p><Button variant="ghost" className="mt-4" onClick={onExit}>나가기</Button></div>;
  return (
    <div className="mx-auto max-w-[1280px] space-y-5 fade-up">
      <RoomHeader data={data} onExit={onExit} />
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {data.room.type === "allocation" ? <AllocationRoom data={data} action={action} busy={busy} /> : <MarketRoom data={data} action={action} busy={busy} />}
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

function MarketRoom({ data, action, busy }: { data: RoomData; action: (body: Record<string, unknown>) => Promise<void>; busy: boolean }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [price, setPrice] = useState(5);
  const [quantity, setQuantity] = useState(1);
  const maxRounds = Number(data.room.config.rounds ?? 10);
  const tradingMode = tradingModeForRoom(data.room.config, data.room.experiment);
  const informationMode = informationModeForRoom(data.room.config, data.room.experiment);
  const dividendDistribution = distributionForRoom(data.room.config, data.room.experiment);
  const expectedDividend = Number(data.room.config.expectedDividend ?? distributionExpectedValue(dividendDistribution));
  const remainingRounds = Math.max(0, maxRounds + 1 - data.room.round);
  const distributionIsPublic = data.isOwner || informationMode === "full_distribution" || ["results", "complete"].includes(data.room.stage);
  const information = informationMode === "full_distribution"
    ? { title: "배당분포 공개", description: "가능한 배당과 확률을 모두 확인하고 거래합니다.", detail: `1장 기대배당 $${expectedDividend.toFixed(2)} · 남은 기대배당가치 $${(expectedDividend * remainingRounds).toFixed(2)}` }
    : informationMode === "expected_only"
      ? { title: "기대배당만 공개", description: "기대값만 알고 세부 배당확률은 장 마감 후 확인합니다.", detail: `1장 기대배당 $${expectedDividend.toFixed(2)} · 세부 분포는 비공개` }
      : { title: "배당정보 비공개", description: "장 마감 전에는 배당의 기대값과 확률분포를 공개하지 않습니다.", detail: "공개된 배당정보 없음" };
  const tradingModeLabel = tradingMode === "open_book" ? "실시간 호가창" : tradingMode === "close_public" ? "마감 후 호가 공개" : "호가 비공개";
  const tradeChart = useMemo(() => {
    const groups = new Map<number, { round: number; total: number; quantity: number }>();
    for (const trade of data.trades ?? []) {
      const entry = groups.get(trade.round) ?? { round: trade.round, total: 0, quantity: 0 };
      entry.total += trade.priceCents * trade.quantity;
      entry.quantity += trade.quantity;
      groups.set(trade.round, entry);
    }
    return [...groups.values()].sort((a, b) => a.round - b.round).map((entry) => ({ label: `${entry.round}장`, price: entry.quantity ? entry.total / entry.quantity / 100 : 0, quantity: entry.quantity }));
  }, [data.trades]);
  if (data.isOwner) return <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]"><Card><CardHeader><CardTitle>선생님 진행 제어</CardTitle><CardDescription>{data.room.round}/{maxRounds}장 · {tradingModeLabel}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-3"><Metric label="입장" value={`${data.memberCount}명`} /><Metric label="주문" value={`${data.orderCount ?? 0}건`} /></div>{data.room.stage === "lobby" && <Button size="lg" className="w-full" onClick={() => action({ action: "start" })} disabled={busy || data.memberCount === 0}><Play /> 시장 열기</Button>}{data.room.stage === "trading" && <Button size="lg" className="w-full bg-[#c77a0b] hover:bg-[#a86408]" onClick={() => action({ action: "close_market" })} disabled={busy}><LockKeyhole /> 장 마감·동시 체결</Button>}{data.room.stage === "results" && <Button size="lg" className="w-full" onClick={() => action({ action: "next_market" })} disabled={busy}><ChevronRightIcon /> {data.room.round === maxRounds ? "실험 종료" : "다음 장"}</Button>}{data.room.stage === "complete" && <div className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">실험이 종료되었습니다.</div>}<div className="rounded-xl bg-muted p-4 text-sm"><p className="font-bold">{information.title}</p><p className="mt-1 text-muted-foreground">{information.detail}</p></div>{distributionIsPublic && <DividendTable distribution={dividendDistribution} />}{data.room.stage === "results" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><b>이번 장 배당</b><p className="mt-1">{data.room.dividendPaid ? `주당 $${(data.room.dividendPaid / 100).toFixed(2)}` : "$0.00"}</p></div>}</CardContent></Card><MarketOverview data={data} chart={tradeChart} /></div>;
  if (!data.member) return <WaitCard title="참여자 정보가 없습니다" description="수업 홈에서 코드로 다시 입장해주세요." />;
  return <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]"><Card className="h-fit"><CardHeader><Badge className="mb-2 w-fit">{data.room.round}장 · {tradingModeLabel}</Badge><CardTitle>{information.title}</CardTitle><CardDescription className="leading-6">{information.description}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900"><b>현재 공개 정보</b><p className="mt-1">{information.detail}</p></div>{distributionIsPublic && <DividendTable distribution={dividendDistribution} />}<div className="grid grid-cols-2 gap-3"><Metric label="보유 현금" value={`$${((data.holding?.cashCents ?? 0) / 100).toFixed(2)}`} /><Metric label="보유 주식" value={`${data.holding?.shares ?? 0}주`} /></div></CardContent></Card><div className="space-y-5">{data.room.stage === "trading" ? <Card><CardHeader><CardTitle>{tradingMode === "private" ? "비공개 주문 제출" : "매수·매도 호가 제출"}</CardTitle><CardDescription>장 마감 전까지 주문을 수정할 수 있습니다.</CardDescription></CardHeader><CardContent className="space-y-5"><RadioGroup value={side} onValueChange={(value) => setSide(value as "buy" | "sell")} className="grid grid-cols-2 gap-3"><label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${side === "buy" ? "border-primary bg-blue-50" : ""}`}><RadioGroupItem value="buy" />매수</label><label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${side === "sell" ? "border-primary bg-blue-50" : ""}`}><RadioGroupItem value="sell" />매도</label></RadioGroup><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="order-price">가격($)</Label><Input id="order-price" type="number" min="0.1" step="0.1" value={price} onChange={(e) => setPrice(Number(e.target.value))} /></div><div className="space-y-2"><Label htmlFor="order-qty">수량</Label><Input id="order-qty" type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} /></div></div><Button size="lg" className="w-full" onClick={() => action({ action: "market_order", side, price, quantity })} disabled={busy}><Send /> {data.ownOrder ? "주문 수정" : "주문 제출"}</Button>{data.ownOrder && <div className="rounded-xl bg-muted p-4 text-sm">현재 주문: <b>{data.ownOrder.side === "buy" ? "매수" : "매도"} ${(data.ownOrder.priceCents / 100).toFixed(2)} · {data.ownOrder.quantity}주</b></div>}</CardContent></Card> : data.room.stage === "results" ? <Card><CardHeader><CardTitle>장 마감 결과</CardTitle><CardDescription>동시체결과 배당이 반영된 잔고입니다.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-3"><Metric label="현금" value={`$${((data.holding?.cashCents ?? 0) / 100).toFixed(2)}`} /><Metric label="주식" value={`${data.holding?.shares ?? 0}주`} /></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><b>배당 결과</b><p className="mt-1">{data.room.dividendPaid ? `주당 $${(data.room.dividendPaid / 100).toFixed(2)} 지급` : "이번 장은 배당이 없습니다."}</p></div></CardContent></Card> : <WaitCard title={data.room.stage === "complete" ? "실험이 종료되었습니다" : "선생님의 시작을 기다리는 중"} description="현재 잔고와 제출 기록은 안전하게 보존됩니다." />}<MarketOverview data={data} chart={tradeChart} compact /></div></div>;
}

function DividendTable({ distribution }: { distribution: DividendDistribution }) {
  return <div className="rounded-xl border bg-card p-4"><div className="mb-3 flex items-center justify-between"><b className="text-sm">{distribution.name}</b><span className="text-xs text-muted-foreground">기대배당 ${distributionExpectedValue(distribution).toFixed(2)}</span></div><div className="space-y-1.5">{distribution.outcomes.map((outcome, index) => <div key={`${outcome.value}-${index}`} className="grid grid-cols-2 rounded-lg bg-muted px-3 py-2 text-sm"><span>주당 ${outcome.value.toFixed(2)}</span><b className="text-right">{outcome.probability.toFixed(1)}%</b></div>)}</div></div>;
}

function MarketOverview({ data, chart, compact = false }: { data: RoomData; chart: Array<{ label: string; price: number; quantity: number }>; compact?: boolean }) {
  const bids = (data.orderbook ?? []).filter((order) => order.side === "buy").sort((a, b) => b.priceCents - a.priceCents);
  const asks = (data.orderbook ?? []).filter((order) => order.side === "sell").sort((a, b) => a.priceCents - b.priceCents);
  const tradingMode = tradingModeForRoom(data.room.config, data.room.experiment);
  const shouldShowOrderbook = data.isOwner || tradingMode === "open_book" || (tradingMode === "close_public" && ["results", "complete"].includes(data.room.stage));
  const orderbookDescription = tradingMode === "open_book" ? "거래 중에도 전체 주문이 공개됩니다." : tradingMode === "close_public" ? "장 마감 후 전체 주문이 공개됩니다." : "호가는 선생님 화면에서만 확인할 수 있습니다.";
  return <div className="space-y-5"><Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="text-primary" />시장가격</CardTitle><CardDescription>평균 체결가격의 장별 움직임입니다.</CardDescription></CardHeader><CardContent className="h-[290px]">{chart.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" hide={chart.length > 12} /><YAxis domain={[0, "auto"]} /><Tooltip /><Legend /><Line type="monotone" dataKey="price" name="평균 체결가" stroke="#194b8f" strokeWidth={3} dot={{ r: 4 }} /><Line type="monotone" dataKey="quantity" name="거래량" stroke="#e29d20" strokeDasharray="5 5" /></LineChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-center text-muted-foreground"><div><CircleDollarSign className="mx-auto mb-3 size-9 opacity-30" /><p>체결이 발생하면 가격 그래프가 나타납니다.</p></div></div>}</CardContent></Card>{shouldShowOrderbook && <Card><CardHeader><CardTitle>호가창</CardTitle><CardDescription>{orderbookDescription}</CardDescription></CardHeader><CardContent><div className="grid grid-cols-2 gap-4"><OrderList title="매수" items={bids} tone="blue" /><OrderList title="매도" items={asks} tone="red" /></div></CardContent></Card>}{!compact && <Card><CardHeader><CardTitle>관찰 질문</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>• 가격은 남은 기대배당 가치에 가까워졌는가?</p><p>• 설정한 정보·호가 공개 방식은 가격과 거래량에 어떤 영향을 주었는가?</p><p>• 개인 판단과 시장가격이 충돌할 때 무엇을 더 믿었는가?</p></CardContent></Card>}</div>;
}

function OrderList({ title, items, tone }: { title: string; items: Array<{ priceCents: number; quantity: number }>; tone: "blue" | "red" }) { return <div><p className={`mb-2 text-sm font-bold ${tone === "blue" ? "text-blue-700" : "text-red-700"}`}>{title}</p><div className="space-y-1">{items.slice(0, 8).map((item, index) => <div key={`${item.priceCents}-${index}`} className="flex justify-between rounded-lg bg-muted px-3 py-2 text-sm"><b>${(item.priceCents / 100).toFixed(2)}</b><span>{item.quantity}주</span></div>)}{!items.length && <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">주문 없음</p>}</div></div>; }
function WaitCard({ title, description, role }: { title: string; description: string; role?: (typeof ROLE_CARDS)[number] }) { return <Card className="mx-auto max-w-2xl"><CardContent className="py-12 text-center"><Clock3 className="mx-auto mb-4 size-10 text-primary" /><h3 className="text-2xl font-bold">{title}</h3><p className="mx-auto mt-2 max-w-lg text-muted-foreground">{description}</p>{role && <div className="mx-auto mt-6 max-w-md rounded-xl bg-blue-50 p-4 text-left text-sm text-blue-900"><b>{role.label}</b><p className="mt-1">{role.summary}</p></div>}</CardContent></Card>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-card p-4"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="number-tabular mt-1 text-xl font-black tracking-tight">{value}</p></div>; }
function stageLabel(stage: string) { return ({ lobby: "대기실", allocate: "최초 배분", shock: "충격 공개", revise: "수정", trading: "거래 중", results: "장 마감", complete: "종료" } as Record<string, string>)[stage] ?? stage; }
function ChevronRightIcon() { return <span aria-hidden>→</span>; }
function Countdown({ deadline }: { deadline: string }) { const [seconds, setSeconds] = useState(() => Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000))); useEffect(() => { const timer = window.setInterval(() => setSeconds(Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000))), 1000); return () => window.clearInterval(timer); }, [deadline]); return <Badge className={seconds <= 10 ? "bg-red-600 text-white" : "bg-amber-100 text-amber-900"}><Clock3 className="mr-1 size-3" />{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</Badge>; }
