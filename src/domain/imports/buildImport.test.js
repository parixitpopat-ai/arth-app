import test from "node:test";
import assert from "node:assert/strict";
import { buildImportTxns, looksLikeCardBill, importedKeysOf, batchTxnIds, applyMerges, undoImportBatch } from "./buildImport.js";

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

test("merge: the existing entry is only linked (nothing else changes); statement ref copied only if it had none; undo restores exactly", () => {
  const mine = { id: "m1", type: "expense", amount: 120, date: "2026-04-03", merchant: "Chai Point", catIds: ["food"], people: { p1: { mode: "spent_on" } }, transactionRef: null };
  const hasRef = { id: "m2", type: "expense", amount: 5, date: "2026-04-03", transactionRef: "MINE-1" };
  const other = { id: "o", type: "expense", amount: 1, date: "2026-04-01" };
  const list = [mine, hasRef, other];
  const merged = applyMerges(list, [{ txnId: "m1", row: { importKey: "k9", ref: "412345" } }, { txnId: "m2", row: { importKey: "k10", ref: "ZZ" } }], { batchId: "B7" });
  assert.equal(merged[0].amount, 120); assert.equal(merged[0].merchant, "Chai Point"); assert.deepEqual(merged[0].catIds, ["food"]); assert.deepEqual(merged[0].people, mine.people);
  assert.equal(merged[0].importKey, "k9"); assert.equal(merged[0].importBatchId, "B7"); assert.equal(merged[0].transactionRef, "412345");
  assert.equal(merged[1].transactionRef, "MINE-1");                 // an existing reference is never replaced
  assert.equal(merged[2], other);                                    // untouched entries are the same object
  assert.deepEqual(importedKeysOf(merged), ["k9", "k10"]);
  assert.deepEqual(undoImportBatch(merged, "B7"), [mine, hasRef, other]);
});
test("merge: an entry already linked is never linked again; undo removes created entries but keeps merged ones", () => {
  const linked = { id: "m1", amount: 1, importKey: "old", importBatchId: "B1", importMerged: true };
  assert.equal(applyMerges([linked], [{ txnId: "m1", row: { importKey: "new" } }], { batchId: "B2" })[0].importKey, "old");
  const created = { id: "c1", importKey: "k", importBatchId: "B3" };
  const keep = { id: "m3", amount: 2 };
  const m = applyMerges([created, keep], [{ txnId: "m3", row: { importKey: "k2" } }], { batchId: "B3" });
  const back = undoImportBatch(m, "B3");
  assert.deepEqual(back, [keep]);
});

test("build: card mode keeps the description as the vendor and never turns a charge into a card payment", () => {
  const out = buildImportTxns([{ row: { date: "2026-10-06", desc: "ZOMATO CYBS DELHI", ref: "1", amountPaise: -37510, importKey: "c1" } }, { row: { date: "2026-10-07", desc: "CREDIT CARD PAYMENT BILL", ref: "", amountPaise: -1000, importKey: "c2" } }],
    { accountId: "cc1", batchId: "B", cards: [{ id: "cc1", last4: "1" }], newId, plainExpenses: true });
  assert.equal(out[0].type, "expense"); assert.equal(out[0].accId, "cc1"); assert.equal(out[0].merchant, "Zomato Cybs Delhi");
  assert.equal(out[1].type, "expense");
});

import { cleanCardMerchant, planNameRepairs } from "./buildImport.js";
test("card vendors: the UPI prefix and the trailing country code are dropped; the UPI reference becomes the entry's reference", () => {
  assert.equal(cleanCardMerchant("UPI-211737389994-VIPULACH AL ENTERPRISE IN"), "VIPULACH AL ENTERPRISE");
  assert.equal(cleanCardMerchant("ZOMATO CYBS NEWDELHI IN"), "ZOMATO CYBS NEWDELHI");
  const out = buildImportTxns([{ row: { date: "2026-10-16", desc: "UPI-211737389994-VIPULACH AL ENTERPRISE IN", ref: "14376807059", amountPaise: -65000, importKey: "c1" } }], { accountId: "cc1", batchId: "B", cards: [], newId, plainExpenses: true });
  assert.equal(out[0].merchant, "Vipulach Al Enterprise"); assert.equal(out[0].transactionRef, "211737389994");
});
test("repairs: entries named Dr/Cr or 'Upi-<ref>-…' by an earlier version get the right vendor; nothing else is touched", () => {
  const list = [
    { id: 1, type: "expense", importKey: "k", merchant: "Dr", desc: "UPI/DR/412345678901/SWIGGY/HDFC/s@ic/x" },
    { id: 2, type: "expense", importKey: "k", merchant: "Upi-171831146733-Mcdonald S In", desc: "UPI-171831146733-MCDONALD S IN" },
    { id: 3, type: "expense", importKey: "k", merchant: "Chai Point", desc: "x" },
    { id: 4, type: "expense", merchant: "Dr", desc: "typed by hand" },
  ];
  assert.deepEqual(planNameRepairs(list), [{ id: 1, from: "Dr", to: "Swiggy" }, { id: 2, from: "Upi-171831146733-Mcdonald S In", to: "Mcdonald S" }]);
});

