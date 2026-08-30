// domain/debt/futureMoney.js
//
// Pure Debt Service -> Future Money projection adapter. Reads loans[],
// accounts[], and txns[] as given, produces events in the exact I-1 event
// shape (matching src/domain/schoolFees/futureMoney.js's shape
// field-for-field). Never mutates anything. Never calls new Date()/
// Date.now() — "today" is always injected by the caller.
//
// Per the accepted trace, Arth's three debt mechanisms genuinely differ —
// this file does NOT unify them into one shape.
//
// THE RELEASE-CRITICAL FINDING THIS FILE WAS BUILT AROUND: getCardSummary()
// (src/domain/cards/summaries.js) already includes type==="cc_emi"
// transactions dated within the current statement cycle
// (prevStatementDate, lastStatementDate] inside currentDue — which flows
// into getCommitments()'s Committed Spending. So a ccEmiPlans[]-backed
// loan's current-cycle installment, if already logged as a real cc_emi
// transaction, is ALREADY represented in Future Money via Committed
// Spending. Projecting it again here as Debt Service would double it.
//
// This file resolves that by checking txns[] for an already-logged cc_emi
// transaction for this specific ccEmiPlanId within the current cycle
// window, using the exact same boundary convention getCardSummary() uses
// (prevStatementDate < date <= lastStatementDate). If found, this file
// projects the FOLLOWING cycle's due date instead of the current one — the
// next installment genuinely not yet reflected anywhere. If not found, the
// current cycle's due date (dueOn) is projected, since currentDue does not
// yet include it.
//
// getCardCycleDates() is imported and reused exactly as-is — this file
// never recomputes billing-cycle boundaries itself.
//
// Mechanism-specific handling, preserved exactly as the trace found them:
//
// 1. Pre-materialized CC-EMI-purchase installments (loan.autoScheduled ===
//    true) are EXCLUDED entirely. Their future is already real, dated
//    transactions in txns[] — projecting them again here would double
//    that spend. autoScheduled is checked first and short-circuits before
//    any of the above logic runs.
//
// 2. ccEmiPlans[]-backed loans (loan.ccEmiPlanId set, not autoScheduled)
//    get their date derived from the linked card's real billing cycle, per
//    the double-count-avoidance logic above.
//
// 3. Personal-loan EMI (taken, has emiAmount, no ccEmiPlanId) gets its date
//    derived from the loan's own dueDay via a simpler, independent
//    function — there's no card/cycle concept here, and no existing
//    authoritative function to defer to, so this is the one place this
//    file computes its own date math.
//
// A loan with no emiAmount at all produces no event. loan.outstanding is
// NEVER read by this file for the amount; only emiAmount is ever used.

import { computeNextOccurrenceOfDay } from "./dateDerivation.js";
import { getCardCycleDates } from "../cards/summaries.js";

function isWithinCycle(date, prevStatementDate, lastStatementDate) {
  return Boolean(date && prevStatementDate && lastStatementDate && date > prevStatementDate && date <= lastStatementDate);
}

function formatLocalDate(date) {
  if (!date) return null;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Determine the next legitimate due date for a ccEmiPlans[]-backed loan,
 * without double-counting a cycle whose installment is already reflected
 * in currentDue/Committed Spending via an already-logged cc_emi transaction.
 *
 * @param {Object} card - the linked account (accounts[] entry)
 * @param {Array} txns - txns[], used only to check for an already-logged
 *   cc_emi transaction for this ccEmiPlanId within the current cycle
 * @param {string} ccEmiPlanId
 * @param {Function} toDateOnly - injected, same date-normalization helper
 *   getCardSummary() itself takes, never imported directly by this file
 * @param {Date} today
 * @returns {string|null}
 */
export function computeNextCcEmiDueDate(card, txns, ccEmiPlanId, toDateOnly, today) {
  if (!card) return null;
  const cycle = getCardCycleDates(card, today);
  if (!cycle?.dueOn) return null;

  const alreadyLoggedThisCycle = (txns || []).some(t => {
    if (t.type !== "cc_emi" || t.ccEmiPlanId !== ccEmiPlanId) return false;
    const d = toDateOnly ? toDateOnly(t.date) : null;
    return isWithinCycle(d, cycle.prevStatementDate, cycle.lastStatementDate);
  });

  if (!alreadyLoggedThisCycle) {
    return formatLocalDate(cycle.dueOn); // current cycle's due date — not yet reflected in currentDue
  }

  // Already reflected this cycle — project the FOLLOWING cycle's due date instead.
  const dayAfterNextStatement = new Date(
    cycle.nextStatementDate.getFullYear(), cycle.nextStatementDate.getMonth(), cycle.nextStatementDate.getDate() + 1, 12, 0, 0, 0
  );
  const nextCycle = getCardCycleDates(card, dayAfterNextStatement);
  return formatLocalDate(nextCycle?.dueOn || null);
}

/**
 * Project a single loan into a Debt Service Future Money event, or null if
 * it shouldn't be projected at all.
 *
 * @param {Object} loan - a loans[] record
 * @param {Array} accounts - accounts[], used to look up the linked card
 * @param {Array} txns - txns[], used only for the CC-EMI double-count check
 * @param {Function} toDateOnly - injected date-normalization helper
 * @param {Date} today - reference date, injected by the caller
 * @returns {Object|null}
 */
export function mapLoanToDebtServiceEvent(loan, accounts, txns, toDateOnly, today) {
  if (!loan || typeof loan !== "object") return null;
  if (loan.direction !== "taken") return null; // "given" loans are receivables, never Debt Service

  // Pre-materialized CC-EMI-purchase installments already exist as real,
  // dated transactions in txns[] — checked first, short-circuits everything
  // below. Never projected again, regardless of any other field present.
  if (loan.autoScheduled === true) return null;

  const amount = Number(loan.emiAmount || 0);
  if (!(amount > 0)) return null; // no established recurring obligation — outstanding is never substituted here

  let date = null;
  let subCategory;
  if (loan.ccEmiPlanId) {
    subCategory = "ccEmi";
    const card = (accounts || []).find(a => a.id === loan.linkedCardId);
    date = computeNextCcEmiDueDate(card, txns, loan.ccEmiPlanId, toDateOnly, today);
  } else {
    subCategory = "personalLoanEmi";
    const dueDay = Number(loan.dueDay || 0);
    if (dueDay >= 1 && dueDay <= 31) {
      date = computeNextOccurrenceOfDay(today, dueDay);
    }
    // no valid dueDay -> date stays null, never guessed
  }

  return {
    sourceType: "debt",
    sourceId: loan.id,
    category: "debtService",
    subCategory,
    name: loan.name || "Loan EMI",
    amount,
    date, // may be null — the UI must show this as "date not established", never a fabricated date
    status: "upcoming",
    recurs: true,
  };
}

/**
 * Project a whole loans[] collection into Debt Service Future Money
 * events, silently dropping anything that shouldn't be projected.
 *
 * @param {Array} loans - loans[], any mix of direction/mechanism
 * @param {Array} accounts - accounts[], for CC statement-cycle lookups
 * @param {Array} txns - txns[], for the CC-EMI double-count check
 * @param {Function} toDateOnly - injected date-normalization helper
 * @param {Date} today - reference date, injected by the caller
 * @returns {Array} Debt Service events, one per genuinely projectable loan
 */
export function projectLoansToDebtServiceEvents(loans, accounts, txns, toDateOnly, today) {
  return (loans || [])
    .map(loan => mapLoanToDebtServiceEvent(loan, accounts, txns, toDateOnly, today))
    .filter(Boolean);
}
