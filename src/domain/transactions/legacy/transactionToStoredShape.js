// WP-TXN-01 — Domain -> stored shape mapping.
//
// Unknown-field preservation strategy (see TxnsStateRepository.js for how
// `priorStoredRecord` is sourced — it is looked up fresh at save time, not
// threaded through from load()): spread the prior stored record first, then
// overwrite only the fields this aggregate actually owns. Any field the
// aggregate doesn't model (desc, merchant, transactionRef, imageBase64,
// reimbursement fields, price breakdown, etc.) passes through untouched.
//
// Fields the aggregate does NOT own are deliberately never assigned here,
// even to a default/empty value — assigning `catIds: []` or `people: {}`
// unconditionally would itself be a form of data loss (turning "field never
// set" into "field explicitly emptied", and for catIds specifically,
// silently discarding legacy readers' expectations). See the two
// conditionals below.

function personSharesToStoredPeople(personShares) {
  const people = {};
  for (const share of personShares) {
    people[share.personId] = {
      amount: share.amount.amount,
      mode: share.mode,
      settledAmt: share.settledAmt.amount,
      remainingAmt: share.remainingAmt.amount,
      settled: share.settled,
    };
  }
  return people;
}

/**
 * @param {Transaction} txn - the aggregate after post()/edit()
 * @param {object|null} priorStoredRecord - the record's previous stored
 *   shape, or null on create
 */
export function transactionToStoredShape(txn, priorStoredRecord = null) {
  const stored = {
    ...(priorStoredRecord || {}),
    id: txn.id,
    type: txn.type,
    date: txn.date,
    amount: txn.amount.amount,
    accId: txn.accountId,
    catId: txn.categoryId,
    subId: txn.subcategoryId,
    note: txn.note,
    updatedAt: Date.now(),
  };

  // catIds is the legacy plural form category-based readers (budget,
  // category views) actually key on. This boundary only ever admits
  // single-category records (checkRepresentability rejects splits before
  // this function is ever reached), so the plural form is always exactly
  // the singular category wrapped in an array — synthesized here so those
  // readers see a consistent shape, never left stale from a prior category.
  if (txn.categoryId) {
    stored.catIds = [txn.categoryId];
  } else {
    delete stored.catIds;
  }

  // Same reasoning as catIds above — subIds is read with an equivalent
  // fallback pattern by legacy subcategory resolution (confirmed at
  // App.jsx's subcategory-id helper), so it must stay in sync with subId.
  if (txn.subcategoryId) {
    stored.subIds = [txn.subcategoryId];
  } else {
    delete stored.subIds;
  }

  // personShares are only non-empty for type "expense" with a real split.
  // Plain income, and expenses with no split, must not have a `people` key
  // forced into existence where the legacy flow would never have set one.
  if (txn.personShares.length > 0) {
    stored.people = personSharesToStoredPeople(txn.personShares);
  }

  return stored;
}
