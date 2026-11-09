import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPettyCashTxn, isPettyCash, getPettyCashGiven, getPettyCashTotalsByPerson, applyPettyCash } from "./pettyCash.js";
import { applyPaybacks, getPaybackTotalsByPerson, buildPaybackTxn } from "./payback.js";
import { getPaidByPayablesByPerson } from "./paidBy.js";

const give = (personId, amount, date = "2026-11-01", extra = {}) => buildPettyCashTxn({ personId, personName: "Priya", fromAccId: "bank1", amount, date, id: `a${amount}${date}`, now: 1700000000000, ...extra });
const bought = (id, amount, by = "sp") => ({ id, type: "expense", amount, paidByPersonId: by, date: "2026-11-02", catIds: ["groceries"] });

test("petty cash is a transfer with a source account and NO destination, tagged to the person; it is not spending", () => {
  const t = give("sp", 10000);
  assert.equal(t.type, "transfer"); assert.equal(t.fromAccId, "bank1"); assert.equal(t.toAccId, null); assert.equal(t.accId, null);
  assert.equal(t.isPettyCash, true); assert.equal(t.pettyCashPersonId, "sp"); assert.deepEqual(t.catIds, []); assert.equal(t.amount, 10000);
  assert.equal(isPettyCash(t), true);
});
test("cash in hand: no source account is allowed (nothing is debited from any account)", () => assert.equal(give("sp", 500, "2026-11-01", { fromAccId: "" }).fromAccId, null));
test("only petty cash is recognised; paybacks, loans and ordinary transfers are not", () => {
  assert.equal(isPettyCash(buildPaybackTxn({ personId: "sp", amount: 5, fromAccId: "b", date: "2026-11-01" })), false);
  assert.equal(isPettyCash({ type: "transfer", fromAccId: "a", toAccId: "b" }), false);
  assert.equal(isPettyCash({ type: "expense", isPettyCash: true, pettyCashPersonId: "sp" }), false);
  assert.equal(isPettyCash({ type: "transfer", isPettyCash: true }), false, "no person, no petty cash");
  assert.equal(isPettyCash(null), false);
});
test("totals and lists per person, oldest first; other people are separate", () => {
  const txns = [give("sp", 3000, "2026-11-05"), give("sp", 7000, "2026-11-01"), give("other", 400), { type: "expense", amount: 9 }];
  assert.deepEqual(getPettyCashTotalsByPerson(txns), { sp: 10000, other: 400 });
  assert.deepEqual(getPettyCashGiven(txns, "sp").map(t => t.amount), [7000, 3000]);
});
test("the example: give 10,000; she spends 6,000 -> I owe nothing and 4,000 is still with her", () => {
  assert.deepEqual(applyPettyCash(6000, 10000), { iOwe: 0, withHer: 4000, used: 6000 });
});
test("she spends more than she held: 12,000 against 10,000 -> I owe her 2,000 and nothing is with her", () => {
  assert.deepEqual(applyPettyCash(12000, 10000), { iOwe: 2000, withHer: 0, used: 10000 });
});
test("nothing spent yet: all of it is with her; no petty cash: what I owe is unchanged", () => {
  assert.deepEqual(applyPettyCash(0, 10000), { iOwe: 0, withHer: 10000, used: 0 });
  assert.deepEqual(applyPettyCash(2500, 0), { iOwe: 2500, withHer: 0, used: 0 });
  assert.deepEqual(applyPettyCash(-5, undefined), { iOwe: 0, withHer: 0, used: 0 });
});
test("the leftover carries: a second handover and a later purchase use the same pool", () => {
  const txns = [give("sp", 10000, "2026-11-01"), give("sp", 5000, "2026-12-01"), bought("e1", 6000), bought("e2", 7000)];
  const owed = getPaidByPayablesByPerson(txns, {}).sp;            // 13,000 bought on my behalf
  assert.deepEqual(applyPettyCash(owed, getPettyCashTotalsByPerson(txns).sp), { iOwe: 0, withHer: 2000, used: 13000 });
});
test("reimbursing her still works after the petty cash: the payback lowers only what is still owed", () => {
  const txns = [give("sp", 5000), bought("e1", 8000), buildPaybackTxn({ personId: "sp", amount: 1000, fromAccId: "b", date: "2026-11-09" })];
  const afterPetty = applyPettyCash(getPaidByPayablesByPerson(txns, {}).sp, getPettyCashTotalsByPerson(txns).sp);   // owed 8,000 - 5,000 = 3,000
  assert.equal(afterPetty.iOwe, 3000);
  assert.deepEqual(applyPaybacks({ owesMe: 0, iOwe: afterPetty.iOwe }, getPaybackTotalsByPerson(txns).sp), { owesMe: 0, iOwe: 2000, excess: 0 });
});
test("paise are rounded", () => assert.deepEqual(applyPettyCash(10.005, 20.004), { iOwe: 0, withHer: 10, used: 10.01 }));
