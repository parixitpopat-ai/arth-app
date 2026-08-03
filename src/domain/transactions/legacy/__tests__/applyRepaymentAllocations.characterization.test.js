// TRX-002C2 — Characterization tests for `applyRepaymentAllocations`.
//
// These capture what the function ACTUALLY does today (patches from this
// session included), not what it should do. This is the safety net TRX-002C2
// needs before anything is allowed to repoint or delete the real function —
// if any of these break during the eventual migration, that's a real behavior
// change to review deliberately, not something to discover by accident.

import test from "node:test";
import assert from "node:assert/strict";
import { applyRepaymentAllocationsCharacterization as apply } from "../applyRepaymentAllocationsCharacterization.js";

const todayStr = () => "2026-08-03";

test("characterization: no-op when settlementLinks is empty or invalid", () => {
  const txns = [{ id: "t1", type: "expense", people: {} }];
  const bills = [{ id: "b1", splitPeople: {} }];
  const result = apply({ txns, bills, personId: "p1", settlementLinks: [], todayStr });
  assert.equal(result.txns, txns, "should return the same array reference when nothing to do");
  assert.equal(result.bills, bills);
});

test("characterization: settling a plain transaction's person share updates settledAmt/remainingAmt/settled", () => {
  const txns = [{
    id: "t1", type: "expense",
    people: { p1: { amount: 500, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 500 } },
  }];
  const { txns: result } = apply({
    txns, bills: [], personId: "p1",
    settlementLinks: [{ kind: "txn", id: "t1", amount: 500 }],
    todayStr,
  });
  const share = result[0].people.p1;
  assert.equal(share.settledAmt, 500);
  assert.equal(share.remainingAmt, 0);
  assert.equal(share.settled, true);
});

test("characterization: partial settlement on a transaction leaves settled=false", () => {
  const txns = [{
    id: "t1", type: "expense",
    people: { p1: { amount: 500, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 500 } },
  }];
  const { txns: result } = apply({
    txns, bills: [], personId: "p1",
    settlementLinks: [{ kind: "txn", id: "t1", amount: 200 }],
    todayStr,
  });
  const share = result[0].people.p1;
  assert.equal(share.settledAmt, 200);
  assert.equal(share.remainingAmt, 300);
  assert.equal(share.settled, false);
});

test("characterization: settling a bill share recomputes bill.status to paid once ALL owed shares are settled (this session's fix)", () => {
  const bills = [{
    id: "b1",
    splitPeople: {
      p1: { amount: 858.40, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 858.40 },
      p2: { amount: 858.40, mode: "owes", settled: true, settledAmt: 858.40, remainingAmt: 0 }, // already settled
    },
    status: "unpaid",
  }];
  const { bills: result } = apply({
    txns: [], bills, personId: "p1",
    settlementLinks: [{ kind: "bill", id: "b1", amount: 858.40 }],
    todayStr,
  });
  assert.equal(result[0].status, "paid", "bill should flip to paid once every owed share is settled");
  assert.equal(result[0].paidDate, "2026-08-03");
});

test("characterization: settling ONE of several unsettled bill shares does NOT flip status to paid", () => {
  const bills = [{
    id: "b1",
    splitPeople: {
      p1: { amount: 858.40, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 858.40 },
      p2: { amount: 1716.80, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 1716.80 },
    },
    status: "unpaid",
  }];
  const { bills: result } = apply({
    txns: [], bills, personId: "p1",
    settlementLinks: [{ kind: "bill", id: "b1", amount: 858.40 }],
    todayStr,
  });
  assert.equal(result[0].status, "unpaid", "p2 is still unsettled, bill must stay unpaid");
  assert.equal(result[0].splitPeople.p1.settled, true);
});

test("characterization: bill settlement mirrors onto the linked source transaction when paidByTxnId is set (this session's fix)", () => {
  const bills = [{
    id: "b1", paidByTxnId: "t1",
    splitPeople: { p1: { amount: 858.40, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 858.40 } },
    status: "unpaid",
  }];
  const txns = [{
    id: "t1", type: "expense",
    people: { p1: { amount: 858.40, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 858.40 } },
  }];
  const result = apply({
    txns, bills, personId: "p1",
    settlementLinks: [{ kind: "bill", id: "b1", amount: 858.40 }],
    todayStr,
  });
  assert.equal(result.bills[0].status, "paid");
  const mirroredShare = result.txns[0].people.p1;
  assert.equal(mirroredShare.settled, true, "the linked transaction's own share must reflect the settlement too — this was the exact bug found and fixed this session");
  assert.equal(mirroredShare.remainingAmt, 0);
});

test("characterization: group-txn settlement advances groupCollectiveSettledAmt and the linked person's share", () => {
  const txns = [{
    id: "t1", type: "expense",
    groupCollectiveAmount: 1000, groupCollectiveSettledAmt: 0,
    people: { p1: { amount: 300, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 300 } },
  }];
  const { txns: result } = apply({
    txns, bills: [], personId: "p1",
    settlementLinks: [{ kind: "group-txn", id: "t1", amount: 300, personId: "p1" }],
    todayStr,
  });
  assert.equal(result[0].groupCollectiveSettledAmt, 300);
  assert.equal(result[0].people.p1.settled, true);
});

test("characterization: tagged links create a settled split entry for a previously-untagged person", () => {
  const txns = [{ id: "t1", type: "expense", people: {} }];
  const { txns: result } = apply({
    txns, bills: [], personId: "p1",
    settlementLinks: [{ kind: "tagged", id: "t1", amount: 250 }],
    todayStr,
  });
  const share = result[0].people.p1;
  assert.equal(share.amount, 250);
  assert.equal(share.settled, true);
  assert.equal(share.remainingAmt, 0);
});

test("characterization: tagged link is a no-op if the person already has a split entry on that transaction", () => {
  const txns = [{
    id: "t1", type: "expense",
    people: { p1: { amount: 100, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 100 } },
  }];
  const { txns: result } = apply({
    txns, bills: [], personId: "p1",
    settlementLinks: [{ kind: "tagged", id: "t1", amount: 250 }],
    todayStr,
  });
  assert.equal(result[0].people.p1.amount, 100, "existing split entry must not be overwritten by a tagged link");
});
