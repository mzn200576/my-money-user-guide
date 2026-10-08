"use client";

import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { distributionExpectedValue, distributionTotal, type DividendDistribution } from "@/lib/market";

export function DividendDistributionEditor({
  distributions,
  activeDistributionId,
  onDistributionsChange,
  onActiveDistributionChange,
}: {
  distributions: DividendDistribution[];
  activeDistributionId: string;
  onDistributionsChange: (next: DividendDistribution[]) => void;
  onActiveDistributionChange: (id: string) => void;
}) {
  const updateDistribution = (distributionIndex: number, patch: Partial<DividendDistribution>) => {
    onDistributionsChange(distributions.map((distribution, index) => index === distributionIndex ? { ...distribution, ...patch } : distribution));
  };
  const updateOutcome = (distributionIndex: number, outcomeIndex: number, field: "value" | "probability", value: number) => {
    const distribution = distributions[distributionIndex];
    updateDistribution(distributionIndex, {
      outcomes: distribution.outcomes.map((outcome, index) => index === outcomeIndex ? { ...outcome, [field]: value } : outcome),
    });
  };
  const addDistribution = () => {
    const id = `distribution-${Date.now()}`;
    onDistributionsChange([...distributions, {
      id,
      name: `배당분포 ${distributions.length + 1}`,
      outcomes: [{ value: 0, probability: 50 }, { value: 2, probability: 50 }],
    }]);
  };
  const removeDistribution = (id: string) => {
    if (distributions.length <= 1) return;
    const next = distributions.filter((distribution) => distribution.id !== id);
    onDistributionsChange(next);
    if (activeDistributionId === id) onActiveDistributionChange(next[0].id);
  };

  return <div className="space-y-4 rounded-xl border p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <Label className="text-base font-bold">배당확률분포</Label>
        <p className="mt-1 text-sm text-muted-foreground">필요한 분포를 여러 개 만들어 두고 이번 방에서 사용할 하나를 선택합니다. 각 확률 합계는 100%여야 합니다.</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addDistribution}><Plus /> 분포 추가</Button>
    </div>
    <div className="space-y-4">
      {distributions.map((distribution, distributionIndex) => {
        const total = distributionTotal(distribution);
        return <section key={distribution.id} className="rounded-xl bg-muted/45 p-4">
          <div className="mb-4 flex items-center gap-2">
            <Input aria-label={`배당분포 ${distributionIndex + 1} 이름`} value={distribution.name} onChange={(event) => updateDistribution(distributionIndex, { name: event.target.value })} className="h-9 max-w-sm bg-card font-semibold" />
            <Badge variant={Math.abs(total - 100) <= 0.01 ? "default" : "destructive"} className="ml-auto shrink-0">합계 {total.toFixed(1)}%</Badge>
            <Button type="button" size="icon" variant="ghost" disabled={distributions.length <= 1} onClick={() => removeDistribution(distribution.id)} aria-label={`${distribution.name} 삭제`}><Trash2 className="size-4" /></Button>
          </div>
          <div className="mb-2 grid grid-cols-[1fr_1fr_36px] gap-2 text-xs font-semibold text-muted-foreground"><span>주당 배당금($)</span><span>발생확률(%)</span><span /></div>
          <div className="space-y-2">
            {distribution.outcomes.map((outcome, outcomeIndex) => <div key={outcomeIndex} className="grid grid-cols-[1fr_1fr_36px] gap-2">
              <Input aria-label={`${distribution.name} ${outcomeIndex + 1}행 배당금`} type="number" min={0} max={10000} step={0.01} value={outcome.value} onChange={(event) => updateOutcome(distributionIndex, outcomeIndex, "value", Number(event.target.value))} className="bg-card" />
              <Input aria-label={`${distribution.name} ${outcomeIndex + 1}행 확률`} type="number" min={0.1} max={100} step={0.1} value={outcome.probability} onChange={(event) => updateOutcome(distributionIndex, outcomeIndex, "probability", Number(event.target.value))} className="bg-card" />
              <Button type="button" size="icon" variant="ghost" disabled={distribution.outcomes.length <= 1} onClick={() => updateDistribution(distributionIndex, { outcomes: distribution.outcomes.filter((_, index) => index !== outcomeIndex) })} aria-label="배당 결과 행 삭제"><Trash2 className="size-4" /></Button>
            </div>)}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="ghost" size="sm" disabled={distribution.outcomes.length >= 12} onClick={() => updateDistribution(distributionIndex, { outcomes: [...distribution.outcomes, { value: 0, probability: 0 }] })}><Plus /> 결과 행 추가</Button>
            <span className="text-sm text-muted-foreground">1장 기대배당: <b className="text-foreground">${distributionExpectedValue(distribution).toFixed(2)}</b></span>
          </div>
        </section>;
      })}
    </div>
    <div className="border-t pt-4">
      <Label className="font-bold">이번 방에서 사용할 분포</Label>
      <Select value={activeDistributionId || distributions[0]?.id} onValueChange={onActiveDistributionChange}>
        <SelectTrigger className="mt-2 w-full bg-card"><SelectValue /></SelectTrigger>
        <SelectContent>{distributions.map((distribution) => <SelectItem key={distribution.id} value={distribution.id}>{distribution.name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  </div>;
}
