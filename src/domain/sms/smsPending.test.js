import test from "node:test";
import assert from "node:assert/strict";
import { toPendingItems, itemStatuses, draftFor, nameFor } from "./smsPending.js";

const accounts = [{ id: "idfc", type: "bank", name: "IDFC", last4: "5748" }, { id: "cc1", type: "cc", name: "Card", last4: "1017" }];
const msg = (id, body, date = Date.UTC(2026, 10, 1)) => ({ id, address: "AX-BANK", body, date });
const UPI = msg("a", "Your a/c ending XXXXXXXX748 is debited by Rs. 200.00 on 01-11-26; HARIKESH credited. UPI Ref 232038797430. Not you? Call 1800");
const CARD = msg("b", "Rs.222.14 spent on HDFC Bank Card x1017 at ZOMATO on 10-11-26. Avl limit Rs.50,000");
const OTP = msg("c", "Your OTP is 123456 for Rs 500 payment");

test("queue messages become items; OTP is left out; each item remembers its account and import key", () => {
  const r = toPendingItems([UPI, CARD, OTP], accounts);
  assert.equal(r.items.length, 2);
  const u = r.items.find(i => i.id === "a"), c = r.items.find(i => i.id === "b");
  assert.equal(u.accountId, "idfc"); assert.equal(u.amountPaise, -20000); assert.equal(u.ref, "232038797430"); assert.ok(u.importKey.startsWith("idfc|2026-11-01|-20000|232038797430"));
  assert.equal(c.accountId, "cc1");
});
test("ids already held or handled are skipped", () => {
  assert.equal(toPendingItems([UPI, CARD], accounts, { haveIds: ["a"] }).items.length, 1);
});
test("a message that matches an entry I already have is 'match' (not a copy); one already saved is dropped; the rest are 'new'", () => {
  const { items } = toPendingItems([UPI, CARD], accounts);
  const mine = [{ id: "u1", type: "expense", accId: "idfc", amount: 200, date: "2026-11-01", merchant: "Uber", transactionRef: "232038797430", catIds: ["t"] }];
  const st = Object.fromEntries(itemStatuses(items, { txns: mine, accounts }).map(i => [i.id, i]));
  assert.equal(st.a.status, "match"); assert.equal(st.a.matchId, "u1"); assert.equal(st.b.status, "new");
  const saved = [{ id: "n1", type: "expense", accId: "cc1", amount: 222.14, date: "2026-11-10", importKey: items.find(i => i.id === "b").importKey }];
  assert.equal(itemStatuses(items, { txns: saved, accounts }).find(i => i.id === "b").status, "saved");
});
test("Accept opens the Add form filled in: name (a known UPI id wins), amount, date, account, reference; extras ride along", () => {
  const { items } = toPendingItems([UPI, CARD], accounts);
  const a = items.find(i => i.id === "a");
  const d = draftFor(a, accounts, new Map());
  assert.equal(d.type, "expense"); assert.equal(d.prefill.amount, "200"); assert.equal(d.prefill.date, "2026-11-01"); assert.equal(d.prefill.accId, "idfc"); assert.equal(d.prefill.transactionRef, "232038797430");
  assert.equal(d.prefill.extra.importKey, a.importKey); assert.equal(d.prefill.extra.importSource, "sms");
  assert.match(d.prefill.who, /harikesh/i);
  assert.equal(nameFor({ ...a, upiId: "hari@ybl" }, accounts, new Map([["hari@ybl", "Hari Chai"]])), "Hari Chai");
});
