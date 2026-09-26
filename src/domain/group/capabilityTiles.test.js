import { test } from "node:test";
import assert from "node:assert/strict";
import { getGroupCapabilityTiles } from "./capabilityTiles.js";
import { GROUP_MODULES, getGroupModules } from "../../constants/appConstants.js";

const base = { moduleDefs: GROUP_MODULES, sym: "₹", fmt: n => n.toLocaleString("en-IN"), today: "2026-09-26" };

test("the six group modules, only the switched-on ones", () => {
  assert.deepEqual(GROUP_MODULES.map(m => m.label), ["Settlements", "Budget", "Bills", "Vendors", "Notes", "Reminders"]);
  const legacy = { id: "g1" };
  assert.deepEqual(getGroupModules(legacy), ["settlement", "budget", "bills", "vendors"], "existing groups don't gain Notes/Reminders");
  const tiles = getGroupCapabilityTiles({ ...base, group: legacy, modules: ["bills", "settlement"] });
  assert.deepEqual(tiles.map(t => t.id), ["settlement", "bills"]);
});

test("summaries use passed-in figures and show reminders as label and date", () => {
  const group = { notes: "Porvorim flat", reminders: [{ id: "r1", label: "Water filter service", date: "2026-10-18" }, { id: "r2", label: "Gas cylinder", date: "2026-10-03" }] };
  const tiles = getGroupCapabilityTiles({ ...base, group, modules: GROUP_MODULES.map(m => m.id), owedToMe: 2100, iOwe: 0, budget: 40000, spent: 31200, relationshipCount: 3, vendorCount: 5 });
  const by = Object.fromEntries(tiles.map(t => [t.id, t.sub]));
  assert.equal(by.settlement, "₹2,100 to settle");
  assert.equal(by.budget, "₹31,200 of ₹40,000");
  assert.equal(by.bills, "3 relationships");
  assert.equal(by.vendors, "5 vendors");
  assert.equal(by.notes, "Porvorim flat");
  assert.equal(by.reminders, "Gas cylinder · 3 Oct");
});

test("empty states", () => {
  const tiles = getGroupCapabilityTiles({ ...base, group: {}, modules: GROUP_MODULES.map(m => m.id) });
  assert.deepEqual(tiles.map(t => t.sub), ["All settled", "No budget set", "No relationships yet", "No vendors yet", "No notes yet", "No reminders"]);
});
