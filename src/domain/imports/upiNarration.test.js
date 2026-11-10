import test from "node:test";
import assert from "node:assert/strict";
import { parseUpiNarration, describeUpiNarration } from "./upiNarration.js";
import { buildImportTxns } from "./buildImport.js";
import { extractUpiMerchant } from "../sms/smsFields.js";

test("narration: the cashback credit", () => {
  const p = parseUpiNarration("UPI/CR/104354172499/NPCI BHI/HDFC/bhimcas/BHIMCASHBACK");
  assert.deepEqual(p, { direction: "credit", rrn: "104354172499", name: "NPCI BHI", bank: "HDFC", handle: "bhimcas", remark: "BHIMCASHBACK", isCashback: true });
  assert.equal(describeUpiNarration(p), "NPCI BHI · BHIMCASHBACK");
});
test("narration: a debit, a missing remark, other layouts and rubbish", () => {
  const d = parseUpiNarration("UPI/DR/412345678901/SWIGGY/HDFC/swiggy@ic/Order food");
  assert.equal(d.direction, "debit"); assert.equal(d.name, "SWIGGY"); assert.equal(d.remark, "Order food"); assert.equal(d.isCashback, false);
  assert.equal(parseUpiNarration("UPI/DR/412345678901/SWIGGY/HDFC/swiggy").remark, "");
  assert.equal(parseUpiNarration("UPI-211737389994-VIPULACH AL ENTE"), null);
  assert.equal(parseUpiNarration("NEFT-SALARY"), null); assert.equal(parseUpiNarration(""), null); assert.equal(parseUpiNarration(null), null);
});
test("the older UPI-name reader no longer takes CR / DR as the merchant", () => {
  assert.equal(extractUpiMerchant("UPI/CR/104354172499/NPCI BHI/HDFC/bhimcas/BHIMCASHBACK"), "Npci Bhi");
  assert.equal(extractUpiMerchant("UPI/DR/412345678901/SWIGGY/HDFC/swiggy@ic/Order"), "Swiggy");
});
let n = 0; const newId = () => "t" + ++n;
test("import: the cashback credit gets the UPI reference as its reference and a readable description; a debit gets the other party as vendor", () => {
  const out = buildImportTxns([
    { row: { date: "2026-10-05", desc: "UPI/CR/104354172499/NPCI BHI/HDFC/bhimcas/BHIMCASHBACK", ref: "", amountPaise: 1200, importKey: "k1" } },
    { row: { date: "2026-10-06", desc: "UPI/DR/412345678901/SWIGGY/HDFC/swiggy@ic/Order food", ref: "", amountPaise: -25000, importKey: "k2" } },
    { row: { date: "2026-10-07", desc: "UPI/DR/412345678902/SHOP/HDFC/shop@ic/x", ref: "BANKREF1", amountPaise: -100, importKey: "k3" } },
  ], { accountId: "a1", batchId: "B", cards: [], newId });
  assert.equal(out[0].type, "income"); assert.equal(out[0].transactionRef, "104354172499"); assert.equal(out[0].desc, "NPCI BHI · BHIMCASHBACK");
  assert.equal(out[1].type, "expense"); assert.equal(out[1].merchant, "Swiggy"); assert.equal(out[1].transactionRef, "412345678901");
  assert.equal(out[2].transactionRef, "412345678902");                // the UPI reference (UTR) wins over the file's own reference column
});
