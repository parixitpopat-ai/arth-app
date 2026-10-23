import test from "node:test";
import assert from "node:assert/strict";
import { shareCharges, chargeBreakdown, equalShares, isCharge, linePaise, ME } from "./chargeShare.js";

const chips = { id: "c", label: "Chips", qty: 2, unitPrice: 20 };
const coke = { id: "k", label: "Coke", qty: 1, unitPrice: 40 };
const handling = { id: "h", label: "Handling charge", qty: 1, unitPrice: 13, kind: "charge", chargeType: "handling" };
const lines = [chips, coke, handling];
const A = { id: "ra", targetType: "person", targetId: "A", items: [{ sourceItemId: "c", qty: 1 }, { sourceItemId: "k", qty: 1 }] };
const B = { id: "rb", targetType: "person", targetId: "B", items: [{ sourceItemId: "c", qty: 1 }] };

test("charges are divided equally by the number of splits, me included; the leftover paisa stays with me", () => {
  const r = shareCharges({ lineItems: lines, rows: [A, B] });
  assert.equal(r.splitCount, 3);
  assert.equal(r.chargesPaise, 1300);
  assert.equal(r.rows.ra.chargePaise, 433);
  assert.equal(r.rows.rb.chargePaise, 433);
  assert.equal(r.meSharePaise, 434);
});

test("each person's total is their items plus their share; the shares plus me add back to the charges", () => {
  const r = shareCharges({ lineItems: lines, rows: [A, B] });
  assert.equal(r.rows.ra.itemsPaise, 6000);        // 1 chips (20) + 1 coke (40)
  assert.equal(r.rows.ra.totalPaise, 6433);
  assert.equal(r.rows.rb.itemsPaise, 2000);
  assert.equal(r.rows.rb.totalPaise, 2433);
  assert.equal(r.rows.ra.chargePaise + r.rows.rb.chargePaise + r.meSharePaise, r.chargesPaise);
});

test("the split does not depend on what each person's items cost", () => {
  const r = shareCharges({ lineItems: [{ id: "x", qty: 1, unitPrice: 900 }, { id: "y", qty: 1, unitPrice: 60 }, handling], rows: [
    { id: "r1", targetType: "person", targetId: "A", items: [{ sourceItemId: "x", qty: 1 }] },
    { id: "r2", targetType: "group", targetId: "G", items: [{ sourceItemId: "y", qty: 1 }] }] });
  assert.equal(r.rows.r1.chargePaise, r.rows.r2.chargePaise);
});

test("'me' not counted: only the tagged people share the charges, the leftover paisa goes to the first", () => {
  const r = shareCharges({ lineItems: lines, rows: [A, B], includeMe: false });
  assert.equal(r.splitCount, 2);
  assert.equal(r.meCounts, false);
  assert.equal(r.rows.ra.chargePaise, 650);
  assert.equal(r.rows.rb.chargePaise, 650);
  const odd = shareCharges({ lineItems: [chips, { ...handling, unitPrice: 13.01 }], rows: [A, B], includeMe: false });
  assert.equal(odd.rows.ra.chargePaise + odd.rows.rb.chargePaise, 1301);
});

test("an explicit 'Me' row is a split of its own and is not counted twice", () => {
  const me = { id: "rm", targetType: "person", targetId: ME, items: [{ sourceItemId: "c", qty: 1 }] };
  const r = shareCharges({ lineItems: lines, rows: [A, me] });
  assert.equal(r.splitCount, 2);
  assert.equal(r.rows.rm.chargePaise + r.rows.ra.chargePaise, 1300);
});

test("nobody tagged to items: nothing is shared (all of it stays with me); flat-amount rows are not splits", () => {
  assert.equal(shareCharges({ lineItems: lines, rows: [] }).splitCount, 0);
  const flat = { id: "rf", targetType: "person", targetId: "A", amount: "50", items: [] };
  const r = shareCharges({ lineItems: lines, rows: [flat] });
  assert.equal(r.rows.rf.chargePaise, 0);
});

test("a group counts as one split; charge lines cannot be picked as items", () => {
  const G = { id: "rg", targetType: "group", targetId: "G", items: [{ sourceItemId: "c", qty: 1 }, { sourceItemId: "h", qty: 1 }] };
  const r = shareCharges({ lineItems: lines, rows: [G, B] });
  assert.equal(r.splitCount, 3);
  assert.equal(r.rows.rg.itemsPaise, 2000);       // the charge line contributes nothing as an "item"
});

test("breakup by charge type, in rupees", () => {
  const b = chargeBreakdown([...lines, { id: "p", qty: 1, unitPrice: 5, kind: "charge", chargeType: "platform" }, { id: "n", qty: 1, unitPrice: 1.5, kind: "charge", chargeType: "mystery" }]);
  assert.deepEqual(b.byType, { handling: 13, platform: 5, other: 1.5 });
  assert.equal(b.total, 19.5);
  assert.deepEqual(chargeBreakdown(null).byType, {});
});

test("helpers", () => {
  assert.deepEqual(equalShares(1000, ["a", "b", "c"], "c"), { a: 333, b: 333, c: 334 });
  assert.equal(isCharge({ kind: "charge" }), true);
  assert.equal(isCharge({}), false);
  assert.equal(linePaise({ qty: 3, unitPrice: 19.99 }), 5997);
  assert.equal(linePaise({ amount: 7.5 }), 750);
});
