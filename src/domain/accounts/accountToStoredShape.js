// ACC-002 WP-02 — Account -> stored-shape conversion (Step 3).
//
// The mirror image of accountFromStoredShape() (Step 2): takes a hydrated
// Account instance and returns a plain object in accounts[]'s current,
// pre-ADR-035 field-naming shape — `type`, `accountTypeId`, `typeLabel`,
// `typeIcon`, `typeBucket` — so it can be written straight into
// setAccounts()/localStorage/cloud sync without changing what every other
// piece of App.jsx (accountBalance, getCardSummary, ledgerRows, the 16
// mutation sites, migrateLegacyAccount() itself) already expects to read.
// Renaming the stored field names is explicitly out of scope for WP-02
// (that's WP-09/WP-10, gated on WP-02/03/06 first) — this function exists
// specifically so WP-02 doesn't have to do that rename to use the aggregate.
//
// Deliberately builds the output object field-by-field rather than
// spreading the Account instance: a spread would carry over the instance's
// own ADR-035-named fields (behavior, classificationId, classificationLabel,
// icon, bucket) *alongside* their renamed legacy counterparts, and would
// leak internal aggregate bookkeeping (_deleted) into persisted data. Only
// the fields accounts[] has ever actually stored are emitted here.
//
// Pure conversion only — no validation, no invariant checks. Account.js
// already validated everything when the instance was created/updated;
// this function's only job is renaming, not re-checking.

export function accountToStoredShape(account) {
  return {
    id: account.id,
    type: account.behavior,
    name: account.name,
    color: account.color,
    last4: account.last4,
    accountTypeId: account.classificationId,
    typeLabel: account.classificationLabel,
    typeIcon: account.icon,
    typeBucket: account.bucket,
    openingBalance: account.openingBalance,
    openingBalanceDate: account.openingBalanceDate,
    needsCalibration: account.needsCalibration,
    limit: account.limit,
    outstanding: account.outstanding,
    statementDate: account.statementDate,
    dueDate: account.dueDate,
    alertPct: account.alertPct,
    billingCycle: account.billingCycle,
    linkedBank: account.linkedBank,
    handle: account.handle,
    linkedAccount: account.linkedAccount,
    attributedTo: account.attributedTo,
    attributeType: account.attributeType,
    excludeFromWealth: account.excludeFromWealth,
    status: account.status,
  };
}
