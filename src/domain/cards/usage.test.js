import { test } from "node:test";
import assert from "node:assert/strict";
import { getCardUsage } from "./usage.js";

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
