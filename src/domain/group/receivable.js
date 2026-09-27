// domain/group/receivable.js
//
// Extracted from App.jsx's inline getGroupCollectiveDue/groupReceivableTotal (byte-for-byte,
// bug fix included — see below) so the fix has real regression tests: this repo's only test
// mechanism is node:test against pure domain functions, there is no React/DOM harness.
//
// Bug fixed here (reported live: two groups split off one purchase, one "Attribute" — spent on
// the group's behalf, nobody owes it back — the other "Collect" — they owe you — and the
// Attribute group's own receivable total showed the SAME amount as the Collect group's):
//
// getGroupCollectiveDue(expense) reads a transaction's single, whole-transaction collective-due
// figure — it has no idea which group is asking. groupReceivableTotal(groupId) used to fall
// through to it whenever this group's OWN groupAllocations row wasn't found with mode==="owes" —
// which is also exactly what happens for a group whose own row exists but has some OTHER mode
// (e.g. "spent_on"/Attribute). Since a multi-group transaction's legacy singular `groupId` field
// only records which allocation row was entered first (see App.jsx's save logic,
// `groupAllocationsVal[0]?.groupId`) — not who owes — an Attribute-mode group could easily end up
// as that primary `groupId`, hit the fallthrough, and inherit the OTHER group's whole
// collective-due amount. The fix: if this group has ANY of its own groupAllocations row (owes or
// not), that row alone decides its contribution — mode !== "owes" means zero, never a fallback to
// the whole-transaction figure. Only a transaction with no groupAllocations at all (a genuinely
// single-group, legacy-shaped expense) reaches getGroupCollectiveDue.

import { remainingShare } from "../shared/remainingShare.js";

/**
 * A transaction's own whole-transaction "collective due" figure — how much of it is owed back
 * collectively, net of what's already settled. Byte-for-byte the same arithmetic as the original
 * inline App.jsx function; only ever meaningful for a transaction with no groupAllocations (a
 * true single-group expense), per this module's own header and groupReceivableTotal's guard below.
 */
export function getGroupCollectiveDue(expense) {
  if (!expense?.groupId || expense?.type !== "expense") return 0;
  const hasIndividualReceivable = Object.entries(expense?.people || {}).some(([pid, info]) => pid !== "__me__" && info?.mode === "owes" && Number(info?.amount || 0) > 0 && !info?.settled);
  const trackingMode = expense?.trackingMode || (hasIndividualReceivable ? "split" : (expense?.forPerson || expense?.groupId ? "tag" : "none"));
  if (trackingMode !== "split" && trackingMode !== "allocate") return 0;
  if (expense.groupCollectiveAmount !== undefined && expense.groupCollectiveAmount !== null) {
    return Math.max(0, Number(expense.groupCollectiveAmount || 0) - Number(expense.groupCollectiveSettledAmt || 0));
  }
  return hasIndividualReceivable ? 0 : Math.max(0, Number(expense.amount || 0));
}

/**
 * Total amount a group owes the Master User: unsettled Transaction splits/allocations + unpaid
 * Bill splits + individually-tagged member expenses/loans, all scoped to this one groupId.
 *
 * @param {Object} deps - { txns, bills, loans, groups }
 * @param {string} groupId
 * @returns {number}
 */
export function groupReceivableTotal({ txns, bills, loans, groups }, groupId) {
  const txnOwed = (txns || []).filter(t => t.type === "expense" && (
    t.groupId === groupId ||
    t.groupAllocations?.some(g => g.groupId === groupId && g.mode === "owes" && Number(g.amount || 0) > 0)
  )).reduce((sum, t) => {
    const groupAlloc = t.groupAllocations?.find(g => g.groupId === groupId && g.mode === "owes");
    if (groupAlloc) {
      const totalCollective = Number(t.groupCollectiveAmount || 0);
      const totalSettled = Number(t.groupCollectiveSettledAmt || 0);
      const groupAmt = Number(groupAlloc.amount || 0);
      const settledRatio = totalCollective > 0 ? Math.min(1, totalSettled / totalCollective) : 0;
      const remaining = Math.max(0, groupAmt - (groupAmt * settledRatio));
      return sum + remaining;
    }
    // This group has its own allocation row, just not an "owes" one — zero, never the
    // whole-transaction fallback below (the fix; see file header).
    if (t.groupAllocations?.some(g => g.groupId === groupId)) return sum;
    // Genuinely single-group (legacy) transaction: groupId unambiguously identifies this group.
    return sum + Object.entries(t.people || {}).reduce((inner, [pid, info]) => {
      if (pid === "__me__" || info.mode !== "owes" || info.settled) return inner;
      return inner + remainingShare(info);
    }, 0) + getGroupCollectiveDue(t);
  }, 0);

  const billOwed = (bills || []).filter(b => b.groupId === groupId && b.status === "unpaid").reduce((sum, b) =>
    sum + Object.entries(b.splitPeople || {}).reduce((inner, [pid, info]) => {
      if (pid === "__me__" || info.mode !== "owes" || info.settled) return inner;
      return inner + remainingShare(info);
    }, 0) + Number(b.groupCollectiveAmount || 0)
  , 0);

  const group = (groups || []).find(g => g.id === groupId);
  const memberIndividualOwed = (group?.members || []).reduce((sum, memberId) => {
    const memberTxnOwed = (txns || []).filter(t =>
      t.type === "expense" &&
      t.people?.[memberId]?.mode === "owes" &&
      !t.people?.[memberId]?.settled &&
      !t.groupId // not a group expense - avoid double counting
    ).reduce((s, t) => s + remainingShare(t.people[memberId]), 0);
    const memberLoanOwed = (loans || []).filter(l =>
      l.direction !== "taken" &&
      l.status === "active" &&
      String(l.personId || l.linkedPersonId || "") === String(memberId)
    ).reduce((s, l) => s + Number(l.outstanding || 0), 0);
    return sum + memberTxnOwed + memberLoanOwed;
  }, 0);

  return txnOwed + billOwed + memberIndividualOwed;
}
