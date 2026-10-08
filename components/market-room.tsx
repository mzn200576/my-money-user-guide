"use client";

import { useMemo, useState } from "react";
import { BarChart3, CircleDollarSign, LockKeyhole, Play, Send, Sparkles } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RoomData } from "@/components/classroom-room";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { distributionExpectedValue, distributionForRoom, informationModeForRoom, tradingModeForRoom, type DividendDistribution } from "@/lib/market";

type Props = { data: RoomData; action: (body: Record<string, unknown>) => Promise<void>; busy: boolean };
type Receipt = NonNullable<RoomData["marketReceipt"]>;
const money = (cents: number) => "$" + (cents / 100).toFixed(2);
const signed = (cents: number) => (cents > 0 ? "+" : cents < 0 ? "−" : "") + money(Math.abs(cents));

export function MarketRoom({ data, action, busy }: Props) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [price, setPrice] = useState(5);
  const [quantity, setQuantity] = useState(1);
  const stage = data.room.stage;
  const maxRounds = Number(data.room.config.rounds ?? 10);
  const mode = tradingModeForRoom(data.room.config, data.room.experiment);
  const infoMode = informationModeForRoom(data.room.config, data.room.experiment);
  const distribution = distributionForRoom(data.room.config, data.room.experiment);
  const expected = Number(data.room.config.expectedDividend ?? distributionExpectedValue(distribution));
  const distributionPublic = data.isOwner || infoMode === "full_distribution" || ["results", "complete"].includes(stage);
  const infoTitle = infoMode === "full_distribution" ? "배당분포 공개" : infoMode === "expected_only" ? "기대배당만 공개" : "배당정보 비공개";
  const infoDetail = infoMode === "hidden" ? "공개된 배당정보 없음" :
    "1장 기대배당 $" + expected.toFixed(2) + (infoMode === "full_distribution"
      ? " · 남은 기대배당가치 $" + (expected * Math.max(0, maxRounds + 1 - data.room.round)).toFixed(2)
      : " · 세부 분포는 배당 결정 전까지 비공개");
  const modeLabel = mode === "open_book" ? "실시간 호가창" : mode === "close_public" ? "마감 후 호가 공개" : "호가 비공개";
  const wheelRunning = stage === "results" && !!data.room.stageEndsAt && Date.parse(data.room.stageEndsAt) > Date.now();
  const chart = useMemo(() => {
    const groups = new Map<number, { round: number; total: number; quantity: number }>();
    for (const trade of data.trades ?? []) {
      const group = groups.get(trade.round) ?? { round: trade.round, total: 0, quantity: 0 };
      group.total += trade.priceCents * trade.quantity;
      group.quantity += trade.quantity;
      groups.set(trade.round, group);
    }
    return [...groups.values()].sort((a, b) => a.round - b.round).map((group) => ({
      label: String(group.round) + "장", price: group.quantity ? group.total / group.quantity / 100 : 0, quantity: group.quantity,
    }));
  }, [data.trades]);

  if (data.isOwner) return <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
    <div className="space-y-5">
      <Card><CardHeader><CardTitle>선생님 진행 제어</CardTitle><CardDescription>{data.room.round}/{maxRounds}장 · {modeLabel}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3"><Metric label="입장" value={String(data.memberCount) + "명"} />
            <Metric label="주문" value={String(data.orderCount ?? 0) + "건"} /></div>
          {stage === "lobby" && <Button size="lg" className="w-full" disabled={busy || data.memberCount === 0}
            onClick={() => action({ action: "start" })}><Play /> 시장 열기</Button>}
          {stage === "trading" && <Button size="lg" className="w-full bg-[#c77a0b] hover:bg-[#a86408]" disabled={busy}
            onClick={() => action({ action: "close_market" })}><LockKeyhole /> 장 마감·거래 체결</Button>}
          {stage === "awaiting_dividend" && <>
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              거래가 확정되어 현금·주식 잔고에 반영됐습니다. 배당금은 아직 지급되지 않았습니다.</p>
            <Button size="lg" className="w-full bg-[#c77a0b] hover:bg-[#a86408]" disabled={busy}
              onClick={() => action({ action: "decide_dividend" })}><Sparkles /> 배당 결정·돌림판 시작</Button>
          </>}
          {stage === "results" && <Button size="lg" className="w-full" disabled={busy || wheelRunning}
            onClick={() => action({ action: "next_market" })}>
            <span aria-hidden>→</span> {data.room.round === maxRounds ? "실험 종료" : "다음 장"}</Button>}
          {stage === "complete" && <p className="rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-800">실험이 종료되었습니다.</p>}
          <div className="rounded-xl bg-muted p-4 text-sm"><b>{infoTitle}</b><p className="mt-1">{infoDetail}</p></div>
          {distributionPublic && <DividendTable distribution={distribution} />}
          {stage === "results" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            이번 장 배당: <b>주당 {money(data.room.dividendPaid)}</b></div>}
        </CardContent></Card>
      {!!data.classReceipts?.length && <Card><CardHeader><CardTitle>참여자별 현금 정산</CardTitle>
        <CardDescription>체결 대금은 참가자 간 이동하고, 배당금만 전체 현금을 늘립니다.</CardDescription></CardHeader>
        <CardContent className="space-y-2">{data.classReceipts.map((item) =>
          <div key={item.memberId} className="grid grid-cols-2 gap-1 rounded-lg border p-3 text-sm sm:grid-cols-4">
            <b>{item.nickname}</b><span>거래 {signed(item.tradeCashCents)}</span>
            <span>배당 {signed(item.dividendCashCents)}</span>
            <b className="text-right">{money(item.endingCashCents)} · {item.endingShares}주</b>
          </div>)}</CardContent></Card>}
    </div>
    <MarketOverview data={data} chart={chart} />
  </div>;

  if (!data.member) return <WaitCard title="참여자 정보가 없습니다" description="수업 홈에서 코드로 다시 입장해주세요." />;
  return <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
    <Card className="h-fit"><CardHeader><Badge className="mb-2 w-fit">{data.room.round}장 · {modeLabel}</Badge>
      <CardTitle>{infoTitle}</CardTitle><CardDescription>{infoMode === "hidden" ? "배당 결정 전에는 배당정보가 비공개입니다." : "수업방의 공개 정보를 바탕으로 판단하세요."}</CardDescription></CardHeader>
      <CardContent className="space-y-4"><div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900"><b>현재 공개 정보</b><p>{infoDetail}</p></div>
        {distributionPublic && <DividendTable distribution={distribution} />}
        <div className="grid grid-cols-2 gap-3"><Metric label="보유 현금" value={money(data.holding?.cashCents ?? 0)} />
          <Metric label="보유 주식" value={String(data.holding?.shares ?? 0) + "주"} /></div></CardContent></Card>
    <div className="space-y-5">
      {stage === "trading" ? <Card><CardHeader><CardTitle>{mode === "private" ? "비공개 주문 제출" : "매수·매도 호가 제출"}</CardTitle>
        <CardDescription>주문 제출만으로 현금은 바뀌지 않습니다. 마감 시 체결된 수량을 실제 체결가격으로 정산합니다.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <RadioGroup value={side} onValueChange={(value) => setSide(value as "buy" | "sell")} className="grid grid-cols-2 gap-3">
            {(["buy", "sell"] as const).map((value) => <label key={value}
              className={"flex cursor-pointer items-center gap-3 rounded-xl border p-4 " + (side === value ? "border-primary bg-blue-50" : "")}>
              <RadioGroupItem value={value} />{value === "buy" ? "매수" : "매도"}</label>)}
          </RadioGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="order-price">호가($)</Label>
              <Input id="order-price" type="number" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(Number(event.target.value))} /></div>
            <div className="space-y-2"><Label htmlFor="order-qty">수량</Label>
              <Input id="order-qty" type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></div>
          </div>
          <Button size="lg" className="w-full" disabled={busy} onClick={() => action({ action: "market_order", side, price, quantity })}>
            <Send /> {data.ownOrder ? "주문 수정" : "주문 제출"}</Button>
          {data.ownOrder && <div className="rounded-xl bg-muted p-4 text-sm">현재 주문: <b>
            {data.ownOrder.side === "buy" ? "매수 " : "매도 "}{money(data.ownOrder.priceCents)} · {data.ownOrder.quantity}주</b></div>}
        </CardContent></Card> : ["awaiting_dividend", "results", "complete"].includes(stage) ? <>
        {stage === "awaiting_dividend" && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 font-semibold text-amber-950">
          거래가 체결되었습니다. 선생님의 배당 추첨을 기다립니다.</p>}
        {data.marketReceipt && <ReceiptCard receipt={data.marketReceipt}
          dividendPaid={stage === "awaiting_dividend" ? null : data.room.dividendPaid} />}
      </> : <WaitCard title="선생님의 시작을 기다리는 중" description="현재 잔고와 제출 기록은 보존됩니다." />}
      <MarketOverview data={data} chart={chart} compact />
    </div>
  </div>;
}

