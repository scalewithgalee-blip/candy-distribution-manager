import { describe, expect, it } from "vitest";
import {
  allocateByValue,
  cashDifferenceCents,
  customerBalanceCents,
  deliveryShortagePacks,
  expenseAdjustmentAmountCents,
  lineTotalCents,
  parseMoneyToCents,
  percentageBps,
  reinvestmentCapacityCents,
  remainingPackBalance,
  remittanceOutstandingCents,
  roundRatio,
  weightedAverageCostCents,
} from "../shared/finance";

describe("PHP-centavo financial helpers", () => {
  it("parses pesos without floating-point centavo drift", () => {
    expect(parseMoneyToCents("25000")).toBe(2_500_000);
    expect(parseMoneyToCents("125.50")).toBe(12_550);
    expect(parseMoneyToCents("0.01")).toBe(1);
  });

  it("rejects negative, over-precision and unsafe money inputs", () => {
    expect(() => parseMoneyToCents("-1.00")).toThrow();
    expect(() => parseMoneyToCents("1.001")).toThrow();
    expect(() => parseMoneyToCents("not money")).toThrow();
    expect(() => parseMoneyToCents("90071992547410.00")).toThrow();
  });

  it("allocates every acquisition cent exactly with largest remainders", () => {
    expect(allocateByValue(2, [1, 1, 1])).toEqual([1, 1, 0]);
    const shares = allocateByValue(101, [90, 10]);
    expect(shares).toEqual([91, 10]);
    expect(shares.reduce((sum, value) => sum + value, 0)).toBe(101);
    expect(allocateByValue(7, [0, 0, 0])).toEqual([3, 2, 2]);
    expect(
      allocateByValue(Number.MAX_SAFE_INTEGER, [Number.MAX_SAFE_INTEGER])
    ).toEqual([Number.MAX_SAFE_INTEGER]);
  });

  it("uses exact integer arithmetic for weighted-average landed cost", () => {
    expect(weightedAverageCostCents(4, 100, 6, 900)).toBe(130);
    expect(weightedAverageCostCents(1, 100, 1, 101)).toBe(101);
    expect(() => weightedAverageCostCents(0, 0, 0, 0)).toThrow();
  });

  it("applies pack-level line discounts without allowing an over-credit", () => {
    expect(lineTotalCents(3, 50, 25)).toBe(125);
    expect(() => lineTotalCents(2, 40, 81)).toThrow();
  });

  it("rounds proportional credits and shared costs using integer arithmetic", () => {
    expect(roundRatio(100, 1, 3)).toBe(33);
    expect(roundRatio(101, 1, 2)).toBe(51);
    expect(roundRatio(2_500_000, 6000, 10000)).toBe(1_500_000);
    expect(() => roundRatio(1, 1, 0)).toThrow();
  });

  it("calculates net receivables after return credits, collections and refunds", () => {
    expect(customerBalanceCents(1000, 100, 500, 20)).toBe(420);
  });

  it("rounds basis points deterministically", () => {
    expect(percentageBps(333, 1000)).toBe(3330);
    expect(percentageBps(2, 3)).toBe(6667);
    expect(percentageBps(0, 0)).toBe(0);
  });

  it("reconciles a known pack purchase, sale, return, delivery, expense, remittance, and cash count", () => {
    const freightShares = allocateByValue(500, [1200, 1800]);
    expect(freightShares).toEqual([200, 300]);
    const movingAverage = weightedAverageCostCents(2, 1300, 3, 4800);
    expect(movingAverage).toBe(1480);

    const invoice = lineTotalCents(4, 2000, 1000);
    const returnCredit = roundRatio(invoice, 1, 4);
    const receivableBeforeCashRefund = customerBalanceCents(
      invoice,
      returnCredit,
      3000,
      0
    );
    const netRevenue = invoice - returnCredit;
    const netCogs = movingAverage * 4 - movingAverage;
    expect(remainingPackBalance(5, 4, 1)).toBe(2);
    expect(receivableBeforeCashRefund).toBe(2250);
    expect(netRevenue - netCogs).toBe(810);

    const candyShare = roundRatio(10000, 6000, 10000);
    expect(candyShare - 2000).toBe(4000);
    expect(deliveryShortagePacks(10, 7, 2)).toBe(1);
    expect(() => deliveryShortagePacks(10, 8, 3)).toThrow();
    expect(remittanceOutstandingCents(3000, 500, 1000, 200)).toBe(1300);
    expect(cashDifferenceCents(10000, 9500)).toBe(-500);
    expect(
      reinvestmentCapacityCents(6000, receivableBeforeCashRefund, 4000)
    ).toBe(4250);
    expect(expenseAdjustmentAmountCents(10000, -2000, 5000)).toBe(8000);
    expect(expenseAdjustmentAmountCents(10000, -6000, 5000)).toBeNull();
    expect(remainingPackBalance(2, 3)).toBeNull();
  });
});
