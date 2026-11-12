// Settings -> Import bank statement, in the real app (Chromium, local Vite dev server). SYNTHETIC statement files and data only. A CHROMIUM check only.
// Run: node tools/imports/statement-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makePdf } from "../../src/domain/invoices/testing/pdfMaker.js";
const PORT = 4215, APP = `http://localhost:${PORT}/`;
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
await ctx.addInitScript(() => { window.__ARTH_SMS_TEST__ = { granted: true, receive: true, notify: true, pending: [], pollMs: 700 }; });
await ctx.addInitScript(() => { if (localStorage.getItem("__own")) return; localStorage.setItem("__own", "1");
  const t = JSON.parse(localStorage.getItem("arth_txns") || "[]"); t.push({ id: "own1", type: "expense", merchant: "Cafe", desc: "Cafe", amount: 75, date: "2026-10-04", accId: "bank1", transactionRef: "999888777666", catIds: ["food"], catId: "food" }); localStorage.setItem("arth_txns", JSON.stringify(t)); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
try {
  await page.goto(APP); await page.waitForTimeout(1800); await unlock(); await page.waitForTimeout(500);
  // open the Add Transaction form (a screen defined inside the main component) and type a vendor
  await page.getByText("Income", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(900);
  const box = page.getByPlaceholder(/Source \(e\.g\. Salary/i);
  await box.fill("typed text"); await page.waitForTimeout(200);
  await page.evaluate(() => { const el = document.querySelector('input[placeholder^="Source (e.g."]'); el.__mark = "same-element"; });
  await page.waitForTimeout(6000);                       // ~8 background looks at 0.7 s
  const after = await page.evaluate(() => { const el = document.querySelector('input[placeholder^="Source (e.g."]'); return { value: el ? el.value : null, same: el ? el.__mark === "same-element" : false }; });
  rec("R1 after several background looks for bank messages the Add form's vendor box still has what I typed and is the SAME element (the screen was not rebuilt)", after.value === "typed text" && after.same, after);
  // a bank message arrives while I am still typing: nothing on screen may change; it is picked up after I leave the field
  await page.evaluate(() => { window.__ARTH_SMS_TEST__.pending.push({ id: "z1", address: "AX-CARD", date: Date.now(), body: "Rs.99.00 spent on ICICI Bank Card XX8004 at NETFLIX on 02-10-26." }); });
  await page.waitForTimeout(3000);
  const during = await page.evaluate(() => { const el = document.querySelector('input[placeholder^="Source (e.g."]'); return { value: el ? el.value : null, same: el ? el.__mark === "same-element" : false, held: JSON.parse(localStorage.getItem("arth_sms_pending") || "[]").length, focused: document.activeElement === el }; });
  rec("R2 a message arriving while I am typing does not touch the screen: text kept, same element, message not applied yet", during.value === "typed text" && during.same && during.held === 0, during);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.waitForTimeout(2500);
  const stillHeld = await page.evaluate(() => JSON.parse(localStorage.getItem("arth_sms_pending") || "[]").length);
  rec("R2b even after focus leaves the field, a half-filled form still blocks the update (text is in the box)", stillHeld === 0, stillHeld);
  await box.fill(""); await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.waitForTimeout(2500);
  const heldAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("arth_sms_pending") || "[]").length);
  rec("R3 once the form is empty / closed the message is picked up", heldAfter === 1, heldAfter);
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);
