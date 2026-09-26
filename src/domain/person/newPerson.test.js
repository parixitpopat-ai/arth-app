import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNewPerson, applyPersonSetup, NEW_PERSON_DEFAULT_MODULES } from "./newPerson.js";
import { buildNewGroup } from "../group/newGroup.js";
import { getPersonSplitDefault } from "./splitDefault.js";
import { getPersonModules, GROUP_TYPE_DEFAULT_MODULES } from "../../constants/appConstants.js";

const genId = () => "id1";

test("name is the only required field; relation, phone and email are optional", () => {
  const p = buildNewPerson({ name: "  Nidhi Popat " }, { genId, color: "#22c55e" });
  assert.equal(p.name, "Nidhi Popat");
  assert.equal(p.relation, "");
  assert.throws(() => buildNewPerson({ name: " " }, { genId, color: "#fff" }), /name/);
});

test("a new person has no personType, so their split default is Ask each time", () => {
  const p = buildNewPerson({ name: "Nidhi" }, { genId, color: "#fff" });
  assert.equal("personType" in p, false);
  assert.equal(getPersonSplitDefault(p), "ask");
});

test("modules are written explicitly with the old wizard's Contact defaults", () => {
  const p = buildNewPerson({ name: "Nidhi" }, { genId, color: "#fff" });
  assert.deepEqual([...p.modules].sort(), [...getPersonModules({ personType: "contact" })].sort());
  assert.deepEqual(p.modules, NEW_PERSON_DEFAULT_MODULES);
});

test("P-3 setup applies modules and the split default; Skip changes nothing", () => {
  const p = buildNewPerson({ name: "Nidhi" }, { genId, color: "#fff" });
  const set = applyPersonSetup(p, { modules: ["budget"], split: "they_owe" });
  assert.deepEqual(set.modules, ["budget"]);
  assert.equal(set.defaultSplit, "they_owe");
  const ask = applyPersonSetup(p, { split: "ask" });
  assert.equal("defaultSplit" in ask, false);
  assert.deepEqual(applyPersonSetup(p, {}), p);
});

const GROUP_TYPES = [
  { id: "family", label: "Family / Dependants", icon: "🏠", default: "attributed" },
  { id: "trip", label: "Trip / Event", icon: "✈️", default: "split" },
  { id: "other", label: "Other", icon: "📄", default: "manual" },
];
const opts = { genId, color: "#06b6d4", groupTypes: GROUP_TYPES, typeDefaultModules: GROUP_TYPE_DEFAULT_MODULES };

test("a typed group gets the same fields the wizard wrote", () => {
  const g = buildNewGroup({ name: "Goa Household", typeId: "family", members: ["p1"], includeMe: true, description: " Porvorim flat " }, opts);
  assert.deepEqual(g, {
    id: "id1", type: "Family / Dependants", typeId: "family", name: "Goa Household", icon: "🏠", color: "#06b6d4",
    members: ["p1"], includeMe: true, manualLimit: 0, defaultIntent: "attributed",
    modules: GROUP_TYPE_DEFAULT_MODULES.family, description: "Porvorim flat",
  });
});

test("a group with no type matches the wizard's no-type result", () => {
  const g = buildNewGroup({ name: "Office" }, opts);
  assert.equal(g.type, "Group");
  assert.equal(g.typeId, "other");
  assert.equal(g.icon, "👥");
  assert.equal(g.defaultIntent, "split");
  assert.deepEqual(g.modules, GROUP_TYPE_DEFAULT_MODULES.other);
  assert.equal("description" in g, false);
  assert.equal(g.modules.includes("notes") || g.modules.includes("reminders"), false, "Add Group stays identity-only");
  assert.throws(() => buildNewGroup({ name: "" }, opts), /name/);
});
