import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseExpenseText, resolvePaymentAccount, resolveCategory, findPossibleDuplicate, buildExpenseDraft,
} from "./naturalLanguageExpense.js";
import { computeAccountBalance } from "../accounts/accountBalance.js";
import { getCardSummary } from "../cards/summaries.js";
import { wireTransactionApplication } from "../../application/transactions/wiring.js";
import { submitTransactionThroughBoundary } from "./legacy/transactionBoundary.js";

const NOW = new Date(2026, 9, 17, 14, 0, 0); // Sat 17 Oct 2026
const parse = t => parseExpenseText(t, { now: NOW });
const deepFreeze = o => { Object.values(o).forEach(v => v && typeof v === "object" && deepFreeze(v)); return Object.freeze(o); };

// Synthetic accounts only.
const bank = { id: "b1", name: "Test Bank", type: "bank", last4: "9001" };
const cc3445 = { id: "c1", name: "Test Card A", type: "cc", last4: "3445" };
const cc7777 = { id: "c2", name: "Test Card B", type: "cc", last4: "7777" };
const debit3445 = { id: "d1", name: "Test Debit", type: "debit", last4: "3445", linkedBank: "b1" };
const upi = { id: "u1", name: "test@upi", type: "upi", linkedAccount: "b1" };
const cash = { id: "k1", name: "Wallet", type: "cash" };
const cats = [
  { id: "food", name: "Food & Dining" }, { id: "groceries", name: "Groceries" },
  { id: "transport", name: "Transport" }, { id: "health", name: "Health" }, { id: "health2", name: "Health Insurance" },
];

// ---- amounts ----------------------------------------------------------------------------------------------------
test("amounts: symbols, words, commas, lakh grouping, decimals", () => {
  const cases = [
    ["paid ₹3,000 to Dominos", 3000], ["paid Rs 450 to Dominos", 450], ["paid Rs. 1,25,000.50 to Dominos", 125000.5],
    ["paid INR 99 to Dominos", 99], ["paid 250 rupees to Dominos", 250], ["paid 3000 ₹ to Dominos", 3000],
    ["paid 199.5 to Dominos", 199.5], ["paid 3000 to Dominos", 3000],
  ];
  for (const [text, want] of cases) assert.equal(parse(text).amount, want, text);
});
test("amounts: missing, zero and conflicting amounts become questions, never a guess", () => {
  assert.equal(parse("paid to Dominos").amount, null);
  assert.ok(parse("paid to Dominos").questions.some(q => q.code === "amount-missing"));
  assert.equal(parse("paid ₹0 to Dominos").amount, null);
  const two = parse("paid ₹300 and ₹400 to Dominos");
  assert.equal(two.amount, null);
  assert.ok(two.questions.some(q => q.code === "amount-ambiguous"));
  assert.equal(parse("paid ₹300 (₹300) to Dominos").amount, 300, "the same amount twice is one amount");
});
test("the card suffix digits are never read as the amount", () => {
  assert.equal(parse("paid to Dominos via credit card ending 3445").amount, null);
  assert.equal(parse("paid 500 to Dominos card ending 3445").amount, 500);
});

// ---- merchants --------------------------------------------------------------------------------------------------
test("merchant: the user's own apostrophe is kept, straight or curly", () => {
  assert.equal(parse("I paid ₹3,000 to Domino’s via credit card ending 3445.").merchant, "Domino’s");
  assert.equal(parse("I paid ₹3,000 to Domino's via credit card ending 3445.").merchant, "Domino's");
});
test("merchant: punctuation inside names survives, sentence punctuation does not", () => {
  const cases = [
    ["paid ₹500 to H&M, via card 3445", "H&M"], ["paid ₹500 at Amazon.in.", "Amazon.in"],
    ["spent ₹80 at Dunkin' Donuts using cash", "Dunkin' Donuts"], ["spent ₹80 at 7-Eleven", "7-Eleven"],
    ["paid ₹80 to McDonald’s!", "McDonald’s"], ["paid ₹80 to \"Cafe Mocha\" in cash", "Cafe Mocha"],
    ["bought a shirt from Myntra for ₹999 using credit card 3445", "Myntra"],
    ["spent 450 at Starbucks on HDFC credit card 1234 yesterday", "Starbucks"],
  ];
  for (const [text, want] of cases) assert.equal(parse(text).merchant, want, text);
});
test("merchant: missing merchant is a question; 'for lunch' is used only when nothing else is given", () => {
  const none = parse("paid ₹500 via credit card 3445");
  assert.equal(none.merchant, null);
  assert.ok(none.questions.some(q => q.code === "merchant-missing"));
  assert.equal(parse("paid 200 for lunch in cash").merchant, "lunch");
  const both = parse("bought groceries for ₹1,200 at DMart with credit card xx3445");
  assert.equal(both.merchant, "DMart");
  assert.equal(both.description, null, "only a stated \"for ...\" is read, nothing is inferred");
});

