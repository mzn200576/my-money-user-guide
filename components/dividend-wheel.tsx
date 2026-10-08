"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { aggregatedDividendOutcomes, type DividendDistribution } from "@/lib/market";

export const DIVIDEND_SPIN_MS = 8_000;
const colors = ["#194b8f", "#e5a63a", "#168b8b", "#9a63b3", "#dd775c", "#58a16a",
  "#365fab", "#e3829d", "#668c39", "#d08736", "#685ac2", "#559aaf"];

export function DividendWheel({
  distribution, dividendCents, deadline,
}: {
  distribution: DividendDistribution; dividendCents: number; deadline: string;
}) {
  const finishAt = Date.parse(deadline);
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, finishAt - Date.now()));
  const [animationDelay] = useState(() =>
    -Math.max(0, Math.min(DIVIDEND_SPIN_MS, DIVIDEND_SPIN_MS - (finishAt - Date.now()))));
  useEffect(() => {
    const update = () => setTimeLeft(Math.max(0, finishAt - Date.now()));
    update();
    const interval = window.setInterval(update, 80);
    return () => window.clearInterval(interval);
  }, [finishAt]);

  // Equal dollar outcomes form one sector so its size matches their combined chance.
  const outcomes = useMemo(() => aggregatedDividendOutcomes(distribution), [distribution]);
  const wheel = useMemo(() => {
    let offset = 0;
    const stops: string[] = [];
    let winningAngle = 0;
    let foundWinner = false;
    for (const [index, outcome] of outcomes.entries()) {
      const end = offset + outcome.probability;
      stops.push(`${colors[index % colors.length]} ${offset}% ${end}%`);
      if (!foundWinner && outcome.cents === dividendCents) {
        winningAngle = (offset + end) * 1.8;
        foundWinner = true;
      }
      offset = end;
    }
    return {
      gradient: `conic-gradient(${stops.join(", ")})`,
      // Six full turns, then stop at the center of the drawn probability sector.
      stop: `${2160 - winningAngle}deg`,
    };
  }, [outcomes, dividendCents]);

  if (!Number.isFinite(finishAt) || timeLeft <= 0) return null;
  const discStyle = {
    background: wheel.gradient,
    "--wheel-stop": wheel.stop,
    animationDelay: `${animationDelay}ms`,
  } as CSSProperties;
  return (
    <div role="dialog" aria-modal="true" aria-label="이번 장 배당 추첨"
      className="fixed inset-0 z-[80] grid place-items-center bg-[#071a35]/95 p-4 text-white backdrop-blur-lg">
      <div className="w-full max-w-xl rounded-3xl border border-white/20 bg-[#10294e] p-6 text-center shadow-2xl sm:p-9">
        <p className="text-sm font-bold tracking-[0.2em] text-amber-200">시장 배당 추첨</p>
        <h3 className="mt-2 text-2xl font-black">확률에 따라 이번 장의 배당을 결정합니다</h3>
        <p className="mt-2 text-sm text-blue-100">선생님과 학생이 같은 추첨 결과를 보고 있습니다.</p>
        <div className="relative mx-auto mt-7 size-60 sm:size-72">
          <div aria-hidden className="absolute left-1/2 top-[-14px] z-10 -translate-x-1/2 border-x-[15px] border-t-[24px] border-x-transparent border-t-amber-300" />
          <div className="market-dividend-disc absolute inset-0 rounded-full border-[9px] border-white shadow-[0_0_45px_rgba(248,186,73,0.3)]"
            style={discStyle} aria-hidden />
          <div aria-hidden className="absolute inset-[38%] grid place-items-center rounded-full border-4 border-white/80 bg-[#10294e] text-xl font-black">배당</div>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {outcomes.map((outcome, index) => (
            <div key={index} className="flex items-center justify-between gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm">
              <span className="flex items-center gap-2"><span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                ${(outcome.cents / 100).toFixed(2)}</span>
              <b>{outcome.probability.toFixed(1)}%</b>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm text-amber-100" aria-live="polite">결과 공개까지 {Math.ceil(timeLeft / 1000)}초</p>
      </div>
    </div>
  );
}
