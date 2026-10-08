"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Atom,
  Calculator,
  Check,
  CircleDot,
  Gauge,
  LineChart as LineIcon,
  Plus,
  Save,
  Settings2,
  Trash2,
  WandSparkles,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { DEFAULT_CORRELATIONS, DEFAULT_MPT_ASSETS } from "@/lib/course-data";
import {
  exactEfficientFrontier,
  frontierSamples,
  isPositiveSemidefinite,
  minimumVariancePortfolioForReturn,
  portfolioMetrics,
  simulatePortfolio,
  simulationSigmaBands,
  unconstrainedFrontier,
  type FrontierPoint,
  type MptAsset,
} from "@/lib/portfolio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

const palette = ["#1d4ed8", "#0891b2", "#e11d48", "#d97706", "#7c3aed", "#15803d", "#be185d"];
const FRONTIER_STEPS = 120;

export function MptLab() {
  const [assets, setAssets] = useState<MptAsset[]>(DEFAULT_MPT_ASSETS);
  const [correlations, setCorrelations] = useState<number[][]>(DEFAULT_CORRELATIONS);
  const [riskFree, setRiskFree] = useState(2.5);
  const [showShort, setShowShort] = useState(true);
  const [showSharpe, setShowSharpe] = useState(false);
  const [allowBorrowing, setAllowBorrowing] = useState(false);
  const [paths, setPaths] = useState<ReturnType<typeof simulatePortfolio> | null>(null);
  const [seed, setSeed] = useState(20260909);
  const [saved, setSaved] = useState(false);

  const modelAssets = useMemo(
    () => assets.map((asset, index) => index === 0 ? { ...asset, name: "현금", expectedReturn: riskFree, volatility: 0 } : asset),
    [assets, riskFree],
  );
  const riskyAssets = modelAssets.slice(1);
  const riskyCorrelations = useMemo(() => correlations.slice(1).map((row) => row.slice(1)), [correlations]);
  const cashWeight = modelAssets[0].weight;
  const metrics = useMemo(() => portfolioMetrics(modelAssets, correlations, undefined, riskFree), [modelAssets, correlations, riskFree]);
  const longSamples = useMemo(() => frontierSamples(riskyAssets, riskyCorrelations, false), [riskyAssets, riskyCorrelations]);
  const longEnvelope = useMemo(
    () => exactEfficientFrontier(riskyAssets, riskyCorrelations, true, FRONTIER_STEPS, riskFree),
    [riskyAssets, riskyCorrelations, riskFree],
  );
  const shortEnvelope = useMemo(
    () => unconstrainedFrontier(riskyAssets, riskyCorrelations, FRONTIER_STEPS, riskFree),
    [riskyAssets, riskyCorrelations, riskFree],
  );
  const longCandidates = longEnvelope.length ? longEnvelope : longSamples;
  const fallbackPoint: FrontierPoint = { risk: 0, ret: riskFree, sharpe: 0, weights: riskyAssets.map(() => 0) };
  const maxSharpe = longCandidates.length
    ? longCandidates.reduce((best, point) => point.sharpe > best.sharpe ? point : best)
    : fallbackPoint;
  const minVarianceRisky = longCandidates.length
    ? longCandidates.reduce((best, point) => point.risk < best.risk ? point : best)
    : fallbackPoint;
  const shortRiskLimit = Math.max(45, ...riskyAssets.map((asset) => asset.volatility * 2.25));
  const visibleShortEnvelope = shortEnvelope.filter((point) => point.risk <= shortRiskLimit);
  const maxGraphRisk = Math.max(
    25,
    ...riskyAssets.map((asset) => asset.volatility),
    ...longEnvelope.map((point) => point.risk),
    ...(showShort ? visibleShortEnvelope.map((point) => point.risk) : [0]),
  );
  const graphReturns = [
    riskFree,
    ...riskyAssets.map((asset) => asset.expectedReturn),
    ...longEnvelope.map((point) => point.ret),
    ...(showShort ? visibleShortEnvelope.map((point) => point.ret) : []),
  ];
  const minGraphReturn = Math.floor(Math.min(...graphReturns) - 1);
  const maxGraphReturn = Math.ceil(Math.max(...graphReturns) + 1);
  const capitalLine = showSharpe && maxSharpe.risk > 0 ? [
    { risk: 0, ret: riskFree },
    {
      risk: allowBorrowing ? maxGraphRisk : maxSharpe.risk,
      ret: riskFree + (allowBorrowing ? maxGraphRisk : maxSharpe.risk) * maxSharpe.sharpe,
    },
  ] : [];
  const pointCloud = longSamples.filter((_, index) => index % 3 === 0);
  const sigmaBands = useMemo(
    () => simulationSigmaBands(metrics.expectedReturn, metrics.volatility, 10, 1000),
    [metrics.expectedReturn, metrics.volatility],
  );
  const mergedPaths = paths
    ? sigmaBands.map((band, month) => ({
      ...band,
      ...Object.fromEntries(paths.map((path, index) => [`path${index}`, path[month].value])),
    }))
    : [];

  const updateAsset = (index: number, patch: Partial<MptAsset>) => {
    if (index === 0) return;
    setAssets((current) => current.map((asset, assetIndex) => assetIndex === index ? { ...asset, ...patch } : asset));
    setPaths(null);
    setSaved(false);
  };

  const updateWeight = (index: number, requested: number) => {
    if (index === 0) return;
    setAssets((current) => {
      const next = current.map((asset) => ({ ...asset }));
      const previous = next[index].weight;
      const available = previous + next[0].weight;
      const target = Math.max(0, Math.min(available, requested));
      const delta = target - previous;
      next[index].weight = target;
      next[0].weight = Math.max(0, Math.min(100, next[0].weight - delta));
      return next;
    });
    setPaths(null);
    setSaved(false);
  };

  const addAsset = () => {
    if (assets.length >= 8) return;
    const index = assets.length;
    setAssets((current) => [
      ...current,
      { key: `custom-${Date.now()}`, name: `새 자산 ${index - 4}`, expectedReturn: 6, volatility: 14, weight: 0, color: palette[index % palette.length] },
    ]);
    setCorrelations((current) => {
      const expanded = current.map((row, rowIndex) => [...row, rowIndex === 0 ? 0 : 0.1]);
      return [...expanded, [0, ...current.slice(1).map(() => 0.1), 1]];
    });
    setPaths(null);
    setSaved(false);
  };

  const removeAsset = (index: number) => {
    if (index === 0 || assets.length <= 3) return;
    setAssets((current) => {
      const removedWeight = current[index].weight;
      return current
        .filter((_, assetIndex) => assetIndex !== index)
        .map((asset, assetIndex) => assetIndex === 0 ? { ...asset, weight: asset.weight + removedWeight } : asset);
    });
    setCorrelations((current) => current.filter((_, rowIndex) => rowIndex !== index).map((row) => row.filter((_, columnIndex) => columnIndex !== index)));
    setPaths(null);
    setSaved(false);
  };

  const runSimulation = () => {
    setPaths(simulatePortfolio(modelAssets, correlations, 10, seed));
    setSeed((current) => current + 7919);
  };

  const save = async () => {
    const payload = { assets: modelAssets, correlations, riskFree, metrics, savedAt: new Date().toISOString() };
    const res = await fetch("/api/artifacts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "portfolio-1", payload }),
    });
    if (res.ok) setSaved(true);
  };

  return <div className="mx-auto max-w-[1480px] space-y-5 fade-up">
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2"><Badge>MPT 개인 실습</Badge><span className="text-sm text-muted-foreground">모든 숫자는 수업용 가정</span></div>
        <h2 className="mt-2 text-2xl font-black tracking-tight">비중을 움직여 위험–수익 지도를 탐색하세요.</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        <CorrelationDialog assets={modelAssets} correlations={correlations} onChange={(next) => { setCorrelations(next); setPaths(null); setSaved(false); }} />
        <Button variant="outline" onClick={addAsset} disabled={assets.length >= 8}><Plus /> 자산 추가</Button>
        <Button onClick={() => void save()}><Save /> {saved ? "저장됨" : "포트폴리오 1.0 저장"}</Button>
      </div>
    </section>

    <div className="grid gap-5 2xl:grid-cols-[520px_minmax(0,1fr)]">
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>자산 가정과 비중</CardTitle>
            <CardDescription>위험자산 비중을 움직인 만큼 현금 비중이 반대로 조정되어 합계 100%를 유지합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {modelAssets.map((asset, index) => <div key={asset.key} className={`rounded-xl border p-4 ${index === 0 ? "border-slate-300 bg-slate-50" : ""}`}>
              <div className="mb-4 flex items-center gap-3">
                <span className="size-3 rounded-full" style={{ background: asset.color }} />
                {index === 0
                  ? <div className="flex-1 font-bold">현금 <span className="ml-2 text-xs font-medium text-muted-foreground">항상 포함 · 나머지 비중</span></div>
                  : <Input aria-label={`${asset.name} 이름`} value={asset.name} onChange={(event) => updateAsset(index, { name: event.target.value })} className="h-8 border-0 bg-transparent p-0 font-bold shadow-none focus-visible:ring-0" />}
                {index > 0 && assets.length > 3 && <Button size="icon" variant="ghost" className="size-8 text-muted-foreground" onClick={() => removeAsset(index)} aria-label={`${asset.name} 삭제`}><Trash2 className="size-4" /></Button>}
              </div>
              {index === 0
                ? <div className="space-y-4">
                  <div className="grid grid-cols-[92px_1fr_64px] items-center gap-3"><Label className="text-sm">비중</Label><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-slate-500 transition-all" style={{ width: `${asset.weight}%` }} /></div><span className="number-tabular text-right text-sm font-bold">{asset.weight.toFixed(0)}%</span></div>
                  <div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-white p-3"><span className="text-muted-foreground">기대수익률</span><b className="mt-1 block">{riskFree.toFixed(1)}%</b></div><div className="rounded-lg bg-white p-3"><span className="text-muted-foreground">위험도</span><b className="mt-1 block">0.0%</b></div></div>
                  <p className="text-xs leading-5 text-muted-foreground">현금이 0%이면 다른 자산을 더 늘릴 수 없고, 현금이 100%이면 다른 자산은 0% 아래로 내릴 수 없습니다.</p>
                </div>
                : <div className="space-y-4">
                  <SettingSlider label="비중" value={asset.weight} min={0} max={asset.weight + cashWeight} step={1} suffix="%" onChange={(value) => updateWeight(index, value)} />
                  <SettingSlider label="기대수익률" value={asset.expectedReturn} min={-5} max={20} step={0.1} suffix="%" onChange={(value) => updateAsset(index, { expectedReturn: value })} />
                  <SettingSlider label="위험도" value={asset.volatility} min={1} max={40} step={0.5} suffix="%" onChange={(value) => updateAsset(index, { volatility: value })} />
                </div>}
            </div>)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>기준과 제약</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <SettingSlider label="무위험수익률" value={riskFree} min={0} max={8} step={0.1} suffix="%" onChange={(value) => { setRiskFree(value); setPaths(null); setSaved(false); }} />
            <div className="flex items-center justify-between rounded-xl border p-4"><div><Label>공매도 허용선 보기</Label><p className="text-xs text-muted-foreground">쌍곡선의 아래·위 가지를 점선으로 표시</p></div><Switch checked={showShort} onCheckedChange={setShowShort} /></div>
            <div className="flex items-center justify-between rounded-xl border p-4"><div><Label>무위험자산 차입</Label><p className="text-xs text-muted-foreground">자본배분선을 접점 너머로 연장</p></div><Switch checked={allowBorrowing} onCheckedChange={setAllowBorrowing} /></div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><CardTitle>효율적 프론티어</CardTitle><CardDescription>실선은 공매도 금지 효율적 구간, 점선은 공매도 허용 쌍곡선 전체입니다.</CardDescription></div>
              <Button variant={showSharpe ? "default" : "outline"} onClick={() => setShowSharpe((value) => !value)}><LineIcon /> 샤프비율 직선</Button>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="h-[500px] min-h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 24, bottom: 28, left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="risk" name="위험" unit="%" domain={[0, Math.ceil(maxGraphRisk)]} label={{ value: "위험(연 변동성)", position: "insideBottom", offset: -16 }} />
                  <YAxis type="number" dataKey="ret" name="기대수익률" unit="%" domain={[minGraphReturn, maxGraphReturn]} label={{ value: "기대수익률", angle: -90, position: "insideLeft" }} />
                  <ZAxis range={[12, 12]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(value, name) => [`${Number(value).toFixed(2)}%`, name]} />
                  <Scatter data={pointCloud} fill="#9fb9da" fillOpacity={0.25} name="가능한 조합" />
                  {showShort && <Scatter data={visibleShortEnvelope} line={{ stroke: "#8b6db8", strokeWidth: 2, strokeDasharray: "7 6" }} shape={() => null} name="공매도 허용 쌍곡선" />}
                  <Scatter data={longEnvelope} line={{ stroke: "#174a8b", strokeWidth: 4 }} shape={() => null} name="공매도 금지" />
                  {showSharpe && <Scatter data={capitalLine} line={{ stroke: "#df9c23", strokeWidth: 3 }} shape={() => null} name="자본배분선" />}
                  <Scatter data={modelAssets.map((asset) => ({ risk: asset.volatility, ret: asset.expectedReturn, name: asset.name }))} fill="#64748b" name="개별 자산" />
                  <Scatter data={[{ risk: metrics.volatility, ret: metrics.expectedReturn }]} fill="#e11d48" name="현재 포트폴리오" shape="circle" />
                  <Scatter data={[{ risk: minVarianceRisky.risk, ret: minVarianceRisky.ret }]} fill="#0e8ca0" name="위험자산 최소분산" shape="diamond" />
                  <Scatter data={[{ risk: maxSharpe.risk, ret: maxSharpe.ret }]} fill="#e29d20" name="최대 샤프" shape="star" />
                  <Legend verticalAlign="top" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-3 border-t pt-5 sm:grid-cols-3">
              <MetricCard icon={CircleDot} label="기대수익률" value={`${metrics.expectedReturn.toFixed(2)}%`} />
              <MetricCard icon={Gauge} label="위험" value={`${metrics.volatility.toFixed(2)}%`} />
              <MetricCard icon={WandSparkles} label="샤프비율" value={metrics.sharpe.toFixed(3)} />
            </div>
            <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm leading-6 text-blue-950">두 선은 공매도 허용 최적해의 모든 비중이 0% 이상인 구간에서 정확히 겹칩니다. 음수 비중이 필요한 순간부터 공매도 금지선이 제약을 받아 갈라집니다.</p>
            <WeightCalculator riskFree={riskFree} assets={riskyAssets} correlations={riskyCorrelations} candidates={longCandidates} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><CardTitle>모의수익률 경로</CardTitle><CardDescription>대표 경로 1개, 같은 조건의 다른 경로 9개, 시간의 제곱근으로 커지는 ±1σ 범위를 함께 봅니다.</CardDescription></div>
              <Button onClick={runSimulation}><Atom /> {paths ? "다시 실행" : "결과 확인"}</Button>
            </div>
          </CardHeader>
          <CardContent>
            {paths ? <>
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mergedPaths}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={(value) => `${Math.floor(value / 12)}년`} />
                    <YAxis domain={["auto", "auto"]} />
                    <Tooltip labelFormatter={(value) => `${Math.floor(Number(value) / 12)}년 ${Number(value) % 12}개월`} formatter={(value) => `${Number(value).toFixed(0)}만원`} />
                    {Array.from({ length: 10 }, (_, index) => <Line key={index} type="monotone" dataKey={`path${index}`} name={index === 0 ? "대표 경로" : `경로 ${index + 1}`} stroke={index === 0 ? "#174a8b" : "#9fb9da"} strokeWidth={index === 0 ? 3 : 1} strokeOpacity={index === 0 ? 1 : 0.38} dot={false} />)}
                    <Line type="monotone" dataKey="plusSigma" name="+1σ·√t" stroke="#a855f7" strokeWidth={1.5} strokeOpacity={0.55} strokeDasharray="7 6" dot={false} />
                    <Line type="monotone" dataKey="minusSigma" name="-1σ·√t" stroke="#a855f7" strokeWidth={1.5} strokeOpacity={0.55} strokeDasharray="7 6" dot={false} />
                    <ReferenceLine y={1000} stroke="#94a3b8" strokeDasharray="4 4" />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 size-4 shrink-0" />점선 폭은 로그수익률의 σ√t를 복리 기준 경로에 적용했습니다. 입력 가정으로 만든 모의실험이며 실제 미래수익률이 아닙니다.</p>
            </> : <div className="grid h-[250px] place-items-center rounded-xl border border-dashed text-center text-muted-foreground"><div><Atom className="mx-auto mb-3 size-10 opacity-30" /><p>결과 확인을 누르면 10년간 10개 경로와 ±1σ·√t 선을 생성합니다.</p></div></div>}
          </CardContent>
        </Card>
      </div>
    </div>
  </div>;
}

