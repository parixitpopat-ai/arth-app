// WP-TXN-01 — Stored shape -> domain mapping.
//
// Callers MUST run checkRepresentability() first (see
// transactionRepresentability.js) — this module assumes the record is
// already known-representable and does not re-check. It maps fields; it
// does not decide policy.

// personShares are only meaningful for type "expense" — the aggregate
// itself throws if personShares is non-empty for any other type, and plain
// income never carries an owed-split in the legacy shape.
function storedPeopleToPersonShares(people, type) {
  if (type !== "expense" || !people) return [];
  return Object.entries(people)
    .filter(([personId]) => personId !== "__me__")
    .map(([personId, info]) => ({
      personId,
      amount: info.amount,
      mode: info.mode,
      settledAmt: info.settledAmt || 0,
    }));
}

/**
 * Maps a legacy stored record to the payload shape `Transaction.post()`
 * (create) expects, and to the field object `new Transaction(...)` accepts
 * directly (hydration for load(), which must NOT raise a TransactionPosted
 * event). Plain personShare objects are passed through — `Transaction`'s own
 * constructor already wraps each into a `TransactionPersonShare`, so this
 * function does not duplicate that wrapping.
 */
export function transactionFromStoredShape(stored) {
  return {
    id: stored.id,
    type: stored.type,
    date: stored.date,
    amount: stored.amount,
    accountId: stored.accId,
    categoryId: stored.catId ?? null,
    subcategoryId: stored.subId ?? null,
    note: stored.note ?? null,
    personShares: storedPeopleToPersonShares(stored.people, stored.type),
  };
}

// Maps a legacy stored draft to the *changes* object Transaction.edit()
// accepts. Only the five fields edit() actually applies — this function
// must never be extended to include accId/people; if those need to change,
// checkRepresentability() will already have routed the submission to the
// legacy path before this function is ever called.
export function storedDraftToEditChanges(draft) {
  return {
    amount: draft.amount,
    note: draft.note ?? null,
    categoryId: draft.catId ?? null,
    subcategoryId: draft.subId ?? null,
    date: draft.date,
  };
}
