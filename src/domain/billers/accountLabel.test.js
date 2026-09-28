import { test } from "node:test";
import assert from "node:assert/strict";
import { getProviderName, getAccountLine, getProviderAccountLabel, searchProviderAccounts } from "./accountLabel.js";

const billers = [{ id: "shell1", name: "Adani Power" }];
const billerAccounts = [
  { id: "ba1", billerId: "shell1", name: "Home Electricity", consumerNo: "900112346012", type: "Electricity" },
  { id: "ba2", billerId: "shell1", name: "Parents' House", consumerNo: "900198769012", type: "Electricity" },
  { id: "ba3", billerId: "shell1", name: "Rental Flat", consumerNo: "900155554518", type: "Electricity" },
  { id: "ba4", provider: "Netflix", name: "Netflix", type: "Other Subscription" }, // no shell, free-text provider
  { id: "ba5", name: "Gym membership", type: "Gym / Fitness" }, // no shell, no provider — name only
];

test("getProviderName: resolves from the shell when linked", () => {
  assert.equal(getProviderName(billerAccounts[0], billers), "Adani Power");
});

test("getProviderName: falls back to the account's own free-text provider when unshelled", () => {
  assert.equal(getProviderName(billerAccounts[3], billers), "Netflix");
});

test("getProviderName: falls back to the account's own name as a last resort", () => {
  assert.equal(getProviderName(billerAccounts[4], billers), "Gym membership");
});

test("getAccountLine: reported example — nickname + masked account number", () => {
  assert.equal(getAccountLine(billerAccounts[0], billers), "Home Electricity · A/c ****6012");
  assert.equal(getAccountLine(billerAccounts[1], billers), "Parents' House · A/c ****9012");
  assert.equal(getAccountLine(billerAccounts[2], billers), "Rental Flat · A/c ****4518");
});

test("getAccountLine: nickname never repeats the Provider name", () => {
  assert.equal(getAccountLine(billerAccounts[4], billers), "Gym / Fitness", "no consumerNo, name equals provider name -> falls back to type");
});

test("getProviderAccountLabel: reported example, full row shape", () => {
  const label = getProviderAccountLabel(billerAccounts[0], billers);
  assert.deepEqual(label, { providerName: "Adani Power", accountLine: "Home Electricity · A/c ****6012", searchText: "Adani Power Home Electricity Electricity 900112346012" });
});

test("searchProviderAccounts: reported example — searching the Provider name finds all three accounts, each disambiguated by its own account line", () => {
  const results = searchProviderAccounts(billerAccounts, billers, "Adani Power");
  assert.deepEqual(results.map(r => r.billerAccount.id).sort(), ["ba1", "ba2", "ba3"]);
  assert.deepEqual(results.map(r => r.accountLine).sort(), ["Home Electricity · A/c ****6012", "Parents' House · A/c ****9012", "Rental Flat · A/c ****4518"].sort());
});

test("searchProviderAccounts: searching a nickname finds the one specific account", () => {
  const results = searchProviderAccounts(billerAccounts, billers, "Home Electricity");
  assert.deepEqual(results.map(r => r.billerAccount.id), ["ba1"]);
});

test("searchProviderAccounts: searching the full account number finds the one specific account", () => {
  const results = searchProviderAccounts(billerAccounts, billers, "900198769012");
  assert.deepEqual(results.map(r => r.billerAccount.id), ["ba2"]);
});

test("searchProviderAccounts: searching just the last digits finds the one specific account", () => {
  const results = searchProviderAccounts(billerAccounts, billers, "6012");
  assert.deepEqual(results.map(r => r.billerAccount.id), ["ba1"]);
});

test("searchProviderAccounts: case-insensitive", () => {
  const results = searchProviderAccounts(billerAccounts, billers, "netflix");
  assert.deepEqual(results.map(r => r.billerAccount.id), ["ba4"]);
});

test("searchProviderAccounts: empty query returns every account, labeled", () => {
  const results = searchProviderAccounts(billerAccounts, billers, "");
  assert.equal(results.length, billerAccounts.length);
  assert.ok(results.every(r => r.providerName));
});

test("searchProviderAccounts: no match returns empty, not a crash", () => {
  assert.deepEqual(searchProviderAccounts(billerAccounts, billers, "no such thing"), []);
});