type CalculatorMode = "max-sharpe" | "min-variance" | "target-return" | "target-risk";
type CalculatorResult = { title: string; expectedReturn: number; risk: number; weights: number[] };

function WeightCalculator({ riskFree, assets, correlations, candidates }: { riskFree: number; assets: MptAsset[]; correlations: number[][]; candidates: FrontierPoint[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CalculatorMode>("max-sharpe");
  const [targetReturn, setTargetReturn] = useState(6);
  const [targetRisk, setTargetRisk] = useState(10);
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [error, setError] = useState("");

  const selectMode = (next: CalculatorMode) => { setMode(next); setResult(null); setError(""); };

  const calculate = () => {
    setError("");
    if (!candidates.length) {
      setResult(null);
      setError("현재 입력으로 계산 가능한 프론티어가 없습니다. 상관관계와 자산 가정을 확인하세요.");
      return;
    }
    if (mode === "min-variance") {
      const best = candidates.reduce((current, point) => point.risk < current.risk ? point : current);
      setResult({ title: "최소 분산 포트폴리오", expectedReturn: best.ret, risk: best.risk, weights: best.weights });
      return;
    }
    if (mode === "max-sharpe") {
      const best = candidates.reduce((current, point) => point.sharpe > current.sharpe ? point : current);
      setResult({ title: "최대 샤프 포트폴리오", expectedReturn: best.ret, risk: best.risk, weights: best.weights });
      return;
    }
    if (mode === "target-return") {
      const minimumReturn = Math.min(...assets.map((asset) => asset.expectedReturn));
      const maximumReturn = Math.max(...assets.map((asset) => asset.expectedReturn));
      if (targetReturn < minimumReturn - 1e-8 || targetReturn > maximumReturn + 1e-8) {
        setResult(null);
        setError(`현금을 제외한 현재 자산으로 만들 수 있는 기대수익률은 ${minimumReturn.toFixed(1)}%~${maximumReturn.toFixed(1)}%입니다.`);
        return;
      }
      const best = minimumVariancePortfolioForReturn(assets, correlations, targetReturn, true, riskFree);
      if (!best) {
        setResult(null);
        setError("입력한 기대수익률에서 계산 가능한 포트폴리오가 없습니다. 자산 가정과 상관관계를 확인하세요.");
        return;
      }
      setResult({ title: `기대수익률 ${targetReturn.toFixed(1)}%의 최소 분산`, expectedReturn: best.ret, risk: best.risk, weights: best.weights });
      return;
    }

    const minimumPoint = candidates.reduce((current, point) => point.risk < current.risk ? point : current);
    if (targetRisk < minimumPoint.risk - 1e-8) {
      setResult(null);
      setError(`현금을 제외하면 최소 위험도는 ${minimumPoint.risk.toFixed(2)}%입니다. 그 이상을 입력하세요.`);
      return;
    }
    let best = minimumPoint;
    let lowReturn = minimumPoint.ret;
    let highReturn = Math.max(...assets.map((asset) => asset.expectedReturn));
    for (let iteration = 0; iteration < 48; iteration += 1) {
      const trialReturn = (lowReturn + highReturn) / 2;
      const trial = minimumVariancePortfolioForReturn(assets, correlations, trialReturn, true, riskFree);
      if (trial && trial.risk <= targetRisk + 1e-8) {
        best = trial;
        lowReturn = trialReturn;
      } else {
        highReturn = trialReturn;
      }
    }
    setResult({ title: `위험 ${targetRisk.toFixed(1)}% 이내 최대 수익`, expectedReturn: best.ret, risk: best.risk, weights: best.weights });
  };

  const modes: Array<{ key: CalculatorMode; label: string }> = [
    { key: "max-sharpe", label: "최대 샤프" },
    { key: "min-variance", label: "최소 분산" },
    { key: "target-return", label: "목표수익률 → 최소 분산" },
    { key: "target-risk", label: "목표위험 → 최대 수익" },
  ];

  return <div className="mt-5 border-t pt-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h3 className="font-bold">정답 비중 확인</h3><p className="text-sm text-muted-foreground">현금은 계산에서 제외하며, 표시된 위험자산 비중의 합은 항상 100%입니다.</p></div>
      <Button variant={open ? "secondary" : "outline"} onClick={() => { setOpen((value) => !value); setResult(null); setError(""); }}><Calculator /> 비중 계산</Button>
    </div>
    {open && <div className="mt-4 rounded-xl border bg-slate-50 p-4 sm:p-5">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{modes.map((item) => <Button key={item.key} variant={mode === item.key ? "default" : "outline"} onClick={() => selectMode(item.key)} className="h-auto min-h-10 whitespace-normal py-2">{item.label}</Button>)}</div>
      {mode === "target-return" && <div className="mt-4 max-w-sm"><Label htmlFor="target-return">목표 기대수익률(%)</Label><Input id="target-return" className="mt-2" type="number" step="0.1" value={targetReturn} onChange={(event) => { setTargetReturn(Number(event.target.value)); setResult(null); setError(""); }} /></div>}
      {mode === "target-risk" && <div className="mt-4 max-w-sm"><Label htmlFor="target-risk">허용 위험(연 변동성, %)</Label><Input id="target-risk" className="mt-2" type="number" min="0" step="0.1" value={targetRisk} onChange={(event) => { setTargetRisk(Number(event.target.value)); setResult(null); setError(""); }} /></div>}
      <Button className="mt-4" onClick={calculate}><Check /> 계산 결과 확인</Button>
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {result && <div className="mt-4 rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold text-primary">계산 결과</p><h4 className="mt-1 text-lg font-black">{result.title}</h4></div><div className="flex gap-4 text-sm"><span>기대수익률 <b>{result.expectedReturn.toFixed(2)}%</b></span><span>위험 <b>{result.risk.toFixed(2)}%</b></span></div></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{assets.map((asset, index) => <div key={asset.key} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"><span>{asset.name}</span><b className="number-tabular">{(result.weights[index] ?? 0).toFixed(1)}%</b></div>)}</div>
      </div>}
    </div>}
  </div>;
}

function SettingSlider({ label, value, min, max, step, suffix, onChange }: { label: string; value: number; min: number; max: number; step: number; suffix: string; onChange: (value: number) => void }) {
  return <div className="grid grid-cols-[92px_1fr_64px] items-center gap-3"><Label className="text-sm">{label}</Label><Slider value={[value]} min={min} max={Math.max(min, max)} step={step} onValueChange={([next]) => onChange(next)} /><span className="number-tabular text-right text-sm font-bold">{value.toFixed(step < 1 ? 1 : 0)}{suffix}</span></div>;
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-xl bg-muted p-4"><span className="grid size-10 place-items-center rounded-xl bg-card text-primary"><Icon className="size-5" /></span><div><p className="text-xs text-muted-foreground">{label}</p><p className="number-tabular text-xl font-black">{value}</p></div></div>;
}

function CorrelationDialog({ assets, correlations, onChange }: { assets: MptAsset[]; correlations: number[][]; onChange: (next: number[][]) => void }) {
  const [draft, setDraft] = useState(correlations);
  const [open, setOpen] = useState(false);
  const valid = isPositiveSemidefinite(draft);
  const update = (i: number, j: number, value: number) => setDraft((current) => current.map((row, rowIndex) => row.map((cell, columnIndex) => rowIndex === i && columnIndex === j || rowIndex === j && columnIndex === i ? value : cell)));
  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) setDraft(correlations.map((row) => [...row])); }}>
    <DialogTrigger asChild><Button variant="outline"><Settings2 /> 상관관계</Button></DialogTrigger>
    <DialogContent className="max-w-3xl">
      <DialogHeader><DialogTitle>상관관계 행렬</DialogTitle><DialogDescription>현금은 위험이 0이므로 다른 자산과의 상관관계를 0으로 고정합니다. 나머지 입력값은 대칭으로 반영됩니다.</DialogDescription></DialogHeader>
      <div className="overflow-x-auto py-2"><div className="grid gap-2" style={{ gridTemplateColumns: `150px repeat(${assets.length}, 76px)` }}><span />{assets.map((asset) => <span key={asset.key} className="truncate text-center text-xs font-semibold">{asset.name}</span>)}{assets.map((asset, i) => <div className="contents" key={asset.key}><span className="truncate self-center text-sm font-semibold">{asset.name}</span>{assets.map((other, j) => <Input key={other.key} type="number" min="-1" max="1" step="0.05" value={draft[i]?.[j] ?? 0} disabled={i === j || i === 0 || j === 0} onChange={(event) => update(i, j, Math.max(-1, Math.min(1, Number(event.target.value))))} className={`h-9 px-2 text-center text-sm ${i === j || i === 0 || j === 0 ? "bg-muted" : ""}`} />)}</div>)}</div></div>
      {valid ? <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900"><Check className="mr-2 inline size-4" />유효한 상관관계 조합입니다. 적용하면 계산이 즉시 갱신됩니다.</div> : <div className="rounded-xl bg-red-50 p-3 text-sm text-red-900"><AlertTriangle className="mr-2 inline size-4" />서로 모순되는 상관관계 조합입니다. 값들을 조정한 뒤 적용하세요.</div>}
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>취소</Button><Button disabled={!valid} onClick={() => { onChange(draft); setOpen(false); }}>적용</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
