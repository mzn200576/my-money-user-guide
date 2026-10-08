export type RiskCategory = "capacity" | "willingness" | "discipline" | "knowledge";

export type RiskQuestion = {
  id: string;
  category: RiskCategory;
  scenario?: string;
  prompt: string;
  shuffle?: boolean;
  options: Array<{ label: string; score: number }>;
};

const scale = (labels: [string, string, string, string, string]) =>
  labels.map((label, score) => ({ label, score }));

const agreement = (reverse = false) =>
  ["전혀 그렇지 않다", "그렇지 않은 편이다", "보통이다", "그런 편이다", "매우 그렇다"].map((label, index) => ({
    label,
    score: reverse ? 4 - index : index,
  }));

const quiz = (choices: Array<[string, boolean]>) =>
  choices.map(([label, correct]) => ({ label, score: correct ? 4 : 0 }));

export const RISK_QUESTIONS: RiskQuestion[] = [
  {
    id: "C1", category: "capacity",
    prompt: "이 투자금에서 처음으로 큰 금액을 인출해야 하는 시점은 언제입니까?",
    options: scale(["1년 이내", "1~3년 뒤", "3~5년 뒤", "5~10년 뒤", "10년 이후"]),
  },
  {
    id: "C2", category: "capacity", shuffle: true,
    scenario: "예상하지 못한 지출로 현재 투자금의 약 15%가 필요해졌습니다.",
    prompt: "손실 중인 투자자산을 팔지 않고 지출을 감당할 수 있습니까?",
    options: scale(["투자금 대부분을 팔아 충당한다", "투자금 절반가량 팔아 충당한다", "투자금 일부를 팔아 충당한다", "다른 자금으로 대부분 충당한다", "다른 자금만으로 전부 충당한다"]),
  },
  {
    id: "C3", category: "capacity",
    scenario: "가구의 주된 소득이 갑자기 중단됐다고 가정합니다.",
    prompt: "현재 생활 수준을 유지할 수 있는 별도 자금은 어느 정도입니까?",
    options: scale(["1개월보다 짧게", "1~3개월 정도", "3~6개월 정도", "6~12개월 정도", "1년보다 길게"]),
  },
  {
    id: "C4", category: "capacity",
    prompt: "매달 확정적으로 갚아야 하는 부채와 고정지출의 부담은 어느 정도입니까?",
    options: scale(["소득을 자주 넘는다", "소득 대부분이다", "소득 절반쯤이다", "소득 일부이다", "부담이 거의 없다"]),
  },
  {
    id: "C5", category: "capacity", shuffle: true,
    scenario: "목표 시점에 투자금이 계획보다 20% 부족합니다.",
    prompt: "목표 금액이나 사용 시점을 얼마나 조정할 수 있습니까?",
    options: scale(["금액과 시점 모두 유지해야 한다", "금액만 일부 조정할 수 있다", "둘 중 한 조건을 조정할 수 있다", "두 조건을 조금씩 조정할 수 있다", "두 조건을 크게 조정할 수 있다"]),
  },
  {
    id: "C6", category: "capacity",
    prompt: "질병·사고·재산손해처럼 큰 비용이 드는 위험에 대비한 상태는 어떻습니까?",
    options: scale(["보장과 비상자금이 거의 없다", "보험 보장만 일부 마련해 두었다", "주요 위험의 보험 보장은 갖췄다", "보험과 비상자금을 함께 갖췄다", "보장과 비상자금을 정기 점검한다"]),
  },
  {
    id: "C7", category: "capacity",
    prompt: "이번 투자금은 전체 금융자산에서 어느 정도의 비중을 차지합니까?",
    options: scale(["80% 이상", "60~80%", "40~60%", "20~40%", "20% 미만"]),
  },
  {
    id: "C8", category: "capacity", shuffle: true,
    scenario: "투자금이 1년 동안 25% 하락한 상태로 유지됩니다.",
    prompt: "생활비나 필수 목표 때문에 이 자금을 꺼내야 할 가능성은 어느 정도입니까?",
    options: scale(["필수 지출 때문에 거의 꺼내야 한다", "필수 지출 때문에 꺼낼 가능성이 높다", "상황에 따라 일부를 꺼낼 수 있다", "다른 자금이 있어 가능성이 낮다", "다른 자금으로 전부 감당할 수 있다"]),
  },

  {
    id: "W1", category: "willingness", shuffle: true,
    scenario: "장기 목표는 그대로지만 포트폴리오가 석 달 만에 25% 하락했습니다.",
    prompt: "실제로 취할 가능성이 가장 높은 행동은 무엇입니까?",
    options: scale(["손실을 막기 위해 대부분 매도한다", "위험자산 비중을 절반 이상 줄인다", "불안을 줄이려 일부 비중을 낮춘다", "기존 목표 비중을 그대로 유지한다", "매수해 사전 목표 비중으로 되돌린다"]),
  },
  {
    id: "W2", category: "willingness",
    prompt: "다음 중 1년 뒤 가능한 최고·최저 결과를 보고 선택할 포트폴리오는 무엇입니까?",
    options: scale(["최고 +5% / 최저 +1%", "최고 +10% / 최저 -4%", "최고 +18% / 최저 -10%", "최고 +30% / 최저 -20%", "최고 +45% / 최저 -32%"]),
  },
  {
    id: "W3", category: "willingness",
    scenario: "1년 동안 같은 금액을 투자하며, 결과는 제시된 두 가지 중 하나가 됩니다.",
    prompt: "가장 편안하게 선택할 수 있는 손익 조합은 무엇입니까?",
    options: scale(["100% 확률로 +3%, 손실 가능성 없음", "50% 확률로 +7%, 50% 확률로 -2%", "50% 확률로 +14%, 50% 확률로 -7%", "50% 확률로 +24%, 50% 확률로 -14%", "50% 확률로 +40%, 50% 확률로 -25%"]),
  },
  {
    id: "W4", category: "willingness",
    scenario: "첫해에 30% 하락한 뒤 원금을 회복하는 데 3년이 걸리는 경로를 미리 보았습니다.",
    prompt: "이 경로를 실제로 겪어도 계획을 유지할 자신은 어느 정도입니까?",
    options: scale(["전혀 자신 없다", "별로 자신 없다", "절반 정도 자신 있다", "대체로 자신 있다", "매우 자신 있다"]),
  },
  {
    id: "W5", category: "willingness",
    scenario: "내 포트폴리오는 3% 올랐지만 친구는 한 종목으로 30% 수익을 냈습니다.",
    prompt: "내 포트폴리오를 바꾸고 싶은 마음은 어느 정도일 것 같습니까?",
    options: scale(["바로 크게 바꾸고 싶다", "상당히 바꾸고 싶다", "일부 바꾸고 싶다", "거의 바꾸고 싶지 않다", "전혀 바꾸고 싶지 않다"]),
  },
  {
    id: "W6", category: "willingness",
    scenario: "시장가격이 일주일 동안 매일 2~3%씩 크게 움직입니다.",
    prompt: "가격을 확인하지 않고 지낼 수 있는 기간은 어느 정도입니까?",
    options: scale(["1시간도 지나기 어렵다", "반나절 정도는 지낼 수 있다", "하루 정도는 지낼 수 있다", "일주일 정도는 지낼 수 있다", "정기 점검일까지 지낼 수 있다"]),
  },
  {
    id: "W7", category: "willingness", shuffle: true,
    scenario: "충분히 분산한 포트폴리오가 손실 중이지만 장기 가정은 바뀌지 않았습니다.",
    prompt: "가장 부담스럽게 느껴지는 것은 무엇입니까?",
    options: scale(["평가금액이 일시적으로 조금 줄어드는 일", "평가손실이 여러 달 계속 이어지는 일", "같은 기간 시장수익률보다 덜 오르는 일", "원금 회복에 예상보다 더 오래 걸리는 일", "처음 세운 투자 근거가 더는 맞지 않는 일"]),
  },
  {
    id: "W8", category: "willingness",
    scenario: "10년 목표를 위해 매년 같은 금액을 투자한다고 가정합니다.",
    prompt: "중간에 경험할 수 있는 최대 하락폭으로 어디까지 받아들일 수 있습니까?",
    options: scale(["최대 약 5%까지", "최대 약 10%까지", "최대 약 20%까지", "최대 약 30%까지", "최대 약 40% 이상"]),
  },
  {
    id: "W9", category: "willingness", shuffle: true,
    scenario: "충분히 검토한 전략이 시장보다 2년 연속 낮은 수익을 냈습니다.",
    prompt: "세 번째 해를 시작할 때 취할 행동과 가장 가까운 것은 무엇입니까?",
    options: scale(["근거를 보지 않고 전략을 전부 중단한다", "근거를 보지 않고 다른 전략으로 대부분 옮긴다", "일부만 바꾼 뒤 성과를 더 지켜본다", "처음 가정의 변화 여부를 확인하고 유지한다", "사전에 정한 평가 기준에 따라 재조정한다"]),
  },

  {
    id: "D1", category: "discipline",
    prompt: "투자 전에 목표 비중과 매도 조건을 기록해 두는 편입니다.",
    options: agreement(),
  },
  {
    id: "D2", category: "discipline",
    prompt: "가격이 크게 움직이면 계획에 없던 주문을 곧바로 내는 편입니다.",
    options: agreement(true),
  },
  {
    id: "D3", category: "discipline", shuffle: true,
    scenario: "신뢰하는 사람이 내가 잘 모르는 상품을 강하게 추천합니다.",
    prompt: "실제 행동과 가장 가까운 것은 무엇입니까?",
    options: scale(["추천만 믿고 바로 큰 금액을 매수한다", "추천만 믿고 우선 소액을 매수한다", "추천자가 제공한 자료만 확인한다", "추천과 별도로 상품 구조를 확인한다", "내 기준표와 독립된 자료를 함께 확인한다"]),
  },
  {
    id: "D4", category: "discipline",
    prompt: "손실을 빨리 만회하려고 평소보다 더 큰 위험을 감수한 적이 있습니다.",
    options: agreement(true),
  },
  {
    id: "D5", category: "discipline",
    prompt: "정해둔 날짜나 비중 이탈 기준에 맞춰 포트폴리오를 점검합니다.",
    options: agreement(),
  },
  {
    id: "D6", category: "discipline", shuffle: true,
    scenario: "한 종목이 크게 올라 목표 비중의 두 배가 됐지만 전망은 여전히 좋아 보입니다.",
    prompt: "가장 가까운 행동은 무엇입니까?",
    options: scale(["상승세를 보고 비중을 더 늘린다", "별도 점검 없이 현재 비중을 유지한다", "가격 추세가 꺾일 때까지 기다린다", "허용범위까지 여러 번 나눠 줄인다", "사전에 정한 목표 비중으로 재조정한다"]),
  },
  {
    id: "D7", category: "discipline",
    prompt: "내 판단과 반대되는 자료는 신뢰하기 어렵다고 느끼는 편입니다.",
    options: agreement(true),
  },
  {
    id: "D8", category: "discipline", shuffle: true,
    scenario: "매수가 10만원인 주식이 7만원이고, 새 정보로 계산한 적정가치는 6만원입니다.",
    prompt: "매도 여부를 결정할 때 가장 크게 반영할 기준은 무엇입니까?",
    options: scale(["처음 매수했던 가격을 가장 먼저 본다", "손익분기가 되는 가격을 가장 먼저 본다", "최근 시장가격의 추세를 가장 먼저 본다", "처음 세운 투자 가정의 변화를 먼저 본다", "현재 가치와 전체 비중을 함께 점검한다"]),
  },
  {
    id: "D9", category: "discipline",
    prompt: "재미가 적더라도 분산된 전략을 오래 유지할 수 있습니다.",
    options: agreement(),
  },

  {
    id: "K1", category: "knowledge", shuffle: true,
    scenario: "시장금리가 크게 상승했습니다.",
    prompt: "기존 고정금리 채권 가격에 일반적으로 나타나는 변화는 무엇입니까?",
    options: quiz([
      ["대체로 하락하며 장기채가 더 민감하다", true],
      ["대체로 상승하며 단기채가 더 민감하다", false],
      ["만기 전까지 시장가격은 변하지 않는다", false],
      ["이자율과 채권가격은 관련이 거의 없다", false],
    ]),
  },
  {
    id: "K2", category: "knowledge", shuffle: true,
    prompt: "상관관계가 낮은 두 위험자산을 함께 보유할 때 가장 정확한 설명은 무엇입니까?",
    options: quiz([
      ["두 자산의 손실 가능성이 모두 사라진다", false],
      ["비중에 상관없이 수익률이 같아진다", false],
      ["전체 포트폴리오의 변동성이 낮아질 수 있다", true],
      ["기대수익률과 위험이 반드시 함께 커진다", false],
    ]),
  },
  {
    id: "K3", category: "knowledge", shuffle: true,
    prompt: "일간 수익률의 2배를 추종하는 레버리지 ETF를 오래 보유할 때 중요한 특성은 무엇입니까?",
    options: quiz([
      ["장기수익률도 언제나 정확히 두 배가 된다", false],
      ["매일 재조정되어 경로에 따라 결과가 달라진다", true],
      ["지수가 하락해도 원금은 일정하게 유지된다", false],
      ["변동성이 커질수록 복리효과가 항상 좋아진다", false],
    ]),
  },
  {
    id: "K4", category: "knowledge", shuffle: true,
    scenario: "높은 쿠폰을 제시하는 복잡한 구조화상품을 처음 보았습니다.",
    prompt: "투자 전에 우선 확인할 항목의 조합으로 가장 적절한 것은 무엇입니까?",
    options: quiz([
      ["최근 수익률, 광고 문구, 판매 순위", false],
      ["추천 의견, 모집 금액, 출시 날짜", false],
      ["손익 구조, 최대 손실, 비용, 발행자 위험", true],
      ["쿠폰 수준, 인기 정도, 가입자 수", false],
    ]),
  },
  {
    id: "K5", category: "knowledge", shuffle: true,
    scenario: "명목수익률은 5%, 같은 기간 물가상승률은 3%였습니다.",
    prompt: "구매력 기준 수익률을 가장 잘 설명한 것은 무엇입니까?",
    options: quiz([
      ["약 8%이며 두 비율을 더해서 구한다", false],
      ["약 5%이며 물가는 따로 보지 않는다", false],
      ["약 3%이며 물가상승률과 같다", false],
      ["약 2%이며 명목수익에서 물가를 반영한다", true],
    ]),
  },
  {
    id: "K6", category: "knowledge", shuffle: true,
    scenario: "투자금이 100만원에서 80만원으로 20% 하락했습니다.",
    prompt: "다시 100만원이 되려면 이후 수익률이 얼마나 필요합니까?",
    options: quiz([["20%", false], ["25%", true], ["30%", false], ["40%", false]]),
  },
  {
    id: "K7", category: "knowledge", shuffle: true,
    prompt: "어떤 자산의 기대수익률이 연 8%라는 설명의 의미로 가장 적절한 것은 무엇입니까?",
    options: quiz([
      ["매년 정확히 8%의 수익이 확정된다", false],
      ["손실이 나도 다음 해에는 8%가 된다", false],
      ["가능한 결과의 확률가중 평균이다", true],
      ["최악의 경우에도 8% 수익을 보장한다", false],
    ]),
  },
  {
    id: "K8", category: "knowledge", shuffle: true,
    prompt: "두 자산으로 만든 포트폴리오의 위험을 계산할 때 필요한 정보는 무엇입니까?",
    options: quiz([
      ["각 자산의 비중, 변동성, 두 자산의 상관관계", true],
      ["각 자산의 이름, 가격, 최근 거래량", false],
      ["각 자산의 최고가, 최저가, 배당 횟수", false],
      ["각 자산의 기대수익률과 투자자 수", false],
    ]),
  },
  {
    id: "K9", category: "knowledge", shuffle: true,
    scenario: "두 펀드의 세전 수익률과 위험은 같지만 연간 비용이 각각 0.2%, 1.5%입니다.",
    prompt: "장기간 보유할 때 비용 차이에 관한 설명으로 가장 적절한 것은 무엇입니까?",
    options: quiz([
      ["비용은 첫해에만 차감되어 장기 결과가 같다", false],
      ["비용 차이는 복리로 누적되어 결과를 벌릴 수 있다", true],
      ["비용이 높은 펀드는 항상 위험이 더 낮다", false],
      ["세전 수익률이 같으면 비용은 비교할 필요가 없다", false],
    ]),
  },
];
