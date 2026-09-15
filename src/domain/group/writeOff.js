// domain/group/writeOff.js
//
// PGRP-001 WP1 — Group archive with financial-integrity gating.
//
// These functions generalize the existing, already-shipped per-member
// write-off mechanism (App.jsx's toggleMember: on removing a member with
// an outstanding balance, mark their unsettled "owes" entries settled —
// never delete or rewrite the underlying record) from "one member" to
// "every member and __me__ in this group at once," so Group Archive can
// require the same explicit write-off before an outstanding balance is
// allowed to be archived away.
//
// Scope boundary, matching toggleMember's own existing boundary exactly:
// this only settles entries in t.people / b.splitPeople with mode==="owes".
// It does not touch t.groupAllocations[] (the multi-group Txn breakup
// case) — toggleMember's existing write-off doesn't either. Extending
// coverage to groupAllocations is a separate, unscoped change, not part
// of this WP.
//
// No entry is ever deleted or amount-rewritten — only settled:true is
// set, exactly as toggleMember already does. This is a write-off (an
// explicit financial event the user consented to), not a history erase.

/**
 * Returns a new txns array with every unsettled "owes" entry belonging to
 * groupId, across every person (including __me__), marked settled:true.
 * Entries that don't match are returned unchanged (same array reference
 * where nothing changed, for cheap re-render skipping).
 *
 * @param {Array} txns
 * @param {string} groupId
 * @returns {Array}
 */
export function writeOffGroupTxns(txns, groupId) {
  return (txns || []).map(t => {
    if (t.groupId !== groupId || t.type !== "expense" || !t.people) return t;
    let changed = false;
    const nextPeople = { ...t.people };
    Object.entries(t.people).forEach(([pid, info]) => {
      if (info && info.mode === "owes" && !info.settled) {
        nextPeople[pid] = { ...info, settled: true };
        changed = true;
      }
    });
    return changed ? { ...t, people: nextPeople } : t;
  });
}

/**
 * Same operation as writeOffGroupTxns, for bills[]/splitPeople.
 *
 * @param {Array} bills
 * @param {string} groupId
 * @returns {Array}
 */
export function writeOffGroupBills(bills, groupId) {
  return (bills || []).map(b => {
    if (b.groupId !== groupId || b.status !== "unpaid" || !b.splitPeople) return b;
    let changed = false;
    const nextSplit = { ...b.splitPeople };
    Object.entries(b.splitPeople).forEach(([pid, info]) => {
      if (info && info.mode === "owes" && !info.settled) {
        nextSplit[pid] = { ...info, settled: true };
        changed = true;
      }
    });
    return changed ? { ...b, splitPeople: nextSplit } : b;
  });
}

/**
 * Whether a group has any outstanding balance in either direction, given
 * the two figures the group-detail screen already computes (groupReceivableTotal
 * for "owed to me", the existing groupIOwe reduction for "I owe"). This
 * function does not recompute either figure — it only combines two
 * already-correct numbers into the single yes/no gate WP1 requires,
 * exactly as the brief specifies: reuse existing logic, do not duplicate.
 *
 * @param {number} owedToMe
 * @param {number} iOwe
 * @returns {boolean}
 */
export function groupHasOutstandingBalance(owedToMe, iOwe) {
  return Number(owedToMe || 0) > 0 || Number(iOwe || 0) > 0;
}