// ---- dates ------------------------------------------------------------------------------------------------------
test("dates: default today, yesterday, day before yesterday, explicit forms", () => {
  assert.equal(parse("paid 100 to Dominos").date, "2026-10-17");
  assert.equal(parse("paid 100 to Dominos").dateStated, false);
  assert.equal(parse("paid 100 to Dominos today").date, "2026-10-17");
  assert.equal(parse("paid 100 to Dominos yesterday").date, "2026-10-16");
  assert.equal(parse("paid 100 to Dominos the day before yesterday").date, "2026-10-15");
  assert.equal(parse("paid 100 to Dominos on 2026-10-05").date, "2026-10-05");
  assert.equal(parse("paid 100 to Dominos on 05/10/2026").date, "2026-10-05", "day/month/year");
  assert.equal(parse("paid 100 to Dominos on 5-10-26").date, "2026-10-05");
  assert.equal(parse("paid 100 to Dominos on 12 Oct").date, "2026-10-12");
  assert.equal(parse("paid 100 to Dominos on 12th October 2025").date, "2025-10-12");
  assert.equal(parse("paid 100 to Dominos on Oct 3rd").date, "2026-10-03");
});
test("dates: impossible, future and year-less future dates are questions, not guesses", () => {
  const feb = parse("paid 100 to Dominos on 31 Feb");
  assert.equal(feb.date, null); assert.ok(feb.questions.some(q => q.code === "date-unreadable"));
  const fut = parse("paid 100 to Dominos on 2026-12-01");
  assert.equal(fut.date, null); assert.ok(fut.questions.some(q => q.code === "date-future"));
  const dec = parse("paid 100 to Dominos on 25 Dec");
  assert.equal(dec.date, null); assert.ok(dec.questions.some(q => q.code === "date-year"));
});
test("a date's numbers are not read as the amount or the card suffix", () => {
  const r = parse("paid ₹100 to Dominos on 12/10/2026 via card ending 3445");
  assert.equal(r.amount, 100); assert.equal(r.payment.last4, "3445"); assert.equal(r.date, "2026-10-12");
});

// ---- payment methods and suffixes -------------------------------------------------------------------------------
test("payment kind and suffix phrasings", () => {
  const cases = [
    ["via credit card ending 3445", "cc", "3445"], ["on my credit card ending in 3445", "cc", "3445"],
    ["using credit card xx3445", "cc", "3445"], ["with credit card ****3445", "cc", "3445"],
    ["by credit card, last 4 digits 3445", "cc", "3445"], ["via debit card ending 3445", "debit", "3445"],
    ["via card 3445", "card", "3445"], ["on HDFC credit card 3445", "cc", "3445"],
    ["via UPI", "upi", null], ["in cash", "cash", null], ["via net banking", "bank", null], ["via credit card", "cc", null],
  ];
  for (const [phrase, kind, last4] of cases) {
    const r = parse(`paid ₹100 to Dominos ${phrase}`);
    assert.deepEqual(r.payment, { kind, last4 }, phrase);
  }
});
test("two different card suffixes, or two payment kinds, are a question", () => {
  assert.ok(parse("paid ₹100 to Dominos via card ending 3445 or ending 7777").questions.some(q => q.code === "card-last4-ambiguous"));
  assert.ok(parse("paid ₹100 to Dominos via credit card and debit card").questions.some(q => q.code === "payment-kind-ambiguous"));
});

