import test from "node:test";
import assert from "node:assert/strict";
import { moneyViewParts, SECTIONS, sectionOfTab, segmentsFor, activeSegmentId, bottomTabs, isSectionTabActive } from "./sections.js";

test("every existing tab sits in exactly one section", () => {
  for (const t of ["home", "insights", "transactions", "wealth", "people", "bills", "budget", "outlook"]) assert.ok(sectionOfTab(t), t);
  const all = SECTIONS.flatMap(s => s.tabs); assert.equal(new Set(all).size, all.length);
  assert.equal(sectionOfTab("settings"), null);
});
test("the bottom bar is Today, Money, +, People, Plan, and Money lands on Activity (no PIN)", () => {
  const b = bottomTabs();
  assert.deepEqual(b.map(x => x.label), ["Today", "Money", "", "People", "Plan"]);
  assert.equal(b[1].id, "transactions"); assert.equal(b[4].id, "bills"); assert.equal(b[0].id, "home");
});
test("a section lights up for any of its tabs", () => {
  const b = bottomTabs();
  assert.equal(isSectionTabActive(b[4], "outlook"), true); assert.equal(isSectionTabActive(b[4], "bills"), true);
  assert.equal(isSectionTabActive(b[1], "wealth"), true); assert.equal(isSectionTabActive(b[1], "people"), false);
  assert.equal(isSectionTabActive(b[2], "home"), false);
});
test("Money has Activity, Accounts, Cards, Loans and Invest (all but Activity private); Plan has Bills, Budget, Goals, Events, Outlook; Today and People have no switch", () => {
  assert.deepEqual(segmentsFor("money").map(s => s.label), ["Activity", "Accounts", "Cards", "Loans", "Invest"]);
  assert.equal(segmentsFor("money")[1].private, true); assert.equal(segmentsFor("money")[0].private, undefined);
  assert.deepEqual(segmentsFor("plan").map(s => s.label), ["Bills", "Budget", "Goals", "Events", "Outlook"]);
  assert.deepEqual(segmentsFor("today"), []); assert.deepEqual(segmentsFor("people"), []);
});
test("the active segment follows the tab; sheets are never active", () => {
  assert.equal(activeSegmentId("transactions"), "activity"); assert.equal(activeSegmentId("wealth"), "accounts");
  assert.equal(activeSegmentId("wealth", "cards"), "cards"); assert.equal(activeSegmentId("wealth", "loans"), "loans"); assert.equal(activeSegmentId("wealth", "invest"), "invest");
  assert.equal(activeSegmentId("bills"), "bills"); assert.equal(activeSegmentId("outlook"), "outlook");
  assert.equal(activeSegmentId("home"), null);
  assert.ok(segmentsFor("plan").filter(s => s.kind === "modal").every(s => activeSegmentId(s.target) === null));
});

test("every part of the money hub shows in exactly one view, so nothing is lost by splitting it", () => {
  const views = ["accounts", "cards", "loans", "invest"];
  for (const part of ["summary", "cash", "investments", "cards", "people", "loans", "assets"]) assert.equal(views.filter(v => moneyViewParts(v)[part]).length, 1, part);
  const old = moneyViewParts("all");
  for (const part of ["summary", "cash", "investments", "cards", "people", "assets"]) assert.equal(old[part], true, part);
  assert.equal(old.loans, false);   // the loans list is new; the current layout stays as it was
});
