// Paying a credit card bill from the expense form, in the real app (Chromium, local Vite dev server, SYNTHETIC data). A CHROMIUM check only.
// Run: node tools/loans/cc-bill-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4199, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const errors = [];
const STATEMENT = { id: "st1", name: "Test Card statement", amount: 5000, dueDate: "2026-11-20", billDate: "2026-11-02", status: "unpaid", isCcStatement: true, accId: "cc1", catId: "financial", catIds: ["financial"], subId: "fi6" };
async function newPage(seed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
  await ctx.addInitScript(seed => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
    localStorage.setItem("arth_master_user_setup_complete", "true"); }, seed);
  const page = await ctx.newPage(); page.on("pageerror", e => errors.push(String(e)));
  const unlock = async () => { for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
  const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
  const home = async () => { await page.goto(APP); await page.waitForTimeout(1000); await unlock(); };
  const spent = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").match(/Spent\s*₹([\d,]+)/)?.[1];
  return { page, unlock, ls, home, spent, T: id => page.getByTestId(id) };
}
const accounts = [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }, { id: "cc1", name: "Test Card", type: "cc", limit: 100000, outstanding: 5000, statementDate: 15, dueDate: 5, last4: "8004" }];
const cardSpend = { id: "e1", type: "expense", amount: 5000, date: "2026-11-02", desc: "Card spend", merchant: "Shop", accId: "cc1", catId: "food", catIds: ["food"] };
try {
  // ── 1: a NEW expense for the amount of an unpaid card statement ──
  {
    const { page, ls, home, spent, T } = await newPage({ arth_accounts: accounts, arth_txns: [cardSpend], arth_bills: [STATEMENT] });
    await home();
    rec("C0 Home counts the card's own spending once (Rs 5,000)", (await spent()) === "5,000", await spent());
    await page.getByRole("button", { name: "+", exact: true }).first().click(); await page.waitForTimeout(700);
    await page.getByText("More options →").click(); await page.waitForTimeout(700);
    await page.getByPlaceholder(/e\.g\. ₹5,500/).fill("5000");
    await page.waitForTimeout(500);
    rec("C1 an expense with the amount of an unpaid card statement shows the 'Paying a credit card bill?' hint", (await T("cc-payment-hint").count()) === 1, {});
    // the Bill payment chip must not offer the statement
    await T("bill-payment-chip").dispatchEvent("click"); await page.waitForTimeout(500);
    const bodyTxt = await page.evaluate(() => document.body.innerText);
    rec("C2 turning on 'Bill payment' does not offer the card statement as a bill to link", !/Test Card statement\s*·\s*due/.test(bodyTxt), {});
    await T("cc-payment-switch").dispatchEvent("click"); await page.waitForTimeout(600);
    const t = await page.evaluate(() => document.body.innerText);
    rec("C3 'Record as card payment' switches the form to a card payment (From / To accounts)", /\bFROM\b/i.test(t) && /\bTO\b/i.test(t) && (await T("cc-payment-hint").count()) === 0, {});
    await page.getByRole("button", { name: /Save|Add ✓/ }).last().click(); await page.waitForTimeout(1000);
    const txns = await ls("arth_txns"), accs = await ls("arth_accounts");
    const pay = txns.find(x => x.type === "cc_payment");
    rec("C4 saved as a card payment from my savings to the card, not as an expense", !!pay && pay.fromAccId === "bank1" && pay.toAccId === "cc1" && pay.amount === 5000 && txns.filter(x => x.type === "expense").length === 1, pay && { from: pay.fromAccId, to: pay.toAccId, type: pay.type });
    rec("C5 the card's balance went down by the payment", accs.find(a => a.id === "cc1").outstanding === 0, accs.find(a => a.id === "cc1").outstanding);
    await home();
    rec("C6 Home 'Spent' did NOT go up (still Rs 5,000)", (await spent()) === "5,000", await spent());
  }
  // ── 2: an expense that was ALREADY linked to the card statement (the reported case) ──
  {
    const linkedTxn = { id: "x1", type: "expense", amount: 5000, date: "2026-11-04", desc: "Test Card statement", merchant: "", note: "Bill payment", accId: "bank1", catId: "financial", catIds: ["financial"], subId: "fi6", subIds: ["fi6"], isBillPayment: true, paidBillId: "st1", paidBillName: "Test Card statement" };
    const paidStatement = { ...STATEMENT, status: "paid", paidDate: "2026-11-04", paidByTxnId: "x1" };
    const { page, unlock, ls, home, spent, T } = await newPage({ arth_accounts: accounts, arth_txns: [cardSpend, linkedTxn], arth_bills: [paidStatement] });
    await home();
    rec("R0 (the reported problem) Home 'Spent' counts the payment too: Rs 10,000", (await spent()) === "10,000", await spent());
    
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
    await page.getByText("Test Card statement", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(800);
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
    await page.getByRole("button", { name: /Edit/ }).first().dispatchEvent("click"); await page.waitForTimeout(900);
    rec("R1 editing that expense shows the hint, saying it is linked to a card statement", (await T("cc-payment-hint").count()) === 1 && /linked to a card statement/.test(await T("cc-payment-hint").innerText()), (await T("cc-payment-hint").count()) ? await T("cc-payment-hint").innerText() : await page.evaluate(() => document.body.innerText.slice(0, 120)));
    await T("cc-payment-switch").dispatchEvent("click"); await page.waitForTimeout(500);
    await page.getByRole("button", { name: /Save|Update/ }).last().click(); await page.waitForTimeout(1000);
    const txns = await ls("arth_txns"), accs = await ls("arth_accounts"), bills = await ls("arth_bills");
    const conv = txns.find(x => x.id === "x1");
    rec("R2 the same entry is now a card payment, savings -> card, no category", conv?.type === "cc_payment" && conv.fromAccId === "bank1" && conv.toAccId === "cc1" && (conv.catIds || []).length === 0 && txns.length === 2, conv && { type: conv.type, from: conv.fromAccId, to: conv.toAccId });
    rec("R3 the statement bill stays paid and still points at this payment", bills[0].status === "paid" && String(bills[0].paidByTxnId) === "x1" && conv?.paidBillId === "st1", { status: bills[0].status, by: bills[0].paidByTxnId, paidBillId: conv?.paidBillId });
    rec("R4 the card's balance went down", accs.find(a => a.id === "cc1").outstanding === 0, accs.find(a => a.id === "cc1").outstanding);
    await home();
    rec("R5 Home 'Spent' is back to Rs 5,000 (the payment is no longer spending)", (await spent()) === "5,000", await spent());
  }
  // ── 2b: the reported screenshot: an expense "Icici CC 8004 Bill Payment" marked Bill payment, linked to a bill THE EXPENSE MADE FOR ITSELF ──
  {
    const own = { id: "own1", name: "Icici CC 8004 Bill Payment", merchant: "Icici CC 8004 Bill Payment", amount: 7000, dueDate: "2026-11-03", status: "paid", paidDate: "2026-11-03", paidByTxnId: "x2", catId: null, catIds: [] };
    const tx = { id: "x2", type: "expense", amount: 7000, date: "2026-11-03", desc: "Icici CC 8004 Bill Payment", merchant: "Icici CC 8004 Bill Payment", note: "Bill payment", transactionRef: "PAYMENT OF RS 7000 HAS BEEN RECEIVED ON YOUR ICICI BANK CREDIT CARD XX8004 THROUGH BHARAT BILL PAYMENT SYSTEM ON 03-NOV-26.", accId: "bank1", catId: null, catIds: [], isBillPayment: true, paidBillId: "own1", paidBillName: "Icici CC 8004 Bill Payment" };
    const cards = [accounts[0], { ...accounts[1], name: "Test ICICI CC", outstanding: 7000 }, { id: "cc2", name: "Other Card", type: "cc", limit: 50000, outstanding: 0, last4: "1111" }];
    const { page, unlock, ls, home, spent, T } = await newPage({ arth_accounts: cards, arth_txns: [tx], arth_bills: [own] });
    await home();
    rec("S0 (the screenshot) the payment is counted as spending: Rs 7,000", (await spent()) === "7,000", await spent());
    await page.getByText("Icici CC 8004 Bill Payment", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(800);
    await page.getByRole("button", { name: /Edit/ }).first().dispatchEvent("click"); await page.waitForTimeout(900);
    const shown = (await T("cc-payment-hint").count()) === 1;
    rec("S1 editing it shows the hint, recognised from the description (card ending 8004 -> 'Test ICICI CC')", shown && /looks like a payment of a credit card bill/.test(await T("cc-payment-hint").innerText()) && /Test ICICI CC/.test(await T("cc-payment-switch").innerText()), shown ? await T("cc-payment-switch").innerText() : null);
    await T("cc-payment-switch").dispatchEvent("click"); await page.waitForTimeout(500);
    await page.getByRole("button", { name: /Save|Update/ }).last().click(); await page.waitForTimeout(1000);
    const txns = await ls("arth_txns"), accs = await ls("arth_accounts"), bills = await ls("arth_bills");
    const conv = txns.find(x => x.id === "x2");
    rec("S2 converted: a card payment from savings to the ICICI card (not the other card), keeping its description", conv?.type === "cc_payment" && conv.fromAccId === "bank1" && conv.toAccId === "cc1" && conv.desc === "Icici CC 8004 Bill Payment", conv && { type: conv.type, to: conv.toAccId, desc: conv.desc });
    rec("S3 the bill this expense had made for itself is gone, and the entry no longer points at it", bills.length === 0 && !conv.paidBillId, { bills: bills.length, paidBillId: conv?.paidBillId });
    rec("S4 the ICICI card's balance went down; the other card is untouched", accs.find(a => a.id === "cc1").outstanding === 0 && accs.find(a => a.id === "cc2").outstanding === 0, accs.map(a => a.outstanding));
    await home();
    rec("S5 'Spent' no longer includes it (Rs 0)", (await spent()) === "0", await spent());
  }
  // ── 2c: controls for the description hint ──
  {
    const { page, home, T } = await newPage({ arth_accounts: accounts, arth_txns: [], arth_bills: [] });
    await home();
    const open = async () => { await page.getByRole("button", { name: "+", exact: true }).first().click(); await page.waitForTimeout(600); await page.getByText("More options →").click(); await page.waitForTimeout(600); };
    await open();
    await page.getByPlaceholder(/e\.g\. ₹5,500/).fill("300");
    await page.getByPlaceholder("Vendor / Person / Place *").fill("Coffee shop"); await page.waitForTimeout(400);
    rec("H1 (control) an ordinary expense shows no card hint", (await T("cc-payment-hint").count()) === 0, {});
    await page.getByPlaceholder("Vendor / Person / Place *").fill("Credit card annual fee payment"); await page.waitForTimeout(500);
    rec("H2 words like 'credit card ... payment' show the hint", (await T("cc-payment-hint").count()) === 1, {});
    await T("cc-payment-dismiss").dispatchEvent("click"); await page.waitForTimeout(300);
    rec("H3 'No, it is an expense' hides it and the form stays an expense", (await T("cc-payment-hint").count()) === 0 && !/\bFROM\b[\s\S]*\bTO\b/.test(await page.evaluate(() => document.body.innerText)), {});
  }
  // ── 3: control: an ordinary bill still links to an expense exactly as before ──
  {
    const bill = { id: "b1", name: "Test Electricity", amount: 1200, dueDate: "2026-11-10", billDate: "2026-11-01", status: "unpaid", catId: "utilities", catIds: ["utilities"], subId: "u1" };
    const { page, home, T } = await newPage({ arth_accounts: accounts, arth_txns: [], arth_bills: [bill] });
    await home();
    await page.getByRole("button", { name: "+", exact: true }).first().click(); await page.waitForTimeout(700);
    await page.getByText("More options →").click(); await page.waitForTimeout(700);
    await page.getByPlaceholder(/e\.g\. ₹5,500/).fill("1200"); await page.waitForTimeout(400);
    rec("K1 (control) no card hint for an ordinary expense that matches no card statement", (await T("cc-payment-hint").count()) === 0, {});
  }
  rec("N1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 500)); }
finally { await browser.close(); try { process.kill(-server.pid); } catch {} }
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
