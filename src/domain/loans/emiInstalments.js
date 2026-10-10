// domain/loans/emiInstalments.js
//
// Dates of the instalments an EMI purchase on a card creates (Add Expense > EMI > Credit card EMI). One instalment per
// statement day, the first on the first statement day AFTER the purchase date: a purchase made on the statement day
// itself is billed on that statement, so its EMI starts the following month. dateAtDay clamps a statement day of 29-31
// into short months (31 -> 28 Feb, 30 Apr) without drifting: each month is derived from the statement day, not from
// the previous instalment's clamped day.

import { dateAtDay, toLocalDateStr } from "../../helpers/dateHelpers.js";

/** @returns {string[]} YYYY-MM-DD, `tenure` entries */
export function getEmiInstalmentDates({ purchaseDate, statementDay, tenure }) {
  const [y, m, d] = String(purchaseDate).slice(0, 10).split("-").map(Number);
  const day = Math.max(1, Math.min(31, Number(statementDay) || 15));
  const purchase = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  let cursor = dateAtDay(y, m - 1, day);
  if (toLocalDateStr(cursor) <= purchase) cursor = dateAtDay(y, m, day);
  const out = [];
  for (let i = 0; i < Math.max(0, Number(tenure) || 0); i++) {
    out.push(toLocalDateStr(cursor));
    cursor = dateAtDay(cursor.getFullYear(), cursor.getMonth() + 1, day);
  }
  return out;
}
