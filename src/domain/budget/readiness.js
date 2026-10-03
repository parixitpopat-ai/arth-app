// domain/budget/readiness.js
//
// Plan Ahead PA6-PA9 — "next month readiness": how much cash to keep ready in a month, and how much of
// it counts against that month's budget. Read-side only: it composes figures other modules already own
// (the Future Money events, the Mandatory Commitments, the month's budget) and creates no new obligation.
//
// Two numbers, never one: every row carries `cash` (money leaving in the month) and `budget` (what counts
// against the month's budget). Today they match except for investments, which are cash but "Not in
// budget"; an event may carry `budgetAmount` to count a different share (the Spread module sets that).
//
// What counts in month M:
//   - a dated event falling in M (a real amount, unless its type is an estimate by the Outlook rules);
//   - a monthly-rhythm event (bills that recur, card statements, SIPs, EMIs, memberships) dated in an
//     EARLIER month, counted once in M as an estimate - the same "Every month" baseline Outlook uses.
// Paid events never count. An active Mandatory Commitment counts as a locked envelope; a bill whose
// category matches an active commitment is covered by it (the row shows the larger of the two), so the
// same money is not planned twice. A commitment skipped for M stops reserving, and its bills count again.

import { isMonthlyRhythm } from "../futureMoney/rhythm.js";
import { isEstimatedOccurrence } from "../futureMoney/sourceTypeMeta.js";
import { itemKey, liveItems } from "../payTogether/group.js";

