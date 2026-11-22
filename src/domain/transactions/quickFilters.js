// domain/transactions/quickFilters.js
//
// The four quick filters above the transaction list (the Design canvas "Money"): Everything, With people, Work, Loans.
// Each is a plain yes/no on one transaction, read from fields the app already saves. Pure.

export const QUICK_FILTERS = [
  { id: "all", label: "Everything" },
  { id: "people", label: "With people" },
  { id: "work", label: "Work" },
  { id: "loans", label: "Loans" },
];

const otherPeople = t => Object.keys(t?.people || {}).some(pid => pid !== "__me__");

export const isWithPeople = t => Boolean(t && (otherPeople(t) || t.paidByPersonId || t.fromPersonId || t.fromGroupId || t.guestPerson || t.groupId
  || (Array.isArray(t.allocations) && t.allocations.some(a => a && a.targetId && a.targetId !== "__me__"))));
export const isWork = t => Boolean(t && (t.reimbursable || t.claimOnly || t.reimbursedByTxnId));
export const isLoanEntry = t => Boolean(t && (t.linkedLoanId || t.isLoanDisbursal || t.madeFromTxnId));

export function matchesQuickFilter(t, id) {
  switch (id) {
    case "people": return isWithPeople(t);
    case "work": return isWork(t);
    case "loans": return isLoanEntry(t);
    default: return true;
  }
}
