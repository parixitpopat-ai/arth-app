// Settings -> Import bank statement, in the real app (Chromium, local Vite dev server). SYNTHETIC statement files and data only. A CHROMIUM check only.
// Run: node tools/imports/statement-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makePdf } from "../../src/domain/invoices/testing/pdfMaker.js";
const PORT = 4211, APP = `http://localhost:${PORT}/`;
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
await ctx.addInitScript(() => { const d = n => Date.now() - n * 3600000; window.__ARTH_SMS_TEST__ = { granted: true, receive: true, notify: true, pending: [
  { id: "n1", address: "AX-BANK", date: d(1), body: "Rs 250.00 debited from A/c XX9001 on 03-10-26 to VPA tea@ybl (UPI Ref No 555666777888). Not you? Call bank" },
  { id: "n2", address: "AX-CARD", date: d(2), body: "Rs.99.00 spent on ICICI Bank Card XX8004 at NETFLIX on 02-10-26." },
  { id: "n3", address: "VM-OTP", date: d(3), body: "Your OTP is 482913 for Rs 640.00 payment. Do not share." },
  { id: "n4", address: "AX-CARD", date: d(4), body: "Payment of INR 1752.75 towards Merchant Amazon to be debited from your card XX8004 on 14-Nov-26" },
  { id: "n5", address: "AX-BANK", date: d(5), body: "Rs 500 debited from A/c XX9001 and credited to A/c XX1234 on 04-Nov-26" },
  { id: "n6", address: "AX-BANK", date: d(6), body: "Rs 75.00 debited from A/c XX9001 on 04-10-26 to VPA cafe@ybl (UPI Ref No 999888777666). Not you? Call bank" } ] }; });
await ctx.addInitScript(() => { if (localStorage.getItem("__own")) return; localStorage.setItem("__own", "1");
  const t = JSON.parse(localStorage.getItem("arth_txns") || "[]"); t.push({ id: "own1", type: "expense", merchant: "Cafe", desc: "Cafe", amount: 75, date: "2026-10-04", accId: "bank1", transactionRef: "999888777666", catIds: ["food"], catId: "food" }); localStorage.setItem("arth_txns", JSON.stringify(t)); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
const goHome = async () => { await page.goto(APP); await page.waitForTimeout(1800); await unlock(); await page.waitForTimeout(500); };
try {
  await goHome();
  const badge = await T("home-bell-badge").innerText().catch(() => "");
  rec("I1 the bell shows 4 waiting: 3 bank messages to review (UPI debit, card spend, one that matches my own entry) + 1 that could not be read; the OTP and the 'to be debited' notice are ignored", badge.trim() === "4", badge);
  await T("home-bell").dispatchEvent("click"); await page.waitForTimeout(500);
  const items = await page.$$eval('[data-testid="sms-item"]', els => els.map(e => e.getAttribute("data-status")).sort());
  rec("I2 list: two 'new' and one 'match', plus one 'could not be read' (the transfer-style message)", items.join() === "match,new,new" && (await T("sms-item-unreadable").count()) === 1, items);
  const matchItem = page.locator('[data-testid="sms-item"][data-status="match"]');
  rec("I3 the one that matches my Cafe entry says so and offers 'Link to it'", /Looks like your entry “Cafe”/.test(await matchItem.innerText()) && (await matchItem.getByTestId("sms-link").count()) === 1, (await matchItem.innerText()).slice(0, 160));
  const before = (await ls("arth_txns")).length;
  await matchItem.getByTestId("sms-link").dispatchEvent("click"); await page.waitForTimeout(500);
  const own = (await ls("arth_txns")).find(t => t.id === "own1");
  rec("I4 'Link to it' links my entry (no copy added): it gets the SMS key and the payee's UPI ID is not invented", (await ls("arth_txns")).length === before && own.importMerged === true && own.importKey && own.category !== "x", { n: (await ls("arth_txns")).length - before, merged: own.importMerged });
  rec("I5 the linked message leaves the list", (await page.$$eval('[data-testid="sms-item"]', els => els.length)) === 2, {});
  const upiItem = page.locator('[data-testid="sms-item"]', { hasText: "250" });
  await upiItem.getByTestId("sms-accept").dispatchEvent("click"); await page.waitForTimeout(800);
  const vals = await page.$$eval("input", els => els.map(e => e.value).filter(Boolean));
  rec("I6 Accept opens the Add form filled in (vendor and amount 250 showing) and nothing is saved yet", vals.includes("250") && vals.some(v => /tea/i.test(v)) && (await ls("arth_txns")).length === before, vals.slice(0, 8));
  await page.getByRole("button", { name: /^Add ✓$/ }).dispatchEvent("click"); await page.waitForTimeout(900);
  const saved = (await ls("arth_txns")).find(t => t.transactionRef === "555666777888" && t.id !== "own1");
  rec("I7 after Save the entry exists with date 2026-10-03, the reference, the import key, source 'sms' and the payee's UPI ID tea@ybl (kept quietly)", saved && saved.amount === 250 && saved.date === "2026-10-03" && saved.accId === "bank1" && saved.importSource === "sms" && saved.importKey && saved.upiId === "tea@ybl", saved && { amount: saved.amount, acc: saved.accId, src: saved.importSource, upi: saved.upiId });
  await T("home-bell").dispatchEvent("click"); await page.waitForTimeout(500);
  const left = await page.$$eval('[data-testid="sms-item"]', els => els.length);
  rec("I8 the saved message is gone from the list; the card message is still waiting", left === 1, left);
  await T("sms-discard").first().dispatchEvent("click"); await page.waitForTimeout(400);
  rec("I9 Discard removes it, nothing is added to the books", (await page.$$eval('[data-testid="sms-item"]', els => els.length)) === 0, {});
  await goHome();
  const again = await page.evaluate(() => (document.querySelector('[data-testid="home-bell-badge"]') || {}).innerText || "");
  rec("I10 after reopening the app, handled messages do not come back (only the unreadable one is still waiting)", again.trim() === "1", again);
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);
