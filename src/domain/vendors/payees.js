// src/domain/vendors/payees.js — tells PEOPLE you paid apart from VENDORS (shops/businesses), by NAME only. Pure; changes nothing by itself.
// A vendor name counts as a person when it equals that person's name or one of the person's `aliases` (names a bank prints for them, e.g. "RAJ PI").
// `suggestPeople` offers likely matches for the person to confirm; it never links anything on its own. Several candidates = no suggestion.
const ME = "__me__";
export const nameKey = s => String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const tokens = s => nameKey(s).split(" ").filter(Boolean);
const realPeople = people => (people || []).filter(p => p && p.id !== ME && p.name);

/** The person a name belongs to (their name or a saved alias), or null. */
export function personForName(name, people) {
  const k = nameKey(name);
  if (!k) return null;
  return realPeople(people).find(p => nameKey(p.name) === k || (p.aliases || []).some(a => nameKey(a) === k)) || null;
}

/** Splits vendorSpend rows into real vendors and rows that are really people. Totals are of the vendors only. */
export function splitVendorsAndPeople(rows, people) {
  const vendors = [], paidPeople = [];
  for (const r of rows || []) {
    const person = (r.variants || [r.name]).map(n => personForName(n, people)).find(Boolean) || personForName(r.name, people);
    (person ? paidPeople : vendors).push(person ? { row: r, person } : r);
  }
  return { vendors, people: paidPeople };
}

/** Banks cut names short ("NIDHI Y", "RAJ PI"). A vendor looks like a person when each of its words is the start of the person's matching word,
 *  its first word is whole (3+ letters), and exactly ONE person fits. Returns [{ name, person }]. */
export function suggestPeople(vendors, people) {
  const out = [], list = realPeople(people);
  for (const v of vendors || []) {
    const vt = tokens(v.name);
    if (!vt.length || vt[0].length < 3) continue;
    const fits = list.filter(p => { const pt = tokens(p.name); return vt.length <= pt.length && vt.every((w, i) => (i === 0 ? pt[0] === w : pt[i].startsWith(w))); });
    if (fits.length === 1) out.push({ name: v.name, person: fits[0] });
  }
  return out;
}

export function addAlias(people, personId, alias) {
  const a = String(alias || "").replace(/\s+/g, " ").trim();
  if (!a) return people;
  return (people || []).map(p => String(p.id) === String(personId) && !(p.aliases || []).some(x => nameKey(x) === nameKey(a)) ? { ...p, aliases: [...(p.aliases || []), a] } : p);
}
export function removeAlias(people, personId, alias) {
  return (people || []).map(p => String(p.id) === String(personId) && p.aliases ? { ...p, aliases: p.aliases.filter(x => nameKey(x) !== nameKey(alias)) } : p);
}
