// domain/cards/billerShellResolution.js
//
// A Credit Card's biller shell always has exactly one auto-created,
// linked BillerAccount (App.jsx's own shell-creation effect: one CC
// account -> one shell -> one billerAccount with accId pointing back to
// the real card). This resolves that link explicitly, rather than
// leaving the UI to re-derive it inline — and returns null rather than
// guessing if the expected shape isn't there, per the explicit
// instruction not to invent a fallback relationship.

/**
 * @param {Object} shell - a billers[] record (the shell, e.g. {id, name, type:"Credit Card", ...})
 * @param {Array} billerAccounts - the full billerAccounts[] array
 * @param {Array} accounts - the full accounts[] array
 * @returns {Object|null} the real accounts[] record for this Credit Card
 *   shell's linked card, or null if no such link exists (e.g. a non-CC
 *   shell, or a CC shell with no linked account yet)
 */
export function resolveCreditCardAccount(shell, billerAccounts, accounts) {
  if (!shell || shell.type !== "Credit Card") return null;
  const linkedBillerAccount = (billerAccounts || []).find(ba => ba.billerId === shell.id && ba.accId);
  if (!linkedBillerAccount) return null;
  return (accounts || []).find(a => a.id === linkedBillerAccount.accId) || null;
}
