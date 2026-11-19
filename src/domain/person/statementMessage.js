// src/domain/person/statementMessage.js — the short text sent with a person's statement (WhatsApp, SMS). Pure. Built from a statement made by personStatement.js.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "5 Aug" ("5 Aug 2026" with withYear); "" for a bad date. */
export function shortDate(iso, withYear = false) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return "";
  return `${+m[3]} ${MONTHS[+m[2] - 1]}${withYear ? ` ${m[1]}` : ""}`;
}
/** "10 Jun – 25 Jul" for a bill's reading period; "" unless both dates are known. */
export function periodLabel(from, to) { return from && to ? `${shortDate(from)} – ${shortDate(to)}` : ""; }

/**
 * @param {object} st a statement from buildPersonStatement
 * @param {{name:string, sym?:string, fmt?:(n:number)=>string, upiHandle?:string}} o
 */
export function buildStatementMessage(st, { name, sym = "₹", fmt = n => Number(n).toFixed(2), upiHandle = "" }) {
  const money = n => `${sym}${fmt(Math.abs(n))}`;
  const lines = [`Hi ${name}, statement ${shortDate(st.from, true)} – ${shortDate(st.to, true)}:`];
  if (Math.abs(st.opening) > 0.004) lines.push(`Brought forward ${st.opening < 0 ? "−" : ""}${money(st.opening)}`);
  for (const s of st.sections) lines.push(`${s.label} ${money(s.subtotal)}`);
  if (st.movedTotal > 0.004) lines.push(`Moved to someone else −${money(st.movedTotal)}`);
  if (st.paymentsTotal > 0.004) lines.push(`Paid −${money(st.paymentsTotal)}`);
  if (st.credit > 0) lines.push(`Credit in your favour ${money(st.credit)}`);
  else if (st.settled) lines.push("Balance due: nothing, settled ✓");
  else lines.push(`Balance due ${money(st.closing)}`);
  if (upiHandle && !st.settled && st.credit === 0) lines.push(`Pay to: ${upiHandle}`);
  return lines.join("\n");
}

/**
 * The message that asks a whole family (a group) for money: one total, what it is made of, and who owes what.
 * @param {object} fam a statement from buildFamilyStatement
 * @param {{groupName:string, nameOf:(id:string)=>string, sym?:string, fmt?:(n:number)=>string, upiHandle?:string}} o
 */
export function buildFamilyMessage(fam, { groupName, nameOf, sym = "₹", fmt = n => Number(n).toFixed(2), upiHandle = "" }) {
  const money = n => `${sym}${fmt(Math.abs(n))}`;
  const P = n => Math.round((Number(n) || 0) * 100);
  const lines = [`Hi, statement for the ${groupName} family, ${shortDate(fam.from, true)} – ${shortDate(fam.to, true)}:`];
  if (Math.abs(fam.opening) > 0.004) lines.push(`Brought forward ${fam.opening < 0 ? "−" : ""}${money(fam.opening)}`);
  const byLabel = new Map();
  for (const m of fam.members) for (const s of m.sections) byLabel.set(s.label, (byLabel.get(s.label) || 0) + P(s.subtotal));
  // a debt moved between members cancels (the original and the "Transferred from" entry), so the family sections are shown net of it
  let within = P(fam.movedWithinFamily);
  if (within > 0) { const own = byLabel.get("Own expenses") || 0; byLabel.set("Own expenses", own - within); }
  for (const [label, p] of byLabel) if (p > 0) lines.push(`${label} ${money(p / 100)}`);
  if (fam.movedTotal > 0.004) lines.push(`Moved to someone outside −${money(fam.movedTotal)}`);
  if (fam.paymentsTotal > 0.004) lines.push(`Paid by the family −${money(fam.paymentsTotal)}`);
  const settled = Math.abs(fam.closing) < 0.005;
  if (fam.closing < -0.004) lines.push(`Credit in your favour ${money(fam.closing)}`);
  else if (settled) lines.push("Balance due: nothing, settled ✓");
  else lines.push(`Balance due ${money(fam.closing)}`);
  const owing = fam.members.filter(m => m.closing > 0.004);
  if (owing.length > 1 || (owing.length === 1 && fam.members.length > 1)) lines.push(`By person: ${owing.map(m => `${nameOf(m.personId)} ${money(m.closing)}`).join(" · ")}`);
  if (upiHandle && fam.closing > 0.004) lines.push(`Pay to: ${upiHandle}`);
  return lines.join("\n");
}

// ── the SIMPLE list: "Item - amount" per line, then "Total = …", for the items the person ticked ─────────────────────────────────────────────
const P100 = n => Math.round((Number(n) || 0) * 100);
/** 135 -> "135", 1177.8 -> "1177.80" (whole amounts have no decimals, as people write them). */
export function plainAmount(n) { const r = P100(n) / 100; return Number.isInteger(r) ? String(r) : r.toFixed(2); }

/**
 * The lines a person can choose from, from one person's statement: every charge in the period, at what is STILL DUE on it (a fully paid one has nothing due and
 * starts unticked), plus an amount brought forward when there is one. `key` is stable so a tick survives a re-render.
 * @returns {Array<{key:string, title:string, due:number, paid:number, amount:number, ticked:boolean, prefix:string}>}
 */
export function statementLines(st, { prefix = "" } = {}) {
  const out = [];
  if (st.opening > 0.004) out.push({ key: `${st.personId}|opening`, title: "Brought forward", amount: st.opening, paid: 0, due: st.opening, ticked: true, prefix });
  for (const s of st.sections) for (const it of s.items) {
    out.push({ key: `${st.personId}|${it.kind}:${it.id}`, title: it.transferredFrom ? `Transferred from ${it.transferredFrom}` : it.title, amount: it.amount, paid: it.paid, due: it.due, ticked: it.due > 0.004, prefix });
  }
  return out;
}
/** The same for a whole family: each member's lines, named by member. */
export function familyLines(fam, nameOf) { return fam.members.flatMap(m => statementLines(m, { prefix: nameOf(m.personId) })); }

/**
 * @param {Array} lines from statementLines/familyLines, each with `on` (true = send it)
 * @param {{upiHandle?:string, withNames?:boolean}} o  withNames puts the member's name before each line (a family)
 * @returns {string} "" when nothing is ticked
 */
export function buildSimpleMessage(lines, { upiHandle = "", withNames = false } = {}) {
  const chosen = lines.filter(l => l.on && l.due > 0.004);
  if (!chosen.length) return "";
  const out = chosen.map(l => `${withNames && l.prefix ? `${l.prefix}: ` : ""}${l.title} - ${plainAmount(l.due)}`);
  const total = chosen.reduce((s, l) => s + P100(l.due), 0);
  out.push("", `Total = ${plainAmount(total / 100)}`);
  if (upiHandle) out.push(`Pay to: ${upiHandle}`);
  return out.join("\n");
}
