// WP-TXN-01 — the one call site AddModal uses for plain expense/income
// create+edit. This is where "representable vs legacy" is decided — once,
// here — so App.jsx never accumulates a manually-maintained checklist of
// special cases as new unrepresentable shapes are discovered.
//
// Critical rule (locked by product decision): the ONLY thing that triggers
// the legacy fallback is an explicit, typed NOT_YET_REPRESENTABLE outcome
// from checkRepresentability(). A dispatch failure that happens AFTER a
// submission was judged representable (VALIDATION_ERROR, NOT_FOUND,
// UNHANDLED_ERROR, UNSUPPORTED_EDIT_FIELDS) is returned to the caller
// as-is — never caught, never silently redirected to the legacy path. A
// generic try/catch-and-fall-back-to-legacy would hide genuine bugs; that
// is explicitly the failure mode this design avoids.

import { checkRepresentability, NOT_YET_REPRESENTABLE } from "./transactionRepresentability.js";
import { transactionFromStoredShape, storedDraftToEditChanges } from "./transactionFromStoredShape.js";

/**
 * @param {"create"|"edit"} operation
 * @param {object} draft - legacy-shaped record about to be submitted
 * @param {object|null} priorStoredRecord - required for "edit"; the record's current stored shape
 * @param {{dispatch: Function}} dispatcher - the CommandDispatcher
 * @param {(draft: object) => void} legacyUpsert - the existing upsertTxn closure, called untouched on NOT_YET_REPRESENTABLE
 * @param {{setPendingCreateSourceDraft: Function}|null} repository - WP-TXN-02,
 *   optional, used only on the create path — when provided, the draft is
 *   registered as this create's passthrough source immediately before
 *   dispatch (see TxnsStateRepository.save()). Omitted entirely for edit,
 *   which is untouched by WP-TXN-02.
 */
export async function submitTransactionThroughBoundary({ operation, draft, priorStoredRecord = null, dispatcher, legacyUpsert, repository = null }) {
  const check = checkRepresentability({ operation, draft, priorStoredRecord });

  if (!check.representable) {
    legacyUpsert(draft);
    return { usedLegacyPath: true, code: NOT_YET_REPRESENTABLE, reason: check.reason };
  }

  if (operation === "create") {
    if (repository) repository.setPendingCreateSourceDraft(draft);
    const result = await dispatcher.dispatch({
      type: "PostTransaction",
      payload: transactionFromStoredShape(draft),
    });
    return { usedLegacyPath: false, result };
  }

  // operation === "edit"
  const result = await dispatcher.dispatch({
    type: "EditTransaction",
    payload: {
      transactionId: draft.id,
      changes: storedDraftToEditChanges(draft),
    },
  });
  return { usedLegacyPath: false, result };
}
