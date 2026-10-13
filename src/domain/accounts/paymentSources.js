// domain/accounts/paymentSources.js
//
// What can appear under "Paid from": accounts the money actually leaves — a bank account, cash, or a credit card (money borrowed to pay).
// Never a debit card or a UPI handle (they are payment methods of a bank or card, not sources — FIN-TRUTH D2), and never an investment
// account such as PPF / FD / NPS (money put away is not a place you pay from). A card statement is paid from a bank or cash, never from a card.
// Pure; the investment test is injected because it reads the app's account-type buckets.

/**
 * @param {Array} accounts
 * @param {{isInvestmentAccount?:(a:Object)=>boolean, allowCard?:boolean}} [opts]
 * @returns {Array} the accounts that may be chosen as the source of a payment, in their stored order
 */
export function getPaidFromAccounts(accounts, { isInvestmentAccount = () => false, allowCard = true } = {}) {
  return (accounts || []).filter(a => {
    if (!a) return false;
    if (a.type === "debit" || a.type === "upi") return false;
    if (a.type === "cc") return allowCard;
    return !isInvestmentAccount(a);
  });
}
