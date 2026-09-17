// WP-BILLS-2A — preserves existing person-settlement progress (settledAmt/remainingAmt/settled)
// when a Bill's split configuration is edited. EditBillModal.save() previously rebuilt
// splitPeople wholesale from the edit form's current shares, silently discarding any
// settlement progress already recorded via settlePersonShareOnBill. This function merges the
// newly-edited amount/mode for each person with their EXISTING settledAmt (if any), recomputing
// remainingAmt/settled the same way settlePersonShareOnBill.js already does
// (Math.max(0, newAmount - settledAmt)) — not inventing new settlement semantics, just applying
// the existing formula against the edited amount instead of losing the progress entirely.
//
// Deliberately out of scope (unchanged from current behavior, not part of this fix):
// - A person who existed in the old splitPeople but is no longer selected in the edited shares
//   is dropped entirely — this matches the pre-existing behavior for removing someone from a
//   bill's split.
// - A newly-added person (no prior entry) gets a fresh {amount, mode} record with no settlement
//   fields, identical to AddBillModal's own construction.

export function mergeEditedSplitPeople(existingSplitPeople, editedShares, getPerson) {
  const existing = existingSplitPeople || {};
  const peopleSplit = {};
  Object.entries(editedShares || {}).forEach(([pid, sh]) => {
    const p = getPerson(pid);
    const mode = p?.personType !== "dependant" ? "owes" : "spent_on";
    const prior = existing[pid];
    if (!prior) {
      peopleSplit[pid] = { amount: sh, mode };
      return;
    }
    const settledAmt = Number(prior.settledAmt || 0);
    const remainingAmt = Math.max(0, Number(sh || 0) - settledAmt);
    peopleSplit[pid] = {
      amount: sh,
      mode,
      settledAmt,
      remainingAmt,
      settled: settledAmt > 0 && remainingAmt <= 0,
    };
  });
  return peopleSplit;
}
