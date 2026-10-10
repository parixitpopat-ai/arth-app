// domain/cards/statementBills.js
//
// Credit Card WP, rule 4 (the central domain change): when a statement
// closes, it becomes a REAL Bill record — not the live synthetic projection
// `getCardSummary` computed before this WP. This module generates those Bill
// records, lazily and idempotently, one per closed statement cycle, each
// carrying the billing-config version it was built from (rule 3) so a later
// billing change never reinterprets it.
//
// Reuses the exact charge/refund selection rule getCardSummary already used
// for "this cycle" (src/domain/cards/summaries.js), generalized to an
// arbitrary [from, to] boundary — one formula, not two competing ones.

import { dateAtDay, toLocalDateStr } from "../../helpers/dateHelpers.js";
import { genId } from "../../helpers/idGenerator.js";
import { getEffectiveBillingConfig } from "./billingConfig.js";

/**
 * A card's (and its linked UPI handles') net billed amount for one
 * statement period: charges (expense/investment/cc_emi) minus refund-type
 * settlement_in, both strictly after `from` and on/before `to` — the same
 * `d<=from||d>to` boundary rule as getCardSummary's lastCycleCharges.
 */
export function computePeriodAmount(card, accounts, txns, from, to, toDateOnly) {
  const linkedUpiIds = (accounts || []).filter(a => a.type === "upi" && a.linkedAccount === card.id).map(a => a.id);
  const allIds = [card.id, ...linkedUpiIds];
  const charges = (txns || []).reduce((sum, t) => {
    if ((t.type !== "expense" && t.type !== "investment" && t.type !== "cc_emi") || !allIds.includes(t.accId)) return sum;
    const d = toDateOnly(t.date);
    if (!d || d <= from || d > to) return sum;
    return sum + Number(t.amount || 0);
  }, 0);
  const refunds = (txns || []).reduce((sum, t) => {
    if (t.type !== "settlement_in" || !t.isRefund || !allIds.includes(t.accId)) return sum;
    const d = toDateOnly(t.date);
    if (!d || d <= from || d > to) return sum;
    return sum + Number(t.amount || 0);
  }, 0);
  return Math.round((charges - refunds) * 100) / 100;
}

/**
 * The statement-cycle boundary [from, to] and due date for the cycle ending
 * around `refDate`, using whichever billing config is effective for that
 * cycle's own statement day (not necessarily today's config).
 */
function cycleForRef(account, refDate) {
  const refDateStr = toLocalDateStr(refDate);
  const cfg = getEffectiveBillingConfig(account, refDateStr);
  const ref = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 12, 0, 0, 0);
  let to = dateAtDay(ref.getFullYear(), ref.getMonth(), cfg.statementDay);
  if (ref < to) to = dateAtDay(ref.getFullYear(), ref.getMonth() - 1, cfg.statementDay);
  const from = dateAtDay(to.getFullYear(), to.getMonth() - 1, cfg.statementDay);
  let dueOn = dateAtDay(to.getFullYear(), to.getMonth(), cfg.dueDay);
  if (dueOn <= to) dueOn = dateAtDay(to.getFullYear(), to.getMonth() + 1, cfg.dueDay);
  return { from, to, dueOn, cfg };
}

/** Parses "YYYY-MM-DD" as a local noon Date — never via `new Date(string)`,
 * which parses as UTC and can silently shift a day in non-UTC timezones. */
const parseIsoLocal = s => {
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
};

/** The cycle immediately after the one ending on `afterTo` (a Date, itself an exact statement day). */
function nextCycleAfter(account, afterTo) {
  const cfg = getEffectiveBillingConfig(account, iso(afterTo));
  let to = dateAtDay(afterTo.getFullYear(), afterTo.getMonth() + 1, cfg.statementDay);
  if (to <= afterTo) to = dateAtDay(afterTo.getFullYear(), afterTo.getMonth() + 2, cfg.statementDay);
  const from = dateAtDay(to.getFullYear(), to.getMonth() - 1, cfg.statementDay);
  let dueOn = dateAtDay(to.getFullYear(), to.getMonth(), cfg.dueDay);
  if (dueOn <= to) dueOn = dateAtDay(to.getFullYear(), to.getMonth() + 1, cfg.dueDay);
  return { from, to, dueOn, cfg };
}

// Dates here are local-noon values (dateAtDay), so the local day is the right one.
const iso = d => toLocalDateStr(d);

