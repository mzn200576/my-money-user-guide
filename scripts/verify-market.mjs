import assert from "node:assert/strict";
import { test } from "node:test";
import { addMarketDividend, marketReceipt, settleMarketOrders } from "../lib/market-settlement.ts";
import { drawDividendValue } from "../lib/market.ts";

function order(id, memberId, side, priceCents, quantity, createdAt = id) {
  return { id, memberId, side, priceCents, quantity, remaining: quantity, createdAt };
}
function holding(memberId, cashCents, shares) {
  return { id: memberId, memberId, cashCents, shares };
}

test("trade settlement conserves cash and shares; dividends credit final shareholders only", () => {
  const original = [holding("buyer", 10_000, 0), holding("seller", 0, 10),
    holding("second", 1000, 0), holding("backup", 2000, 3)];
  const orders = [order("buy1", "buyer", "buy", 600, 10), order("buy2", "second", "buy", 500, 2),
    order("sell1", "seller", "sell", 400, 8), order("sell2", "backup", "sell", 600, 3)];
  let sequence = 0;
  const result = settleMarketOrders(orders, original, () => String(++sequence));
  assert.deepEqual(result.trades.map(({ priceCents, quantity }) => [priceCents, quantity]), [[500, 8], [600, 2]]);
  assert.equal(result.holdings.find((item) => item.memberId === "buyer").cashCents, 4800);
  assert.equal(result.holdings.find((item) => item.memberId === "buyer").shares, 10);
  assert.equal(result.holdings.find((item) => item.memberId === "backup").shares, 1);
  assert.equal(result.orders.find((item) => item.id === "sell2").status, "partial");
  assert.equal(orders[0].remaining, 10); // A failed DB write can safely retry with the original orders.
  const cashBefore = original.reduce((sum, item) => sum + item.cashCents, 0);
  const cashAfterTrades = result.holdings.reduce((sum, item) => sum + item.cashCents, 0);
  assert.equal(cashAfterTrades, cashBefore);
  const afterDividend = addMarketDividend(result.holdings, 200);
  assert.equal(afterDividend.reduce((sum, item) => sum + item.cashCents, 0), cashBefore + 13 * 200);
  const receipt = marketReceipt(afterDividend[0], result.trades, "buyer", 200);
  assert.equal(receipt.openingCashCents, 10_000);
  assert.equal(receipt.tradeCashCents, -5200);
  assert.equal(receipt.dividendCashCents, 2000);
  assert.equal(receipt.endingCashCents, 6800);
});

test("partial fill cannot overspend and subsequent seller cannot receive an unfunded trade", () => {
  const result = settleMarketOrders(
    [order("buy", "buyer", "buy", 500, 4), order("sell", "seller", "sell", 300, 4)],
    [holding("buyer", 900, 0), holding("seller", 0, 4)], () => "trade",
  );
  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].quantity, 2);
  assert.equal(result.holdings[0].cashCents, 100);
  assert.equal(result.holdings[1].cashCents, 800);
  assert.equal(result.orders[0].remaining, 2);
  assert.equal(result.orders[0].status, "partial");
});

test("draw follows probability boundaries, including a zero-dollar outcome", () => {
  const distribution = { id: "d", name: "test", outcomes: [
    { value: 0, probability: 20 }, { value: 1.5, probability: 30 }, { value: 4, probability: 50 },
  ] };
  assert.equal(drawDividendValue(distribution, 0), 0);
  assert.equal(drawDividendValue(distribution, 0.199999), 0);
  assert.equal(drawDividendValue(distribution, 0.2), 1.5);
  assert.equal(drawDividendValue(distribution, 0.5), 4);
  assert.equal(drawDividendValue(distribution, 0.999999), 4);
});

test("dividend overflow is rejected before persisting balances", () => {
  assert.throws(() => addMarketDividend([holding("one", 2_147_483_640, 5)], 2), /잔고 한도/);
});
