// domain/loans/autoEmiProgress.js
//
// An EMI purchase on a card creates every instalment up front as a dated card expense and a loan marked
// `autoScheduled` that lists them in `scheduledInstallmentIds` (App.jsx, Add Expense > EMI). Nothing used to move
// that loan forward as the instalments fell due: outstanding stayed at the full principal and the due date at the
// first instalment, so a finished EMI looked live forever (and kept counting in Financial Runway).
//
// This derives the progress from the instalments themselves. An instalment dated on or before today is billed to
// the card, so it is no longer owed to the plan:
//   outstanding = min(current outstanding, principal - sum of instalments dated <= today)
// min() keeps it idempotent and respects repayments the user already recorded by hand (never counts one twice, and
// a prepayment is never undone). The due date becomes the next instalment still ahead; when none is left the loan
// is closed on the date of its last instalment.
//
// Pure: returns the same array when nothing changes.

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

/** @returns {{loan:object, changed:boolean}} */
export function reconcileAutoEmiLoan(loan, txns, today) {
  if (!loan || loan.autoScheduled !== true || loan.status !== "active") return { loan, changed: false };
  const ids = new Set((loan.scheduledInstallmentIds || []).map(String));
  if (ids.size === 0) return { loan, changed: false };
  const insts = (txns || []).filter(t => ids.has(String(t.id)) && t.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (insts.length === 0) return { loan, changed: false };

  const billed = r2(insts.filter(t => String(t.date) <= today).reduce((s, t) => s + Number(t.amount || 0), 0));
  const current = Number(loan.outstanding || 0);
  const target = Math.max(0, r2(Number(loan.principal || 0) - billed));
  const outstanding = Math.min(current, target);
  const upcoming = insts.find(t => String(t.date) > today);
  const closes = outstanding <= 0.01 || !upcoming;
  const next = {
    ...loan,
    outstanding: closes ? 0 : outstanding,
    dueDate: upcoming ? upcoming.date : insts[insts.length - 1].date,
    ...(closes ? { status: "closed", closedDate: loan.closedDate || insts[insts.length - 1].date } : {}),
  };
  const delta = r2(current - next.outstanding);
  if (delta > 0) {
    next.repayments = [...(Array.isArray(loan.repayments) ? loan.repayments : []),
      { id: `auto_${loan.id}_${today}`, date: today, amount: delta, note: "Instalments billed to the card", auto: true }];
  }
  const changed = next.outstanding !== current || next.dueDate !== loan.dueDate || next.status !== loan.status;
  return changed ? { loan: next, changed: true } : { loan, changed: false };
}

/** Applies reconcileAutoEmiLoan to every loan; returns the SAME array when nothing changed. */
export function reconcileAutoEmiLoans(loans, txns, today) {
  let any = false;
  const out = (loans || []).map(l => { const r = reconcileAutoEmiLoan(l, txns, today); if (r.changed) any = true; return r.loan; });
  return any ? out : loans;
}
