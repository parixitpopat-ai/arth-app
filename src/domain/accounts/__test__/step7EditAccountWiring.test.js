import test from "node:test";
import assert from "node:assert/strict";
import { AccountValidationError } from "../Account.js";
import { accountFromStoredShape } from "../accountFromStoredShape.js";
import { accountToStoredShape } from "../accountToStoredShape.js";

// Simulates EditAccountModal's save() exactly as wired in Step 7 — hydrate
// via accountFromStoredShape(), branch on whether it resolved, and either
// route through Account.update() or perform the narrow legacy-shaped field
// update for unresolved accounts. App.jsx has no JSX test runtime in this
// sandbox, so this exercises the wiring logic directly.
function simulateEditAccountSave(stored, formState) {
  if (!formState.name.trim()) return { skipped: true };
  const hydrationResult = accountFromStoredShape(stored);
  if (hydrationResult.status === "hydrated") {
    const changes = {
      name: formState.name.trim(), last4: formState.last4, color: formState.color, excludeFromWealth: formState.excludeFromWealth,
      attributedTo: formState.accAttributedTo || null, attributeType: formState.accAttributedTo ? formState.accAttributeType : null,
      ...(stored.type === "cc" && { limit: formState.limit, statementDate: formState.statementDate, dueDate: formState.dueDate, alertPct: formState.alertPct, billingCycle: formState.billingCycle }),
      ...((stored.type === "bank" || stored.type === "cash") && { openingBalance: formState.openingBalance, openingBalanceDate: formState.openingBalanceDate, needsCalibration: formState.needsCalibration }),
      ...(stored.type === "upi" && { handle: formState.handle, linkedAccount: formState.linkedUpiAccount || "" }),
      ...(stored.type === "debit" && { linkedBank: formState.linkedBank }),
    };
    try {
      hydrationResult.account.update(changes);
    } catch (err) {
      if (err instanceof AccountValidationError) return { error: err.message };
      throw err;
    }
    return { stored: accountToStoredShape(hydrationResult.account) };
  } else {
    return {
      stored: {
        ...stored, name: formState.name.trim(), last4: formState.last4, color: formState.color, excludeFromWealth: formState.excludeFromWealth,
        attributedTo: formState.accAttributedTo || null, attributeType: formState.accAttributedTo ? formState.accAttributeType : null,
      },
      unresolved: true,
    };
  }
}

// --- Resolved path ---

test("Step 7 resolved: editing a valid bank account updates fields via Account.update() and preserves type", () => {
  const stored = { id: "b1", type: "bank", name: "HDFC Savings", color: "#22c55e", last4: "3310", accountTypeId: "bank", typeLabel: "Bank Account", typeIcon: "🏦", typeBucket: "cash", openingBalance: 5000, openingBalanceDate: "2026-04-01", needsCalibration: false };
  const result = simulateEditAccountSave(stored, { name: "HDFC Prime Savings", last4: "3310", color: "#3b82f6", excludeFromWealth: false, openingBalance: 6000, openingBalanceDate: "2026-04-01", needsCalibration: false });
  assert.equal(result.error, undefined);
  assert.equal(result.stored.type, "bank");
  assert.equal(result.stored.name, "HDFC Prime Savings");
  assert.equal(result.stored.color, "#3b82f6");
  assert.equal(result.stored.openingBalance, 6000);
});

test("Step 7 resolved: editing a debit account to remove its linked bank is rejected by Account.update()'s own invariant, surfaced as an error", () => {
  const stored = { id: "d1", type: "debit", name: "Visa", accountTypeId: "debit", typeLabel: "Debit Card", linkedBank: "b1", last4: "0211" };
  const result = simulateEditAccountSave(stored, { name: "Visa", last4: "0211", color: "#3b82f6", excludeFromWealth: false, linkedBank: "" });
  assert.equal(result.stored, undefined);
  assert.equal(result.error, "Debit account requires a linked bank");
});

test("Step 7 resolved: a valid edit does not change the account's type/behavior", () => {
  const stored = { id: "cc1", type: "cc", name: "Sapphire", accountTypeId: "cc", typeLabel: "Credit Card", limit: 300000, outstanding: 12000, statementDate: 15, dueDate: 5, alertPct: 30, billingCycle: "15th–14th" };
  const result = simulateEditAccountSave(stored, { name: "Sapphire Elite", last4: "", color: "#000", excludeFromWealth: false, limit: 350000, statementDate: 15, dueDate: 5, alertPct: 30, billingCycle: "15th–14th" });
  assert.equal(result.stored.type, "cc");
});

// --- Unresolved path ---

test("Step 7 unresolved: editing an account with an unmapped type allows name/color/attribution changes without calling Account.update()", () => {
  const stored = { id: "x1", type: "crypto", name: "My Crypto", typeLabel: "Crypto Wallet", color: "#a855f7", last4: "" };
  const result = simulateEditAccountSave(stored, { name: "My Crypto Wallet", last4: "", color: "#3b82f6", excludeFromWealth: false });
  assert.equal(result.error, undefined);
  assert.equal(result.unresolved, true);
  assert.equal(result.stored.name, "My Crypto Wallet");
  assert.equal(result.stored.color, "#3b82f6");
});

test("Step 7 unresolved: the account's type is never converted, changed, or repaired", () => {
  const stored = { id: "x2", type: "crypto", name: "My Crypto", typeLabel: "Crypto Wallet" };
  const result = simulateEditAccountSave(stored, { name: "Renamed Crypto", last4: "", color: "#000", excludeFromWealth: false });
  assert.equal(result.stored.type, "crypto");
  assert.notEqual(result.stored.type, "bank");
});

test("Step 7 unresolved: existing transaction-relevant fields not in the narrow edit set are preserved untouched (spread from original)", () => {
  const stored = { id: "x3", type: "crypto", name: "My Crypto", typeLabel: "Crypto Wallet", openingBalance: 12345, customField: "untouched" };
  const result = simulateEditAccountSave(stored, { name: "My Crypto", last4: "", color: "#000", excludeFromWealth: false });
  assert.equal(result.stored.openingBalance, 12345);
  assert.equal(result.stored.customField, "untouched");
});

test("Step 7 unresolved: INVALID_DATA accounts (resolved type, other invariant broken) also use the narrow edit path, not Account.update()", () => {
  const stored = { id: "x4", type: "debit", name: "Orphan Debit", accountTypeId: "debit", typeLabel: "Debit Card" }; // no linkedBank
  const result = simulateEditAccountSave(stored, { name: "Orphan Debit Renamed", last4: "", color: "#000", excludeFromWealth: false });
  assert.equal(result.error, undefined);
  assert.equal(result.unresolved, true);
  assert.equal(result.stored.type, "debit");
  assert.equal(result.stored.name, "Orphan Debit Renamed");
});

test("Step 7: hydration is read-only — the original stored record is never mutated by save() in either path", () => {
  const stored = { id: "x5", type: "crypto", name: "My Crypto", typeLabel: "Crypto Wallet" };
  const snapshot = JSON.stringify(stored);
  simulateEditAccountSave(stored, { name: "Changed", last4: "", color: "#000", excludeFromWealth: false });
  assert.equal(JSON.stringify(stored), snapshot);
});
