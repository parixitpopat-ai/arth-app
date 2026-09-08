// WP-TXN-01 — Representability boundary.
//
// Principle (locked by product decision during WP-TXN-01 planning):
//   The new domain boundary must never accept a transaction it cannot
//   represent losslessly. A legacy record that the current `Transaction`
//   aggregate cannot fully represent — even if it's an otherwise ordinary
//   expense/income — is NOT_YET_REPRESENTABLE and must be handled by the
//   existing legacy `upsertTxn()` path, unchanged.
//
// This is the ONE place that owns this decision. `PostTransactionHandler`
// and `EditTransactionHandler` stay legacy-shape-agnostic (they only ever
// see already-mapped domain payloads); `AddModal` stays free of a growing
// checklist of special cases — it calls the transaction boundary (see
// transactionBoundary.js) and the boundary consults this module once.
//
// This module is intentionally pure (no I/O, no React, no repository) so it
// can be tested directly against plain objects.

export const NOT_YET_REPRESENTABLE = "NOT_YET_REPRESENTABLE";

// Mirrors TransactionPersonShare.VALID_MODES exactly. Duplicated here
// (rather than imported) on purpose: this file's job is to reason about the
// LEGACY shape's compatibility with the domain, so it names the domain's
// constraint explicitly rather than reaching into TransactionPersonShare's
// internals. If the aggregate's valid modes ever change, this constant must
// be updated deliberately — that's a signal, not friction to route around.
const AGGREGATE_VALID_PERSON_SHARE_MODES = ["owes", "owes_by_me", "on_me"];

function hasCategorySplit(draft) {
  const catIds = draft.catIds || [];
  return catIds.length > 1 || Boolean(draft.catAllocations);
}

// Every non-"__me__" entry in a legacy `people` dict must use a mode the
// aggregate's TransactionPersonShare actually accepts. Real legacy data is
// confirmed (by direct trace) to also use "spent_on" for attribution/tagging
// purposes unrelated to owed-amount splitting — that mode has no domain
// equivalent today, so any record containing it is NOT_YET_REPRESENTABLE.
function hasUnrepresentablePersonShareMode(people) {
  if (!people) return false;
  return Object.entries(people).some(([personId, info]) => {
    if (personId === "__me__") return false;
    if (!info || info.mode == null) return false;
    return !AGGREGATE_VALID_PERSON_SHARE_MODES.includes(info.mode);
  });
}

// Structural equality of the parts of a legacy `people` dict that
// Transaction.edit() cannot change (it never touches personShares at all).
// Deliberately ignores settledAmt/remainingAmt/settled — those are
// settlement-progress bookkeeping that can legitimately differ between the
// loaded record and a fresh read without representing an edit the user
// asked for.
function peopleUnchanged(draftPeople = {}, priorPeople = {}) {
  const draftKeys = Object.keys(draftPeople).filter(k => k !== "__me__");
  const priorKeys = Object.keys(priorPeople).filter(k => k !== "__me__");
  if (draftKeys.length !== priorKeys.length) return false;
  return draftKeys.every(personId => {
    const d = draftPeople[personId];
    const p = priorPeople[personId];
    if (!p) return false;
    return Number(d.amount) === Number(p.amount) && d.mode === p.mode;
  });
}

/**
 * @param {"create"|"edit"} operation
 * @param {object} draft - the legacy-shaped record about to be submitted
 * @param {object|null} priorStoredRecord - the existing stored record, required for "edit"
 * @returns {{representable: true} | {representable: false, code: "NOT_YET_REPRESENTABLE", reason: string}}
 */
export function checkRepresentability({ operation, draft, priorStoredRecord = null }) {
  if (draft.type !== "expense" && draft.type !== "income") {
    return notRepresentable(`type "${draft.type}" is outside WP-TXN-01 scope (expense/income only)`);
  }

  if (hasCategorySplit(draft)) {
    return notRepresentable("category split (catIds.length > 1 or catAllocations) has no Transaction.categoryId equivalent");
  }

  if (hasUnrepresentablePersonShareMode(draft.people)) {
    return notRepresentable('a person-share mode outside ["owes","owes_by_me","on_me"] has no TransactionPersonShare equivalent');
  }

  if (operation === "edit") {
    if (!priorStoredRecord) {
      return notRepresentable("edit requested but no prior stored record was found for this id");
    }
    if (hasUnrepresentablePersonShareMode(priorStoredRecord.people)) {
      return notRepresentable("the existing record already contains a person-share mode with no domain equivalent");
    }
    if (String(draft.accId ?? "") !== String(priorStoredRecord.accId ?? "")) {
      return notRepresentable("account reassignment has no Transaction.edit() equivalent");
    }
    if (!peopleUnchanged(draft.people, priorStoredRecord.people)) {
      return notRepresentable("person-share change has no Transaction.edit() equivalent");
    }
  }

  return { representable: true };
}

function notRepresentable(reason) {
  return { representable: false, code: NOT_YET_REPRESENTABLE, reason };
}
