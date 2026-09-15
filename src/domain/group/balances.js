// domain/group/balances.js
//
// PGRP-001 WP2 — group-scoped per-person balance calculations, extracted
// as pure functions so they can be genuinely unit-tested (this repo's
// only test mechanism is node:test against pure domain functions — there
// is no React/DOM test harness) and so Person Profile can consume them
// without duplicating their logic.
//
// getGroupMemberOwed is a byte-for-byte extraction of the function that
// previously lived inline inside App.jsx's People component (originally
// only reachable from toggleMember's write-off flow) — same filters, same
// arithmetic, only the data (txns, bills) is now passed in as parameters
// instead of closed over.
//

// getGroupMemberIOwe — implemented per explicit decision after the WP2 stop
// report: transaction-only, no invented bill path. It covers exactly ONE of
// the THREE sources that feed the unscoped settlements[pid].iOwe figure —
// the only one that is genuinely group-attributable in the current data
// model. The other two (settlement_in/settlement_out transactions) key off
// t.fromPersonId/t.toPersonId only; the unscoped payables computation never
// reads t.groupId or t.fromGroupId for them, and group-tagged settlements
// actually use a *different* field, fromGroupId, confirmed by direct trace
// of App.jsx (settlementTagGroup → repaymentGroupId → t.fromGroupId, never
// t.groupId). Inventing a groupId-scoping rule for settlements here — e.g.
// treating t.fromGroupId===groupId as equivalent to t.groupId===groupId —
// would be adding scoping behavior that doesn't exist in the unscoped
// source, not extracting existing behavior. So it is deliberately left out.
// This does not break reconciliation (see balances.test.js): it means the
// settlement_in/settlement_out contribution to iOwe, for any given person,
// is entirely part of the "non-group remainder" when reconciling against
// the unscoped total — never part of any single group's scoped figure.

import { remainingShare } from "../shared/remainingShare.js";

/**
 * How much the Master User owes a specific person, within a specific
 * group — the payable direction, transaction-only (see module header for
 * why no bill path exists here, matching the current unscoped reality).
 *
 * Mirrors the unscoped settlements computation's "Txn breakup O mode
 * (owes_by_me)" pathway exactly, including its two real asymmetries
 * against getGroupMemberOwed, preserved deliberately rather than
 * "corrected," per this WP's explicit instruction not to touch existing
 * settlement semantics:
 *   1. Uses the raw Number(info.amount||0), not remainingShare(info) —
 *      the unscoped source does not apply the settled-remainder logic to
 *      this pathway.
 *   2. Does not check info.settled at all — the unscoped source has no
 *      settled guard on this specific pathway (unlike its receivables
 *      counterpart, which does check !info.settled on bills).
 *
 * @param {Array} txns
 * @param {string} groupId
 * @param {string} pid
 * @returns {number}
 */
export function getGroupMemberIOwe(txns, groupId, pid) {
  if (pid === "__me__") return 0;
  return (txns || [])
    .filter(t => t.groupId === groupId && t.type === "expense" && t.people && t.people[pid] && t.people[pid].mode === "owes_by_me")
    .reduce((sum, t) => sum + Number(t.people[pid].amount || 0), 0);
}

/**
 * How much a specific person owes within a specific group — the
 * receivable direction ("what this person owes me, in this group").
 * Sums unsettled "owes"-mode entries from both the transaction ledger
 * and unpaid bills, scoped to groupId and pid.
 *
 * @param {Array} txns
 * @param {Array} bills
 * @param {string} groupId
 * @param {string} pid
 * @returns {number}
 */
export function getGroupMemberOwed(txns, bills, groupId, pid) {
  const txnOwed = (txns || [])
    .filter(t => t.groupId === groupId && t.type === "expense" && t.people && t.people[pid] && t.people[pid].mode === "owes" && !t.people[pid].settled)
    .reduce((sum, t) => sum + remainingShare(t.people[pid]), 0);
  const billOwed = (bills || [])
    .filter(b => b.groupId === groupId && b.status === "unpaid" && b.splitPeople && b.splitPeople[pid] && b.splitPeople[pid].mode === "owes" && !b.splitPeople[pid].settled)
    .reduce((sum, b) => sum + remainingShare(b.splitPeople[pid]), 0);
  return txnOwed + billOwed;
}
