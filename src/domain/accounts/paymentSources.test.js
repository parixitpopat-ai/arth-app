import test from "node:test";
import assert from "node:assert/strict";
import { getPaidFromAccounts } from "./paymentSources.js";

const accounts = [
  { id: "bank", name: "HDFC", type: "bank" },
  { id: "cash", name: "Cash", type: "cash" },
  { id: "cc", name: "Amazon Visa", type: "cc" },
  { id: "debit", name: "HDFC Debit", type: "debit", linkedBank: "bank" },
  { id: "upi", name: "GPay", type: "upi", linkedAccount: "bank" },
  { id: "upi2", name: "Loose UPI", type: "upi" },
  { id: "ppf", name: "PPF", type: "bank", typeBucket: "investment" },
  { id: "fd", name: "SBI FD", type: "bank", typeBucket: "investment" },
];
const isInv = a => a.typeBucket === "investment";

test("Paid from lists bank, cash and credit card only", () => {
  assert.deepEqual(getPaidFromAccounts(accounts, { isInvestmentAccount: isInv }).map(a => a.id), ["bank", "cash", "cc"]);
});

test("debit cards and UPI handles never appear, linked or not", () => {
  const ids = getPaidFromAccounts(accounts, { isInvestmentAccount: isInv }).map(a => a.id);
  for (const id of ["debit", "upi", "upi2"]) assert.equal(ids.includes(id), false, id);
});

test("investment accounts (PPF, FD, NPS...) never appear", () => {
  const ids = getPaidFromAccounts(accounts, { isInvestmentAccount: isInv }).map(a => a.id);
  assert.equal(ids.includes("ppf"), false);
  assert.equal(ids.includes("fd"), false);
});

test("a card statement is paid from bank or cash, never a card", () => {
  assert.deepEqual(getPaidFromAccounts(accounts, { isInvestmentAccount: isInv, allowCard: false }).map(a => a.id), ["bank", "cash"]);
});

test("empty and missing input are safe", () => {
  assert.deepEqual(getPaidFromAccounts(undefined), []);
  assert.deepEqual(getPaidFromAccounts([null, undefined]), []);
});