import { planRefRepairs } from "./buildImport.js";
test("merge: a UPI payment's reference is its UTR (not a card statement's SerNo); only copied when the entry has none", () => {
  const card = { id: "m1", type: "expense", amount: 559, date: "2026-09-17", transactionRef: null };
  const row = { importKey: "k1", desc: "UPI-221718689935-SNACK BA RR IN", ref: "14308206086" };               // ref is the card statement's SerNo
  const out = applyMerges([card, { id: "m2", type: "expense", amount: 1, date: "2026-09-17", transactionRef: "MINE" }], [{ txnId: "m1", row }, { txnId: "m2", row: { ...row, importKey: "k2" } }], { batchId: "B" });
  assert.equal(out[0].transactionRef, "221718689935"); assert.equal(out[0].importSetRef, true);
  assert.equal(out[1].transactionRef, "MINE");
  const noUpi = applyMerges([{ ...card }], [{ txnId: "m1", row: { importKey: "k3", desc: "ZOMATO", ref: "14308206999" } }], { batchId: "B" });
  assert.equal(noUpi[0].transactionRef, "14308206999");                                                             // no UTR: the file's own reference, as before
});
test("import: a bank debit paid by UPI is marked Payment Method UPI; a card charge, a bank credit and a non-UPI debit are not", () => {
  const rows = [{ date: "2026-10-06", desc: "UPI/DR/412345678901/SWIGGY/HDFC/s@ic/x", ref: "", amountPaise: -100, importKey: "a" }, { date: "2026-10-06", desc: "NEFT-X", ref: "", amountPaise: -100, importKey: "b" }, { date: "2026-10-06", desc: "UPI/CR/412345678902/X/HDFC/x@ic/y", ref: "", amountPaise: 100, importKey: "c" }].map(row => ({ row }));
  const bank = buildImportTxns(rows, { accountId: "a1", batchId: "B", cards: [], newId, accountType: "bank" });
  assert.deepEqual(bank.map(t => t.paymentMethod), ["UPI", undefined, undefined]);
  const card = buildImportTxns([rows[0]], { accountId: "c1", batchId: "B", cards: [], newId, plainExpenses: true, accountType: "cc" });
  assert.equal(card[0].paymentMethod, undefined);
});
test("repairs: entries an earlier merge gave a SerNo get the UTR from their import key; correct ones are left alone", () => {
  const list = [
    { id: 1, importMerged: true, importSetRef: true, transactionRef: "14308206086", importKey: "cc1|2026-09-17|-55900|14308206086|upi 221718689935 snack ba rr in|0" },
    { id: 2, importMerged: true, importSetRef: true, transactionRef: "221718689935", importKey: "cc1|2026-09-17|-55900||upi 221718689935 x|0" },
    { id: 3, importMerged: true, importSetRef: true, transactionRef: "14308206999", importKey: "cc1|2026-09-17|-100|14308206999|zomato cybs|0" },
    { id: 4, importMerged: true, transactionRef: "MINE", importKey: "x|upi 221718689935" },
  ];
  assert.deepEqual(planRefRepairs(list), [{ id: 1, field: "transactionRef", from: "14308206086", to: "221718689935" }]);
});
test("card vendor from a bank-app description with a hash prefix", () => {
  assert.equal(cleanCardMerchant("Hdfc6d8e912e45d4d79bb1d43ada1dcc09e_upi-104449304091-Zomato L"), "Zomato L");
  assert.equal(cleanCardMerchant("UPI-211737389994-VIPULACH AL ENTERPRISE IN"), "VIPULACH AL ENTERPRISE");
  assert.equal(cleanCardMerchant("SWIGGY INSTAMART BLR"), "SWIGGY INSTAMART BLR");
  const fix = planNameRepairs([{ id: "a", importKey: "k", type: "expense", merchant: "Hdfc6d8e912e45d4d79bb1d43ada1dcc09e_upi-104449304091-Zomato L" }]);
  assert.equal(fix.length, 1); assert.equal(fix[0].to, "Zomato L");
});
