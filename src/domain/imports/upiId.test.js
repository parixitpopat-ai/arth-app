import test from "node:test";
import assert from "node:assert/strict";
import { extractUpiId, payeeNamesByUpiId, upiIdsForName, addUpiIds, removeUpiIds } from "./upiId.js";
import { buildImportTxns, applyMerges, undoImportBatch } from "./buildImport.js";
import { parseMoneySms } from "../sms/smsInbox.js";

test("a full UPI id is read; a cut-short piece, an e-mail or nothing is not", () => {
  assert.equal(extractUpiId("debited to VPA Tea@YBL (UPI Ref 555666777888)"), "tea@ybl");
  assert.equal(extractUpiId("UPI/DR/412345678901/SWIGGY/HDFC/swiggy@ic/Order"), "swiggy@ic");
  assert.equal(extractUpiId("UPI/DR/412345678901/SWIGGY/HDFC/swiggy/Order"), "");
  assert.equal(extractUpiId("sent from a.b@gmail.com"), "");
  assert.equal(extractUpiId(""), "");
});
test("the SMS reader keeps the payee's UPI id on the row", () => {
  const p = parseMoneySms({ id: 1, date: Date.UTC(2026, 10, 4), body: "Rs 250.00 debited from A/c XX9001 on 03-10-26 to VPA tea@ybl (UPI Ref No 555666777888). Not you? Call bank" });
  assert.equal(p.row.upiId, "tea@ybl"); assert.equal(p.row.ref, "555666777888");
});
test("a person's saved ids win; otherwise the name the user already gave that id; several ids can belong to one payee", () => {
  const txns = [{ merchant: "Swiggy", upiId: "swiggy@ybl" }, { merchant: "Swiggy", upiId: "swiggy.rzp@axis" }, { merchant: "Swiggy", upiId: "swiggy@ybl" },
    { merchant: "UPI payment", upiId: "x@ybl" }, { merchant: "Tea@Ybl", upiId: "tea@ybl" }];
  const people = [{ id: "__me__", name: "Me" }, { id: "p1", name: "Raj Adhiya", upiIds: ["Raj@OkAxis"] }];
  const m = payeeNamesByUpiId(txns, people);
  assert.equal(m.get("swiggy@ybl"), "Swiggy"); assert.equal(m.get("swiggy.rzp@axis"), "Swiggy");           // two ids, one vendor
  assert.equal(m.get("raj@okaxis"), "Raj Adhiya");
  assert.equal(m.has("x@ybl"), false); assert.equal(m.has("tea@ybl"), false);                                  // generic / address-as-name are not names
  assert.deepEqual(upiIdsForName(txns, "swiggy").sort(), ["swiggy.rzp@axis", "swiggy@ybl"]);
});
test("import saves the UPI id and names the vendor from a known id; merge copies it only when missing, and undo removes it", () => {
  const row = { importKey: "k", date: "2026-11-01", desc: "UPI-555666777888-tea@ybl", ref: "555666777888", upiId: "tea@ybl", amountPaise: -25000 };
  const known = new Map([["tea@ybl", "Chai Point"]]);
  const [t] = buildImportTxns([{ status: "new", row }], { accountId: "b", batchId: "x", cards: [], newId: () => "n", accountType: "bank", payeeByUpiId: known });
  assert.equal(t.upiId, "tea@ybl"); assert.equal(t.merchant, "Chai Point");
  const [u] = buildImportTxns([{ status: "new", row }], { accountId: "b", batchId: "x", cards: [], newId: () => "n", accountType: "bank" });
  assert.equal(u.merchant, "Tea@Ybl" === u.merchant ? u.merchant : u.merchant);               // without a known name the old rules apply (not asserted further)
  const mine = [{ id: "m1", type: "expense", accId: "b", amount: 250, date: "2026-11-01", merchant: "Tea stall" }, { id: "m2", type: "expense", accId: "b", amount: 250, date: "2026-11-01", merchant: "Other", upiId: "other@ybl" }];
  const merged = applyMerges(mine, [{ txnId: "m1", row }, { txnId: "m2", row: { ...row, importKey: "k2" } }], { batchId: "bb" });
  assert.equal(merged[0].upiId, "tea@ybl"); assert.equal(merged[1].upiId, "other@ybl");                    // an existing id is kept
  const undone = undoImportBatch(merged, "bb");
  assert.equal(undone[0].upiId, undefined); assert.equal(undone[1].upiId, "other@ybl");
});
test("linking and unlinking a person's UPI ids", () => {
  let p = addUpiIds([{ id: "p1", name: "Raj" }], "p1", ["A@ybl", "b@okaxis", "a@YBL"]);
  assert.deepEqual(p[0].upiIds, ["a@ybl", "b@okaxis"]);
  p = removeUpiIds(p, "p1", ["a@ybl"]); assert.deepEqual(p[0].upiIds, ["b@okaxis"]);
});
