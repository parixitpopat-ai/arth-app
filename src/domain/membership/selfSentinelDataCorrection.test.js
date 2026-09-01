import { test } from "node:test";
import assert from "node:assert/strict";
import { correctSelfSentinel } from "./relationship.js";

// WP-5: one-time data-correction pass for legacy production records.
// Deliberately reuses correctSelfSentinel AS-IS (no new function, no new
// sentinel rule) — these tests prove it works correctly against the real
// shapes of BOTH arrays it needs to run against, not just the abstract
// relationship shape its original WP-A1 tests covered.

function makeMembershipPaymentRecord(overrides = {}) {
  // The real memberships[] payment-record shape, confirmed by trace
  // (App.jsx ~L14847-14863): far more fields than a relationship record has.
  return {
    id: "mem_1",
    billerAccountId: "ba1",
    personId: "self",
    membershipRelationshipId: "rel_1",
    amount: 1500,
    accId: "acc1",
    catId: "cat_fitness",
    periods: [{ id: "p1", label: "Monthly", from: "2026-08-01", to: "2026-08-31", amount: 1500, graceDays: 0 }],
    note: "Gym membership",
    linkedTxnId: "txn1",
    paidDate: "2026-08-01",
    createdAt: 1234567890,
    ...overrides,
  };
}

function makeRelationshipRecord(overrides = {}) {
  return {
    id: "rel_1", billerAccountId: "ba1", personId: "self", status: "active",
    statusHistory: [{ status: "active", effectiveDate: "2026-08-01", timestamp: 1 }],
    createdAt: 1234567890,
    ...overrides,
  };
}

// --- 1. "self" -> canonical self ID, for the REAL memberships[] shape ----

test("WP-5: a memberships[] payment record with personId:'self' is corrected to '__me__'", () => {
  const record = makeMembershipPaymentRecord();
  const [corrected] = correctSelfSentinel([record]);
  assert.equal(corrected.personId, "__me__");
});

test("WP-5: every other field on the memberships[] record survives byte-for-byte — amount, dates, biller/account links, transaction links, status/lifecycle all untouched", () => {
  const record = makeMembershipPaymentRecord();
  const [corrected] = correctSelfSentinel([record]);
  assert.equal(corrected.id, record.id);
  assert.equal(corrected.billerAccountId, record.billerAccountId);
  assert.equal(corrected.membershipRelationshipId, record.membershipRelationshipId);
  assert.equal(corrected.amount, record.amount);
  assert.equal(corrected.accId, record.accId);
  assert.equal(corrected.catId, record.catId);
  assert.deepEqual(corrected.periods, record.periods);
  assert.equal(corrected.note, record.note);
  assert.equal(corrected.linkedTxnId, record.linkedTxnId);
  assert.equal(corrected.paidDate, record.paidDate);
  assert.equal(corrected.createdAt, record.createdAt);
});

test("WP-5: a relationship record with personId:'self' is corrected to '__me__', full statusHistory/lifecycle preserved", () => {
  const record = makeRelationshipRecord();
  const [corrected] = correctSelfSentinel([record]);
  assert.equal(corrected.personId, "__me__");
  assert.equal(corrected.status, record.status);
  assert.deepEqual(corrected.statusHistory, record.statusHistory);
  assert.equal(corrected.createdAt, record.createdAt);
});

// --- 2. existing canonical self ID remains unchanged ----------------------

test("WP-5: a record already carrying the canonical '__me__' is left completely untouched (same reference)", () => {
  const already = makeMembershipPaymentRecord({ personId: "__me__" });
  const [result] = correctSelfSentinel([already]);
  assert.equal(result, already); // exact same object reference, not even a new copy
});

// --- 3. unrelated person IDs remain unchanged ------------------------------

test("WP-5: records for real (non-self) people are never touched, in either array shape", () => {
  const vyomMembership = makeMembershipPaymentRecord({ id: "mem_2", personId: "vyom_id" });
  const vyomRelationship = makeRelationshipRecord({ id: "rel_2", personId: "vyom_id" });
  const [correctedMembership] = correctSelfSentinel([vyomMembership]);
  const [correctedRelationship] = correctSelfSentinel([vyomRelationship]);
  assert.equal(correctedMembership, vyomMembership);
  assert.equal(correctedRelationship, vyomRelationship);
});

test("WP-5: a mixed batch corrects only the tainted records, leaves every other record — self, real-person, already-correct — untouched", () => {
  const tainted = makeMembershipPaymentRecord({ id: "mem_1", personId: "self" });
  const alreadyCorrect = makeMembershipPaymentRecord({ id: "mem_2", personId: "__me__" });
  const realPerson = makeMembershipPaymentRecord({ id: "mem_3", personId: "vyom_id" });
  const batch = [tainted, alreadyCorrect, realPerson];
  const result = correctSelfSentinel(batch);

  assert.equal(result[0].personId, "__me__"); // corrected
  assert.equal(result[1], alreadyCorrect);    // untouched, same reference
  assert.equal(result[2], realPerson);        // untouched, same reference
});

// --- 4. idempotent — second execution makes no further changes ------------

test("WP-5: running the correction twice on the same data produces byte-identical results the second time — genuinely idempotent, not just non-crashing", () => {
  const records = [
    makeMembershipPaymentRecord({ id: "mem_1", personId: "self" }),
    makeRelationshipRecord({ id: "rel_1", personId: "self" }),
    makeMembershipPaymentRecord({ id: "mem_2", personId: "vyom_id" }),
  ];
  const firstPass = correctSelfSentinel(records);
  const secondPass = correctSelfSentinel(firstPass);
  assert.deepEqual(firstPass, secondPass);
  // Stronger than deepEqual: confirm the second pass didn't even create new
  // object references for anything — a true no-op on already-correct data.
  assert.equal(secondPass[0], firstPass[0]);
  assert.equal(secondPass[1], firstPass[1]);
  assert.equal(secondPass[2], firstPass[2]);
});

test("WP-5: idempotency holds across both arrays independently — correcting memberships[] doesn't need membershipRelationships[] to also change, and vice versa", () => {
  const memberships = [makeMembershipPaymentRecord({ personId: "self" })];
  const relationships = [makeRelationshipRecord({ personId: "vyom_id" })]; // already fine

  const correctedMemberships1 = correctSelfSentinel(memberships);
  const correctedRelationships1 = correctSelfSentinel(relationships);
  const correctedMemberships2 = correctSelfSentinel(correctedMemberships1);
  const correctedRelationships2 = correctSelfSentinel(correctedRelationships1);

  assert.equal(correctedMemberships1[0].personId, "__me__");
  assert.deepEqual(correctedMemberships1, correctedMemberships2);
  assert.equal(correctedRelationships1[0], relationships[0]); // untouched from the start
  assert.deepEqual(correctedRelationships1, correctedRelationships2);
});

// --- No duplicate records created ------------------------------------------

test("WP-5: the correction never adds or removes records — output length always equals input length", () => {
  const records = [
    makeMembershipPaymentRecord({ id: "mem_1", personId: "self" }),
    makeMembershipPaymentRecord({ id: "mem_2", personId: "__me__" }),
    makeMembershipPaymentRecord({ id: "mem_3", personId: "vyom_id" }),
  ];
  const result = correctSelfSentinel(records);
  assert.equal(result.length, records.length);
  assert.deepEqual(result.map(r => r.id), records.map(r => r.id));
});
