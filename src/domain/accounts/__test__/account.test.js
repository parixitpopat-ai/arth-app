import test from "node:test";
import assert from "node:assert/strict";
import { Account, AccountValidationError, VALID_ACCOUNT_BEHAVIORS } from "../Account.js";

const baseParams = (overrides = {}) => ({
  id: "acc-1",
  behavior: "bank",
  name: "HDFC Savings",
  ...overrides,
});

// --- Constructor invariants ---

test("Account: rejects invalid behavior", () => {
  assert.throws(
    () => new Account(baseParams({ behavior: "not_a_real_behavior" })),
    AccountValidationError
  );
});

test("Account: accepts every behavior in the frozen enum", () => {
  for (const behavior of VALID_ACCOUNT_BEHAVIORS) {
    const extra = behavior === "debit" ? { linkedBank: "acc-bank-1" } : {};
    assert.doesNotThrow(() => new Account(baseParams({ behavior, ...extra })));
  }
});

// Per ADR-035: no silent default to "bank" for an unmapped/custom behavior.
// An invalid or unmapped behavior must be rejected, not coerced.
test("Account: does not silently default an unrecognized behavior to bank", () => {
  assert.throws(
    () => new Account(baseParams({ behavior: "crypto" })),
    AccountValidationError
  );
});

test("Account: requires a name", () => {
  assert.throws(() => new Account(baseParams({ name: "" })), AccountValidationError);
  assert.throws(() => new Account(baseParams({ name: "   " })), AccountValidationError);
  assert.throws(() => new Account(baseParams({ name: null })), AccountValidationError);
});

test("Account: trims name", () => {
  const acc = new Account(baseParams({ name: "  Padded  " }));
  assert.equal(acc.name, "Padded");
});

// Invariant (ACC-001 §2): debit behavior requires linkedBank.
// This is the exact gap ACC-000 found missing from EditAccountModal.
test("Account: debit behavior requires a linkedBank", () => {
  assert.throws(
    () => new Account(baseParams({ behavior: "debit", linkedBank: null })),
    AccountValidationError
  );
  assert.doesNotThrow(
    () => new Account(baseParams({ behavior: "debit", linkedBank: "acc-bank-1" }))
  );
});

test("Account: rejects invalid status", () => {
  assert.throws(
    () => new Account(baseParams({ status: "not_a_real_status" })),
    AccountValidationError
  );
});

test("Account: defaults to active status", () => {
  const acc = new Account(baseParams());
  assert.equal(acc.status, "active");
});

test("Account: clears attributeType when attributedTo is not set", () => {
  const acc = new Account(baseParams({ attributedTo: null, attributeType: "person" }));
  assert.equal(acc.attributeType, null);
});

// Per ADR-035: classification/presentation fields are open, no invariant
// weight — a custom classification (e.g. "Crypto") is valid as long as it
// declares a real, closed-enum behavior alongside it.
test("Account: stores open classification/presentation metadata, decoupled from behavior", () => {
  const acc = new Account(baseParams({
    behavior: "bank",
    classificationId: "crypto", classificationLabel: "Crypto Wallet", icon: "🪙", bucket: "cash-bank",
  }));
  assert.equal(acc.behavior, "bank");
  assert.equal(acc.classificationId, "crypto");
  assert.equal(acc.classificationLabel, "Crypto Wallet");
  assert.equal(acc.icon, "🪙");
  assert.equal(acc.bucket, "cash-bank");
});

// --- Behavior: create() ---

test("Account.create(): raises AccountCreated event", () => {
  const acc = Account.create(baseParams());
  const events = acc.pullEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "AccountCreated");
  assert.equal(events[0].accountId, "acc-1");
  assert.equal(events[0].behavior, "bank");
});

test("Account.create(): pullEvents() drains the queue", () => {
  const acc = Account.create(baseParams());
  acc.pullEvents();
  assert.equal(acc.pullEvents().length, 0);
});

// --- Behavior: update() ---

test("Account.update(): raises AccountUpdated event with changes", () => {
  const acc = Account.create(baseParams());
  acc.pullEvents();
  acc.update({ name: "New Name" });
  const events = acc.pullEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "AccountUpdated");
  assert.deepEqual(events[0].changes, { name: "New Name" });
  assert.equal(acc.name, "New Name");
});

test("Account.update(): re-validates name on update", () => {
  const acc = Account.create(baseParams());
  assert.throws(() => acc.update({ name: "" }), AccountValidationError);
});

test("Account.update(): re-validates behavior on update", () => {
  const acc = Account.create(baseParams());
  assert.throws(() => acc.update({ behavior: "not_a_real_behavior" }), AccountValidationError);
});

// This is the exact rule ACR-001 exists to consolidate — one validation path
// for both create and update, instead of the two independently-shaped
// implementations ACC-000 found in AddAccountModal/EditAccountModal.
test("Account.update(): re-validates debit->linkedBank invariant", () => {
  const acc = Account.create(baseParams({ behavior: "debit", linkedBank: "acc-bank-1" }));
  assert.throws(() => acc.update({ linkedBank: null }), AccountValidationError);
  assert.doesNotThrow(() => acc.update({ linkedBank: "acc-bank-2" }));
});

test("Account.update(): cannot update a deleted account", () => {
  const acc = Account.create(baseParams());
  acc.markDeleted();
  assert.throws(() => acc.update({ name: "New Name" }), AccountValidationError);
});

// --- Behavior: archive() / unarchive() ---

test("Account.archive(): raises AccountArchived and sets status", () => {
  const acc = Account.create(baseParams());
  acc.pullEvents();
  acc.archive();
  assert.equal(acc.status, "archived");
  const events = acc.pullEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "AccountArchived");
});

test("Account.archive(): cannot double-archive", () => {
  const acc = Account.create(baseParams());
  acc.archive();
  assert.throws(() => acc.archive(), AccountValidationError);
});

test("Account.unarchive(): restores active status", () => {
  const acc = Account.create(baseParams());
  acc.archive();
  acc.pullEvents();
  acc.unarchive();
  assert.equal(acc.status, "active");
  const events = acc.pullEvents();
  assert.equal(events[0].type, "AccountUnarchived");
});

test("Account.unarchive(): cannot unarchive an already-active account", () => {
  const acc = Account.create(baseParams());
  assert.throws(() => acc.unarchive(), AccountValidationError);
});

test("Account.archive(): cannot archive a deleted account", () => {
  const acc = Account.create(baseParams());
  acc.markDeleted();
  assert.throws(() => acc.archive(), AccountValidationError);
});

// --- Behavior: markDeleted() ---
// Per ACC-001 §4: this method assumes the caller (AccountDeletionService,
// WP-06) has already resolved every reference. It does not and cannot
// verify reference-freedom itself — that's a cross-aggregate concern.

test("Account.markDeleted(): raises AccountDeleted event", () => {
  const acc = Account.create(baseParams());
  acc.pullEvents();
  acc.markDeleted();
  const events = acc.pullEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "AccountDeleted");
});

test("Account.markDeleted(): cannot double-delete", () => {
  const acc = Account.create(baseParams());
  acc.markDeleted();
  assert.throws(() => acc.markDeleted(), AccountValidationError);
});
