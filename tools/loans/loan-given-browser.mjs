// "Loan given" from the Add Transaction screen, in the real app (Chromium, local Vite dev server, SYNTHETIC data, phone-width viewport).
// A CHROMIUM check. It says nothing about the Android app.   Run: node tools/loans/loan-given-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4195, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
  localStorage.setItem("arth_accounts", JSON.stringify([
    { id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" },
    { id: "cc1", name: "Test Card", type: "cc", limit: 100000, outstanding: 0, statementDate: 15, dueDate: 5, last4: "4242" }]));
  localStorage.setItem("arth_people", JSON.stringify([{ id: "me", name: "Me", isMe: true }, { id: "p_raj", name: "Raj Test" }, { id: "p_old", name: "Old Friend", archived: true }]));
  localStorage.setItem("arth_txns", "[]"); localStorage.setItem("arth_loans", "[]"); localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const unlock = async () => { for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const openAdd = async () => { await page.goto(APP); await page.waitForTimeout(900); await unlock(); await page.getByRole("button", { name: "+", exact: true }).first().click(); await page.waitForTimeout(700); await page.getByText("More options →").click(); await page.waitForTimeout(700); };
try {
  await openAdd();
  rec("T0 the Add screen has a 'Loan given' choice next to Transfer", (await page.getByRole("button", { name: /Loan given/ }).count()) === 1 && (await page.getByRole("button", { name: /Transfer/ }).count()) >= 1, {});
  // control: Transfer still has From and To (it is for moving money between YOUR accounts)
  await page.locator("button:visible", { hasText: "Transfer" }).first().dispatchEvent("click"); await page.waitForTimeout(500);
  const tBody = await page.evaluate(() => document.body.innerText);
  rec("T1 (control) the Transfer form still asks From and To", /\bFROM\b/i.test(tBody) && /\bTO\b/i.test(tBody), {});
  await page.locator("button:visible", { hasText: "Expense" }).first().dispatchEvent("click"); await page.waitForTimeout(300);
  await page.getByPlaceholder(/e\.g\. ₹5,500/).fill("15000");
  await page.locator("button:visible", { hasText: "Loan given" }).first().dispatchEvent("click"); await page.waitForTimeout(700);
  rec("T2 choosing it opens the Loan given sheet with the typed amount carried over", (await T("loan-given-sheet").count()) === 1 && (await T("loan-given-amount").inputValue()) === "15000", { amount: await T("loan-given-amount").inputValue().catch(() => null) });
  const sheetText = await T("loan-given-sheet").innerText();
  rec("T3 it never asks for a destination account: one 'Paid from' group (savings + 'not from an account'; the card is not offered), no 'To account', no dropdown", !/to account|destination|to which|transfer to/i.test(sheetText) && /Paid from/i.test(sheetText) && (await page.locator('[data-testid^="loan-given-from-"]').count()) === 2 && (await page.locator("select").count()) === 0, sheetText.replace(/\n/g, " | ").slice(0, 200));
  rec("T4 only real people are offered (archived and 'Me' are not)", (await T("loan-given-person-p_raj").count()) === 1 && (await T("loan-given-person-p_old").count()) === 0 && (await T("loan-given-person-me").count()) === 0, {});
  // validation
  await T("loan-given-save").click(); await page.waitForTimeout(300);
  rec("T5 saving without choosing who it was lent to is refused with a plain message and saves nothing", /who you lent/.test(await T("loan-given-error").innerText()) && (await ls("arth_loans")).length === 0 && (await ls("arth_txns")).length === 0, await T("loan-given-error").innerText());
  await T("loan-given-person-p_raj").click(); await T("loan-given-amount").fill("0"); await T("loan-given-save").click(); await page.waitForTimeout(300);
  rec("T6 a zero amount is refused", /amount/.test(await T("loan-given-error").innerText()) && (await ls("arth_loans")).length === 0, await T("loan-given-error").innerText());
  await T("loan-given-amount").fill("15000"); await T("loan-given-from-bank1").click(); await T("loan-given-note").fill("for rent");
  await T("loan-given-save").click(); await page.waitForTimeout(900);
  const loans = await ls("arth_loans"), txns = await ls("arth_txns");
  rec("T7 one loan was made: given, to Raj, 15,000, active, linked to the person", loans.length === 1 && loans[0].direction === "given" && loans[0].personId === "p_raj" && loans[0].principal === 15000 && loans[0].outstanding === 15000 && loans[0].status === "active" && loans[0].sourceType === "person", loans[0] && { d: loans[0].direction, p: loans[0].personId, pr: loans[0].principal });
  rec("T8 one money-out entry: from my savings, NO destination account, linked to the loan, not a spend category", txns.length === 1 && txns[0].fromAccId === "bank1" && txns[0].toAccId === null && txns[0].linkedLoanId === loans[0].id && txns[0].isLoanDisbursal === true && txns[0].amount === 15000 && (txns[0].catIds || []).length === 0, txns[0] && { from: txns[0].fromAccId, to: txns[0].toAccId, desc: txns[0].desc });
  rec("T9 the sheet closed and nothing was recorded as a card payment or a transfer to another account", (await T("loan-given-sheet").count()) === 0 && txns.every(t => t.toAccId == null) && txns.every(t => t.type !== "cc_payment"), {});

  // the Loans area lists it; Home budget is not touched
  await page.goto(APP); await page.waitForTimeout(900); await unlock();
  const home = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  rec("T10 the loan is not counted as spending on Home", /Spent\s*₹0(\.00)?\b/.test(home) || !/Spent\s*₹15,000/.test(home), (home.match(/Spent[^A-Za-z]{0,20}/) || [""])[0]);

  // tapping the money-out entry shows the loan notice, not a transfer form
  await page.getByText("MONEY", { exact: true }).first().click().catch(() => {}); await page.waitForTimeout(700);
  const row = page.getByText("Loan given - Raj Test").first();
  const rowShown = (await row.count()) > 0;
  if (rowShown) { await row.dispatchEvent("click"); await page.waitForTimeout(800); if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT }); }
  const noticeShown = null;
  const sheetTxt = await page.evaluate(() => document.body.innerText);
  rec("T10a the entry's detail says LOAN GIVEN (not TRANSFER), names the account it left, and shows it as money out", /LOAN GIVEN/.test(sheetTxt) && !/\bTRANSFER\b/.test(sheetTxt) && /Test Savings/.test(sheetTxt) && /-₹15,000/.test(sheetTxt.replace(/\s+/g, "")), (sheetTxt.match(/Raj Test[\s\S]{0,160}/) || [""])[0].replace(/\n/g, " | "));
  if (rowShown) { await page.getByRole("button", { name: /Edit/ }).first().click(); await page.waitForTimeout(800); }
  const notice = rowShown ? ((await T("loan-entry-notice").count()) === 1 && !/\bFROM\b[\s\S]*\bTO\b/.test(await T("loan-entry-notice").innerText())) : true;
  rec("T10b the entry appears in the list as 'Loan given - Raj Test', and tapping it shows the loan notice (not a transfer form)", rowShown && notice && (await T("loan-entry-edit").count()) === 1, { rowShown, noticeShown });
  if (rowShown) { await T("loan-entry-edit").click(); await page.waitForTimeout(700); }
  rec("T10c 'Open the loan' opens the loan itself", rowShown && /Edit Loan/.test(await page.evaluate(() => document.body.innerText)), {});
  await page.goto(APP); await page.waitForTimeout(900); await unlock();
  // from a second run: not-from-an-account path
  await openAdd(); await page.getByPlaceholder(/e\.g\. ₹5,500/).fill("2000"); await page.locator("button:visible", { hasText: "Loan given" }).first().dispatchEvent("click"); await page.waitForTimeout(600);
  await T("loan-given-name").fill("Neighbour"); await T("loan-given-save").click(); await page.waitForTimeout(800);
  const loans2 = await ls("arth_loans"), txns2 = await ls("arth_txns");
  rec("T11 a loan to someone not in People, not from an account: the loan is made and NO balance entry is added", loans2.length === 2 && loans2[0].name === "Neighbour" && loans2[0].personId === null && txns2.length === 1, { loans: loans2.length, txns: txns2.length });
  rec("T12 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 400)); }
finally { await browser.close(); try { process.kill(-server.pid); } catch {} }
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
