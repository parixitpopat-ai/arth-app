// src/domain/imports/upiNarration.js — reads the bank narration of a UPI transaction as printed on an account statement, e.g.
//   UPI/CR/104354172499/NPCI BHI/HDFC/bhimcas/BHIMCASHBACK
//   UPI/DR/412345678901/SWIGGY/HDFC/swiggy@ic/Order food
// Layout (seen on one bank's statement, not verified for every bank): UPI / CR|DR / 12-digit UPI reference (RRN) / the other party's name (cut short by the
// bank) / the other party's bank / the first letters of the other party's UPI handle (cut short) / the payer's remark.
// Returns null when the text is not in this slash layout (other banks write "UPI-NAME-VPA-..." — see sms/smsFields.js).

const rx = /^\s*UPI\/(CR|DR)\/(\d{9,16})\/([^/]*)\/([^/]*)\/([^/]*)(?:\/(.*))?$/i;

export function parseUpiNarration(text) {
  const m = rx.exec(String(text || "").replace(/\s+/g, " ").trim());
  if (!m) return null;
  const clean = s => String(s || "").replace(/\s+/g, " ").trim();
  const name = clean(m[3]), remark = clean(m[6]);
  return {
    direction: m[1].toUpperCase() === "CR" ? "credit" : "debit",
    rrn: m[2],
    name,
    bank: clean(m[4]),
    handle: clean(m[5]),
    remark,
    isCashback: /cash\s*back/i.test(remark) || /^bhimcas/i.test(clean(m[5])),
  };
}

/** A short readable line for a parsed narration: "NPCI BHI · BHIMCASHBACK". */
export function describeUpiNarration(p) {
  if (!p) return "";
  return [p.name, p.remark && p.remark.toLowerCase() !== p.name.toLowerCase() ? p.remark : ""].filter(Boolean).join(" · ");
}
