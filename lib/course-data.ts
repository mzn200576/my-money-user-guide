export const ROLE_CARDS = [
  {
    key: "tuition",
    label: "등록금형",
    horizon: "1년",
    summary: "1년 뒤 100포인트가 반드시 필요하고 목표를 미루기 어렵습니다.",
    focus: "목표 부족액과 최악상황 가치",
    liquidityNeed: 0,
    maxLoss: 0,
  },
  {
    key: "emergency",
    label: "비상금형",
    horizon: "언제든",
    summary: "언제든 40포인트를 손실 없이 꺼낼 수 있어야 합니다.",
    focus: "즉시유동성과 최악상황 가치",
    liquidityNeed: 40,
    maxLoss: 0,
  },
  {
    key: "housing",
    label: "주거자금형",
    horizon: "3년",
    summary: "3년 뒤 사용할 돈이며 1년 중간손실 12%를 넘기기 어렵습니다.",
    focus: "중간손실과 금리노출",
    liquidityNeed: 10,
    maxLoss: 12,
  },
  {
    key: "retirement",
    label: "은퇴자금형",
    horizon: "30년",
    summary: "단기 변동은 감수할 수 있지만 장기 구매력이 중요합니다.",
    focus: "실질가치와 성장자산 노출",
    liquidityNeed: 0,
    maxLoss: 30,
  },
] as const;

export const ALLOCATION_ASSETS = [
  { key: "cash", label: "즉시예금", rate: 1.5, risk: "물가위험 · 낮은 기대수익" },
  { key: "deposit", label: "1년 정기예금", rate: 3, risk: "중도해지 · 기회비용" },
  { key: "bond3", label: "3년 국채", rate: 4, risk: "금리위험 · 물가위험" },
  { key: "bond10", label: "10년 국채", rate: 5, risk: "큰 금리민감도 · 물가위험" },
  { key: "stockA", label: "개별주식 A", rate: null, risk: "기업고유위험 · 시장위험" },
  { key: "index", label: "주가지수 ETF", rate: null, risk: "시장위험 · 추적오차" },
] as const;

export const SHOCKS = [
  {
    key: "growth",
    label: "정상 성장",
    inflation: 2,
    values: { cash: 101.5, deposit: 103, bond3: 104, bond10: 105, stockA: 110, index: 108 },
  },
  {
    key: "inflation",
    label: "금리·물가 급등",
    inflation: 7,
    values: { cash: 101.5, deposit: 103, bond3: 100.33, bond10: 91.97, stockA: 82, index: 91 },
  },
  {
    key: "recession",
    label: "경기침체·금리하락",
    inflation: 1,
    values: { cash: 101.5, deposit: 103, bond3: 107.88, bond10: 120.57, stockA: 68, index: 84 },
  },
  {
    key: "fraud",
    label: "A기업 회계부정",
    inflation: 2,
    values: { cash: 101.5, deposit: 103, bond3: 104, bond10: 105, stockA: 40, index: 103 },
  },
] as const;

export type AllocationWeights = Record<(typeof ALLOCATION_ASSETS)[number]["key"], number>;

export function calculateAllocation(weights: AllocationWeights, shockKey: string, roleKey: string) {
  const shock = SHOCKS.find((item) => item.key === shockKey) ?? SHOCKS[0];
  const role = ROLE_CARDS.find((item) => item.key === roleKey) ?? ROLE_CARDS[0];
  const contributions = ALLOCATION_ASSETS.map((asset) => {
    const weight = weights[asset.key] ?? 0;
    const value = shock.values[asset.key];
    return { key: asset.key, label: asset.label, contribution: (weight * (value - 100)) / 100 };
  });
  const nominal = ALLOCATION_ASSETS.reduce(
    (total, asset) => total + ((weights[asset.key] ?? 0) * shock.values[asset.key]) / 100,
    0,
  );
  const real = nominal / (1 + shock.inflation / 100);
  const liquidity = (weights.cash ?? 0) + (weights.deposit ?? 0) * 0.5;
  const loss = Math.max(0, 100 - nominal);
  const goalMet = role.key === "retirement" ? real >= 100 : nominal >= 100;
  const liquidityMet = liquidity >= role.liquidityNeed;
  const lossMet = role.maxLoss === 0 ? loss === 0 : loss <= role.maxLoss;
  const worstValue = Math.min(
    ...SHOCKS.map((candidate) =>
      ALLOCATION_ASSETS.reduce(
        (total, asset) => total + ((weights[asset.key] ?? 0) * candidate.values[asset.key]) / 100,
        0,
      ),
    ),
  );
  return { shock, role, nominal, real, liquidity, loss, goalMet, liquidityMet, lossMet, worstValue, contributions };
}

export const DEFAULT_MPT_ASSETS = [
  { key: "cash", name: "현금", expectedReturn: 2.5, volatility: 0, weight: 20, color: "#64748b" },
  { key: "bond3", name: "3년 국채", expectedReturn: 4, volatility: 6, weight: 16, color: "#1d4ed8" },
  { key: "bond10", name: "10년 국채", expectedReturn: 5, volatility: 12, weight: 16, color: "#0891b2" },
  { key: "krStock", name: "국내주식", expectedReturn: 8, volatility: 20, weight: 16, color: "#e11d48" },
  { key: "globalStock", name: "글로벌주식", expectedReturn: 7.5, volatility: 17, weight: 16, color: "#d97706" },
  { key: "gold", name: "금", expectedReturn: 5.5, volatility: 15, weight: 16, color: "#7c3aed" },
];

export const DEFAULT_CORRELATIONS = [
  [1, 0, 0, 0, 0, 0],
  [0, 1, 0.6, -0.1, -0.05, 0.1],
  [0, 0.6, 1, -0.2, -0.15, 0.15],
  [0, -0.1, -0.2, 1, 0.75, 0.05],
  [0, -0.05, -0.15, 0.75, 1, 0.1],
  [0, 0.1, 0.15, 0.05, 0.1, 1],
];
