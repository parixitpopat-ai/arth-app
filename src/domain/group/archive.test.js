import { test } from "node:test";
import assert from "node:assert/strict";
import { archiveGroup, unarchiveGroup, isGroupArchived, getActiveGroups, getArchivedGroups } from "./archive.js";

function makeGroup(overrides = {}) {
  return {
    id: "goa_trip_id", type: "Trip", typeId: "trip", name: "Goa Trip",
    icon: "🏖️", color: "#06b6d4", members: ["p1", "p2"], includeMe: true,
    manualLimit: 0, defaultIntent: "split", modules: ["settlement"],
    ...overrides,
  };
}

// --- archiveGroup ------------------------------------------------------------

test("archiveGroup sets archived:true and preserves id exactly", () => {
  const group = makeGroup();
  const archived = archiveGroup(group);
  assert.equal(archived.id, "goa_trip_id");
  assert.equal(archived.archived, true);
});

test("archiveGroup preserves every other field byte-for-byte, including members[]", () => {
  const group = makeGroup();
  const archived = archiveGroup(group);
  const { archived: _, ...rest } = archived;
  const { ...original } = group;
  assert.deepEqual(rest, original);
});

test("archiveGroup requires a group record", () => {
  assert.throws(() => archiveGroup(null), /group record is required/);
  assert.throws(() => archiveGroup(undefined), /group record is required/);
});

test("archiveGroup never mutates the input", () => {
  const group = makeGroup();
  const snapshot = JSON.parse(JSON.stringify(group));
  archiveGroup(group);
  assert.deepEqual(group, snapshot);
});

// --- unarchiveGroup ------------------------------------------------------------

test("unarchiveGroup sets archived:false, id unchanged", () => {
  const archived = archiveGroup(makeGroup());
  const restored = unarchiveGroup(archived);
  assert.equal(restored.id, "goa_trip_id");
  assert.equal(restored.archived, false);
});

test("archive then unarchive is a full round trip — every field back to original except the flag itself", () => {
  const group = makeGroup();
  const restored = unarchiveGroup(archiveGroup(group));
  const { archived: _, ...rest } = restored;
  assert.deepEqual(rest, group);
});

// --- isGroupArchived ------------------------------------------------------------

test("isGroupArchived: a record with no archived field at all (every pre-existing group) reads as active, not archived — no migration needed", () => {
  const preExisting = makeGroup(); // no `archived` key present
  assert.equal(isGroupArchived(preExisting), false);
});

test("isGroupArchived correctly reflects true/false after archive/unarchive", () => {
  const group = makeGroup();
  assert.equal(isGroupArchived(group), false);
  assert.equal(isGroupArchived(archiveGroup(group)), true);
  assert.equal(isGroupArchived(unarchiveGroup(archiveGroup(group))), false);
});

test("isGroupArchived handles null/undefined gracefully, never throws", () => {
  assert.equal(isGroupArchived(null), false);
  assert.equal(isGroupArchived(undefined), false);
});

// --- getActiveGroups / getArchivedGroups -------------------------------------

test("getActiveGroups excludes archived, includes everyone else — including pre-existing records with no archived field", () => {
  const active1 = makeGroup({ id: "g1" }); // no archived field
  const active2 = makeGroup({ id: "g2", archived: false });
  const archived1 = makeGroup({ id: "g3", archived: true });
  const groups = [active1, active2, archived1];

  const result = getActiveGroups(groups);
  assert.deepEqual(result.map(g => g.id).sort(), ["g1", "g2"]);
});

test("getArchivedGroups returns exactly the archived subset", () => {
  const groups = [
    makeGroup({ id: "g1" }),
    makeGroup({ id: "g2", archived: true }),
    makeGroup({ id: "g3", archived: true }),
  ];
  const result = getArchivedGroups(groups);
  assert.deepEqual(result.map(g => g.id).sort(), ["g2", "g3"]);
});