/**
 * Every closed statement cycle for this card that does not yet have a
 * generated Bill, as new (unpersisted) Bill-shaped records. Idempotent by
 * construction: walks forward strictly from the latest already-generated
 * Bill's period end, so calling this repeatedly against a `bills` array that
 * already contains its own prior output generates nothing further, until a
 * new cycle has genuinely closed. Never generates the still-open current
 * cycle (the one getCardSummary still reports live via `currentDue`).
 *
 * @returns {Array} plain Bill objects — caller appends to `bills` state.
 */
export function generateDueStatements({ card, accounts, txns, bills, toDateOnly, refDate = new Date() }) {
  const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 12, 0, 0, 0);
  const existing = (bills || []).filter(b => b.isCcStatement && b.accId === card.id);
  const latestGenerated = existing.length ? existing.map(b => b.periodTo).sort().slice(-1)[0] : null;

  const cycles = [];
  if (!latestGenerated) {
    // First-ever generation for this card: the most recently closed cycle —
    // numerically identical to what getCardSummary already shows as
    // "currentDue" today, so nothing appears to jump for the user.
    const first = cycleForRef(card, today);
    if (first.to <= today) cycles.push(first);
  } else {
    let cursor = parseIsoLocal(latestGenerated);
    while (true) {
      const next = nextCycleAfter(card, cursor);
      if (next.to > today) break;
      cycles.push(next);
      cursor = next.to;
    }
  }

  // No transactions, no bill: a cycle that netted to nothing produces no statement at all, so nothing can go
  // overdue. (The user is asked about such a cycle on billing day instead: getPendingStatementChecks.) A cycle
  // skipped here is looked at again on the next run, so entries added to it later still produce its bill.
  const withCharges = cycles
    .map(c => ({ ...c, amount: computePeriodAmount(card, accounts, txns, c.from, c.to, toDateOnly) }))
    .filter(c => c.amount > 0);

  return withCharges.map(({ from, to, dueOn, cfg, amount }) => ({
    id: genId(),
    isCcStatement: true,
    accId: card.id,
    billerCategory: "Credit Card",
    name: `${card.name || "Card"} Statement`,
    periodFrom: iso(from),
    periodTo: iso(to),
    arthAmount: amount,
    amount,
    dueDate: iso(dueOn),
    status: "unpaid",
    verification: "needs_verification",
    bankAmount: null,
    verifiedAt: null,
    billingConfigVersion: cfg.effectiveFrom,
    adjustments: [],
    createdAt: iso(today),
  }));
}

/**
 * A statement Bill that was generated for a cycle with nothing in it: unpaid, nothing recorded by Arth, nothing
 * entered from the bank. These exist from before "no transactions, no bill" and are removed. A bill with a bank
 * amount entered (even if Arth's own figure is 0) is real money the bank says is owed, so it is never one of these.
 */
export const isEmptyStatementBill = b =>
  Boolean(b && b.isCcStatement && b.status === "unpaid"
    && Number(b.arthAmount ?? b.amount ?? 0) === 0 && Number(b.amount || 0) === 0
    && (b.bankAmount == null || Number(b.bankAmount) === 0)
    && !(Array.isArray(b.adjustments) && b.adjustments.length));

/**
 * Billing-day check: for each card whose most recent statement cycle has closed and produced no bill (no
 * transactions in it), ask the user to confirm. "No transactions" is recorded on the card (statementChecks) and the
 * question is never asked again for that cycle; "Yes" leads to adding them, after which the bill appears by itself.
 * A snoozed question comes back the next day.
 *
 * @returns {Array<{cardId:string, cardName:string, from:string, to:string, periodTo:string}>}
 */
export function getPendingStatementChecks({ accounts, txns, bills, toDateOnly, today }) {
  const refDate = parseIsoLocal(today);
  const out = [];
  for (const card of (accounts || []).filter(a => a.type === "cc")) {
    const { from, to } = cycleForRef(card, refDate);
    if (to > refDate) continue;
    const periodTo = iso(to);
    if (card.openingBalanceDate && String(card.openingBalanceDate) > periodTo) continue; // card added after this cycle
    if ((bills || []).some(b => b.isCcStatement && b.accId === card.id && b.periodTo === periodTo)) continue;
    if (computePeriodAmount(card, accounts, txns, from, to, toDateOnly) > 0) continue; // it will get its bill
    const check = card.statementChecks && card.statementChecks[periodTo];
    if (check === "none") continue;
    if (typeof check === "string" && check.startsWith("snooze:") && check.slice(7) >= today) continue;
    out.push({ cardId: card.id, cardName: card.name || "Card", from: iso(from), to: periodTo, periodTo });
  }
  return out;
}