function ReceiptCard({ receipt, dividendPaid }: { receipt: Receipt; dividendPaid: number | null }) {
  return <Card><CardHeader><CardTitle>이번 장 현금 변동</CardTitle>
    <CardDescription>체결 대금과 배당금을 따로 표시합니다. 미체결 주문은 잔고에 영향을 주지 않습니다.</CardDescription></CardHeader>
    <CardContent className="space-y-3 text-sm">
      <div className="flex justify-between"><span>마감 전 현금</span><b>{money(receipt.openingCashCents)}</b></div>
      <div className="flex justify-between"><span>체결 대금 ({receipt.filledQuantity}주)</span>
        <b className={receipt.tradeCashCents < 0 ? "text-red-700" : "text-emerald-700"}>{signed(receipt.tradeCashCents)}</b></div>
      <div className="flex justify-between"><span>배당금 {dividendPaid === null ? "(결정 전)" : "(주당 " + money(dividendPaid) + ")"}</span>
        <b>{dividendPaid === null ? "대기" : signed(receipt.dividendCashCents)}</b></div>
      <div className="flex justify-between border-t pt-3 text-base font-bold"><span>현재 현금</span><span>{money(receipt.endingCashCents)}</span></div>
      <p className="text-muted-foreground">주식 {receipt.openingShares}주 → {receipt.endingShares}주 · 매수·매도 호가의 중간 가격으로 체결됩니다.</p>
    </CardContent></Card>;
}

