import { test } from "node:test";
import assert from "node:assert/strict";
import { extractDMonYDate, extractUpiMerchant } from "./smsFields.js";

const REAL = "[BP-ICICIT-S] ICICI Bank Credit Card XX8004 debited for INR 670.01 on 04-Nov-26 for UPI--PAX INNO. To dispute call 18001080/SMS BLOCK 8004 to 9215676766";
// what parseSms hands to the readers after it strips the fraud/footer text
const stripped = t => t.replace(/not you[?.]?.*/i, "").replace(/call.*\d{10}.*/i, "").replace(/helpline.*/i, "").replace(/block.*/i, "").replace(/to dispute.*/i, "").replace(/report.*/i, "").replace(/\b\d{10,}\b/g, "");

test("the reported SMS: date 04-Nov-26 and merchant PAX INNO", () => {
  assert.equal(extractDMonYDate(stripped(REAL)), "2026-11-04");
  assert.equal(extractUpiMerchant(stripped(REAL)), "Pax Inno");
  assert.equal(extractUpiMerchant(REAL), "Pax Inno", "also without the footer being stripped first");
});
test("dates: day-Mon-year in the common bank spellings", () => {
  for (const [t, iso] of [["on 04-Nov-26", "2026-11-04"], ["4-Nov-2026", "2026-11-04"], ["04/Nov/26", "2026-11-04"], ["04 Nov 26", "2026-11-04"], ["on 1-Jan-27.", "2027-01-01"], ["29-Feb-28", "2028-02-29"], ["15-SEP-25", "2025-09-15"], ["3rd Mar 2026", "2026-03-03"], ["04-November-26", "2026-11-04"], ["31-Dec-99", "1999-12-31"]]) assert.equal(extractDMonYDate(t), iso, t);
});
test("dates: impossible or absent dates give nothing", () => {
  for (const t of ["31-Feb-26", "29-Feb-27", "00-Nov-26", "32-Nov-26", "no date here", "", null, undefined, "04-Xyz-26", "on 04-11-26"]) assert.equal(extractDMonYDate(t), "", String(t));
});
test("merchant: the common UPI description shapes", () => {
  for (const [t, name] of [
    ["debited for INR 99 on 04-Nov-26 for UPI--PAX INNO.", "Pax Inno"],
    ["Info: UPI-PAX INNO", "Pax Inno"],
    ["UPI/P2M/412345678901/PAX INNO", "Pax Inno"],
    ["Paid via UPI/412345678901/Swiggy Instamart Ref 12", "Swiggy Instamart"],
    ["UPI-123456789012-SWIGGY-swiggy@ybl-Order", "Swiggy"],
    ["debited INR 10 for UPI-Zomato Ltd. Avl bal INR 100", "Zomato Ltd"],
    ["UPI: BIG BAZAAR, ref no 5", "Big Bazaar"],
    ["for UPI-M&S Traders on 04-Nov-26", "M&S Traders"],
  ]) assert.equal(extractUpiMerchant(t), name, t);
});
test("merchant: nothing clear -> null so the other readers still run", () => {
  for (const t of ["debited INR 670.01 for groceries", "UPI-123456789012", "UPI/P2M/412345678901", "UPI-name@ybl", "UPI--", "UPI-X", "", null, undefined, "Credit Card XX8004 debited for INR 670.01 on 04-Nov-26"]) assert.equal(extractUpiMerchant(t), null, String(t));
});
test("merchant: a non-UPI description is not touched even with the word 'for'", () => {
  assert.equal(extractUpiMerchant("debited for INR 670.01 at AMAZON PAY on 04-Nov-26"), null);
});
