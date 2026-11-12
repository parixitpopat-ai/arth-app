// src/domain/imports/upiId.js — the payee's UPI ID (address such as "swiggy@ybl"), as opposed to the per-payment transaction reference (12-digit UTR).
// A UPI ID belongs to ONE payee, but a payee can have several. Saved quietly on imported entries (`upiId`, lower case) and used to remember who is who:
// a person's `upiIds` (set when the user links a vendor to a person) and the names the user already gave to entries carrying the same UPI ID.
// Only a FULL address counts. A bank's cut-short piece ("bhimcas", "swiggy@ic…") is not stored. Pure.
const VPA = /([a-z0-9][a-z0-9._-]{1,48})@([a-z][a-z0-9]{1,24})(?![a-z0-9]*\.[a-z])/gi;   // UPI handles have no dot ("okaxis"); an e-mail ("a@gmail.com") does

/** The first full UPI ID in the text, lower case, or "". */
export function extractUpiId(text) {
  const s = String(text || "");
  VPA.lastIndex = 0;
  for (let m = VPA.exec(s); m; m = VPA.exec(s)) {
    const after = s.slice(VPA.lastIndex, VPA.lastIndex + 2);
    if (/^\.[a-z]/i.test(after)) continue;                       // "x@gmail.com"
    return `${m[1]}@${m[2]}`.toLowerCase();
  }
  return "";
}

const generic = n => { const s = String(n || "").trim(); return !s || /^upi( payment)?$/i.test(s) || /@/.test(s) || /^upi[-/]/i.test(s); };

/**
 * UPI id -> the name an entry with that id should carry. A person's saved `upiIds` win; otherwise the name the person's own earlier entries gave it
 * (the most used non-generic vendor name for that id). @returns {Map<string,string>}
 */
export function payeeNamesByUpiId(txns, people) {
  const seen = new Map();
  for (const t of txns || []) {
    const id = String((t && t.upiId) || "").toLowerCase();
    if (!id || generic(t.merchant)) continue;
    const byName = seen.get(id) || new Map();
    byName.set(t.merchant, (byName.get(t.merchant) || 0) + 1); seen.set(id, byName);
  }
  const out = new Map();
  for (const [id, byName] of seen) out.set(id, [...byName.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]);
  for (const p of people || []) if (p && p.id !== "__me__" && p.name) for (const id of p.upiIds || []) out.set(String(id).toLowerCase(), p.name);
  return out;
}

/** The distinct UPI ids saved on entries whose vendor name is `name` (ignoring capitals/spaces). */
export function upiIdsForName(txns, name) {
  const k = String(name || "").toLowerCase().replace(/\s+/g, " ").trim();
  return [...new Set((txns || []).filter(t => t && t.upiId && String(t.merchant || "").toLowerCase().replace(/\s+/g, " ").trim() === k).map(t => String(t.upiId).toLowerCase()))];
}

export function addUpiIds(people, personId, ids) {
  const add = (ids || []).map(x => String(x).toLowerCase()).filter(Boolean);
  if (!add.length) return people;
  return (people || []).map(p => String(p.id) === String(personId) ? { ...p, upiIds: [...new Set([...(p.upiIds || []).map(x => String(x).toLowerCase()), ...add])] } : p);
}
export function removeUpiIds(people, personId, ids) {
  const drop = new Set((ids || []).map(x => String(x).toLowerCase()));
  return (people || []).map(p => String(p.id) === String(personId) && p.upiIds ? { ...p, upiIds: p.upiIds.filter(x => !drop.has(String(x).toLowerCase())) } : p);
}
