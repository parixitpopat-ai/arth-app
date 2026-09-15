import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MEANINGFUL_ARRAY_KEYS,
  hasMeaningfulData,
  isMasterUserSetupComplete,
  FIRST_AUTH_ACTIONS,
  determineFirstAuthAction,
  summarizeMeaningfulData,
  mergeMasterUserProfileFields,
} from "./masterUserSetup.js";

// --- hasMeaningfulData ------------------------------------------------

test("hasMeaningfulData: false for null/undefined/non-object", () => {
  assert.equal(hasMeaningfulData(null), false);
  assert.equal(hasMeaningfulData(undefined), false);
  assert.equal(hasMeaningfulData("not an object"), false);
});

test("hasMeaningfulData: false when all meaningful arrays are empty", () => {
  const state = { txns: [], investments: [], bills: [], loans: [], memberships: [], feePayments: [], gifts: [], goals: [] };
  assert.equal(hasMeaningfulData(state), false);
});

test("hasMeaningfulData: true when any one meaningful array is non-empty", () => {
  for (const key of MEANINGFUL_ARRAY_KEYS) {
    const state = { txns: [], investments: [], bills: [], loans: [], memberships: [], feePayments: [], gifts: [], goals: [] };
    state[key] = [{ id: "x" }];
    assert.equal(hasMeaningfulData(state), true, `expected true when ${key} is non-empty`);
  }
});

test("hasMeaningfulData: a fresh install's seeded accounts/cats do NOT count as meaningful", () => {
  // Mirrors DEFAULT_ACCOUNTS (4 accounts) / DEFAULT_CATS (full category list)
  // seeded on every fresh install per appConstants.js — confirmed by trace.
  const freshInstall = {
    accounts: [{ id: "bank1" }, { id: "cc1" }, { id: "upi1" }, { id: "cash1" }],
    cats: [{ id: "housing" }, { id: "utilities" }],
    measureUnits: ["kg", "g"],
    wealthSnapshots: [{ date: "2026-09-01" }, { date: "2026-09-02" }],
    txns: [], investments: [], bills: [], loans: [], memberships: [], feePayments: [], gifts: [], goals: [],
  };
  assert.equal(hasMeaningfulData(freshInstall), false);
});

test("hasMeaningfulData: ignores keys not in MEANINGFUL_ARRAY_KEYS entirely", () => {
  const state = { people: [{ id: "__me__" }], accounts: [{ id: "a" }] };
  assert.equal(hasMeaningfulData(state), false);
});

// --- isMasterUserSetupComplete -----------------------------------------

test("isMasterUserSetupComplete: false when flag absent, null snapshot, or falsy", () => {
  assert.equal(isMasterUserSetupComplete(undefined), false);
  assert.equal(isMasterUserSetupComplete({}), false);
  assert.equal(isMasterUserSetupComplete({ masterUserSetupComplete: false }), false);
});

test("isMasterUserSetupComplete: true only when explicit flag is true", () => {
  assert.equal(isMasterUserSetupComplete({ masterUserSetupComplete: true }), true);
});

test("isMasterUserSetupComplete: does NOT infer from name/emoji looking default", () => {
  // Regression guard for the exact live-account shape found during trace:
  // {name:"Me", emoji:"👤"} — not even byte-identical to the hardcoded ME
  // default (emoji "🧑"), yet never genuinely set up. Must not be inferred
  // true or false from these fields at all.
  const liveAccountShape = { people: [{ id: "__me__", name: "Me", emoji: "👤", relation: "Self", isMe: true }] };
  assert.equal(isMasterUserSetupComplete(liveAccountShape), false);
  const evenIfNameLooksReal = { people: [{ id: "__me__", name: "Priya Sharma" }] };
  assert.equal(isMasterUserSetupComplete(evenIfNameLooksReal), false);
});

// --- determineFirstAuthAction — one test per matrix row ----------------

test("matrix row 1: local empty, cloud empty/no row, online -> SETUP", () => {
  const action = determineFirstAuthAction({ networkOk: true, cloudRowExists: false, cloudMeaningful: false, localMeaningful: false });
  assert.equal(action, FIRST_AUTH_ACTIONS.SETUP);
});

test("matrix row 1b: local empty, cloud row exists but empty, online -> SETUP", () => {
  const action = determineFirstAuthAction({ networkOk: true, cloudRowExists: true, cloudMeaningful: false, localMeaningful: false });
  assert.equal(action, FIRST_AUTH_ACTIONS.SETUP);
});

test("matrix row 2: local meaningful, cloud empty/new, online -> PUSH_LOCAL_THEN_SETUP", () => {
  const action = determineFirstAuthAction({ networkOk: true, cloudRowExists: false, cloudMeaningful: false, localMeaningful: true });
  assert.equal(action, FIRST_AUTH_ACTIONS.PUSH_LOCAL_THEN_SETUP);
});