test("getActiveGroups + getArchivedGroups partition the full list exactly — nothing lost, nothing duplicated", () => {
  const groups = [
    makeGroup({ id: "g1" }),
    makeGroup({ id: "g2", archived: true }),
    makeGroup({ id: "g3" }),
    makeGroup({ id: "g4", archived: true }),
    makeGroup({ id: "g5" }),
  ];
  const active = getActiveGroups(groups);
  const archivedList = getArchivedGroups(groups);
  assert.equal(active.length + archivedList.length, groups.length);
  const allIds = [...active, ...archivedList].map(g => g.id).sort();
  assert.deepEqual(allIds, groups.map(g => g.id).sort());
});

test("empty/missing groups array handled gracefully by both filters", () => {
  assert.deepEqual(getActiveGroups([]), []);
  assert.deepEqual(getActiveGroups(undefined), []);
  assert.deepEqual(getArchivedGroups([]), []);
  assert.deepEqual(getArchivedGroups(undefined), []);
});

// --- The core structural claim: archive touches NOTHING but the group record itself ---

test("this module has no function capable of reading or writing txns/bills/people — structural proof archive cannot corrupt either reference type", () => {
  const source = [archiveGroup, unarchiveGroup, isGroupArchived, getActiveGroups, getArchivedGroups]
    .map(fn => fn.toString()).join("\n");
  assert.equal(/txns\[|setTxns|bills\[|setBills|people\[|setPeople/i.test(source), false);
});

// --- PGRP-001 WP1 follow-up — picker-exclusion regression, encoded against the domain layer ---
//
// These four tests exist to make the picker-exclusion contract explicit and
// checkable, even though the actual JSX wiring at the ~10 App.jsx picker call
// sites (each now calling getActiveGroups(groups) instead of bare groups) is
// not itself covered by an automated test — this repo has no React/DOM test
// harness, and extracting 10 different inline picker lists into named,
// independently-testable functions would be a structural change beyond WP1's
// scope. What IS proven here, at the domain layer every picker now depends
// on: getActiveGroups is the single, correctly-tested source of truth every
// picker was pointed at, and archiving is structurally incapable of altering
// any existing groupId reference.

test("REGRESSION: an archived group is absent from getActiveGroups — the exact function every new-record picker now filters through", () => {
  const active = makeGroup({ id: "g_active" });
  const archived = makeGroup({ id: "g_archived", archived: true });
  const result = getActiveGroups([active, archived]);
  assert.deepEqual(result.map(g => g.id), ["g_active"]);
});

test("REGRESSION: archiving a group cannot rewrite any historical groupId — archiveGroup only ever returns {...group, archived:true}, id included, byte-identical otherwise", () => {
  const group = makeGroup({ id: "g_1" });
  const archived = archiveGroup(group);
  assert.equal(archived.id, group.id); // id (what txns/bills reference) is untouched
  const { archived: _, ...rest } = archived;
  assert.deepEqual(rest, group); // every other field, including nothing txn/bill-shaped, untouched
});

test("REGRESSION: an archived group remains resolvable by id for historical display — getActiveGroups excludes it from selection, but the record itself still exists in the array for getGroup(id)-style lookups", () => {
  const archived = makeGroup({ id: "g_archived", archived: true });
  const groups = [archived];
  // Simulates App.jsx's getGroup(id): groups.find(g=>g.id===id) — unfiltered,
  // used for historical resolution, never routed through getActiveGroups.
  const resolved = groups.find(g => g.id === "g_archived");
  assert.equal(resolved.name, "Goa Trip");
  assert.equal(resolved.archived, true);
  // But it is correctly absent from the active-selection subset:
  assert.deepEqual(getActiveGroups(groups), []);
});

test("REGRESSION: getArchivedGroups + getActiveGroups partition cleanly even for a group that was just archived this session — no id is ever silently dropped from the underlying array", () => {
  const groups = [
    makeGroup({ id: "g1" }),
    archiveGroup(makeGroup({ id: "g2" })),
  ];
  assert.equal(groups.length, 2); // archiving never removes an entry from groups[]
  assert.deepEqual(getActiveGroups(groups).map(g => g.id), ["g1"]);
  assert.deepEqual(getArchivedGroups(groups).map(g => g.id), ["g2"]);
});
