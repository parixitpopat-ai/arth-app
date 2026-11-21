// domain/bills/billMonthTitle.js
//
// A bill is named for the month it was GENERATED in: "July Water Bill". The generation date is the bill's own date (billDate, else createdDate, else dueDate), never the
// due date, so a bill generated on 27 July and due on 2 August is still the July bill. It is a display name only; the stored name is never changed. Used where bills are
// listed in a message (statements), so each line says which month's bill it is.
//
//   * A name that already says a month ("July Water Bill") is left alone.
//   * "Bill" is added when the name does not already say what it is (bill, statement, fee, rent, EMI, premium, maintenance, subscription, recharge, plan, insurance, tax, loan,
//     instalment, membership). "Water" becomes "July Water Bill"; "Rent" becomes "July Rent".
//   * The year is added only when the bill is not from this year ("July 2025 Water Bill").

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = MONTHS.map(m => m.slice(0, 3));
const NAMES_MONTH = new RegExp(`\\b(${MONTHS.join("|")}|${SHORT.join("|")})\\b`, "i");
const SAYS_WHAT = /\b(bill|statement|fees?|rent|emi|premium|maintenance|subscription|recharge|plan|insurance|tax|loan|instal?lments?|membership)\b/i;

export function billMonthTitle(bill, { today = new Date() } = {}) {
  const base = String((bill && (bill.name || bill.merchant)) || "").trim() || "Bill";
  const m = /^(\d{4})-(\d{2})/.exec(String((bill && (bill.billDate || bill.createdDate || bill.dueDate)) || ""));
  const month = m ? MONTHS[Number(m[2]) - 1] : null;
  if (!month || NAMES_MONTH.test(base)) return base;
  const named = SAYS_WHAT.test(base) ? base : `${base} Bill`;
  const year = m[1] !== String(today.getFullYear()) ? ` ${m[1]}` : "";
  return `${month}${year} ${named}`;
}
