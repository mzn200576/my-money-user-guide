// Market accounting uses cents throughout. Quotes do not move cash; only fills do.
export type MarketOrderInput = {
  id: string; memberId: string; side: string; priceCents: number;
  quantity: number; remaining: number; createdAt: string;
};
export type MarketHoldingInput = { id: string; memberId: string; cashCents: number; shares: number };
export type MarketFill = {
  id: string; buyerMemberId: string; sellerMemberId: string;
  priceCents: number; quantity: number;
};
const MAX_DB_INTEGER = 2_147_483_647;

export function settleMarketOrders(
  originalOrders: MarketOrderInput[], originalHoldings: MarketHoldingInput[],
  makeId: () => string,
) {
  const holdings = originalHoldings.map((holding) => ({ ...holding }));
  const orders = originalOrders.map((order) => ({ ...order }));
  const holdingMap = new Map(holdings.map((holding) => [holding.memberId, holding]));
  const buys = orders.filter((order) => order.side === "buy")
    .sort((a, b) => b.priceCents - a.priceCents || a.createdAt.localeCompare(b.createdAt));
  const sells = orders.filter((order) => order.side === "sell")
    .sort((a, b) => a.priceCents - b.priceCents || a.createdAt.localeCompare(b.createdAt));
  const trades: MarketFill[] = [];
  let bi = 0;
  let si = 0;
  while (bi < buys.length && si < sells.length) {
    const buy = buys[bi];
    const sell = sells[si];
    if (buy.remaining <= 0) { bi += 1; continue; }
    if (sell.remaining <= 0) { si += 1; continue; }
    if (buy.priceCents < sell.priceCents) break;
    const buyer = holdingMap.get(buy.memberId);
    const seller = holdingMap.get(sell.memberId);
    if (!buyer || !seller || buyer === seller) throw new Error("주문 참가자의 잔고를 확인해주세요.");
    const priceCents = Math.round((buy.priceCents + sell.priceCents) / 2);
    const affordable = Math.floor(buyer.cashCents / priceCents);
    const quantity = Math.min(buy.remaining, sell.remaining, affordable, seller.shares);
    if (quantity <= 0) {
      if (affordable <= 0) bi += 1;
      if (seller.shares <= 0) si += 1;
      continue;
    }
    const amount = priceCents * quantity;
    if (!Number.isSafeInteger(amount) || seller.cashCents + amount > MAX_DB_INTEGER ||
        buyer.shares + quantity > MAX_DB_INTEGER) throw new Error("체결 결과가 잔고 한도를 넘었습니다.");
    buyer.cashCents -= amount;
    buyer.shares += quantity;
    seller.cashCents += amount;
    seller.shares -= quantity;
    buy.remaining -= quantity;
    sell.remaining -= quantity;
    trades.push({ id: makeId(), buyerMemberId: buy.memberId, sellerMemberId: sell.memberId, priceCents, quantity });
    if (buy.remaining === 0) bi += 1;
    if (sell.remaining === 0) si += 1;
  }
  const cashBefore = originalHoldings.reduce((sum, holding) => sum + holding.cashCents, 0);
  const cashAfter = holdings.reduce((sum, holding) => sum + holding.cashCents, 0);
  const sharesBefore = originalHoldings.reduce((sum, holding) => sum + holding.shares, 0);
  const sharesAfter = holdings.reduce((sum, holding) => sum + holding.shares, 0);
  if (cashBefore !== cashAfter || sharesBefore !== sharesAfter) throw new Error("체결 결과의 잔고 합계가 맞지 않습니다.");
  return {
    holdings,
    trades,
    orders: orders.map((order) => ({
      id: order.id, remaining: order.remaining,
      status: order.remaining === 0 ? "filled" : order.remaining < order.quantity ? "partial" : "cancelled",
    })),
  };
}

export function addMarketDividend<T extends MarketHoldingInput>(holdings: T[], dividendCents: number): T[] {
  if (!Number.isSafeInteger(dividendCents) || dividendCents < 0 || dividendCents > MAX_DB_INTEGER)
    throw new Error("배당금을 센트 단위로 확인해주세요.");
  return holdings.map((holding) => {
    const cashCents = holding.cashCents + holding.shares * dividendCents;
    if (!Number.isSafeInteger(cashCents) || cashCents > MAX_DB_INTEGER)
      throw new Error("배당 지급 결과가 잔고 한도를 넘었습니다.");
    return { ...holding, cashCents };
  });
}

export function marketReceipt(
  holding: MarketHoldingInput,
  trades: Array<Pick<MarketFill, "buyerMemberId" | "sellerMemberId" | "priceCents" | "quantity">>,
  memberId: string, dividendCents: number,
) {
  let tradeCashCents = 0;
  let sharesChange = 0;
  let filledQuantity = 0;
  for (const trade of trades) {
    if (trade.buyerMemberId === memberId) {
      tradeCashCents -= trade.priceCents * trade.quantity;
      sharesChange += trade.quantity;
      filledQuantity += trade.quantity;
    }
    if (trade.sellerMemberId === memberId) {
      tradeCashCents += trade.priceCents * trade.quantity;
      sharesChange -= trade.quantity;
      filledQuantity += trade.quantity;
    }
  }
  const dividendCashCents = holding.shares * dividendCents;
  return {
    openingCashCents: holding.cashCents - tradeCashCents - dividendCashCents,
    tradeCashCents,
    dividendCashCents,
    endingCashCents: holding.cashCents,
    openingShares: holding.shares - sharesChange,
    endingShares: holding.shares,
    filledQuantity,
  };
}
