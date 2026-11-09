import { test } from "node:test";
import assert from "node:assert/strict";
import { vendorKey, vendorId, vendorSpend, findVendorDuplicates, mergeVendors, undoVendorMerge, groupSignature } from "./vendorMerge.js";

const e = (id, merchant, amount, date = "2026-11-02", extra = {}) => ({ id, type: "expense", merchant, amount, date, ...extra });

test("names that are the same vendor share a key", () => {
  const same = [["ABC Textile", "ABC Textiles"], ["A B C Textile", "ABC Textiles"], ["Dudh Sagar Dairy", "DudhSagar Dairy"], ["Goa Electricity Department", "Goa electricity Department"],
    ["Sharma Traders Pvt. Ltd.", "Sharma Traders"], ["Mehta & Co", "Mehta and Company"], ["  Big   Bazaar ", "big bazaar"]];
  for (const [a, b] of same) assert.equal(vendorKey(a), vendorKey(b), `${a} / ${b}`);
});
test("different vendors keep different keys (a wrong suggestion costs more than a missed one)", () => {
  const diff = [["Mahesh Stores", "Mahesh"], ["Raj Medical", "Raj Mobile"], ["Shell", "Shell Gas"], ["Amazon", "Amazon Fresh"], ["Star Bazaar", "Star Bazar Annex"]];
  for (const [a, b] of diff) assert.notEqual(vendorKey(a), vendorKey(b), `${a} / ${b}`);
  assert.equal(vendorKey("   "), ""); assert.equal(vendorKey(null), "");
});
test("vendor spend: totals expenses only, ignoring capitals and extra spaces; newest spelling wins by use", () => {
  const rows = vendorSpend([e(1, "Goa Electricity Department", 1000), e(2, "Goa electricity Department", 500), e(3, "  Goa Electricity   Department ", 250), e(4, "Cafe X", 90),
    { id: 5, type: "income", merchant: "Cafe X", amount: 5000, date: "2026-11-01" }, e(6, "", 40), e(7, undefined, 40)]);
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].name, rows[0].entries, rows[0].amount], ["Goa Electricity Department", 3, 1750]);
  assert.deepEqual(rows[0].variants.length, 2);
  assert.deepEqual([rows[1].name, rows[1].amount], ["Cafe X", 90]);
});
test("vendor spend: the period limits entries by date, inclusive", () => {
  const txns = [e(1, "A", 10, "2026-03-31"), e(2, "A", 20, "2026-04-01"), e(3, "A", 30, "2027-03-31"), e(4, "A", 40, "2027-04-01")];
  assert.equal(vendorSpend(txns, { from: "2026-04-01", to: "2027-03-31" })[0].amount, 50);
  assert.equal(vendorSpend(txns)[0].amount, 100);
});
test("finding duplicates: your real cases, with counts and amounts, most-used spelling suggested", () => {
  const txns = [e(1, "DudhSagar Dairy", 1440), e(2, "DudhSagar Dairy", 1440), e(3, "Dudh Sagar Dairy", 200), e(4, "Goa Electricity Department", 3000), e(5, "Goa electricity Department", 776), e(6, "Unrelated", 5)];
  const g = findVendorDuplicates(txns);
  assert.equal(g.length, 1, "Goa Electricity Department / Goa electricity Department differ only in a capital: the app already counts them as ONE vendor, so nothing to ask");
  const dairy = g.find(x => x.key.includes("dudh"));
  assert.equal(dairy.suggested, "DudhSagar Dairy"); assert.deepEqual(dairy.names.map(n => [n.name, n.entries, n.amount]), [["DudhSagar Dairy", 2, 2880], ["Dudh Sagar Dairy", 1, 200]]);
  const spend = vendorSpend(txns).find(v => v.id === "goa electricity department");
  assert.deepEqual([spend.entries, spend.amount, spend.variants.length], [2, 3776, 2], "...and it totals them together in the vendor list");
});
test("a single vendor, or different vendors, are never suggested", () => assert.deepEqual(findVendorDuplicates([e(1, "A", 1), e(2, "A", 2), e(3, "Mahesh Stores", 1), e(4, "Mahesh", 1)]), []));
test("'not the same' is remembered by signature; a NEW spelling brings the question back", () => {
  const txns = [e(1, "Dudh Sagar", 1), e(2, "DudhSagar", 1)];
  const [g] = findVendorDuplicates(txns);
  assert.deepEqual(findVendorDuplicates(txns, { dismissed: [g.signature] }), []);
  const more = [...txns, e(3, "Dudh-Sagar", 1)];
  assert.equal(findVendorDuplicates(more, { dismissed: [g.signature] }).length, 1);
  assert.equal(groupSignature(["B b", "a"]), groupSignature(["A", "b B"]));
});
test("merging renames transactions and bills of every listed spelling, ignoring capitals, and nothing else", () => {
  const txns = [e(1, "DudhSagar Dairy", 10), e(2, "dudh sagar dairy", 20), e(3, "Dudh Sagar Dairy", 30), e(4, "Other", 40), { id: 5, type: "income", merchant: "DudhSagar Dairy", amount: 1, date: "2026-11-01" }];
  const bills = [{ id: "b1", merchant: "DudhSagar Dairy", amount: 99 }, { id: "b2", merchant: "Other", amount: 1 }];
  const frozen = JSON.stringify({ txns, bills });
  const r = mergeVendors({ txns, bills }, { from: ["DudhSagar Dairy", "Dudh Sagar Dairy"], to: "Dudh Sagar Dairy" });
  assert.equal(JSON.stringify({ txns, bills }), frozen, "input untouched");
  assert.deepEqual(r.txns.map(t => t.merchant), ["Dudh Sagar Dairy", "Dudh Sagar Dairy", "Dudh Sagar Dairy", "Other", "Dudh Sagar Dairy"]);
  assert.equal(r.changedTxns, 3, "the one already named correctly is not counted"); assert.equal(r.changedBills, 1); assert.equal(r.bills[1].merchant, "Other");
  assert.equal(r.txns[3], txns[3], "untouched entries are the same objects");
  assert.equal(vendorSpend(r.txns).length, 2, "one vendor plus Other");
});
test("merging with nothing to do (no target, no names, already the target) changes nothing", () => {
  const txns = [e(1, "A", 1)];
  for (const arg of [{ from: ["A"], to: "" }, { from: [], to: "A" }, { from: ["A"], to: "A" }]) { const r = mergeVendors({ txns, bills: [] }, arg); assert.equal(r.txns, txns); assert.equal(r.changedTxns, 0); }
});
test("undo puts the old names back on exactly what was changed, and leaves anything edited since alone", () => {
  const txns = [e(1, "DudhSagar Dairy", 10), e(2, "Dudh Sagar Dairy", 20), e(3, "Keep", 1)];
  const bills = [{ id: "b1", merchant: "DudhSagar Dairy" }];
  const r = mergeVendors({ txns, bills }, { from: ["DudhSagar Dairy", "Dudh Sagar Dairy"], to: "Dudh Sagar Dairy" });
  const edited = r.txns.map(t => (t.id === 1 ? { ...t, merchant: "Renamed Later" } : t));      // entry 1 was edited after the merge
  const back = undoVendorMerge({ txns: edited, bills: r.bills }, r.undo, { to: "Dudh Sagar Dairy" });
  assert.equal(back.txns[0].merchant, "Renamed Later"); assert.equal(back.txns[1].merchant, "Dudh Sagar Dairy"); assert.equal(back.bills[0].merchant, "DudhSagar Dairy");
  const full = undoVendorMerge({ txns: r.txns, bills: r.bills }, r.undo, { to: "Dudh Sagar Dairy" });
  assert.deepEqual(full.txns.map(t => t.merchant), ["DudhSagar Dairy", "Dudh Sagar Dairy", "Keep"]);
});
test("vendorId ignores capitals and extra spaces only", () => { assert.equal(vendorId("  Big   Bazaar"), "big bazaar"); assert.notEqual(vendorId("Big Bazaar"), vendorId("BigBazaar")); });
