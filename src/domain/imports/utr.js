// src/domain/imports/utr.js — the UTR (UPI reference / RRN) of a statement row, read from its narration.
// UPI and IMPS narrations carry a 12-digit reference: "UPI/CR/104354172499/…", "UPI-211737389994-NAME-…", "IMPS-RIB/Fund Trf/906920699478/". It is unique per
// transaction, so two entries with the same UTR are the same payment. A cheque number (6 digits), a card statement's serial number or a NEFT text reference are not
// treated as UTRs. Returns "" when there is none.

export function extractUtr(row) {
  const text = String((row && row.desc) || "");
  if (/(?<![a-z])(?:UPI|IMPS)(?![a-z])/i.test(text)) {   // not \b: "…hash_upi-104449304091-Zomato L" has an underscore, a word character
    const m = /(?<!\d)(\d{12})(?!\d)/.exec(text);
    if (m) return m[1];
  }
  // a card statement's "UPI-UPI-11104450178": the number after it is the payment's reference (not always 12 digits)
  const bare = /^\s*UPI[-/]UPI[-/](\d{9,14})\s*$/i.exec(text);
  if (bare) return bare[1];
  const ref = String((row && row.ref) || "").trim();
  return /^\d{12}$/.test(ref) ? ref : "";
}

/** Digits of an existing entry's reference, or "" — compared with a UTR by `includes` so "UTR 104354172499" still matches. */
export const refDigits = ref => String(ref || "").replace(/\D/g, "");
