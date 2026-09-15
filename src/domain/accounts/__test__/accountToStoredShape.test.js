import test from "node:test";
import assert from "node:assert/strict";
import { Account } from "../Account.js";
import { accountToStoredShape } from "../accountToStoredShape.js";
import { accountFromStoredShape } from "../accountFromStoredShape.js";

// --- Field mapping correctness: all 5 behaviors ---

test("toStoredShape: bank account -> legacy shape (type, accountTypeId, typeLabel, typeIcon, typeBucket)", () => {
  const account = new Account({ id: "b1", behavior: "bank", name: "HDFC Savings", color: "#22c55e", last4: "3310", classificationId: "bank", classificationLabel: "Bank Account", icon: "🏦", bucket: "cash", openingBalance: 5000, openingBalanceDate: "2026-04-01" });
  const stored = accountToStoredShape(account);
  assert.equal(stored.id, "b1");
  assert.equal(stored.type, "bank");
  assert.equal(stored.name, "HDFC Savings");
  assert.equal(stored.accountTypeId, "bank");
  assert.equal(stored.typeLabel, "Bank Account");
  assert.equal(stored.typeIcon, "🏦");
  assert.equal(stored.typeBucket, "cash");
  assert.equal(stored.openingBalance, 5000);
});

test("toStoredShape: cc account -> cc-specific fields preserved", () => {
  const account = new Account({ id: "cc1", behavior: "cc", name: "Sapphire", classificationId: "cc", classificationLabel: "Credit Card", icon: "💳", bucket: "liability", limit: 300000, outstanding: 12000, statementDate: 15, dueDate: 5, alertPct: 30, billingCycle: "15th–14th" });
  const stored = accountToStoredShape(account);
  assert.equal(stored.type, "cc");
  assert.equal(stored.limit, 300000);
  assert.equal(stored.outstanding, 12000);
  assert.equal(stored.billingCycle, "15th–14th");
});

test("toStoredShape: debit account -> linkedBank preserved", () => {
  const account = new Account({ id: "d1", behavior: "debit", name: "Visa", classificationId: "debit", classificationLabel: "Debit Card", linkedBank: "b1", last4: "0211" });
  const stored = accountToStoredShape(account);
  assert.equal(stored.type, "debit");
  assert.equal(stored.linkedBank, "b1");
});

test("toStoredShape: upi account -> handle and linkedAccount preserved as-is (no UPI model change)", () => {
  const account = new Account({ id: "u1", behavior: "upi", name: "GPay", classificationId: "upi", classificationLabel: "UPI", handle: "9309848069@upi", linkedAccount: "b1" });
  const stored = accountToStoredShape(account);
  assert.equal(stored.type, "upi");
  assert.equal(stored.handle, "9309848069@upi");
  assert.equal(stored.linkedAccount, "b1");
});

test("toStoredShape: cash account -> behavior=cash", () => {
  const account = new Account({ id: "c1", behavior: "cash", name: "Wallet", classificationId: "cash", classificationLabel: "Cash", openingBalance: 2000 });
  const stored = accountToStoredShape(account);
  assert.equal(stored.type, "cash");
  assert.equal(stored.openingBalance, 2000);
});

// --- No leakage of ADR-035-named fields or internal aggregate bookkeeping ---

test("toStoredShape: does not leak the ADR-035-named fields (behavior/classificationId/classificationLabel) into the stored object", () => {
  const account = new Account({ id: "b2", behavior: "bank", name: "ICICI", classificationId: "bank", classificationLabel: "Bank Account", icon: "🏦", bucket: "cash" });
  const stored = accountToStoredShape(account);
  assert.equal(Object.prototype.hasOwnProperty.call(stored, "behavior"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(stored, "classificationId"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(stored, "classificationLabel"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(stored, "icon"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(stored, "bucket"), false);
});

test("toStoredShape: does not leak internal aggregate bookkeeping (_deleted, _pendingEvents)", () => {
  const account = new Account({ id: "b3", behavior: "bank", name: "ICICI" });
  const stored = accountToStoredShape(account);
  assert.equal(Object.prototype.hasOwnProperty.call(stored, "_deleted"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(stored, "_pendingEvents"), false);
});

// --- Round-trip equivalence: accountFromStoredShape() -> accountToStoredShape() reproduces the original ---

test("round-trip: hydrating a stored bank account and converting back reproduces the original record", () => {
  const original = { id: "rt1", type: "bank", name: "HDFC 6819", color: "#06b6d4", last4: "6819", accountTypeId: "bank", typeLabel: "Bank Account", typeIcon: "🏦", typeBucket: "cash", openingBalance: 411017.95, openingBalanceDate: "2026-04-01", needsCalibration: false, attributedTo: null, attributeType: null, excludeFromWealth: false, status: "active", limit: 0, outstanding: 0, statementDate: 15, dueDate: 5, alertPct: 30, billingCycle: null, linkedBank: null, handle: null, linkedAccount: null };
  const hydrated = accountFromStoredShape(original);
  assert.equal(hydrated.status, "hydrated");
  const roundTripped = accountToStoredShape(hydrated.account);
  assert.deepEqual(roundTripped, original);
});

test("round-trip: hydrating a stored UPI account (linked, no wallet model change) and converting back reproduces the original", () => {
  const original = { id: "rt2", type: "upi", name: "BHIM UPI", color: "#3b82f6", last4: null, accountTypeId: "upi", typeLabel: "UPI", typeIcon: "📱", typeBucket: "cash", handle: "9309848069@UPI", linkedAccount: "srvod5z", openingBalance: 0, openingBalanceDate: null, needsCalibration: false, attributedTo: null, attributeType: null, excludeFromWealth: false, status: "active", limit: 0, outstanding: 0, statementDate: 15, dueDate: 5, alertPct: 30, billingCycle: null, linkedBank: null };
  const hydrated = accountFromStoredShape(original);
  assert.equal(hydrated.status, "hydrated");
  const roundTripped = accountToStoredShape(hydrated.account);
  assert.deepEqual(roundTripped, original);
});

test("round-trip: a no-op update() in between still reproduces an equivalent stored record", () => {
  const original = { id: "rt3", type: "cc", name: "Sapphire", color: "#3b82f6", last4: "4242", accountTypeId: "cc", typeLabel: "Credit Card", typeIcon: "💳", typeBucket: "liability", limit: 300000, outstanding: 0, statementDate: 15, dueDate: 5, alertPct: 30, billingCycle: "15th–14th", openingBalance: 0, openingBalanceDate: null, needsCalibration: false, linkedBank: null, handle: null, linkedAccount: null, attributedTo: null, attributeType: null, excludeFromWealth: false, status: "active" };
  const hydrated = accountFromStoredShape(original);
  assert.equal(hydrated.status, "hydrated");
  hydrated.account.update({});
  const roundTripped = accountToStoredShape(hydrated.account);
  assert.deepEqual(roundTripped, original);
});