// ---- purchases versus card-bill payments and repayments ---------------------------------------------------------
test("a purchase made WITH a credit card is an expense", () => {
  for (const t of [
    "I paid ₹3,000 to Domino's via credit card ending 3445", "paid 3000 to Dominos using my credit card", "spent 500 at Zomato on credit card 3445",
    "paid ₹3,000 to Dominos with credit card ending 3445", "paid 3000 to HDFC Bank Ltd canteen by credit card",
  ]) assert.equal(parse(t).intent, "expense", t);
});
test("paying a credit-card BILL is not a purchase and is never drafted as one", () => {
  for (const t of [
    "paid ₹5,000 to my HDFC credit card ending 3445", "paid my credit card bill 5000", "credit card bill payment of 5000",
    "paid 5000 towards credit card", "HDFC credit card payment 5000", "paid the statement of my card 3445 ₹5000",
    "cleared credit card dues 5000", "paid 5000 to credit card",
  ]) {
    const r = parse(t);
    assert.equal(r.intent, "card_payment", t);
    assert.equal(r.detected, "card_payment");
    assert.equal(r.merchant, null, "no draft fields for a refused sentence");
    assert.equal(r.payment.kind, null);
    assert.match(r.message, /card bill payment\. Use the full form/);
  }
});
test("repayments, refunds and money received are not purchases", () => {
  for (const t of ["Rahul paid me back 500", "received ₹500 refund from Amazon", "salary credited 50000", "I repaid Rahul ₹500", "got back 300 from Rahul"]) {
    assert.equal(parse(t).intent, "not_a_purchase", t);
  }
});
test("empty or whitespace text drafts nothing", () => {
  assert.equal(parse("").intent, "empty");
  assert.equal(parse("   ").intent, "empty");
});

// ---- account resolution: one, many, none ------------------------------------------------------------------------
const accounts = [bank, cc3445, cc7777, debit3445, upi, cash];
test("one credit card ends in 3445: resolved, charged to the card, no bank and no payment method", () => {
  const r = resolvePaymentAccount({ kind: "cc", last4: "3445" }, accounts);
  assert.equal(r.status, "resolved"); assert.equal(r.accId, "c1"); assert.equal(r.paymentMethod, null);
});
test("the same four digits on a DEBIT card never satisfy a credit-card expectation", () => {
  const r = resolvePaymentAccount({ kind: "cc", last4: "3445" }, [bank, debit3445, cc7777]);
  assert.equal(r.status, "wrong-type"); assert.equal(r.accId, undefined);
  assert.match(r.message, /No credit card ending 3445, but .*3445 \(debit\) does\. Pick the account below\./);
});
test("a debit card resolves to its linked bank with the card as the payment method", () => {
  const r = resolvePaymentAccount({ kind: "debit", last4: "3445" }, accounts);
  assert.equal(r.status, "resolved"); assert.equal(r.accId, "b1"); assert.equal(r.paymentMethod, "Test Debit");
});
test("a debit card with no linked bank cannot be recorded against and is not guessed", () => {
  const r = resolvePaymentAccount({ kind: "debit", last4: "3445" }, [bank, { ...debit3445, linkedBank: null }]);
  assert.notEqual(r.status, "resolved");
});
test("'card 3445' with a credit card AND a debit card sharing the suffix asks", () => {
  const r = resolvePaymentAccount({ kind: "card", last4: "3445" }, accounts);
  assert.equal(r.status, "ambiguous"); assert.equal(r.candidates.length, 2);
});
test("two credit cards with the same suffix: multiple matches need a choice", () => {
  const twin = { id: "c3", name: "Test Card C", type: "cc", last4: "3445" };
  const r = resolvePaymentAccount({ kind: "cc", last4: "3445" }, [cc3445, twin, bank]);
  assert.equal(r.status, "ambiguous"); assert.deepEqual(r.candidates.map(c => c.accId), ["c1", "c3"]);
});
test("no card ends in the stated digits: clarification, and no account is invented", () => {
  const before = JSON.stringify(accounts);
  const r = resolvePaymentAccount({ kind: "cc", last4: "0000" }, accounts);
  assert.equal(r.status, "none"); assert.equal(r.message, "No card ending 0000. Pick one below or check the number.");
  assert.equal(JSON.stringify(accounts), before);
});
test("a card named without digits resolves only when exactly one card of that kind exists", () => {
  assert.equal(resolvePaymentAccount({ kind: "cc", last4: null }, [bank, cc3445]).status, "resolved");
  assert.equal(resolvePaymentAccount({ kind: "cc", last4: null }, accounts).status, "ambiguous");
  assert.equal(resolvePaymentAccount({ kind: "cc", last4: null }, [bank]).status, "none");
});
test("no payment words at all: unspecified, never defaulted to the last-used account", () => {
  assert.equal(resolvePaymentAccount({ kind: null, last4: null }, accounts).status, "unspecified");
  assert.equal(resolvePaymentAccount({ kind: null, last4: "3445" }, accounts).status, "needs-type");
});
test("a target outside the allowed paid-from list is not used", () => {
  const r = resolvePaymentAccount({ kind: "cc", last4: "3445" }, accounts, { paidFrom: [bank] });
  assert.notEqual(r.status, "resolved");
});