function DividendTable({ distribution }: { distribution: DividendDistribution }) {
  return <div className="rounded-xl border bg-card p-4"><div className="mb-3 flex items-center justify-between"><b>{distribution.name}</b>
    <span className="text-xs text-muted-foreground">기대배당 $<b>{distributionExpectedValue(distribution).toFixed(2)}</b></span></div>
    <div className="space-y-1.5">{distribution.outcomes.map((outcome, index) => <div key={index}
      className="grid grid-cols-2 rounded-lg bg-muted px-3 py-2 text-sm">
      <span>주당 {money(Math.round(outcome.value * 100))}</span><b className="text-right">{outcome.probability.toFixed(1)}%</b>
    </div>)}</div></div>;
}

function MarketOverview({ data, chart, compact = false }: {
  data: RoomData; chart: Array<{ label: string; price: number; quantity: number }>; compact?: boolean;
}) {
  const bids = (data.orderbook ?? []).filter((order) => order.side === "buy").sort((a, b) => b.priceCents - a.priceCents);
  const asks = (data.orderbook ?? []).filter((order) => order.side === "sell").sort((a, b) => a.priceCents - b.priceCents);
  const mode = tradingModeForRoom(data.room.config, data.room.experiment);
  const visible = data.isOwner || mode === "open_book" ||
    (mode === "close_public" && ["awaiting_dividend", "results", "complete"].includes(data.room.stage));
  const description = data.room.stage === "trading" ? "제출된 호가와 수량입니다." : "마감 후 남은 미체결 수량입니다.";
  return <div className="space-y-5">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="text-primary" />시장가격</CardTitle>
      <CardDescription>장별 평균 체결가격과 거래량입니다.</CardDescription></CardHeader>
      <CardContent className="h-[290px]">{chart.length ? <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chart}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" hide={chart.length > 12} />
          <YAxis yAxisId="price" domain={[0, "auto"]} unit="$" /><YAxis yAxisId="volume" orientation="right" domain={[0, "auto"]} allowDecimals={false} />
          <Tooltip /><Legend />
          <Line yAxisId="price" type="monotone" dataKey="price" name="평균 체결가" stroke="#194b8f" strokeWidth={3} dot={{ r: 4 }} />
          <Line yAxisId="volume" type="monotone" dataKey="quantity" name="거래량" stroke="#e29d20" strokeDasharray="5 5" />
        </LineChart>
      </ResponsiveContainer> : <div className="grid h-full place-items-center text-center text-muted-foreground">
        <div><CircleDollarSign className="mx-auto mb-3 size-9 opacity-30" /><p>체결이 발생하면 가격 그래프가 나타납니다.</p></div>
      </div>}</CardContent></Card>
    {visible && <Card><CardHeader><CardTitle>호가창</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent><div className="grid grid-cols-2 gap-4"><OrderList title="매수" items={bids} tone="blue" />
        <OrderList title="매도" items={asks} tone="red" /></div></CardContent></Card>}
    {!compact && <Card><CardHeader><CardTitle>관찰 질문</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>• 가격은 남은 기대배당 가치에 가까워졌는가?</p>
        <p>• 설정한 정보·호가 공개 방식은 가격과 거래량에 어떤 영향을 주었는가?</p>
        <p>• 개인 판단과 시장가격이 충돌할 때 무엇을 더 믿었는가?</p>
      </CardContent></Card>}
  </div>;
}

function OrderList({ title, items, tone }: {
  title: string; items: Array<{ priceCents: number; quantity: number }>; tone: "blue" | "red";
}) {
  const nonempty = items.filter((item) => item.quantity > 0);
  return <div><p className={"mb-2 text-sm font-bold " + (tone === "blue" ? "text-blue-700" : "text-red-700")}>{title}</p>
    <div className="space-y-1">{nonempty.slice(0, 8).map((item, index) => <div key={index}
      className="flex justify-between rounded-lg bg-muted px-3 py-2 text-sm"><b>{money(item.priceCents)}</b><span>{item.quantity}주</span></div>)}
      {!nonempty.length && <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">주문 없음</p>}
    </div>
  </div>;
}

function WaitCard({ title, description }: { title: string; description: string }) {
  return <Card><CardContent className="py-12 text-center"><h3 className="text-xl font-bold">{title}</h3>
    <p className="mt-2 text-muted-foreground">{description}</p></CardContent></Card>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-card p-4"><p className="text-xs font-semibold text-muted-foreground">{label}</p>
    <p className="number-tabular mt-1 text-xl font-black tracking-tight">{value}</p></div>;
}
