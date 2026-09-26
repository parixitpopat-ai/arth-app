// domain/billers/creditCardReconciliation.js
//
// Credit Card WP, rule 13 (last line): "If an existing Credit Card Biller is currently
// functioning as both Biller and Account identity, reconcile it to the canonical Account
// relationship instead of creating another entity." This is that reconciliation, extracted to a
// pure function so it can be verified directly rather than only by reading the effect that calls
// it (App.jsx's Credit Card migration effect).
//
// Root cause this exists to fix: cloud-synced accounts/billers/billerAccounts
// (applyCloudSnapshot, App.jsx ~L8295) arrive asynchronously, after the app's first render. A
// migration gated on a one-shot `useEffect(..., [])` can only ever see whatever was in
// localStorage at that first render — any account or biller that only existed in the
// not-yet-loaded cloud snapshot is permanently missed. This function itself is unaware of that
// timing; it's pure and stateless. The fix lives in the caller depending on real data
// (accounts/billers/billerAccounts) instead of `[]`, so it naturally re-evaluates once the cloud
// snapshot lands, and again on every later change — this function just has to stay idempotent,
// which a pure "what's still unlinked" function naturally is.
//
// Matches by name (case-insensitive), never by copying financial data — the match only ever
// produces a link (a billerAccounts row with accId), never a duplicate Bill/statement/ledger.

/**
 * @param {Array} accounts - full accounts[] array
 * @param {Array} billers - full billers[] array (shells)
 * @param {Array} billerAccounts - full billerAccounts[] array
 * @param {Function} genId - id generator, injected (not imported) to keep this pure
 * @param {number} now - Date.now(), injectable for deterministic tests
 * @returns {{ newBillers: Array, newBillerAccounts: Array }} — both empty if there's nothing to
 *   reconcile. Caller appends newBillers to `billers` and newBillerAccounts to `billerAccounts`.
 */
export function reconcileCreditCardBillers({ accounts, billers, billerAccounts, genId, now = Date.now() }) {
  const ccAccounts = (accounts || []).filter(a => a.type === "cc");
  if (ccAccounts.length === 0) return { newBillers: [], newBillerAccounts: [] };

  const linkedAccIds = new Set((billerAccounts || []).filter(ba => ba.accId).map(ba => ba.accId));
  const unlinked = ccAccounts.filter(a => !linkedAccIds.has(a.id));
  if (unlinked.length === 0) return { newBillers: [], newBillerAccounts: [] };

  const findExistingShell = name => (billers || []).find(
    b => b.type === "Credit Card" && (b.provider || b.name || "").trim().toLowerCase() === name.trim().toLowerCase()
  );

  const newBillers = [];
  const newBillerAccounts = [];
  unlinked.forEach(acc => {
    const existingShell = findExistingShell(acc.name);
    let shellId;
    if (existingShell) {
      shellId = existingShell.id;
    } else {
      const shell = { id: genId(), name: acc.name, type: "Credit Card", provider: acc.name, createdAt: now };
      newBillers.push(shell);
      shellId = shell.id;
    }
    newBillerAccounts.push({ id: genId(), billerId: shellId, accId: acc.id, name: acc.name, type: "Credit Card", consumerNo: null, createdAt: now });
  });

  return { newBillers, newBillerAccounts };
}
