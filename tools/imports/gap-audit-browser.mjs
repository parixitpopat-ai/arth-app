// Card statement preview: 'Where the difference comes from' names every contributor (an entry on another account, a refund recorded on the card, ...) with a View button, and reports what it cannot explain.
// SYNTHETIC statement PDF, invented figures, real app in Chromium. A CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makePdf } from "../../src/domain/invoices/testing/pdfMaker.js";
const PORT = 4237, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const dir = mkdtempSync(join(tmpdir(), "stmt-"));
const ct = (str, x, y, size = 7) => ({ str, x, y, size });
const cright = (s, y) => ct(s, 590 - s.length * 3.6, y);
const mk = (prev, buy, pay, total) => makePdf([{ texts: [
  ct("STATEMENT DATE", 90, 700), ct("October 16, 2026", 88, 682), ct("PAYMENT DUE DATE", 82, 650), ct("November 3, 2026", 88, 632), ct("Total Amount due", 90, 580), ct("₹" + total, 105, 562), ct("Minimum Amount due", 84, 520), ct("₹100.00", 105, 502), ct("Dining-100%", 40, 390),
  ct("Previous Balance", 340, 560, 6), ct("₹" + prev, 346, 545, 6), ct("Purchases / Charges", 395, 560, 6), ct("₹" + buy, 412, 545, 6), ct("Cash Advances", 468, 560, 6), ct("₹0.00", 480, 545, 6), ct("Payments / Credits", 523, 560, 6), ct("₹" + pay, 532, 545, 6),
  ct("Date", 342, 420), ct("SerNo.", 385, 420), ct("Transaction Details", 430, 420), ct("Reward", 505, 420), ct("Points", 507, 411), ct("Amount (in₹)", 545, 420),
  ct("06/10/2026", 342, 380), ct("14308206086", 385, 380), ct("ZOMATO CYBS DELHI", 430, 380), ct("7", 505, 380), cright("375.10", 380),
  ct("08/10/2026", 342, 365), ct("14308206999", 385, 365), ct("AMAZON PAY MUMBAI", 430, 365), cright("200.00", 365)] }]);
const scen = join(dir, "scen.pdf"); writeFileSync(scen, mk("0.00", "575.10", "0.00", "575.10"));           // statement: 375.10 + 200.00 = 575.10 due
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }, { id: "cc1", name: "Test ICICI Card", type: "cc", last4: "8004", creditLimit: 100000, statementDay: 16, dueDay: 3 }]);
  const e = (id, date, amount, m) => ({ id, type: "expense", merchant: m, desc: m, amount, date, accId: "cc1", catId: "food", catIds: ["food"] });
  // Arth: Zomato on the card; the 200.00 Amazon Pay purchase was recorded on the SAVINGS account by mistake; and a 50.00 refund is recorded on the card
  set("arth_txns", [e("z", "2026-10-06", 375.1, "Zomato"), { ...e("a", "2026-10-08", 200, "Amazon Pay"), accId: "bank1" },
    { id: "r", type: "settlement_in", isRefund: true, desc: "Shop refund", merchant: "Shop refund", amount: 50, date: "2026-10-10", accId: "cc1" }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
const open = async () => { await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(700);
  await T("card-import-statement").dispatchEvent("click"); await page.waitForTimeout(500); };
try {
  await open(); await T("stmt-file").setInputFiles(scen); await page.waitForTimeout(2400);
  const bc = (await T("stmt-bill-card").innerText()).replace(/\s+/g, " ");
  rec("A1 the bill card shows the difference: statement ₹575.10, Arth ₹325.10, ₹250.00 short", /575\.10/.test(bc) && /325\.10/.test(bc) && /250\.00 short/.test(bc), bc.slice(0, 180));
  const lines = await T("stmt-gap-line").evaluateAll(els => els.map(e => ({ id: e.dataset.id, t: e.innerText.replace(/\s+/g, " ") })));
  const other = lines.find(l => l.id === "other"), refunds = lines.find(l => l.id === "refunds");
  rec("A2 it names the 200.00 purchase that is recorded on a DIFFERENT account (Test Savings)", other && /200\.00/.test(other.t) && /Amazon/i.test(other.t) && /recorded on Test Savings/.test(other.t), other && other.t);
  rec("A3 it names the 50.00 refund recorded on the card", refunds && /50\.00/.test(refunds.t), refunds && refunds.t);
  rec("A4 nothing else is listed and the whole ₹250.00 is accounted for", lines.length === 2 && /All of the ₹250\.00 is accounted for/.test(await T("stmt-gap-rest").innerText()), lines.map(l => l.id));
  await T("stmt-gap-open").first().click(); await page.waitForTimeout(700);
  rec("A5 View opens that entry so it can be fixed (moved to the right account)", /Amazon Pay/.test(await text()), {});
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);