// ---- categories -------------------------------------------------------------------------------------------------
test("categories: stated and matching resolves; unknown or ambiguous is left unassigned and asked", () => {
  assert.equal(resolveCategory("groceries", cats).catId, "groceries");
  assert.equal(resolveCategory("food", cats).catId, "food");
  assert.equal(resolveCategory("Food and Dining", cats).catId, "food");
  assert.equal(resolveCategory("health", cats).status, "ambiguous", "Health vs Health Insurance");
  assert.equal(resolveCategory("pets", cats).status, "unmatched");
  const d = buildExpenseDraft("paid 100 to Dominos under pets via cash", { accounts, cats, now: NOW });
  assert.equal(d.category.status, "unmatched");
  assert.ok(d.questions.some(q => q.code === "category-unmatched"));
  assert.equal(buildExpenseDraft("paid 100 to Dominos via cash", { accounts, cats, now: NOW }).category.status, "none", "no category stated, none assigned");
});

// ---- the whole sentence -----------------------------------------------------------------------------------------
test("the example sentence builds one complete draft against card 3445", () => {
  const d = buildExpenseDraft("I paid ₹3,000 to Domino’s via credit card ending 3445.", { accounts, cats, now: NOW });
  assert.equal(d.intent, "expense"); assert.equal(d.amount, 3000); assert.equal(d.merchant, "Domino’s");
  assert.equal(d.date, "2026-10-17"); assert.equal(d.account.status, "resolved"); assert.equal(d.account.accId, "c1");
  assert.deepEqual(d.questions, []);
});

// ---- parsing never writes ---------------------------------------------------------------------------------------
test("parsing is pure: frozen inputs are untouched and there is nothing to write to", () => {
  const frozenAccounts = deepFreeze(JSON.parse(JSON.stringify(accounts)));
  const frozenCats = deepFreeze(JSON.parse(JSON.stringify(cats)));
  const txns = deepFreeze([{ id: "t1", type: "expense", amount: 1, accId: "b1", date: "2026-10-01", merchant: "x" }]);
  for (const t of ["I paid ₹3,000 to Domino's via credit card ending 3445.", "paid my credit card bill 5000", "", "paid 1 2 3"]) {
    buildExpenseDraft(t, { accounts: frozenAccounts, cats: frozenCats, now: NOW });
  }
  assert.equal(txns.length, 1);
});
test("the module has no imports and no access to storage or app state", () => {
  const src = readFileSync(new URL("./naturalLanguageExpense.js", import.meta.url), "utf8");
  assert.ok(!/^\s*import\s/m.test(src), "no imports");
  for (const word of ["localStorage", "setTxns", "fetch(", "XMLHttpRequest", "sessionStorage", "indexedDB"]) assert.ok(!src.includes(word), word);
});

// ---- repeated submissions ---------------------------------------------------------------------------------------
test("a repeat of an already-recorded purchase is flagged (never silently dropped, never blocked)", () => {
  const existing = [{ id: "t1", type: "expense", amount: 3000, accId: "c1", date: "2026-10-17", merchant: "Domino's" }];
  const probe = { amount: 3000, merchant: "Domino’s", date: "2026-10-17", accId: "c1" };
  assert.equal(findPossibleDuplicate(probe, existing).length, 1);
  assert.equal(findPossibleDuplicate({ ...probe, date: "2026-10-16" }, existing).length, 0);
  assert.equal(findPossibleDuplicate({ ...probe, accId: "c2" }, existing).length, 0);
});

