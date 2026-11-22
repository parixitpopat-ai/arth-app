// domain/group/expenseMessage.js — the message for a group's itemised expenses: one line per ticked item, then the totals. Pure.
import { shortDate, plainAmount } from "../person/statementMessage.js";

/** @param {Array} items from buildGroupExpenseList, each with `on` (true = send it)
 *  @returns {string} "" when nothing is ticked */
export function buildGroupExpenseMessage(items, { groupName = "", from, to, upiHandle = "", showShares = true } = {}) {
  const chosen = (items || []).filter(i => i.on);
  if (!chosen.length) return "";
  const out = [`${groupName ? `${groupName} · ` : ""}expenses${from && to ? ` ${shortDate(from)} – ${shortDate(to)}` : ""}`, ""];
  for (const i of chosen) {
    const who = showShares && i.shares.length ? ` (${i.shares.map(s => `${s.name} ${plainAmount(s.amount)}`).join(", ")}${i.yourShare ? `, you ${plainAmount(i.yourShare)}` : ""})` : "";
    out.push(`${shortDate(i.date)} · ${i.title}${i.payer === "not paid yet" ? " (bill, not paid yet)" : ""} - ${plainAmount(i.total)}${who}`);
  }
  const P = n => Math.round((Number(n) || 0) * 100);
  const total = chosen.reduce((s, i) => s + P(i.total), 0) / 100;
  const due = chosen.reduce((s, i) => s + P(i.due), 0) / 100;
  out.push("", `Total expenses = ${plainAmount(total)}`);
  if (due > 0) out.push(`Still to be paid by members = ${plainAmount(due)}`);
  if (upiHandle) out.push(`Pay to: ${upiHandle}`);
  return out.join("\n");
}
