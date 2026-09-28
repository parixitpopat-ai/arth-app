// domain/billers/accountLabel.js
//
// WP1 (Arth IA — Payments, Outlook, Budget & Insights, §2/§3) — the one place that decides how a
// Biller Account ("Provider" in the UI) is labeled and searched, everywhere an existing
// Provider/account gets picked. Fixes the exact reported confusion: a Biller Account's own `name`
// is often just a NICKNAME the user gave it to tell two accounts under the same real Provider
// apart ("Home Electricity" vs "Parents' House," both under "Adani Power") — showing that
// nickname alone, with no Provider name and no account number, is what let "Parixit" and "Me"
// look like two different gyms instead of one duplicated account.
//
// Pure, read-only. Never used to derive anything financial — labeling and search text only.

/**
 * The Provider's real name for a Biller Account: the linked shell's name when one exists
 * (billerAccounts[].billerId → billers[]), else the account's own free-text `provider` field
 * (set on accounts created without a shell), else its own `name` as a last resort so a row is
 * never unlabeled.
 *
 * @param {Object} billerAccount
 * @param {Array} billers - biller shells
 * @returns {string}
 */
export function getProviderName(billerAccount, billers) {
  const shell = billerAccount?.billerId ? (billers || []).find(b => String(b.id) === String(billerAccount.billerId)) : null;
  return shell?.name || billerAccount?.provider || billerAccount?.name || "Unknown Provider";
}

/**
 * The account-identifying second line: the account's own nickname (only when it differs from the
 * Provider name — no point saying "Adani Power / Adani Power"), plus a masked account number when
 * one exists. Falls back to the account's type when neither is available, so a row is never blank.
 *
 * @param {Object} billerAccount
 * @param {Array} billers
 * @returns {string}
 */
export function getAccountLine(billerAccount, billers) {
  const providerName = getProviderName(billerAccount, billers);
  const nickname = billerAccount?.name || "";
  const showNickname = nickname && nickname !== providerName;
  const consumerNo = String(billerAccount?.consumerNo || "");
  const last4 = consumerNo ? consumerNo.slice(-4) : "";
  const parts = [showNickname ? nickname : null, last4 ? `A/c ****${last4}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : (billerAccount?.type || "");
}

/**
 * The full label for one Biller Account/Provider row, plus its search text — every field a
 * person might reasonably search by: Provider name, nickname, account type, and the FULL
 * (unmasked) account number, so both "search the whole number" and "search the last few digits"
 * work via plain substring matching.
 *
 * @param {Object} billerAccount
 * @param {Array} billers
 * @returns {{providerName:string, accountLine:string, searchText:string}}
 */
export function getProviderAccountLabel(billerAccount, billers) {
  const providerName = getProviderName(billerAccount, billers);
  const accountLine = getAccountLine(billerAccount, billers);
  const searchText = [providerName, billerAccount?.name, billerAccount?.type, billerAccount?.consumerNo]
    .filter(Boolean)
    .join(" ");
  return { providerName, accountLine, searchText };
}

/**
 * Search a list of Biller Accounts by Provider name, nickname, or full/partial account number.
 * Empty query returns every account, labeled. Case-insensitive; a partial account number matches
 * anywhere in the number (covers both "the whole number" and "just the last few digits").
 *
 * @param {Array} billerAccounts
 * @param {Array} billers
 * @param {string} query
 * @returns {Array<{billerAccount, providerName, accountLine, searchText}>}
 */
export function searchProviderAccounts(billerAccounts, billers, query) {
  const rows = (billerAccounts || []).map(ba => ({ billerAccount: ba, ...getProviderAccountLabel(ba, billers) }));
  const q = String(query || "").trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(r => r.searchText.toLowerCase().includes(q));
}
