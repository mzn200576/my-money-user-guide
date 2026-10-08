export type DividendOutcome = {
  value: number;
  probability: number;
};

export type DividendDistribution = {
  id: string;
  name: string;
  outcomes: DividendOutcome[];
};

export type TradingMode = "private" | "close_public" | "open_book";
export type InformationMode = "full_distribution" | "expected_only" | "hidden";

export const DEFAULT_DIVIDEND_DISTRIBUTIONS: DividendDistribution[] = [
  {
    id: "distribution-1",
    name: "기본 배당분포",
    outcomes: [
      { value: 0, probability: 50 },
      { value: 2, probability: 50 },
    ],
  },
];

export const DEFAULT_ACTIVE_DISTRIBUTION_ID = "distribution-1";

export function distributionTotal(distribution: DividendDistribution) {
  return distribution.outcomes.reduce((sum, outcome) => sum + Number(outcome.probability || 0), 0);
}

export function distributionExpectedValue(distribution: DividendDistribution) {
  const total = distributionTotal(distribution);
  if (total <= 0) return 0;
  return distribution.outcomes.reduce(
    (sum, outcome) => sum + Number(outcome.value || 0) * Number(outcome.probability || 0),
    0,
  ) / total;
}

export function validateDividendDistributions(distributions: DividendDistribution[]) {
  if (!distributions.length) return "배당확률분포를 하나 이상 추가해주세요.";
  for (const distribution of distributions) {
    if (!distribution.name.trim()) return "각 배당확률분포의 이름을 입력해주세요.";
    if (!distribution.outcomes.length) return `${distribution.name}에 배당 결과를 하나 이상 추가해주세요.`;
    if (distribution.outcomes.some((outcome) => !Number.isFinite(outcome.value) || outcome.value < 0)) {
      return `${distribution.name}의 배당금은 0 이상이어야 합니다.`;
    }
    if (distribution.outcomes.some((outcome) => !Number.isFinite(outcome.probability) || outcome.probability <= 0 || outcome.probability > 100)) {
      return `${distribution.name}의 확률은 0보다 크고 100 이하여야 합니다.`;
    }
    if (Math.abs(distributionTotal(distribution) - 100) > 0.01) {
      return `${distribution.name}의 확률 합계를 100%로 맞춰주세요.`;
    }
  }
  return null;
}

export function sanitizeDividendDistributions(value: unknown): DividendDistribution[] | null {
  if (!Array.isArray(value) || !value.length || value.length > 10) return null;
  const distributions: DividendDistribution[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const source = value[index];
    if (!source || typeof source !== "object") return null;
    const candidate = source as { id?: unknown; name?: unknown; outcomes?: unknown };
    if (!Array.isArray(candidate.outcomes) || !candidate.outcomes.length || candidate.outcomes.length > 12) return null;
    const outcomes = candidate.outcomes.map((outcome) => {
      const row = outcome && typeof outcome === "object" ? outcome as { value?: unknown; probability?: unknown } : {};
      return { value: Number(row.value), probability: Number(row.probability) };
    });
    const distribution: DividendDistribution = {
      id: String(candidate.id || `distribution-${index + 1}`).slice(0, 80),
      name: String(candidate.name || `배당분포 ${index + 1}`).trim().slice(0, 40),
      outcomes,
    };
    if (validateDividendDistributions([distribution])) return null;
    distributions.push(distribution);
  }
  if (new Set(distributions.map((distribution) => distribution.id)).size !== distributions.length) return null;
  return distributions;
}

export function distributionsFromConfig(config: Record<string, unknown>) {
  const parsed = sanitizeDividendDistributions(config.dividendDistributions);
  if (parsed) return parsed;
  const legacy = Array.isArray(config.dividendValues)
    ? config.dividendValues.map(Number).filter((value) => Number.isFinite(value) && value >= 0)
    : [];
  if (legacy.length) {
    return [{
      id: "legacy-distribution",
      name: "배당분포",
      outcomes: legacy.map((value) => ({ value, probability: 100 / legacy.length })),
    }];
  }
  return DEFAULT_DIVIDEND_DISTRIBUTIONS.map((distribution) => ({
    ...distribution,
    outcomes: distribution.outcomes.map((outcome) => ({ ...outcome })),
  }));
}

export function distributionForRoom(config: Record<string, unknown>, experiment = 1) {
  const distributions = distributionsFromConfig(config);
  const activeId = String(config.activeDistributionId ?? "");
  if (activeId) return distributions.find((distribution) => distribution.id === activeId) ?? distributions[0];
  const assignments = config.experimentDistributionIds && typeof config.experimentDistributionIds === "object"
    ? config.experimentDistributionIds as Record<string, unknown>
    : {};
  const requestedId = String(assignments[String(experiment)] ?? "");
  return distributions.find((distribution) => distribution.id === requestedId) ?? distributions[0];
}

export function tradingModeForRoom(config: Record<string, unknown>, legacyExperiment = 1): TradingMode {
  if (["private", "close_public", "open_book"].includes(String(config.tradingMode))) {
    return config.tradingMode as TradingMode;
  }
  return legacyExperiment === 3 ? "open_book" : "close_public";
}

export function informationModeForRoom(config: Record<string, unknown>, legacyExperiment = 1): InformationMode {
  if (["full_distribution", "expected_only", "hidden"].includes(String(config.informationMode))) {
    return config.informationMode as InformationMode;
  }
  if (legacyExperiment === 1) return "full_distribution";
  return legacyExperiment === 2 ? "expected_only" : "hidden";
}

export function drawDividendValue(distribution: DividendDistribution, random: number) {
  const threshold = Math.max(0, Math.min(0.999999999, random)) * 100;
  let cumulative = 0;
  for (const outcome of distribution.outcomes) {
    cumulative += outcome.probability;
    if (threshold < cumulative) return outcome.value;
  }
  return distribution.outcomes.at(-1)?.value ?? 0;
}
