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
