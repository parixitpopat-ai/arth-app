import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dedupeSettlementTxns } from "./settlementDedupe.js";

// The cleanup that shipped before this change, kept verbatim as a negative control.
const legacyKey = t => t?.type==="settlement_in" && t?.againstTxnId
  ? [t.fromPersonId||"", t.againstTxnId||"", t.date||"", Number(t.amount||0), t.accId||""].join("|") : null;
const legacyDedupe = txns => {
  const seenLinked = new Set(); const seenLegacy = new Set();
  return txns.filter(t => {
    if (t.type !== "settlement_in") return true;
    const k = legacyKey(t);
    if (k) { if (seenLinked.has(k)) return false; seenLinked.add(k); return true; }
    const lk = `${t.fromPersonId||""}_${t.date||""}_${Number(t.amount||0)}`;
    if (seenLegacy.has(lk)) return false; seenLegacy.add(lk); return true;
  });
};

const repay = (id, extra = {}) => ({ id, type: "settlement_in", amount: 500, date: "2026-10-01", fromPersonId: "p1", accId: "a1", ...extra });
const refund = (id, extra = {}) => ({ id, type: "settlement_in", amount: 499, date: "2026-10-01", isRefund: true, accId: "a1", ...extra });

test("two real same-day repayments of the same amount are both kept", () => {
  const list = [repay("r1"), repay("r2")];
  assert.deepEqual(dedupeSettlementTxns(list).map(t => t.id), ["r1", "r2"]);
  assert.equal(legacyDedupe(list).length, 1, "negative control: the old cleanup deleted one");
});

test("two linked repayments against the same expense, account, date and amount are both kept", () => {
  const list = [repay("r1", { againstTxnId: "e1" }), repay("r2", { againstTxnId: "e1" })];
  assert.equal(dedupeSettlementTxns(list).length, 2);
  assert.equal(legacyDedupe(list).length, 1);
});

test("two refunds of the same amount on one day (no person) are both kept", () => {
  const list = [refund("f1"), refund("f2", { desc: "other shop" })];
  assert.equal(dedupeSettlementTxns(list).length, 2);
  assert.equal(legacyDedupe(list).length, 1);
});

test("a record that is identical in every field, id included, is collapsed and the kept copy equals it", () => {
  const a = repay("r1", { note: "x", settlementLinks: [{ id: "e1", amount: 500 }] });
  const b = JSON.parse(JSON.stringify(a));
  const out = dedupeSettlementTxns([a, b]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], b);
});

test("never drops anything that differs in any field, and never touches other types", () => {
  const list = [repay("r1"), repay("r1", { note: "different" }), { id: "e1", type: "expense", amount: 5 }, { id: "e1", type: "expense", amount: 5 }];
  assert.equal(dedupeSettlementTxns(list).length, 4);
});

test("property: result ids are a subset only when the dropped record equals a kept one", () => {
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let i = 0; i < 200; i++) {
    const list = Array.from({ length: 8 }, (_, k) => repay(`r${Math.floor(rnd() * 5)}`, { amount: 100 * (1 + Math.floor(rnd() * 2)), note: rnd() < 0.5 ? "a" : "b", k: 0 }));
    const out = dedupeSettlementTxns(list);
    const keptKeys = new Set(out.map(t => JSON.stringify(Object.entries(t).sort())));
    list.forEach(t => assert.ok(keptKeys.has(JSON.stringify(Object.entries(t).sort())), "every input record is represented identically in the output"));
  }
});

test("App.jsx no longer deletes lookalike settlements on load or on save", () => {
  const src = readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");
  assert.ok(!src.includes("linkedSettlementKey"), "key-based settlement skipping removed");
  assert.ok(!src.includes("seenLegacy"), "key-based cleanup removed");
  assert.ok(src.includes('from "./domain/transactions/settlementDedupe.js"'));
});
