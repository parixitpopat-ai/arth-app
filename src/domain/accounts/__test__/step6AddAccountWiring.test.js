import test from "node:test";
import assert from "node:assert/strict";
import { Account, AccountValidationError } from "../Account.js";
import { accountToStoredShape } from "../accountToStoredShape.js";
import { isResolvedBehavior } from "../legacyTypeMapping.js";

// Simulates AddAccountModal's submit() exactly as wired in Step 6 — same
// field mapping, same isResolvedBehavior gate, same Account.create() /
// accountToStoredShape() calls — since App.jsx itself has no JSX test
// runtime available in this sandbox. This verifies the wiring logic that
// was pasted into the modal, not the rendered UI.
function simulateAddAccountSubmit({ name, selectedAccountBaseType, selectedAccountType, selectedAccountBucket, color, accAttributedTo, accAttributeType, typeFields = {} }) {
  if (!name.trim()) return { error: "Name required" };
  if (!isResolvedBehavior(selectedAccountBaseType)) return { error: "This account type needs a behavior mapping before it can be used to create an account." };
  const base = {
    id: "test-id",
    name: name.trim(),
    color,
    classificationId: selectedAccountType.id,
    classificationLabel: selectedAccountType.label,
    icon: selectedAccountType.icon,
    bucket: selectedAccountBucket,
    attributedTo: accAttributedTo || null,
    attributeType: accAttributedTo ? accAttributeType : null,
  };
  try {
    const account = Account.create({ ...base, behavior: selectedAccountBaseType, ...typeFields });
    return { stored: accountToStoredShape(account) };
  } catch (err) {
    if (err instanceof AccountValidationError) return { error: err.message };
    throw err;
  }
}

test("Step 6 wiring: creating a bank account succeeds and produces the correct stored shape", () => {
  const result = simulateAddAccountSubmit({
    name: "HDFC Savings", selectedAccountBaseType: "bank",
    selectedAccountType: { id: "bank", label: "Bank Account", icon: "🏦" },
    selectedAccountBucket: "cash", color: "#22c55e",
    typeFields: { last4: "3310", openingBalance: 5000, openingBalanceDate: "2026-04-01", needsCalibration: false },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.stored.type, "bank");
  assert.equal(result.stored.name, "HDFC Savings");
  assert.equal(result.stored.accountTypeId, "bank");
  assert.equal(result.stored.typeLabel, "Bank Account");
  assert.equal(result.stored.openingBalance, 5000);
});

test("Step 6 wiring: creating a debit account without a linked bank is rejected by Account.create(), surfaced as the aggregate's own error message", () => {
  const result = simulateAddAccountSubmit({
    name: "Visa", selectedAccountBaseType: "debit",
    selectedAccountType: { id: "debit", label: "Debit Card", icon: "🏧" },
    selectedAccountBucket: "cash", color: "#3b82f6",
    typeFields: { last4: "0211", linkedBank: "" },
  });
  assert.equal(result.stored, undefined);
  assert.equal(result.error, "Debit account requires a linked bank");
});

test("Step 6 wiring: creating a debit account WITH a linked bank succeeds", () => {
  const result = simulateAddAccountSubmit({
    name: "Visa", selectedAccountBaseType: "debit",
    selectedAccountType: { id: "debit", label: "Debit Card", icon: "🏧" },
    selectedAccountBucket: "cash", color: "#3b82f6",
    typeFields: { last4: "0211", linkedBank: "bank1" },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.stored.type, "debit");
  assert.equal(result.stored.linkedBank, "bank1");
});

test("Step 6 wiring: creating an account under a classification with an unresolved (null) baseType is blocked, never becomes bank", () => {
  const result = simulateAddAccountSubmit({
    name: "My Crypto", selectedAccountBaseType: null,
    selectedAccountType: { id: "crypto_wallet", label: "Crypto Wallet", icon: "🪙" },
    selectedAccountBucket: "cash", color: "#a855f7",
  });
  assert.equal(result.stored, undefined);
  assert.equal(result.error, "This account type needs a behavior mapping before it can be used to create an account.");
});

test("Step 6 wiring: selecting a raw custom behavior directly (its own id, not one of the 5) is also blocked, not silently accepted", () => {
  // Simulates picking a top-level custom behavior chip (e.g. "Crypto" itself,
  // not a classification under it) — its baseType equals its own id, which
  // is truthy but still not one of the 5 valid Account behaviors.
  const result = simulateAddAccountSubmit({
    name: "My Crypto", selectedAccountBaseType: "crypto",
    selectedAccountType: { id: "crypto", label: "Crypto", icon: "🪙" },
    selectedAccountBucket: "cash", color: "#a855f7",
  });
  assert.equal(result.stored, undefined);
  assert.ok(result.error.includes("behavior mapping"));
});

test("Step 6 wiring: name required check still fires before the behavior check", () => {
  const result = simulateAddAccountSubmit({
    name: "   ", selectedAccountBaseType: "bank",
    selectedAccountType: { id: "bank", label: "Bank Account", icon: "🏦" },
    selectedAccountBucket: "cash", color: "#22c55e",
  });
  assert.equal(result.error, "Name required");
});

test("Step 6 wiring: attribution fields pass through correctly when set", () => {
  const result = simulateAddAccountSubmit({
    name: "Joint Account", selectedAccountBaseType: "bank",
    selectedAccountType: { id: "bank", label: "Bank Account", icon: "🏦" },
    selectedAccountBucket: "cash", color: "#22c55e",
    accAttributedTo: "person1", accAttributeType: "person",
    typeFields: { openingBalance: 0 },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.stored.attributedTo, "person1");
  assert.equal(result.stored.attributeType, "person");
});

test("Step 6 wiring: a successfully created account raises exactly one AccountCreated event (real creation, not hydration)", () => {
  // Direct check on Account.create() itself, confirming the command layer
  // uses the correct entry point (unlike accountFromStoredShape's hydration).
  const account = Account.create({ id: "x1", behavior: "cash", name: "Wallet", classificationId: "cash", classificationLabel: "Cash", icon: "💵", bucket: "cash" });
  const events = account.pullEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "AccountCreated");
});
