// Settings -> Import bank statement, in the real app (Chromium, local Vite dev server). SYNTHETIC statement files and data only. A CHROMIUM check only.
// Run: node tools/imports/statement-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makePdf } from "../../src/domain/invoices/testing/pdfMaker.js";
const PORT = 4219, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const dir = mkdtempSync(join(tmpdir(), "stmt-"));
const csv = join(dir, "stmt.csv");
writeFileSync(csv, ["Transaction Date,Value Date,Particulars,Cheque No.,Debit,Credit,Balance",
  "01-04-2026,01-04-2026,UPI/P2M/412345678901/PAX INNO,,670.01,,9329.99",
  "02-04-2026,02-04-2026,SALARY APR,,,50000.00,59329.99",
  "03-04-2026,03-04-2026,ICICI CC 8004 BILL PAYMENT,,2500.00,,56829.99",
  "04-04-2026,04-04-2026,UPI/P2M/412345678902/CHAI POINT,,120.00,,56709.99"].join("\n"));
const t = (str, x, y) => ({ str, x, y, size: 8 });
const pdf = join(dir, "stmt.pdf");
writeFileSync(pdf, makePdf([{ texts: [t("Transaction Date", 30, 780), t("Particulars", 110, 780), t("Debit", 300, 780), t("Credit", 360, 780), t("Balance", 430, 780),
  t("05-04-2026", 30, 760), t("IFT/9/SHOP TWO", 110, 760), t("200.00", 370, 760), t("56509.99", 465, 760),
  t("06-04-2026", 30, 740), t("IFT/9/SHOP THREE", 110, 740), t("50.00", 370, 740), t("56459.99", 465, 740)] }]));

// synthetic credit-card statement PDF (side panel + summary strip + table), invented figures
const ct = (str, x, y, size = 7) => ({ str, x, y, size });
const cright = (s, y) => ct(s, 590 - s.length * 3.6, y);
const cardPdf = join(dir, "card.pdf");
writeFileSync(cardPdf, makePdf([{ texts: [
  ct("STATEMENT DATE", 90, 700), ct("October 16, 2026", 88, 682), ct("PAYMENT DUE DATE", 82, 650), ct("November 3, 2026", 88, 632), ct("Total Amount due", 90, 580), ct("\u20B9575.10", 105, 562), ct("Minimum Amount due", 84, 520), ct("\u20B9100.00", 105, 502), ct("Dining-100%", 40, 390),
  ct("Previous Balance", 340, 560, 6), ct("\u20B91,000.00", 346, 545, 6), ct("Purchases / Charges", 395, 560, 6), ct("\u20B9575.10", 412, 545, 6), ct("Cash Advances", 468, 560, 6), ct("\u20B90.00", 480, 545, 6), ct("Payments / Credits", 523, 560, 6), ct("\u20B91,000.00", 532, 545, 6),
  ct("Date", 342, 420), ct("SerNo.", 385, 420), ct("Transaction Details", 430, 420), ct("Reward", 505, 420), ct("Points", 507, 411), ct("Amount (in\u20B9)", 545, 420),
  ct("06/10/2026", 342, 380), ct("14308206086", 385, 380), ct("ZOMATO CYBS DELHI", 430, 380), ct("7", 505, 380), cright("375.10", 380),
  ct("08/10/2026", 342, 365), ct("14308206999", 385, 365), ct("AMAZON PAY MUMBAI", 430, 365), cright("200.00", 365),
  ct("09/10/2026", 342, 350), ct("14308207000", 385, 350), ct("PAYMENT RECEIVED", 430, 350), cright("1,000.00 CR", 350)] }]));
const bad = join(dir, "x.csv"); writeFileSync(bad, "hello,world\n1,2\n");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 10000, openingBalanceDate: "2026-01-01", last4: "9001" }, { id: "cc1", name: "Test ICICI Card", type: "cc", last4: "8004", creditLimit: 100000 }, { id: "upi1", name: "Test UPI", type: "upi", handle: "test@upi", linkedAccount: "bank1" }]);
  set("arth_txns", [{ id: "m1", type: "expense", merchant: "Chai Point", desc: "Chai Point", amount: 120, date: "2026-04-03", accId: "upi1", catId: "food", catIds: ["food"] }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
await ctx.addInitScript(() => { window.__ARTH_SMS_TEST__ = { granted: true, receive: true, notify: true, pending: [{ id: "c1", address: "AX-BANK", date: Date.now() - 3600000, body: "Your A/C Xxxxx529001 Is Credited With Inr 352.00 On 13/11/26" }], pollMs: 700 }; });
await ctx.addInitScript(() => { if (localStorage.getItem("__own")) return; localStorage.setItem("__own", "1");
  const t = JSON.parse(localStorage.getItem("arth_txns") || "[]"); t.push({ id: "own1", type: "expense", merchant: "Cafe", desc: "Cafe", amount: 75, date: "2026-10-04", accId: "bank1", transactionRef: "999888777666", catIds: ["food"], catId: "food" }); localStorage.setItem("arth_txns", JSON.stringify(t)); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
try {
  await page.goto(APP); await page.waitForTimeout(1800); await unlock(); await page.waitForTimeout(500);
  await T("home-bell").dispatchEvent("click"); await page.waitForTimeout(600);
  const item = T("sms-item"); const t = await item.innerText();
  rec("C1 the message is listed as money IN of 352 for Test Savings (the 6-digit masked number Xxxxx529001 is recognised as account ····9001)", /Money in/.test(t) && /352/.test(t) && /Test Savings/.test(t) && !/not recognised/i.test(t), t.slice(0, 160));
  rec("C2 the message text is NOT used as the name: the title says 'Unnamed', not 'Your A/C Xxxxx…'", /Unnamed/.test(t) && !/Xxxxx|Credited With/i.test(t), t.slice(0, 120));
  await T("sms-accept").dispatchEvent("click"); await page.waitForTimeout(900);
  const vals = await page.$$eval("input", els => els.map(e => e.value).filter(Boolean));
  rec("C3 Accept opens the Add form with amount 352 and an EMPTY name box (nothing from the message text)", vals.includes("352") && !vals.some(v => /Credited|Xxxxx|Your A\/C/i.test(v)), vals.slice(0, 8));
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);
