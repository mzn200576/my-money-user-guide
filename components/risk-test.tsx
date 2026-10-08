"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, Link2, RotateCcw, Save, ShieldAlert } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RISK_QUESTIONS, type RiskCategory } from "@/lib/risk-profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { readJsonResponse } from "@/lib/client-response";

type Answers = Record<string, number>;
type Scores = { capacity: number; willingness: number; discipline: number; knowledge: number };

const colors = ["#194b8f", "#0e8ca0", "#d97706", "#7c3aed"];
const optionLetters = ["A", "B", "C", "D", "E"];

function optionOrder(questionId: string, optionIndex: number) {
  let hash = 2166136261;
  const value = `${questionId}:${optionIndex}:investment-class`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function RiskTest() {
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<Scores | null>(null);
  const [saved, setSaved] = useState(false);
  const [hasPortfolio, setHasPortfolio] = useState(false);

  useEffect(() => {
    fetch("/api/artifacts?type=portfolio-1")
      .then((res) => readJsonResponse<{ artifacts?: unknown[] }>(res))
      .then((data) => setHasPortfolio(Boolean(data.artifacts?.length)))
      .catch(() => undefined);
  }, []);

  const question = RISK_QUESTIONS[index];
  const displayedOptions = useMemo(() => {
    const options = question.options.map((option, originalIndex) => ({ ...option, originalIndex }));
    return question.shuffle ? options.sort((left, right) => optionOrder(question.id, left.originalIndex) - optionOrder(question.id, right.originalIndex)) : options;
  }, [question]);
  const answered = Object.keys(answers).length;
  const progress = (answered / RISK_QUESTIONS.length) * 100;
  const calculate = () => {
    const scoreCategory = (category: RiskCategory) => {
      const questions = RISK_QUESTIONS.filter((item) => item.category === category);
      const achieved = questions.reduce((total, item) => {
        const selectedIndex = answers[item.id];
        return total + (selectedIndex === undefined ? 0 : (item.options[selectedIndex]?.score ?? 0));
      }, 0);
      const possible = questions.reduce((total, item) => total + Math.max(...item.options.map((option) => option.score)), 0);
      return Math.round((achieved / possible) * 100);
    };
    setResult({
      capacity: scoreCategory("capacity"),
      willingness: scoreCategory("willingness"),
      discipline: scoreCategory("discipline"),
      knowledge: scoreCategory("knowledge"),
    });
  };

  const save = async () => {
    if (!result) return;
    const res = await fetch("/api/artifacts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "risk-profile", payload: { answers, scores: result, savedAt: new Date().toISOString() } }),
    });
    if (res.ok) setSaved(true);
  };

  if (result) {
    return <RiskResult
      scores={result}
      saved={saved}
      hasPortfolio={hasPortfolio}
      onSave={() => void save()}
      onReset={() => { setResult(null); setIndex(0); setAnswers({}); setSaved(false); }}
    />;
  }

  return <div className="mx-auto max-w-4xl fade-up">
    <section className="mb-5 flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Badge>5차시 개인 진단</Badge>
        <h2 className="mt-2 text-2xl font-black tracking-tight">투자자 위험 프로파일</h2>
        <p className="mt-1 text-sm text-muted-foreground">35개 문항으로 감내여력·위험선호·원칙준수·투자이해를 나눠 점검합니다.</p>
      </div>
      <div className="min-w-52">
        <div className="mb-2 flex justify-between text-sm"><span>응답 진행률</span><b>{answered}/{RISK_QUESTIONS.length}</b></div>
        <Progress value={progress} />
      </div>
    </section>

    <Card className="overflow-hidden border-0 shadow-xl shadow-slate-900/8">
      <div className="h-2 bg-gradient-to-r from-[#194b8f] via-[#0e8ca0] to-[#e6a12a]" />
      <CardHeader className="px-6 pt-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Badge variant="outline">{question.id} · {categoryLabel(question.category)}</Badge>
          <span className="number-tabular text-sm font-semibold text-muted-foreground">{index + 1} / {RISK_QUESTIONS.length}</span>
        </div>
        {question.scenario && <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
          <span className="mb-1 block text-xs font-bold text-blue-700">가정 상황</span>
          {question.scenario}
        </div>}
        <CardTitle className={`${question.scenario ? "mt-5" : "mt-7"} text-2xl leading-9 sm:text-3xl`}>{question.prompt}</CardTitle>
        <CardDescription className="text-base">현재 조건과 평소 행동에 가장 가까운 답을 고르세요. 보기 위치와 문장 길이는 결과 방향을 뜻하지 않습니다.</CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-8 sm:px-10">
        <RadioGroup
          key={question.id}
          value={answers[question.id] === undefined ? "" : String(answers[question.id])}
          onValueChange={(value) => setAnswers((current) => ({ ...current, [question.id]: Number(value) }))}
          className="mt-4 grid gap-3"
        >
          {displayedOptions.map((option, optionIndex) => <label
            key={`${question.id}-${option.originalIndex}`}
            className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition hover:border-primary/50 ${answers[question.id] === option.originalIndex ? "border-primary bg-blue-50 shadow-sm" : "bg-card"}`}
          >
            <RadioGroupItem value={String(option.originalIndex)} />
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold">{optionLetters[optionIndex]}</span>
            <span className="font-medium leading-6">{option.label}</span>
          </label>)}
        </RadioGroup>
        <div className="mt-8 flex items-center justify-between">
          <Button variant="outline" onClick={() => setIndex((current) => Math.max(0, current - 1))} disabled={index === 0}><ArrowLeft /> 이전</Button>
          {index < RISK_QUESTIONS.length - 1
            ? <Button onClick={() => setIndex((current) => current + 1)} disabled={answers[question.id] === undefined}>다음 <ArrowRight /></Button>
            : <Button onClick={calculate} disabled={answered !== RISK_QUESTIONS.length}><ClipboardCheck /> 결과 확인</Button>}
        </div>
      </CardContent>
    </Card>
    <p className="mt-5 text-center text-sm text-muted-foreground">이 진단은 투자적합성 판정이나 금융상품 추천이 아닌 수업용 자기점검입니다.</p>
  </div>;
}

function RiskResult({ scores, saved, hasPortfolio, onSave, onReset }: { scores: Scores; saved: boolean; hasPortfolio: boolean; onSave: () => void; onReset: () => void }) {
  const chart = [
    { name: "감내여력", value: scores.capacity, description: "기간·유동성·소득으로 손실을 버틸 조건" },
    { name: "위험선호", value: scores.willingness, description: "불확실한 손익을 받아들일 의향" },
    { name: "원칙준수", value: scores.discipline, description: "충동보다 사전 규칙을 따르는 정도" },
    { name: "투자이해", value: scores.knowledge, description: "핵심 위험과 상품구조 이해" },
  ];
  const lowerConstraint = scores.capacity <= scores.willingness ? "감내여력" : "위험선호";
  const gap = Math.abs(scores.capacity - scores.willingness);
  const style = [
    scores.willingness >= 60 ? "성장 추구" : "안정 우선",
    scores.discipline >= 60 ? "원칙 중심" : "상황 반응형",
    scores.knowledge >= 60 ? "검증 중심" : "설명 보강형",
  ];
  const guidance = useMemo(() => {
    const items = [] as string[];
    if (gap >= 20) items.push(`감내여력과 위험선호가 ${gap}점 차이입니다. 더 낮은 ${lowerConstraint}을 전략 한도로 먼저 존중하세요.`);
    if (scores.discipline < 60) items.push("거래 전 대기시간, 목표 비중, 리밸런싱 조건을 적어 충동적인 변경을 줄여보세요.");
    if (scores.knowledge < 60) items.push("손익구조와 최대손실을 직접 설명하기 어려운 상품은 학습 전까지 편입하지 않는 편이 안전합니다.");
    if (!items.length) items.push("한 지표가 높다는 이유로 위험을 늘리기보다 목표·기간·유동성과 함께 확인하세요.");
    return items;
  }, [gap, lowerConstraint, scores]);

  return <div className="mx-auto max-w-5xl space-y-5 fade-up">
    <section className="flex flex-col gap-4 rounded-2xl bg-[#10294e] p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
      <div><Badge className="bg-white/10 text-white hover:bg-white/10">개인 진단 완료</Badge><h2 className="mt-3 text-3xl font-black tracking-tight">네 개의 축으로 본 투자 프로파일</h2><p className="mt-2 text-blue-100/70">현재 자금 조건과 평소 의사결정 성향을 함께 해석합니다.</p></div>
      <div className="flex gap-2"><Button variant="secondary" onClick={onReset}><RotateCcw /> 다시 하기</Button><Button className="bg-[#f3b63f] text-[#10294e] hover:bg-[#ffc953]" onClick={onSave}><Save /> {saved ? "저장됨" : "결과 저장"}</Button></div>
    </section>
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <Card><CardHeader><CardTitle>진단 결과</CardTitle><CardDescription>네 축 모두 높을수록 해당 조건이나 역량이 충분하다는 뜻입니다.</CardDescription></CardHeader><CardContent><div className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} layout="vertical" margin={{ left: 20, right: 30 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={[0, 100]} unit="점" /><YAxis dataKey="name" type="category" width={78} /><Tooltip formatter={(value) => `${value}점`} /><Bar dataKey="value" radius={[0, 8, 8, 0]}>{chart.map((_, itemIndex) => <Cell key={itemIndex} fill={colors[itemIndex]} />)}</Bar></BarChart></ResponsiveContainer></div><div className="mt-2 rounded-xl bg-muted p-4"><p className="text-xs font-bold text-muted-foreground">의사결정 스타일</p><div className="mt-2 flex flex-wrap gap-2">{style.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">상대적 선호를 설명하는 표현이며 능력이나 사람의 유형을 판정하는 이름이 아닙니다.</p></div></CardContent></Card>
      <div className="space-y-5">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="text-amber-600" />전략에 반영할 점</CardTitle></CardHeader><CardContent className="space-y-3">{guidance.map((item) => <div key={item} className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">{item}</div>)}</CardContent></Card>
        <Card className={hasPortfolio ? "border-emerald-200" : ""}><CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="text-primary" />3차시 결과 연결</CardTitle></CardHeader><CardContent>{hasPortfolio ? <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCircle2 className="mt-0.5 size-5 shrink-0" /><div><b>포트폴리오 1.0이 연결되었습니다.</b><p className="mt-1">5차시에는 수학적 결과와 현재의 기간·유동성·위험 한도를 함께 비교합니다.</p></div></div> : <p className="text-sm text-muted-foreground">저장된 MPT 결과가 없습니다. 3차시 MPT에서 포트폴리오 1.0을 저장하면 이곳에 연결됩니다.</p>}</CardContent></Card>
      </div>
    </div>
    <p className="text-center text-sm text-muted-foreground">감내여력과 위험선호 중 더 낮은 제약을 우선 존중하고, 필요수익률이 이를 넘으면 목표·기간·납입액부터 조정합니다.</p>
  </div>;
}

function categoryLabel(category: RiskCategory) {
  return ({ capacity: "감내여력", willingness: "위험선호", discipline: "원칙준수", knowledge: "투자이해" } as Record<RiskCategory, string>)[category];
}
