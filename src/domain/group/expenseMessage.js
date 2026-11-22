// domain/group/expenseMessage.js — the message for a group's itemised expenses, laid out the way it is read out loud: month by month, one line per ticked item
// ("Item - amount", with the member's name in front when the expense is that one member's), a Sum for each month, then the total for the period to date. Pure.
//   July
//   July Common Meter Electricity Bill - 4560
//   Family Member F - K Auto - 7899
//   Sum - 12459
//   ...
//   PTD total - 55000
import { shortDate, plainAmount } from "../person/statementMessage.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** @param {Array} items from buildGroupExpenseList, each with `on` (true = send it)
 *  @returns {string} "" when nothing is ticked */
export function buildGroupExpenseMessage(items, { groupName = "", from, to, upiHandle = "", breakup = null } = {}) {
  const chosen = (items || []).filter(i => i.on).slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.key).localeCompare(String(b.key)));
  if (!chosen.length) return "";
  const P = n => Math.round((Number(n) || 0) * 100);
  const years = new Set(chosen.map(i => i.date.slice(0, 4)));
  const months = [];
  for (const i of chosen) { const k = i.date.slice(0, 7); let m = months[months.length - 1]; if (!m || m.key !== k) { m = { key: k, items: [] }; months.push(m); } m.items.push(i); }
  const blocks = [[`${groupName ? `${groupName} · ` : ""}${from && to ? `${shortDate(from, true)} – ${shortDate(to, true)}` : "expenses"}`]];
  let all = 0;
  for (const m of months) {
    const label = `${MONTHS[Number(m.key.slice(5, 7)) - 1]}${years.size > 1 ? ` ${m.key.slice(0, 4)}` : ""}`;
    const lines = [label]; let sum = 0;
    for (const i of m.items) { lines.push(`${i.forName ? `${i.forName} - ` : ""}${i.title}${i.payer === "not paid yet" ? " (not paid yet)" : ""} - ${plainAmount(i.total)}`); sum += P(i.total); }
    lines.push(`Sum - ${plainAmount(sum / 100)}`);
    blocks.push(lines); all += sum;
  }
  if (months.length > 1) blocks.push([`PTD total - ${plainAmount(all / 100)}`]);
  if (breakup && breakup.rows && breakup.rows.length) blocks.push(["By category:", ...breakup.rows.map(r => `${r.name} - ${plainAmount(r.amount)} (${r.pct}%)`)]);
  if (upiHandle) blocks.push([`Pay to: ${upiHandle}`]);
  return blocks.map(b => b.join("\n")).join("\n\n");
}
