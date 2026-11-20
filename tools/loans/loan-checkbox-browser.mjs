// "This is a loan" under C on the Add Transaction screen, in the real app (Chromium, local Vite dev server, SYNTHETIC data, phone-width viewport).
// A CHROMIUM check. It says nothing about the Android app.   Run: node tools/loans/loan-checkbox-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4321, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
  localStorage.setItem("arth_accounts", JSON.stringify([
    { id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" },
    { id: "cc1", name: "Test Card", type: "cc", limit: 100000, outstanding: 0, statementDate: 15, dueDate: 5, last4: "4242" }]));
  localStorage.setItem("arth_people", JSON.stringify([{ id: "me", name: "Me", isMe: true }, { id: "p_raj", name: "Raj Test" }, { id: "p_sun", name: "Sunny Test" }, { id: "p_old", name: "Old Friend", archived: true }]));
  localStorage.setItem("arth_txns", "[]"); localStorage.setItem("arth_loans", "[]"); localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const unlock = async () => { for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const openAdd = async () => { await page.goto(APP); await page.waitForTimeout(900); await unlock(); await page.getByRole("button", { name: "+", exact: true }).first().click(); await page.waitForTimeout(700); await page.getByText("More options →").click(); await page.waitForTimeout(700); };
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
try {
  await openAdd();
  rec("T0 the top row no longer has a 'Loan given' button", (await page.locator("button:visible", { hasText: "Loan given" }).count()) === 0, {});
  await page.getByPlaceholder(/e\.g\. ₹5,500/).fill("15000");
  const addPerson = async name => { await page.getByRole("button", { name: /Add person or group/ }).first().dispatchEvent("click"); await page.waitForTimeout(400); await page.getByPlaceholder(/Search person or group/).fill(name); await page.waitForTimeout(300); await page.locator("button:visible", { hasText: name }).last().dispatchEvent("click"); await page.waitForTimeout(400); };
  await addPerson("Raj");
  rec("T1 with the person on A or no mode yet there is no loan box", (await T("loan-box").count()) === 0, {});
  await page.locator("button[title='Collect']").first().dispatchEvent("click"); await page.waitForTimeout(300);
  rec("T2 tapping C shows the box 'This is a loan', unticked, with no extra fields yet", (await T("loan-tick").count()) === 1 && !(await T("loan-tick").isChecked()) && (await T("loan-due").count()) === 0, {});
  await T("loan-tick").dispatchEvent("click"); await page.waitForTimeout(300);
  rec("T3 ticking it shows 'Expected back' and 'Interest % a year', both optional, and says interest is a reminder", (await T("loan-due").count()) === 1 && (await T("loan-rate").count()) === 1 && /not added to what they owe/.test(await T("loan-note").innerText()), {});
  await T("loan-tick").dispatchEvent("click"); await page.waitForTimeout(300);
  rec("T4 unticking hides them again", (await T("loan-due").count()) === 0, {});
  await T("loan-tick").dispatchEvent("click"); await page.waitForTimeout(300);
  await addPerson("Sunny");
  await page.locator("button[title='Collect']").last().dispatchEvent("click"); await page.waitForTimeout(300);
  rec("T5 with two people on C the box is greyed with the one-person message and cannot be ticked", (await T("loan-tick").isDisabled()) && (await T("loan-one-person").count()) === 1 && (await T("loan-due").count()) === 0, {});
  await page.locator("button:visible", { hasText: /Sunny Test/ }).last().scrollIntoViewIfNeeded().catch(() => {});
  // remove Sunny's row again by tapping the chip that added it
  await page.getByRole("button", { name: /Add person or group/ }).first().dispatchEvent("click").catch(() => {});
  await page.reload(); await page.waitForTimeout(900); await unlock();
  await page.getByRole("button", { name: "+", exact: true }).first().click(); await page.waitForTimeout(700); await page.getByText("More options →").click(); await page.waitForTimeout(700);
  await page.getByPlaceholder(/e\.g\. ₹5,500/).fill("15000"); await addPerson("Raj");
  await page.locator("button[title='Collect']").first().dispatchEvent("click"); await T("loan-tick").dispatchEvent("click"); await page.waitForTimeout(300);
  await T("loan-due").fill("2020-01-01"); await page.getByRole("button", { name: /Add ✓/ }).last().dispatchEvent("click"); await page.waitForTimeout(500);
  rec("T6 a return date before the lending date is refused and nothing is saved", /before the date/.test(await text()) && (await ls("arth_loans")).length === 0 && (await ls("arth_txns")).length === 0, {});
  await T("loan-due").fill("2027-02-01"); await T("loan-rate").fill("12");
  await page.getByRole("button", { name: /Add ✓/ }).last().dispatchEvent("click"); await page.waitForTimeout(900);
  const loans = await ls("arth_loans"), txns = await ls("arth_txns");
  rec("T7 one loan: to Raj, 15,000, expected back 1 Feb 2027, 12% a year, direction given, outstanding 15,000 (interest NOT added)", loans.length === 1 && loans[0].direction === "given" && loans[0].personId === "p_raj" && loans[0].principal === 15000 && loans[0].outstanding === 15000 && loans[0].dueDate === "2027-02-01" && loans[0].interestRate === 12 && loans[0].hasInterest === true, loans[0]);
  rec("T8 one money-out entry from the savings account, no destination, not an expense and no category (so not spending)", txns.length === 1 && txns[0].isLoanDisbursal === true && txns[0].fromAccId === "bank1" && txns[0].toAccId == null && txns[0].type !== "expense" && (txns[0].catIds || []).length === 0, txns[0]);
  rec("T9 NO ordinary expense with Raj owing a share was created (he is not double counted)", txns.every(t => !t.people || !Object.keys(t.people).length), {});
  await page.goto(APP); await page.waitForTimeout(900); await unlock();
  const t = await text();
  rec("T10 To Receive on Home now includes the 15,000 loan", /15,000/.test(t) && /To Receive/i.test(t), (t.match(/₹[\d,]+ To Receive/i) || ["(none)"])[0]);
  rec("T11 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 400)); }
finally { await browser.close(); try { process.kill(-server.pid); } catch {} }
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