test("matrix row 3: local meaningful, cloud meaningful, online -> CONFLICT", () => {
  const action = determineFirstAuthAction({ networkOk: true, cloudRowExists: true, cloudMeaningful: true, localMeaningful: true });
  assert.equal(action, FIRST_AUTH_ACTIONS.CONFLICT);
});

test("matrix row 4: local empty, cloud meaningful, online -> PULL_CLOUD_THEN_CHECK", () => {
  const action = determineFirstAuthAction({ networkOk: true, cloudRowExists: true, cloudMeaningful: true, localMeaningful: false });
  assert.equal(action, FIRST_AUTH_ACTIONS.PULL_CLOUD_THEN_CHECK);
});

test("matrix row 5: network fails -> BLOCKED_OFFLINE regardless of other fields", () => {
  assert.equal(determineFirstAuthAction({ networkOk: false, cloudRowExists: true, cloudMeaningful: true, localMeaningful: true }), FIRST_AUTH_ACTIONS.BLOCKED_OFFLINE);
  assert.equal(determineFirstAuthAction({ networkOk: false, cloudRowExists: false, cloudMeaningful: false, localMeaningful: false }), FIRST_AUTH_ACTIONS.BLOCKED_OFFLINE);
});

test("cloudRowExists=true but cloudMeaningful=false behaves as no-cloud-data (not a false conflict)", () => {
  // A cloud row can exist with all-empty arrays (e.g. an account that
  // signed up once and never entered anything). Must not be treated as
  // "cloud has data" just because a row exists.
  const action = determineFirstAuthAction({ networkOk: true, cloudRowExists: true, cloudMeaningful: false, localMeaningful: true });
  assert.equal(action, FIRST_AUTH_ACTIONS.PUSH_LOCAL_THEN_SETUP);
});

// --- summarizeMeaningfulData --------------------------------------------

test("summarizeMeaningfulData: returns a count per key, 0 for missing/non-array", () => {
  const summary = summarizeMeaningfulData({ txns: [1, 2, 3], investments: null, bills: [] });
  assert.equal(summary.txns, 3);
  assert.equal(summary.investments, 0);
  assert.equal(summary.bills, 0);
  assert.equal(summary.loans, 0);
  assert.deepEqual(Object.keys(summary).sort(), [...MEANINGFUL_ARRAY_KEYS].sort());
});

// --- mergeMasterUserProfileFields ---------------------------------------

test("mergeMasterUserProfileFields: only touches name/emoji/phone/dob", () => {
  const existing = {
    id: "__me__", isMe: true, name: "Me", emoji: "👤", relation: "Self",
    personType: "dependant", creditLimit: 0, spendBudget: 500, favorite: false,
    phone: "", email: "old@example.com", dob: "", anniversary: "2020-01-01",
    notes: "some note", modules: ["budget"], color: "#f0a500",
  };
  const next = mergeMasterUserProfileFields(existing, { name: "Priya Sharma", emoji: "🙋‍♀️", phone: "9999999999", dob: "1990-05-01" });

  assert.equal(next.name, "Priya Sharma");
  assert.equal(next.emoji, "🙋‍♀️");
  assert.equal(next.phone, "9999999999");
  assert.equal(next.dob, "1990-05-01");

  // Everything else must survive untouched — this is the whole point of a
  // partial merge instead of EditPersonModal's full-overwrite save().
  assert.equal(next.relation, "Self");
  assert.equal(next.personType, "dependant");
  assert.equal(next.creditLimit, 0);
  assert.equal(next.spendBudget, 500);
  assert.equal(next.favorite, false);
  assert.equal(next.email, "old@example.com"); // profile email untouched by this screen
  assert.equal(next.anniversary, "2020-01-01");
  assert.equal(next.notes, "some note");
  assert.deepEqual(next.modules, ["budget"]);
  assert.equal(next.color, "#f0a500");
  assert.equal(next.id, "__me__");
  assert.equal(next.isMe, true);
});

test("mergeMasterUserProfileFields: partial fields object only overwrites what's provided", () => {
  const existing = { id: "__me__", name: "Me", emoji: "👤", phone: "123", dob: "" };
  const next = mergeMasterUserProfileFields(existing, { name: "New Name" });
  assert.equal(next.name, "New Name");
  assert.equal(next.emoji, "👤"); // untouched — not present in fields arg
  assert.equal(next.phone, "123");
});

test("mergeMasterUserProfileFields: does not mutate the original record", () => {
  const existing = { id: "__me__", name: "Me" };
  const frozen = Object.freeze({ ...existing });
  assert.doesNotThrow(() => mergeMasterUserProfileFields(frozen, { name: "New Name" }));
});
