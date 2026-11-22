import test from "node:test";
import assert from "node:assert/strict";
import { looksLikeBillSms, parseBillSms, extractDueDate, extractBillAmount, extractConsumerNo, matchBillerAccount } from "./billSms.js";

const power = { id: "m1", address: "VM-TORPWR", body: "Dear customer, your electricity bill of Rs.3,045.00 for consumer no 1234567890 is due on 28-Jul-26. Pay online to avoid late fee.", date: 1790000000000 };
const bas = [{ id: "ba1", name: "House Electricity", provider: "Torrent Power", consumerNo: "1234567890" }, { id: "ba2", name: "Office Water", provider: "City Water", consumerNo: "WT-77120045" }];

test("a bill notice looks like one; money movements, OTPs and promotions do not", () => {
  assert.equal(looksLikeBillSms(power.body), true);
  for (const t of ["Rs.450 debited from A/c XX9001 to SWIGGY", "Your OTP for bill payment is 123456, Rs.500", "Pay your bill and win cashback up to Rs.100", "Thank you for your payment of Rs.3045 towards your bill", "Your HDFC credit card bill of Rs.5000 is due on 05-Dec-26", "Statement of Rs.5000 is due on 05-Dec-26", "Your bill is ready", "Rs.3045"]) assert.equal(looksLikeBillSms(t), false, t);
});

test("amount, due date and consumer number are read from the wording", () => {
  assert.equal(extractBillAmount(power.body), 3045);
  assert.equal(extractDueDate(power.body), "2026-07-28");
  assert.equal(extractConsumerNo(power.body), "1234567890");
  assert.equal(extractDueDate("Bill Rs.500 payable by 05/08/2026"), "2026-08-05");
  assert.equal(extractDueDate("Bill Rs.500 due soon"), "");
});

test("it is matched to the connection with the same consumer number, else by provider name, else none", () => {
  assert.equal(matchBillerAccount(power, bas).id, "ba1");
  assert.equal(matchBillerAccount({ address: "CITYWATER", body: "Your water bill Rs.700 is due on 10-Aug-26" }, bas).id, "ba2");
  assert.equal(matchBillerAccount({ address: "XX", body: "Gas bill Rs.900 due 10-Aug-26" }, bas), null);
});

test("a proposal carries what was read, and an unmatched bill is called New bill", () => {
  const p = parseBillSms(power, bas);
  assert.deepEqual([p.kind, p.amount, p.dueDate, p.billerAccountId, p.title], ["bill", 3045, "2026-07-28", "ba1", "House Electricity"]);
  const q = parseBillSms({ id: "z", address: "XX", body: "Gas bill Rs.900 due on 10-Aug-26" }, bas);
  assert.deepEqual([q.title, q.billerAccountId, q.amount], ["New bill", "", 900]);
  assert.equal(parseBillSms({ id: "k", body: "hello" }, bas), null);
});
