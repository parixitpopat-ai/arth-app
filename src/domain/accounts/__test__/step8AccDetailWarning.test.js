import test from "node:test";
import assert from "node:assert/strict";
import { accountFromStoredShape } from "../accountFromStoredShape.js";

// Simulates AccDetailModal's exact Step 8 predicate:
//   const isUnresolvedType = accountFromStoredShape(a).status !== "hydrated";
function isUnresolvedType(stored) {
  return accountFromStoredShape(stored).status !== "hydrated";
}

test("Step 8: a normal bank account is not flagged as unresolved", () => {
  const stored = { id: "b1", type: "bank", name: "HDFC Savings", accountTypeId: "bank", typeLabel: "Bank Account" };
  assert.equal(isUnresolvedType(stored), false);
});

test("Step 8: an account with an unmapped custom type (NEEDS_BEHAVIOR) is flagged as unresolved", () => {
  const stored = { id: "x1", type: "crypto", name: "My Crypto", typeLabel: "Crypto Wallet" };
  assert.equal(isUnresolvedType(stored), true);
});

test("Step 8: a resolved type with a broken invariant (INVALID_DATA, e.g. debit with no linkedBank) is also flagged as unresolved", () => {
  const stored = { id: "d1", type: "debit", name: "Orphan Debit", accountTypeId: "debit", typeLabel: "Debit Card" };
  assert.equal(isUnresolvedType(stored), true);
});

test("Step 8: all 5 built-in behaviors are correctly identified as resolved (not flagged)", () => {
  const cases = [
    { id: "b2", type: "bank", name: "B" },
    { id: "c1", type: "cash", name: "C" },
    { id: "cc1", type: "cc", name: "CC" },
    { id: "d2", type: "debit", name: "D", linkedBank: "b2" },
    { id: "u1", type: "upi", name: "U" },
  ];
  for (const stored of cases) {
    assert.equal(isUnresolvedType(stored), false, `expected ${stored.type} to be resolved`);
  }
});

test("Step 8: checking unresolved status does not mutate the stored account", () => {
  const stored = { id: "x2", type: "crypto", name: "My Crypto" };
  const snapshot = JSON.stringify(stored);
  isUnresolvedType(stored);
  assert.equal(JSON.stringify(stored), snapshot);
});
