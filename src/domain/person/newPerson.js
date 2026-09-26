// domain/person/newPerson.js
//
// UI-2C P-2 / P-3 — the record written by the one-screen Add Person, and
// the optional setup applied right after it.
//
// Same record shape as the old three-step wizard, with two deliberate
// differences:
//   - no `personType`: Add Person no longer asks Family / Contact. Having
//     no type is also what marks the person as new for the split-default
//     rule (splitDefault.js), so they are asked each time until a default
//     is chosen.
//   - Relationship is optional; name is the only required field.
// `modules` are written explicitly with the wizard's own defaults for a
// Contact (everything except Monthly budget), so nothing a new person had
// before is lost; P-3 can switch any of them.

import { withSplitDefault } from "./splitDefault.js";

export const NEW_PERSON_DEFAULT_MODULES = ["sharedExpenses", "gifts", "notes", "reminders", "borrowMoney"];

export function buildNewPerson({ name, relation, phone, email } = {}, { genId, color }) {
  const clean = String(name || "").trim();
  if (!clean) throw new Error("A person needs a name.");
  if (typeof genId !== "function") throw new Error("genId is required.");
  return {
    id: genId(),
    name: clean,
    emoji: "👤",
    relation: String(relation || "").trim(),
    phone: String(phone || "").trim(),
    email: String(email || "").trim(),
    color,
    creditLimit: 0,
    spendBudget: 0,
    favorite: false,
    defaultSettlement: "UPI",
    modules: [...NEW_PERSON_DEFAULT_MODULES],
  };
}

/** P-3: the chosen modules and default split, applied to the new person. */
export function applyPersonSetup(person, { modules, split } = {}) {
  const next = Array.isArray(modules) ? { ...person, modules: [...modules] } : { ...person };
  return split === undefined ? next : withSplitDefault(next, split);
}
