import { test } from "node:test";
import assert from "node:assert/strict";
import { getWaitingClaims, autoPickClaims, summarisePick, applyReimbursement } from "./claims.js";

const txns = () => [
  { id: 1, type: "expense", reimbursable: true, date: "2026-11-12", desc: "Taxi to airport", amount: 1850 },
  { id: 2, type: "expense", reimbursable: true, date: "2026-11-12", desc: "Hotel", amount: 4800, reimbursableAmount: 4000, createdAt: 2 },
  { id: 3, type: "expense", reimbursable: true, date: "2026-11-14", desc: "Client lunch", amount: 1150 },
  { id: 4, type: "expense", reimbursable: true, date: "2026-11-15", desc: "Cab", amount: 600 },
  { id: 5, type: "expense", reimbursable: true, reimbursedByTxnId: 99, date: "2026-10-01", desc: "Already done", amount: 500 },
  { id: 6, type: "expense", date: "2026-11-10", desc: "Not a work expense", amount: 700 },
  { id: 7, type: "income", reimbursable: true, date: "2026-11-11", amount: 100 },
];

test("waiting claims are the work expenses not yet reimbursed, oldest first, at the claimed amount", () => {
  const c = getWaitingClaims(txns());
  assert.deepEqual(c.map(x => x.title), ["Taxi to airport", "Hotel", "Client lunch", "Cab"]);
  assert.equal(c[1].amount, 4000); assert.equal(c[1].spent, 4800);
});
test("ticks from the oldest while the money lasts: ₹7,000 clears the first three exactly", () => {
  const c = getWaitingClaims(txns());
  const ids = autoPickClaims(c, 7000);
  assert.deepEqual(ids, ["1", "2", "3"]);
  const s = summarisePick(c, ids, 7000);
  assert.equal(s.total, 7000); assert.equal(s.left, 0); assert.equal(s.short, 0); assert.equal(s.count, 3);
});
test("it stops at the first expense that does not fit and says what is left over", () => {
  const c = getWaitingClaims(txns());
  const ids = autoPickClaims(c, 6000);     // 1,850 + 4,000 = 5,850; lunch 1,150 would make 7,000
  assert.deepEqual(ids, ["1", "2"]);
  assert.equal(summarisePick(c, ids, 6000).left, 150);
});
test("ticking more than was received is reported as short", () => {
  const c = getWaitingClaims(txns());
  const s = summarisePick(c, ["1", "2", "3", "4"], 7000);
  assert.equal(s.total, 7600); assert.equal(s.short, 600); assert.equal(s.left, 0);
});
test("saving marks only the picked expenses as reimbursed by this payment and leaves the rest alone", () => {
  const next = applyReimbursement(txns(), ["1", "2", "3"], 555);
  assert.deepEqual(next.filter(t => t.reimbursedByTxnId === 555).map(t => t.id), [1, 2, 3]);
  assert.equal(next.find(t => t.id === 4).reimbursedByTxnId, undefined);
  assert.equal(next.find(t => t.id === 5).reimbursedByTxnId, 99);          // an earlier reimbursement is never overwritten
  assert.equal(next.find(t => t.id === 6).reimbursedByTxnId, undefined);
});
test("nothing waiting gives an empty list and picks nothing", () => {
  assert.deepEqual(getWaitingClaims([]), []);
  assert.deepEqual(autoPickClaims([], 5000), []);
});
