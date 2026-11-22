import { test } from "node:test";
import assert from "node:assert/strict";
import { getCardUsage, summariseCardLimits, emiBalanceForCard } from "./usage.js";

test("your card: limit 4,80,000, nothing billed, 28,295.94 unbilled -> used 28,295.94, 6% utilised", () => {
  const u = getCardUsage({ limit: 480000, billedOutstanding: 0, unbilled: 28295.94 });
  assert.equal(u.used, 28295.94);
  assert.equal(u.available, 451704.06);
  assert.equal(u.utilisationPct, 6);
  assert.equal(u.overLimit, false);
});

test("billed and unbilled add up; available limit never goes below zero", () => {
  const u = getCardUsage({ limit: 100000, billedOutstanding: 60000, unbilled: 50000 });
  assert.equal(u.used, 110000);
  assert.equal(u.available, 0);
  assert.equal(u.utilisationPct, 100);
  assert.equal(u.overLimit, true);
});

test("no limit set: used is still reported, availability and percentage are not invented", () => {
  const u = getCardUsage({ limit: 0, billedOutstanding: 1000, unbilled: 500 });
  assert.equal(u.used, 1500);
  assert.equal(u.hasLimit, false);
  assert.equal(u.available, null);
  assert.equal(u.utilisationPct, null);
});

test("missing, negative or non-numeric inputs count as zero", () => {
  const u = getCardUsage({ limit: 50000, billedOutstanding: -20, unbilled: undefined });
  assert.equal(u.used, 0);
  assert.equal(u.utilisationPct, 0);
});


test("EMI balance still to be billed counts against the limit, once", () => {
  const u = getCardUsage({ limit: 100000, billedOutstanding: 10000, unbilled: 6000, emiBalance: 48000 });
  assert.deepEqual([u.billed, u.unbilled, u.emi, u.used, u.available, u.utilisationPct], [10000, 6000, 48000, 64000, 36000, 64]);
  assert.equal(getCardUsage({ limit: 100000, billedOutstanding: 0, unbilled: 0 }).used, 0);
});

test("a card with no limit shows no available figure and no utilisation", () => {
  const u = getCardUsage({ limit: 0, billedOutstanding: 500, unbilled: 0 });
  assert.deepEqual([u.hasLimit, u.available, u.utilisationPct], [false, null, null]);
});

test("totals: only cards with a limit count; utilisation is used over the total limit", () => {
  const rows = [
    { limit: 100000, usage: getCardUsage({ limit: 100000, billedOutstanding: 20000, unbilled: 5000, emiBalance: 25000 }) },
    { limit: 50000, usage: getCardUsage({ limit: 50000, billedOutstanding: 0, unbilled: 0 }) },
    { limit: 0, usage: getCardUsage({ limit: 0, billedOutstanding: 9999, unbilled: 0 }) },
  ];
  assert.deepEqual(summariseCardLimits(rows), { cardCount: 3, cardsWithLimit: 2, totalLimit: 150000, totalUsed: 50000, totalAvailable: 100000, utilisationPct: 33 });
});

test("EMI balance for a card: only that card's active card-EMI loans", () => {
  const loans = [
    { direction: "taken", status: "active", autoScheduled: true, paymentAccId: "c1", outstanding: 48000 },
    { direction: "taken", status: "active", autoScheduled: true, paymentAccId: "c2", outstanding: 9000 },
    { direction: "taken", status: "closed", autoScheduled: true, paymentAccId: "c1", outstanding: 0 },
    { direction: "taken", status: "active", autoScheduled: false, paymentAccId: "c1", outstanding: 7000 },
    { direction: "given", status: "active", autoScheduled: true, paymentAccId: "c1", outstanding: 5000 },
  ];
  assert.equal(emiBalanceForCard(loans, "c1"), 48000);
  assert.equal(emiBalanceForCard([], "c1"), 0);
});
