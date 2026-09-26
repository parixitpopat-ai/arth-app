import { test } from "node:test";
import assert from "node:assert/strict";
import { getBillerAccountDeleteBlockers, describeBillerAccountDeleteBlockers } from "./deleteGuard.js";

test("counts bills, memberships, fee payments and linked transactions", () => {
  const c = getBillerAccountDeleteBlockers("ba1", {
    bills: [{ billerAccountId: "ba1" }, { billerAccountId: "ba2" }],
    memberships: [{ billerAccountId: "ba1" }],
    feePayments: [],
    txns: [{ billerLinkId: "ba1" }, { billerLinkId: "ba1" }, { billerLinkId: null }, {}],
  });
  assert.deepEqual(c, { bills: 1, memberships: 1, feePayments: 0, txns: 2, total: 4 });
});

test("a billerAccount referenced only by a transaction is blocked (the gap this fixes)", () => {
  const c = getBillerAccountDeleteBlockers("ba1", { txns: [{ billerLinkId: "ba1" }] });
  assert.equal(c.total, 1);
  assert.equal(c.txns, 1);
});

test("ids are compared as strings (numeric vs string ids in stored data)", () => {
  const c = getBillerAccountDeleteBlockers(17, { bills: [{ billerAccountId: "17" }], txns: [{ billerLinkId: 17 }] });
  assert.equal(c.total, 2);
});

test("nothing linked → total 0; missing arrays are tolerated", () => {
  assert.equal(getBillerAccountDeleteBlockers("ba1").total, 0);
});

test("description names what is linked", () => {
  assert.equal(describeBillerAccountDeleteBlockers({ bills: 2, memberships: 0, feePayments: 0, txns: 5 }), "2 bills and 5 transactions");
  assert.equal(describeBillerAccountDeleteBlockers({ bills: 1, memberships: 1, feePayments: 1, txns: 1 }), "1 bill, 1 membership, 1 fee payment and 1 transaction");
  assert.equal(describeBillerAccountDeleteBlockers({ bills: 0, memberships: 0, feePayments: 0, txns: 1 }), "1 transaction");
});
