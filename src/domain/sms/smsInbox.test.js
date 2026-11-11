import test from "node:test";
import assert from "node:assert/strict";
import { looksLikeMoneySms, parseMoneySms, sortSmsToAccounts, smsRows } from "./smsInbox.js";
import { withImportKeys } from "../imports/statement.js";
import { matchStatement } from "../imports/matchStatement.js";
import { extractUtr } from "../imports/utr.js";

const CARD = { id: 1, body: "Rs.222.14 spent on HDFC Bank Card x1234 at ZOMATO on 10-11-26. Avl limit Rs.50,000. Not you? Call 1800", date: Date.UTC(2026, 10, 10, 8) };
const UPI = { id: 2, body: "Rs 500.00 debited from A/c XX5678 on 04-Nov-26 to VPA swiggy@ybl (UPI Ref No 104449304091). Not you? Call bank", date: Date.UTC(2026, 10, 4, 8) };
const CR = { id: 3, body: "Rs 12,000.00 credited to A/c XX5678 on 05-Nov-26. UPI Ref 104449304092 from rahul@okaxis", date: Date.UTC(2026, 10, 5, 8) };

test("money messages are recognised; OTP and offers are not", () => {
  assert.equal(looksLikeMoneySms(CARD.body), true);
  assert.equal(looksLikeMoneySms("Your OTP is 123456 for Rs 500 payment"), false);
  assert.equal(looksLikeMoneySms("Pre-approved loan up to Rs 5,00,000. Apply now"), false);
  assert.equal(looksLikeMoneySms("Hi, see you at 5"), false);
  assert.equal(parseMoneySms({ body: "hello" }), null);
});
test("card spend: debit sign, date, last4, merchant", () => {
  const p = parseMoneySms(CARD);
  assert.equal(p.ok, true); assert.equal(p.row.amountPaise, -22214); assert.equal(p.row.date, "2026-11-10"); assert.deepEqual(p.last4s, ["1234"]);
  assert.match(p.row.desc, /ZOMATO/i);
});
test("UPI debit / credit: reference found, sign right", () => {
  const d = parseMoneySms(UPI), c = parseMoneySms(CR);
  assert.equal(d.row.amountPaise, -50000); assert.equal(d.row.ref, "104449304091"); assert.equal(extractUtr(d.row), "104449304091"); assert.equal(d.row.date, "2026-11-04");
  assert.equal(c.row.amountPaise, 1200000); assert.equal(c.row.ref, "104449304092");
});
test("a transfer-style message is reported, not guessed", () => {
  const p = parseMoneySms({ id: 9, body: "Rs 500 debited from A/c XX1234 and credited to A/c XX5678 on 04-Nov-26", date: 1 });
  assert.equal(p.ok, false);
});
test("sorted to accounts by last 4; ambiguous or unknown go to 'noAccount'; seen ids skipped", () => {
  const accs = [{ id: "card", last4: "1234" }, { id: "bank", last4: "5678" }];
  const r = sortSmsToAccounts([CARD, UPI, CR, { id: 4, body: "Rs 10 spent on card 9999 at X on 01-11-26", date: 1 }], accs, { seenIds: [3] });
  assert.equal(r.byAccount.get("card").length, 1); assert.equal(r.byAccount.get("bank").length, 1);
  assert.equal(r.noAccount.length, 1); assert.equal(r.skippedSeen, 1);
});
test("SMS rows match an entry I already have (same amount, UTR) instead of duplicating", () => {
  const rows = withImportKeys(smsRows([parseMoneySms(UPI)]), "bank");
  const mine = [{ id: "m1", type: "expense", accId: "bank", amount: 500, date: "2026-11-04", merchant: "Swiggy", transactionRef: "104449304091" }];
  const m = matchStatement(rows, { transactions: mine, accountId: "bank", importedKeys: [], linkedIds: [], importedUtrs: [] });
  assert.equal(m.results[0].status, "probable-match");
});
