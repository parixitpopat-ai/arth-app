import test from "node:test";
import assert from "node:assert/strict";
import { buildImportTxns, looksLikeCardBill, importedKeysOf, batchTxnIds } from "./buildImport.js";

let n = 0; const newId = () => "t" + ++n;
const rows = [
  { date: "2026-04-01", desc: "UPI/P2M/412345678901/PAX INNO", ref: "412345678901", amountPaise: -67001, importKey: "k1" },
  { date: "2026-04-02", desc: "SALARY APR", ref: "", amountPaise: 5000000, importKey: "k2" },
  { date: "2026-04-03", desc: "ICICI CC 8004 BILL PAYMENT", ref: "", amountPaise: -250000, importKey: "k3" },
  { date: "2026-04-04", desc: "CREDIT CARD PAYMENT", ref: "", amountPaise: -1000, importKey: "k4" },
];
const chosen = rows.map(row => ({ row, status: "new" }));

test("build: debit->expense uncategorised with merchant; credit->income; keys and batch stored", () => {
  const [a, b] = buildImportTxns(chosen, { accountId: "acc1", batchId: "B1", cards: [], newId });
  assert.equal(a.type, "expense"); assert.equal(a.amount, 670.01); assert.equal(a.merchant, "Pax Inno"); assert.deepEqual(a.catIds, []);
  assert.equal(a.importKey, "k1"); assert.equal(a.importBatchId, "B1"); assert.equal(a.accId, "acc1");
  assert.equal(b.type, "income"); assert.equal(b.amount, 50000);
});
test("build: card bill payment becomes cc_payment to the card with matching last four; no match stays flagged expense", () => {
  const cards = [{ id: "c1", last4: "8004" }, { id: "c2", last4: "1111" }];
  const out = buildImportTxns(chosen, { accountId: "acc1", batchId: "B1", cards, newId });
  assert.equal(out[2].type, "cc_payment"); assert.equal(out[2].toAccId, "c1"); assert.equal(out[2].fromAccId, "acc1"); assert.equal(out[2].accId, null);
  assert.equal(out[3].type, "expense"); assert.equal(out[3].cardBillUnmatched, true);
});
test("build: a single card is used when the text names none", () => {
  const out = buildImportTxns([chosen[3]], { accountId: "acc1", batchId: "B", cards: [{ id: "only", last4: "1" }], newId });
  assert.equal(out[0].type, "cc_payment"); assert.equal(out[0].toAccId, "only");
});
test("build: helpers", () => {
  assert.equal(looksLikeCardBill("Swiggy order"), false);
  const t = buildImportTxns(chosen, { accountId: "a", batchId: "B9", cards: [], newId });
  assert.deepEqual(importedKeysOf(t), ["k1", "k2", "k3", "k4"]);
  assert.equal(batchTxnIds(t, "B9").length, 4); assert.equal(batchTxnIds(t, "x").length, 0);
});
