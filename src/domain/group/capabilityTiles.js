// domain/group/capabilityTiles.js
//
// UI-2C G-12 — one summary line per switched-on group module, in the
// stored module order. Reads figures the caller already computed; never
// computes money itself. Reminders show dates only (D-9).

import { getSortedGroupReminders, getGroupNotes } from "./reminders.js";

export function getGroupCapabilityTiles({ group, modules, moduleDefs, owedToMe, iOwe, budget, spent, relationshipCount, vendorCount, today, sym, fmt }) {
  const on = new Set(modules || []);
  const money = n => `${sym}${fmt(Number(n || 0))}`;
  const reminders = getSortedGroupReminders(group, today);
  const notes = getGroupNotes(group);
  const toSettle = Number(owedToMe || 0) + Number(iOwe || 0);
  const sub = {
    settlement: toSettle > 0 ? `${money(toSettle)} to settle` : "All settled",
    budget: Number(budget) > 0 ? `${money(spent)} of ${money(budget)}` : "No budget set",
    bills: relationshipCount > 0 ? `${relationshipCount} relationship${relationshipCount === 1 ? "" : "s"}` : "No relationships yet",
    vendors: vendorCount > 0 ? `${vendorCount} vendor${vendorCount === 1 ? "" : "s"}` : "No vendors yet",
    notes: notes.hasValue ? notes.value.split("\n")[0].slice(0, 40) : "No notes yet",
    reminders: reminders.find(r => !r.past)?.text || (reminders[0]?.text ?? "No reminders"),
  };
  return (moduleDefs || [])
    .filter(m => on.has(m.id))
    .map(m => ({ id: m.id, label: m.label, sub: sub[m.id] ?? "" }));
}