/** "YYYY-MM" shifted by whole months. */
export const shiftMonthKey = (mk, delta) => { const [y, m] = mk.split("-").map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortMonth = mk => SHORT[Number(String(mk).slice(5, 7)) - 1] || "";
const dayMonth = d => `${Number(String(d).slice(8, 10))} ${shortMonth(d)}`;
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const monthKeyOf = d => String(d || "").slice(0, 7);
const daysBetween = (fromStr, toStr) => Math.ceil((new Date(`${toStr}T00:00:00`) - new Date(`${fromStr}T00:00:00`)) / 86400000);

const TYPE_ORDER = ["schoolFees", "insurance", "memberships", "cards", "bills", "loans"];
const TYPE_LABEL = {
  schoolFees: "School fees", insurance: "Insurance", memberships: "Memberships",
  cards: "Card statements", bills: "Bills", loans: "Loans & EMIs", sips: "SIPs",
};
function typeKeyOf(e) {
  if (e.category === "committedSaving") return "sips";
  switch (e.sourceType) {
    case "feePeriod": return "schoolFees";
    case "insurancePolicy": return "insurance";
    case "membership": return "memberships";
    case "ccStatement": return "cards";
    case "debt": return "loans";
    default: return e.category === "debtService" ? "loans" : "bills";
  }
}

/**
 * @param {Object} p
 * @param {Array}  p.events        flat Future Money events (spending + saving + debt), unmodified
 * @param {Array}  p.commitments   Mandatory Commitments ({id,name,amount,categoryId,skippedMonths})
 * @param {string} p.monthKey      "YYYY-MM" being planned
 * @param {number} p.monthBudget   that month's budget (0 when none is set)
 * @param {string} p.today         "YYYY-MM-DD"
 * @param {(e:Object)=>string|null} [p.catIdOf] category id of an event, when known
 * @param {Array}  [p.groups]      Pay together groups ({id,date,items}); cash moves to the group's date, budget stays in each due month
 */
export function buildReadiness({ events, commitments, monthKey, monthBudget, today, catIdOf = () => null, groups = [] }) {
  const active = (commitments || []).filter(c => !(c.skippedMonths || []).includes(monthKey) && Number(c.amount) > 0);
  const byCat = new Map(active.filter(c => c.categoryId).map(c => [String(c.categoryId), c]));

  // 0 · Pay together: the whole group's CASH lands in the group's date month; BUDGET stays in each due month
  const groupOf = new Map();
  for (const g of groups || []) for (const it of g.items || []) groupOf.set(itemKey(it), g);
  const groupRows = { spending: [], saving: [] };
  for (const g of groups || []) {
    if (monthKeyOf(g.date) !== monthKey) continue;
    const live = liveItems(g, events);
    for (const [cls, list] of [["spending", live.filter(e => e.category !== "committedSaving")], ["saving", live.filter(e => e.category === "committedSaving")]]) {
      if (!list.length) continue;
      const cash = r2(list.reduce((a, e) => a + Number(e.amount), 0));
      const budget = cls === "saving" ? null : r2(list.filter(e => monthKeyOf(e.date) === monthKey).reduce((a, e) => a + Number(e.amount), 0));
      const sameType = list.every(e => typeKeyOf(e) === typeKeyOf(list[0]));
      const months = [...new Set(list.map(e => monthKeyOf(e.date)))].sort();
      const span = months.length > 1 ? ` · ${shortMonth(months[0])}–${shortMonth(months[months.length - 1])}` : ` · ${shortMonth(months[0])}`;
      groupRows[cls].push({
        key: `group:${g.id}:${cls}`, kind: cls === "saving" ? "investment" : "group", groupId: g.id,
        label: `${sameType ? (TYPE_LABEL[typeKeyOf(list[0])] || "Instalments") : "Paid together"} ×${list.length}`,
        sub: `Paid together ${dayMonth(g.date)}${span}`, cash, budget, estimate: false, items: list,
      });
    }
  }

  // 1 · which events count in this month, and whether each is an estimate
  const counted = [];
  for (const e of events || []) {
    if (!e || !e.date || e.status === "paid") continue;
    const grp = groupOf.get(itemKey(e));
    if (grp && monthKeyOf(grp.date) === monthKey) continue; // already inside this month's group row
    if (grp && monthKeyOf(e.date) !== monthKey) continue;   // grouped, and not due here: nothing to show
    const amount = Number(e.amount) || 0;
    if (!(amount > 0)) continue;
    const eMonth = monthKeyOf(e.date);
    let estimate;
    if (eMonth === monthKey) {
      const section = daysBetween(today, e.date) <= 30 ? "next30" : "later";
      estimate = isEstimatedOccurrence(e.sourceType, section);
    } else if (isMonthlyRhythm(e) && eMonth < monthKey) {
      estimate = true; // the same item recurring into this month: a projection, not a bill yet
    } else continue;
    const grp2 = groupOf.get(itemKey(e));
    const cash = grp2 ? 0 : amount; // grouped: the cash is in the group's month
    const budget = e.category === "committedSaving" ? null : (e.budgetAmount != null ? Number(e.budgetAmount) : amount);
    counted.push({ event: e, cash, budget, estimate, paidTogether: grp2 ? grp2.date : null });
  }

  // 2 · commitments cover bills in their category
  const covered = new Map(); // commitment id -> items
  const free = [];
  for (const it of counted) {
    const c = it.event.category === "committedSaving" ? null : byCat.get(String(catIdOf(it.event)));
    if (c) { if (!covered.has(c.id)) covered.set(c.id, []); covered.get(c.id).push(it); } else free.push(it);
  }

  const spendingRows = [];
  for (const c of active) {
    const items = covered.get(c.id) || [];
    const coveredSum = r2(items.reduce((s, i) => s + i.cash, 0));
    const amount = Math.max(Number(c.amount), coveredSum);
    spendingRows.push({
      key: `commitment:${c.id}`, kind: "commitment", label: c.name,
      sub: items.length ? `Locked · covers ${items.length} bill${items.length === 1 ? "" : "s"}` : "Locked each month",
      cash: r2(amount), budget: r2(amount), estimate: false, items: items.map(i => i.event),
    });
  }

  const typeGroups = new Map();
  for (const it of free) {
    const key = typeKeyOf(it.event);
    if (!typeGroups.has(key)) typeGroups.set(key, []);
    typeGroups.get(key).push(it);
  }
  const rowFor = (key, items, kind) => {
    const cash = r2(items.reduce((s, i) => s + i.cash, 0));
    const budget = kind === "investment" ? null : r2(items.reduce((s, i) => s + (i.budget ?? i.cash), 0));
    const names = items.map(i => i.event.name).filter(Boolean);
    const together = items.every(i => i.paidTogether) ? items[0].paidTogether : null;
    return {
      key, kind, label: TYPE_LABEL[key] || key,
      sub: together ? `Paid together ${dayMonth(together)}` : items.length === 1 ? (names[0] || "") : `${items.length} items`,
      cash, budget, estimate: items.some(i => i.estimate), items: items.map(i => i.event),
    };
  };
  for (const key of TYPE_ORDER) if (typeGroups.has(key)) spendingRows.push(rowFor(key, typeGroups.get(key), "spending"));
  const investmentRows = typeGroups.has("sips") ? [rowFor("sips", typeGroups.get("sips"), "investment")] : [];

  spendingRows.unshift(...groupRows.spending);
  investmentRows.unshift(...groupRows.saving);

  const spendingCash = r2(spendingRows.reduce((s, r) => s + r.cash, 0));
  const budgetUsed = r2(spendingRows.reduce((s, r) => s + r.budget, 0));
  const investments = r2(investmentRows.reduce((s, r) => s + r.cash, 0));
  const budget = Number(monthBudget) || 0;
  const over = budget > 0 && budgetUsed > budget ? r2(budgetUsed - budget) : 0;

  return {
    monthKey, spendingRows, investmentRows,
    spendingCash, investments, cashNeeded: r2(spendingCash + investments),
    budgetUsed, monthBudget: budget, over,
    spendingEstimated: spendingRows.some(r => r.estimate),
    empty: spendingRows.length === 0 && investmentRows.length === 0,
  };
}
