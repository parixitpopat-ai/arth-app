// TRX-002C3 — Legacy Adapter for person-share settlement on a plain Transaction.
//
// Scope, deliberately narrow: this adapter only covers the "settle a person's
// share directly on a Transaction" case (the `kind:"txn"` branch of the legacy
// `applyRepaymentAllocations`, and the plain-transaction branch of
// `SettleModal.settle()`). It does NOT cover bill settlement (Bill has no
// aggregate yet), group-txn/group-bill links, or tagged-attribution links —
// those remain on legacy logic, unchanged, until their own aggregates/audits
// exist.
//
//   Legacy Adapter
//       |
//       +-- Transaction.applySettlement(...)   <- canonical, governed by ADR-033
//       |
//       +-- Legacy groupCollective update       <- CR-006, explicitly NOT canonicalized yet
//
// Group-collective tracking (`groupCollectiveAmount`/`groupCollectiveSettledAmt`)
// is intentionally left as legacy plain-object mutation here, not absorbed into
// the Transaction aggregate. Per CR-006: this repo's own discipline (ADR-001)
// says a concept only moves into the domain model once it's been audited as
// belonging there — group-collective tracking hasn't had that audit. Adding it
// to Transaction now would be changing the aggregate because of an
// implementation dependency, not because a business invariant was established.

import { Transaction } from "../Transaction.js";

export function settlePersonShareOnTransaction({ txn, personId, amount, todayStr }) {
  const info = txn.people?.[personId];
  if (!info) return txn; // matches legacy: `if(!txn.people?.[personId]) return txn;`

  // Reconstruct a minimal Transaction aggregate from the plain object — just
  // enough fields for applySettlement()'s invariants to hold. `accountId` and
  // `date` aren't used by settlement logic itself, but the constructor
  // requires them; passing the real values if present, safe placeholders if not.
  const aggregate = new Transaction({
    id: txn.id,
    type: txn.type,
    date: txn.date || todayStr(),
    amount: Number(txn.amount || info.amount || 0),
    accountId: txn.accId || "unknown",
    personShares: [{
      personId,
      amount: Number(info.amount || 0),
      mode: info.mode,
      settledAmt: Number(info.settledAmt || 0),
    }],
  });

  const { fullySettled } = aggregate.applySettlement(personId, amount);
  const updatedShare = aggregate.personShares[0];

  // Serialize back to the exact plain shape legacy code produces.
  const updatedInfo = {
    ...info,
    settled: fullySettled,
    settledAmt: updatedShare.settledAmt.amount,
    remainingAmt: updatedShare.remainingAmt.amount,
  };

  // --- CR-006: legacy pass-through, not canonicalized ---
  const addedAmt = updatedShare.settledAmt.amount - Number(info.settledAmt || 0);
  const groupCap = Number(txn.groupCollectiveAmount || 0);
  const nextGroupSettled = groupCap > 0
    ? Math.min(groupCap, Number(txn.groupCollectiveSettledAmt || 0) + addedAmt)
    : txn.groupCollectiveSettledAmt;

  return {
    ...txn,
    people: { ...txn.people, [personId]: updatedInfo },
    ...(groupCap > 0 ? { groupCollectiveSettledAmt: nextGroupSettled } : {}),
  };
}