// ---- existing accounting rules are unchanged (regression) -------------------------------------------------------
const inRange = () => true;
const toDateOnly = v => { const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; };
// Shaped exactly like the record Quick Add builds in saveDirect for a simple expense.
const quickAddShapedRecord = d => ({
  id: "new1", type: "expense", amount: d.amount, date: d.date, merchant: d.merchant, desc: d.merchant,
  catId: null, catIds: [], subId: null, subIds: [], accId: d.account.accId, people: {}, forPerson: "", groupId: null,
  vehicleId: null, paymentMethod: d.account.paymentMethod, excludeFromSpend: false, splitMode: "none", trackingMode: "none",
  tagMode: null, note: "", lineItems: null,
});
test("regression: a credit-card purchase charges the card and leaves the bank alone until the bill is paid", () => {
  const card = { ...cc3445, statementDate: 15, dueDate: 5, limit: 100000 };
  const accs = [{ ...bank, openingBalance: 10000, openingBalanceDate: "" }, card];
  const d = buildExpenseDraft("I paid ₹3,000 to Domino's via credit card ending 3445", { accounts: accs, cats, now: NOW });
  const rec = quickAddShapedRecord(d);
  const bankBefore = computeAccountBalance({ accId: "b1", accounts: accs, txns: [], isDateInRange: inRange });
  const bankAfter = computeAccountBalance({ accId: "b1", accounts: accs, txns: [rec], isDateInRange: inRange });
  assert.equal(bankAfter, bankBefore, "bank untouched by a card purchase");
  assert.equal(computeAccountBalance({ accId: "c1", accounts: accs, txns: [rec], isDateInRange: inRange }), 0, "a card has no cash balance");
  const before = getCardSummary(card, accs, [], toDateOnly);
  const after = getCardSummary(card, accs, [rec], toDateOnly);
  const owed = s => s.totalOutstanding + s.currentCycleSpend;
  assert.equal(owed(after) - owed(before), 3000, "the card now owes the purchase");
  // Paying the bill later is what moves the bank.
  const pay = { id: "p1", type: "cc_payment", date: "2026-10-17", amount: 3000, fromAccId: "b1", toAccId: "c1" };
  assert.equal(computeAccountBalance({ accId: "b1", accounts: accs, txns: [rec, pay], isDateInRange: inRange }), bankBefore - 3000);
});
test("regression: the boundary stores exactly one transaction for one submission", async () => {
  let store = [];
  const statePort = { getAll: () => store, upsert: r => { store = [r, ...store.filter(t => String(t.id) !== String(r.id))]; } };
  const { dispatcher, repository } = wireTransactionApplication({ statePort });
  const legacy = [];
  const d = buildExpenseDraft("I paid ₹3,000 to Domino's via credit card ending 3445", { accounts, cats, now: NOW });
  await submitTransactionThroughBoundary({ operation: "create", draft: quickAddShapedRecord(d), dispatcher, repository, legacyUpsert: r => legacy.push(r) });
  assert.equal(store.length + legacy.length, 1);
});

// ---- what a refused sentence is, and the amount carried to the full form ---------------------------------------------
test("refused sentences name what was detected, say what to do, and carry the amount over", () => {
  const cases = [
    ["paid my credit card bill 5000", "card_payment", 5000, /card bill payment\. Use the full form for that\./],
    ["paid ₹5,000 to my HDFC credit card ending 3445", "card_payment", 5000, /card bill payment/],
    ["salary credited 50000", "income", 50000, /^Income isn't supported here yet\. Use the full form for that\.$/],
    ["received ₹1,200 from Rahul", "income", 1200, /Income isn't supported/],
    ["received ₹500 refund from Amazon", "refund", 500, /a refund\. Use the full form/],
    ["Rahul paid me back 500", "repayment", 500, /a repayment\. Use the full form/],
  ];
  for (const [text, detected, amount, msg] of cases) {
    const r = parse(text);
    assert.equal(r.detected, detected, text);
    assert.equal(r.amount, amount, `${text}: amount carried`);
    assert.match(r.message, msg, text);
    assert.notEqual(r.intent, "expense", text);
  }
  assert.equal(parse("salary credited").amount, null, "no amount in the sentence: nothing invented");
});
test("an account message that names the wrong type or no match always says what to do next", () => {
  for (const r of [
    resolvePaymentAccount({ kind: "cc", last4: "0000" }, accounts),
    resolvePaymentAccount({ kind: "cc", last4: "3445" }, [bank, debit3445]),
    resolvePaymentAccount({ kind: "cc", last4: null }, [bank]),
    resolvePaymentAccount({ kind: null, last4: null }, accounts),
  ]) assert.match(r.message, /Pick|Which/, r.message);
});
