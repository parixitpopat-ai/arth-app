// WP-D evidence (no behaviour change). Carry-forward subtracts last month's spend from last month's budget.
// App.jsx computes that "spend" inline with the legacy filter below (4 call sites). Every other figure shown
// as "spent" uses getHouseholdAttributedTotal. These tests pin where the two disagree, so the intended rule
// can be decided and then fixed against known expectations.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getHouseholdAttributedTotal, resolveCarryForwardMonthly } from "./adapter.js";

const MONTH = "2026-09";
// verbatim shape of the inline App.jsx filter (App.jsx ~L10013, L13475, L15484, L15570)
const legacyPrevSpend = txns => txns.filter(t => t.type === "expense" && (t.date || "").startsWith(MONTH) && !t.groupId).reduce((s, t) => s + Number(t.amount || 0), 0);
const shownSpend = txns => getHouseholdAttributedTotal({ periodTransactions: txns.filter(t => (t.date || "").startsWith(MONTH)), allTransactions: txns });
const exp = (id, amount, extra = {}) => ({ id, type: "expense", amount, date: "2026-09-10", ...extra });

test("agree when every expense is plain", () => {
  const t = [exp("a", 1000), exp("b", 500)];
  assert.equal(legacyPrevSpend(t), 1500);
  assert.equal(shownSpend(t), 1500);
});

test("DISAGREE: a refund — legacy counts gross, shown spend is net", () => {
  const t = [exp("a", 1000), { id: "r", type: "settlement_in", isRefund: true, againstTxnId: "a", amount: 300, date: "2026-09-12" }];
  assert.equal(legacyPrevSpend(t), 1000);
  assert.equal(shownSpend(t), 700);
});

test("DISAGREE: an expense excluded from spend — legacy still counts it", () => {
  const t = [exp("a", 1000), exp("x", 400, { excludeFromSpend: true })];
  assert.equal(legacyPrevSpend(t), 1400);
  assert.equal(shownSpend(t), 1000);
});

test("DISAGREE: money a friend owes me — legacy counts it as my spend", () => {
  const t = [exp("a", 1000, { people: { p1: { mode: "owes", amount: 400 } } })];
  assert.equal(legacyPrevSpend(t), 1000);
  assert.equal(shownSpend(t), 600);
});

test("DISAGREE (opposite direction): a group-tagged expense — legacy drops it entirely, shown spend keeps my share", () => {
  const t = [exp("g", 1000, { groupId: "grp1", trackingMode: "split", groupAllocations: [{ groupId: "grp1", mode: "owes", amount: 600 }] })];
  assert.equal(legacyPrevSpend(t), 0);
  assert.equal(shownSpend(t), 400);
});

test("effect on the carried amount: budget 10,000, base 10,000", () => {
  const t = [exp("a", 1000), { id: "r", type: "settlement_in", isRefund: true, againstTxnId: "a", amount: 300, date: "2026-09-12" }];
  const viaLegacy = resolveCarryForwardMonthly(true, 10000, 10000, legacyPrevSpend(t));
  const viaShown = resolveCarryForwardMonthly(true, 10000, 10000, shownSpend(t));
  assert.equal(viaLegacy, 19000); // carries 9,000
  assert.equal(viaShown, 19300);  // carries 9,300 — what the month's own "Spent" figure implies
});
