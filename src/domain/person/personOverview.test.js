import { test } from "node:test";
import assert from "node:assert/strict";
import { getPersonSpendingSummary, getPersonActiveConnections } from "./personOverview.js";

// --- getPersonSpendingSummary ---------------------------------------------

// Mirrors the REAL App.jsx getCat(id) shape and fallback exactly (~L1216):
// {name,color,icon,subs}, with {name:"?",color:"#888",icon:"❓",subs:[]}
// for an unknown id — this is what the corrected adapter signature
// actually receives in production, not a categoriesById map.
function fakeGetCat(catsById) {
  return (id) => catsById[id] || { name: "?", color: "#888", icon: "❓", subs: [] };
}

test("sums attributed amounts per category, uses the injected getPersonAttributedAmount — never reimplements attribution", () => {
  const txns = [
    { id: "t1", type: "expense" },
    { id: "t2", type: "expense" },
    { id: "t3", type: "income" }, // excluded — not an expense
  ];
  const getPersonAttributedAmount = (t, pid) => {
    if (t.id === "t1") return 8000;
    if (t.id === "t2") return 5400;
    return 0;
  };
  const getTxnCategoryIds = (t) => (t.id === "t1" ? ["education"] : ["food"]);
  const getCat = fakeGetCat({ education: { name: "Education", icon: "🎓" }, food: { name: "Food", icon: "🍽️" } });

  const summary = getPersonSpendingSummary("vyom_id", txns, getPersonAttributedAmount, getTxnCategoryIds, getCat);
  assert.equal(summary.total, 13400);
  assert.deepEqual(summary.byCategory.map(r => r.catId), ["education", "food"]); // sorted descending
  assert.equal(summary.byCategory[0].amount, 8000);
  assert.equal(summary.byCategory[0].name, "Education");
});

test("zero-attributed transactions (person not involved) are excluded entirely, not shown as zero rows", () => {
  const txns = [{ id: "t1", type: "expense" }];
  const getPersonAttributedAmount = () => 0;
  const getTxnCategoryIds = () => ["food"];
  const summary = getPersonSpendingSummary("vyom_id", txns, getPersonAttributedAmount, getTxnCategoryIds, fakeGetCat({}));
  assert.equal(summary.total, 0);
  assert.deepEqual(summary.byCategory, []);
});

test("a multi-category transaction attributes its full share to each category it touches, matching the app's existing multi-category filter convention", () => {
  const txns = [{ id: "t1", type: "expense" }];
  const getPersonAttributedAmount = () => 1000;
  const getTxnCategoryIds = () => ["food", "travel"];
  const summary = getPersonSpendingSummary("vyom_id", txns, getPersonAttributedAmount, getTxnCategoryIds, fakeGetCat({}));
  assert.equal(summary.byCategory.find(r => r.catId === "food").amount, 1000);
  assert.equal(summary.byCategory.find(r => r.catId === "travel").amount, 1000);
});

test("a transaction with no category falls into 'uncategorized', not silently dropped", () => {
  const txns = [{ id: "t1", type: "expense" }];
  const getPersonAttributedAmount = () => 500;
  const getTxnCategoryIds = () => [];
  const summary = getPersonSpendingSummary("vyom_id", txns, getPersonAttributedAmount, getTxnCategoryIds, fakeGetCat({}));
  assert.equal(summary.byCategory[0].catId, "uncategorized");
  assert.equal(summary.byCategory[0].name, "Uncategorized");
});

test("the 'uncategorized' sentinel is never passed through getCat() — it must not surface getCat's own '?' unknown-id fallback", () => {
  let calledWith = [];
  const getCat = (id) => { calledWith.push(id); return { name: "?", color: "#888", icon: "❓", subs: [] }; };
  const txns = [{ id: "t1", type: "expense" }];
  const summary = getPersonSpendingSummary("vyom_id", txns, () => 500, () => [], getCat);
  assert.equal(summary.byCategory[0].name, "Uncategorized"); // not "?"
  assert.equal(calledWith.includes("uncategorized"), false); // getCat never called with the sentinel
});

test("a real category id is resolved through the injected getCat function, exactly matching its real name/icon fields", () => {
  const getCat = fakeGetCat({ health: { name: "Health", icon: "💊" } });
  const txns = [{ id: "t1", type: "expense" }];
  const summary = getPersonSpendingSummary("vyom_id", txns, () => 5000, () => ["health"], getCat);
  assert.equal(summary.byCategory[0].name, "Health");
  assert.equal(summary.byCategory[0].icon, "💊");
});

test("an unknown (non-sentinel) category id correctly surfaces getCat's own '?' fallback, unmodified — this adapter never invents its own fallback for a real, unresolvable id", () => {
  const getCat = fakeGetCat({}); // "ghost_cat" not in the map
  const txns = [{ id: "t1", type: "expense" }];
  const summary = getPersonSpendingSummary("vyom_id", txns, () => 500, () => ["ghost_cat"], getCat);
  assert.equal(summary.byCategory[0].name, "?"); // getCat's real fallback, not "Uncategorized"
});

