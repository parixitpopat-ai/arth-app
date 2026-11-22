// domain/group/expenseMessage.js — the message for a group's itemised expenses, laid out the way it is read out loud: month by month, and inside each month one
// block per person ("Parixit Popat - expenses") listing only THAT person's part of each expense as "Item - amount", with a Sum; expenses that belong to the
// group as a whole go under "<group> - expenses". After the months, the total for the period to date. Pure.
//   July
//   Parixit Popat - expenses
//   July Building Electricity Bill - 1520
//   July Water Bill - 262
//   Sum - 1782
//   ...
//   PTD total - 22047
import { shortDate, plainAmount } from "../person/statementMessage.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** @param {Array} items from buildGroupExpenseList, each with `on` (true = send it) and `parts` ([{personId,name,amount}])
 *  @param {{meId?:any, onlyPersonId?:any, showNames?:boolean}} o  meId: the person using Arth is listed first; onlyPersonId: leave everyone else's parts out;
 *    showNames false: no names at all, just the month's lines "Item - amount" and the Sum (what is sent to a family the person is not part of)
 *  @returns {string} "" when nothing is ticked */
export function buildGroupExpenseMessage(items, { groupName = "", from, to, upiHandle = "", breakup = null, meId = null, onlyPersonId = null, showNames = true, onlyUnpaid = false } = {}) {
  const chosen = (items || []).filter(i => i.on && (onlyPersonId == null || (i.parts || []).some(pt => pt.personId != null && String(pt.personId) === String(onlyPersonId)))).slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.key).localeCompare(String(b.key)));
  if (!chosen.length) return "";
  const P = n => Math.round((Number(n) || 0) * 100);
  const years = new Set(chosen.map(i => i.date.slice(0, 4)));
  const months = [];
  for (const i of chosen) { const k = i.date.slice(0, 7); let m = months[months.length - 1]; if (!m || m.key !== k) { m = { key: k, items: [] }; months.push(m); } m.items.push(i); }
  const blocks = [[`${groupName ? `${groupName} · ` : ""}${from && to ? `${shortDate(from, true)} – ${shortDate(to, true)}` : "expenses"}`, ...(onlyUnpaid ? ["Only unpaid entries"] : [])]];
  let all = 0;
  for (const m of months) {
    const label = `${MONTHS[Number(m.key.slice(5, 7)) - 1]}${years.size > 1 ? ` ${m.key.slice(0, 4)}` : ""}`;
    if (!showNames) {   // one plain list for the month: no person, no heading
      const lines = [label]; let sum = 0;
      for (const i of m.items) { lines.push(`${i.soloName ? `${i.soloName} - ` : ""}${i.title}${i.payer === "not paid yet" ? " (not paid yet)" : ""} - ${plainAmount(i.total)}`); sum += P(i.total); }   // a vendor expense that belongs to one person carries their name: "Person B - Vendor - amount"
      lines.push(`Sum - ${plainAmount(sum / 100)}`); blocks.push(lines); all += sum; continue;
    }
    const who = new Map();   // person key -> { name, lines, paise }
    for (const i of m.items) {
      let parts = i.parts && i.parts.length ? i.parts : [{ personId: null, name: "", amount: i.total }];
      if (onlyPersonId != null) parts = parts.filter(pt => pt.personId != null && String(pt.personId) === String(onlyPersonId));   // one person's own parts only
      for (const pt of parts) {
        if (!(P(pt.amount) > 0)) continue;
        const k = pt.personId == null ? "__group__" : String(pt.personId);
        const g = who.get(k) || { name: pt.personId == null ? (groupName || "Group") : pt.name, isMe: meId != null && pt.personId != null && String(pt.personId) === String(meId), group: pt.personId == null, lines: [], paise: 0 };
        g.lines.push(`${i.title}${i.payer === "not paid yet" ? " (not paid yet)" : ""} - ${plainAmount(pt.amount)}`); g.paise += P(pt.amount); who.set(k, g);
      }
    }
    const order = [...who.values()].sort((a, b) => (b.isMe - a.isMe) || (a.group - b.group) || a.name.localeCompare(b.name));
    const many = order.length > 1;
    const lines = [label];
    let sum = 0;
    for (const g of order) {
      lines.push(`${g.name} - expenses`, ...g.lines);
      if (many) lines.push(`Sum - ${plainAmount(g.paise / 100)}`, "");
      sum += g.paise;
    }
    if (many) lines.push(`${label} total - ${plainAmount(sum / 100)}`); else lines.push(`Sum - ${plainAmount(sum / 100)}`);
    blocks.push(lines); all += sum;
  }
  if (months.length > 1) blocks.push([`PTD total - ${plainAmount(all / 100)}`]);
  if (breakup && breakup.rows && breakup.rows.length) blocks.push(["By category:", ...breakup.rows.map(r => `${r.name} - ${plainAmount(r.amount)} (${r.pct}%)`)]);
  if (upiHandle) blocks.push([`Pay to: ${upiHandle}`]);
  return blocks.map(b => b.join("\n")).join("\n\n");
}
