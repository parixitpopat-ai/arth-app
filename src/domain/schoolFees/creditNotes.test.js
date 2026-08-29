import { test } from "node:test";
import assert from "node:assert/strict";
import { createSchoolCreditNote, calculateAvailableCredit, applyCreditToPeriod } from "./creditNotes.js";
import { calculateOutstanding } from "./outstanding.js";

let counter = 0;
const genId = () => `note_${++counter}`;

function makePeriod(overrides = {}) {
  return {
    id: "p1", obligationAmount: 4500, startingStateDeclared: true, paidAmount: 4500, // locked example: already fully paid
    discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0,
    settlementLinks: [{ txnId: "txn1", amount: 4500 }], ...overrides,
  };
}

// --- createSchoolCreditNote ----------------------------------------------

test("creates a standalone credit note with no period dependency", () => {
  const note = createSchoolCreditNote("sched1", 300, "School credited late fee", genId);
  assert.equal(note.scheduleId, "sched1");
  assert.equal(note.amount, 300);
  assert.deepEqual(note.applications, []);
});

test("rejects a credit note with no reason", () => {
  assert.throws(() => createSchoolCreditNote("sched1", 300, "", genId), /reason is required/);
});

// --- calculateAvailableCredit ---------------------------------------------

test("locked example: available credit is the full amount before any application", () => {
  const note = createSchoolCreditNote("sched1", 300, "credit", genId);
  assert.equal(calculateAvailableCredit(note), 300);
});

// --- applyCreditToPeriod: the core provenance-separation guarantee -------

test("locked example: October already paid ₹4,500, later credit note ₹300 — historical payment untouched, credit exists as available balance", () => {
  const period = makePeriod(); // October: obligation 4,500, paid 4,500 already — 0 outstanding
  const paidAmountBefore = period.paidAmount;
  const settlementLinksBefore = JSON.parse(JSON.stringify(period.settlementLinks));

  const note = createSchoolCreditNote("sched1", 300, "School credited late fee", genId);
  assert.equal(calculateAvailableCredit(note), 300);

  // Historical record is untouched by merely creating the note.
  assert.equal(period.paidAmount, paidAmountBefore);
  assert.deepEqual(period.settlementLinks, settlementLinksBefore);

  // October itself has 0 outstanding (already fully paid) — the credit
  // cannot be applied back to it, only to a period that actually has an
  // outstanding balance. This matches decision #8's own framing: "Arth may
  // recommend applying the credit to a future fee" — not necessarily back
  // onto the period the credit originated from.
  assert.equal(calculateOutstanding(period), 0);
  assert.throws(
    () => applyCreditToPeriod(note, period, 300, calculateOutstanding),
    /exceeds the period's outstanding balance/
  );

  // It CAN be applied to a different period that has real outstanding —
  // e.g. a future fee period, per decision #8.
  const novemberPeriod = { id: "nov", obligationAmount: 4500, startingStateDeclared: true, paidAmount: 0, discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0, settlementLinks: [] };
  const { updatedNote, updatedPeriod } = applyCreditToPeriod(note, novemberPeriod, 300, calculateOutstanding);
  assert.equal(updatedPeriod.appliedCreditAmount, 300);
  assert.equal(calculateAvailableCredit(updatedNote), 0);
});

test("applying a credit never touches paidAmount or settlementLinks", () => {
  const period = { id: "p2", obligationAmount: 4500, startingStateDeclared: true, paidAmount: 0, discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0, settlementLinks: [] };
  const note = createSchoolCreditNote("sched1", 300, "credit", genId);
  const { updatedPeriod } = applyCreditToPeriod(note, period, 300, calculateOutstanding);
  assert.equal(updatedPeriod.paidAmount, 0); // untouched
  assert.deepEqual(updatedPeriod.settlementLinks, []); // untouched — no synthetic transaction
  assert.equal(updatedPeriod.appliedCreditAmount, 300); // tracked in its own field
});

test("applying a credit does not create a transaction — confirmed by the returned shape having no txnId anywhere", () => {
  const period = { id: "p2", obligationAmount: 4500, startingStateDeclared: true, paidAmount: 0, discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0, settlementLinks: [] };
  const note = createSchoolCreditNote("sched1", 300, "credit", genId);
  const { updatedNote, updatedPeriod } = applyCreditToPeriod(note, period, 300, calculateOutstanding);
  assert.equal(JSON.stringify(updatedNote).includes("txnId"), false);
  assert.equal(JSON.stringify(updatedPeriod).includes("txnId"), false);
});

test("reduces available credit after application, correctly, across multiple applications", () => {
  const note = createSchoolCreditNote("sched1", 300, "credit", genId);
  const periodA = { id: "pa", obligationAmount: 4500, startingStateDeclared: true, paidAmount: 0, discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0, settlementLinks: [] };
  const periodB = { id: "pb", obligationAmount: 4500, startingStateDeclared: true, paidAmount: 0, discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0, settlementLinks: [] };

  const first = applyCreditToPeriod(note, periodA, 100, calculateOutstanding);
  assert.equal(calculateAvailableCredit(first.updatedNote), 200);

  const second = applyCreditToPeriod(first.updatedNote, periodB, 150, calculateOutstanding);
  assert.equal(calculateAvailableCredit(second.updatedNote), 50);
});

test("rejects applying more than the note's available balance — does not cap", () => {
  const note = createSchoolCreditNote("sched1", 300, "credit", genId);
  const period = { id: "p2", obligationAmount: 4500, startingStateDeclared: true, paidAmount: 0, discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0, settlementLinks: [] };
  assert.throws(() => applyCreditToPeriod(note, period, 500, calculateOutstanding), /exceeds the credit note's available balance/);
});

test("rejects applying more than the period's outstanding balance — does not cap", () => {
  const note = createSchoolCreditNote("sched1", 10000, "big credit", genId);
  const period = { id: "p2", obligationAmount: 4500, startingStateDeclared: true, paidAmount: 4000, discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0, settlementLinks: [] }; // only 500 outstanding
  assert.throws(() => applyCreditToPeriod(note, period, 1000, calculateOutstanding), /exceeds the period's outstanding balance/);
});

test("never auto-applies — creating a note never touches any period", () => {
  const note = createSchoolCreditNote("sched1", 300, "credit", genId);
  assert.deepEqual(note.applications, []);
});

test("rejects applying credit to a period that hasn't been declared yet (WP-3 gate)", () => {
  const note = createSchoolCreditNote("sched1", 300, "credit", genId);
  const period = { id: "p2", obligationAmount: 4500, startingStateDeclared: false, paidAmount: 0, discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0, settlementLinks: [] };
  assert.throws(() => applyCreditToPeriod(note, period, 300, calculateOutstanding), /has not been declared yet/);
});

test("never mutates the input note or period", () => {
  const note = createSchoolCreditNote("sched1", 300, "credit", genId);
  const period = { id: "p2", obligationAmount: 4500, startingStateDeclared: true, paidAmount: 0, discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0, settlementLinks: [] };
  const noteSnapshot = JSON.parse(JSON.stringify(note));
  const periodSnapshot = JSON.parse(JSON.stringify(period));
  applyCreditToPeriod(note, period, 100, calculateOutstanding);
  assert.deepEqual(note, noteSnapshot);
  assert.deepEqual(period, periodSnapshot);
});