test("non-expense transaction types (income, transfer, investment) never contribute to the summary", () => {
  const txns = [{ id: "t1", type: "income" }, { id: "t2", type: "transfer" }];
  const getPersonAttributedAmount = () => 5000; // would be huge if counted
  const summary = getPersonSpendingSummary("vyom_id", txns, getPersonAttributedAmount, () => ["food"], fakeGetCat({}));
  assert.equal(summary.total, 0);
});

test("empty/missing transaction list returns a valid empty summary, never throws", () => {
  const summary = getPersonSpendingSummary("vyom_id", [], () => 0, () => [], fakeGetCat({}));
  assert.deepEqual(summary, { total: 0, byCategory: [] });
  const summary2 = getPersonSpendingSummary("vyom_id", undefined, () => 0, () => [], fakeGetCat({}));
  assert.deepEqual(summary2, { total: 0, byCategory: [] });
});

// --- getPersonActiveConnections -------------------------------------------

const alwaysActive = () => true;
const alwaysInactive = () => false;

test("Groups: a group the person is a member of appears; one they're not a member of does not", () => {
  const groups = [
    { id: "g1", name: "Family", icon: "👨‍👩‍👦", members: ["vyom_id", "__me__"] },
    { id: "g2", name: "Office", icon: "💼", members: ["__me__"] }, // vyom not a member
  ];
  const connections = getPersonActiveConnections("vyom_id", { groups }, alwaysActive, alwaysActive, "2026-08-31");
  const groupEntries = connections.filter(c => c.type === "group");
  assert.equal(groupEntries.length, 1);
  assert.equal(groupEntries[0].id, "g1");
});

test("Membership: an active relationship for this person appears; an inactive one does not", () => {
  const rel = { id: "m1", personId: "vyom_id", billerAccountId: "ba1", statusHistory: [] };
  const withActive = getPersonActiveConnections("vyom_id", { membershipRelationships: [rel] }, alwaysActive, alwaysActive, "2026-08-31");
  assert.equal(withActive.filter(c => c.type === "membership").length, 1);

  const withInactive = getPersonActiveConnections("vyom_id", { membershipRelationships: [rel] }, alwaysInactive, alwaysActive, "2026-08-31");
  assert.equal(withInactive.filter(c => c.type === "membership").length, 0);
});

test("Membership: a relationship belonging to a different person never appears", () => {
  const rel = { id: "m1", personId: "someone_else", billerAccountId: "ba1", statusHistory: [] };
  const connections = getPersonActiveConnections("vyom_id", { membershipRelationships: [rel] }, alwaysActive, alwaysActive, "2026-08-31");
  assert.equal(connections.filter(c => c.type === "membership").length, 0);
});

test("School: called with NO schoolRelationships argument at all (today's real App.jsx state, which doesn't exist yet) produces zero School entries, no error", () => {
  const connections = getPersonActiveConnections("vyom_id", { groups: [], membershipRelationships: [] }, alwaysActive, alwaysActive, "2026-08-31");
  assert.deepEqual(connections.filter(c => c.type === "school"), []);
});

test("School: once real schoolRelationships[] exists (future Phase E), an active one appears and an ended one does not — zero changes needed to this function when that day comes", () => {
  const rel = { id: "sr1", personId: "vyom_id", billerAccountId: "dps", statusHistory: [] };
  const active = getPersonActiveConnections("vyom_id", { schoolRelationships: [rel] }, alwaysActive, alwaysActive, "2026-08-31");
  assert.equal(active.filter(c => c.type === "school").length, 1);

  const ended = getPersonActiveConnections("vyom_id", { schoolRelationships: [rel] }, alwaysActive, alwaysInactive, "2026-08-31");
  assert.equal(ended.filter(c => c.type === "school").length, 0);
});

test("this is presence-based, not module-gated: a person with real Group/Membership/School data returns entries with NO reference to PERSON_MODULES anywhere in this function's logic", () => {
  const src = getPersonActiveConnections.toString();
  assert.equal(/PERSON_MODULES|modules\.includes|getPersonModules/.test(src), false);
});

test("a Contact with zero relationships of any kind returns an empty array, not an error or placeholder entries", () => {
  const connections = getPersonActiveConnections("parth_id", {}, alwaysActive, alwaysActive, "2026-08-31");
  assert.deepEqual(connections, []);
});

test("a person can have Groups + Membership + School simultaneously — all three appear, correctly attributed only to that person", () => {
  const groups = [{ id: "g1", name: "Family", members: ["vyom_id"] }];
  const membershipRelationships = [{ id: "m1", personId: "vyom_id", billerAccountId: "ba1", statusHistory: [] }];
  const schoolRelationships = [{ id: "sr1", personId: "vyom_id", billerAccountId: "dps", statusHistory: [] }];
  const connections = getPersonActiveConnections("vyom_id", { groups, membershipRelationships, schoolRelationships }, alwaysActive, alwaysActive, "2026-08-31");
  assert.equal(connections.length, 3);
  assert.deepEqual(connections.map(c => c.type).sort(), ["group", "membership", "school"]);
});
