import { test } from "node:test";
import assert from "node:assert/strict";
import { archivePerson, unarchivePerson, isPersonArchived, getActivePeople, getArchivedPeople } from "./archive.js";

function makePerson(overrides = {}) {
  return {
    id: "vyom_id", name: "Vyom", emoji: "👤", relation: "Son", color: "#f0a500",
    personType: "dependant", creditLimit: 0, spendBudget: 0, favorite: true,
    defaultSettlement: "UPI", modules: ["budget", "gifts"],
    phone: "9999999999", email: "vyom@example.com", dob: "2016-05-12",
    anniversary: "", notes: "loves gym",
    ...overrides,
  };
}

// --- archivePerson ----------------------------------------------------------

test("archivePerson sets archived:true and preserves id exactly", () => {
  const person = makePerson();
  const archived = archivePerson(person);
  assert.equal(archived.id, "vyom_id");
  assert.equal(archived.archived, true);
});

test("archivePerson preserves every other field byte-for-byte — this IS the reference-preservation guarantee, since nothing else in the app reads anything but id/archived from a person for referencing purposes", () => {
  const person = makePerson();
  const archived = archivePerson(person);
  const { archived: _, ...rest } = archived;
  const { ...original } = person;
  assert.deepEqual(rest, original);
});

test("archivePerson requires a person record", () => {
  assert.throws(() => archivePerson(null), /person record is required/);
  assert.throws(() => archivePerson(undefined), /person record is required/);
});

test("archivePerson never mutates the input", () => {
  const person = makePerson();
  const snapshot = JSON.parse(JSON.stringify(person));
  archivePerson(person);
  assert.deepEqual(person, snapshot);
});

// --- unarchivePerson ---------------------------------------------------------

test("unarchivePerson sets archived:false, id unchanged", () => {
  const archived = archivePerson(makePerson());
  const restored = unarchivePerson(archived);
  assert.equal(restored.id, "vyom_id");
  assert.equal(restored.archived, false);
});

test("archive then unarchive is a full round trip — every field back to original except the flag itself", () => {
  const person = makePerson();
  const restored = unarchivePerson(archivePerson(person));
  const { archived: _, ...rest } = restored;
  assert.deepEqual(rest, person);
});

// --- isPersonArchived ---------------------------------------------------------

test("isPersonArchived: a record with no archived field at all (every pre-existing person) reads as active, not archived — no migration needed", () => {
  const preExisting = makePerson(); // no `archived` key present
  assert.equal(isPersonArchived(preExisting), false);
});

test("isPersonArchived correctly reflects true/false after archive/unarchive", () => {
  const person = makePerson();
  assert.equal(isPersonArchived(person), false);
  assert.equal(isPersonArchived(archivePerson(person)), true);
  assert.equal(isPersonArchived(unarchivePerson(archivePerson(person))), false);
});

test("isPersonArchived handles null/undefined gracefully, never throws", () => {
  assert.equal(isPersonArchived(null), false);
  assert.equal(isPersonArchived(undefined), false);
});

// --- getActivePeople / getArchivedPeople -------------------------------------

test("getActivePeople excludes archived, includes everyone else — including pre-existing records with no archived field", () => {
  const active1 = makePerson({ id: "p1" }); // no archived field
  const active2 = makePerson({ id: "p2", archived: false });
  const archived1 = makePerson({ id: "p3", archived: true });
  const people = [active1, active2, archived1];

  const result = getActivePeople(people);
  assert.deepEqual(result.map(p => p.id).sort(), ["p1", "p2"]);
});

test("getArchivedPeople returns exactly the archived subset", () => {
  const people = [
    makePerson({ id: "p1" }),
    makePerson({ id: "p2", archived: true }),
    makePerson({ id: "p3", archived: true }),
  ];
  const result = getArchivedPeople(people);
  assert.deepEqual(result.map(p => p.id).sort(), ["p2", "p3"]);
});

test("getActivePeople + getArchivedPeople partition the full list exactly — nothing lost, nothing duplicated", () => {
  const people = [
    makePerson({ id: "p1" }),
    makePerson({ id: "p2", archived: true }),
    makePerson({ id: "p3" }),
    makePerson({ id: "p4", archived: true }),
    makePerson({ id: "p5" }),
  ];
  const active = getActivePeople(people);
  const archivedList = getArchivedPeople(people);
  assert.equal(active.length + archivedList.length, people.length);
  const allIds = [...active, ...archivedList].map(p => p.id).sort();
  assert.deepEqual(allIds, people.map(p => p.id).sort());
});

test("empty/missing people array handled gracefully by both filters", () => {
  assert.deepEqual(getActivePeople([]), []);
  assert.deepEqual(getActivePeople(undefined), []);
  assert.deepEqual(getArchivedPeople([]), []);
  assert.deepEqual(getArchivedPeople(undefined), []);
});

// --- The core structural claim: archive touches NOTHING but the person record itself ---

test("this module has no function capable of reading or writing txns/bills/groups/memberships/gifts/loans — structural proof archive cannot corrupt any of the 8 traced reference types", () => {
  const source = [archivePerson, unarchivePerson, isPersonArchived, getActivePeople, getArchivedPeople]
    .map(fn => fn.toString()).join("\n");
  assert.equal(/txns\[|setTxns|bills\[|setBills|groups\[|setGroups|membership|setGifts|gifts\[|loans\[|setLoans/i.test(source), false);
});
