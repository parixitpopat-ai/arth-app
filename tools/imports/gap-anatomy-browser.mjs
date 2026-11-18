// Card statement preview: the printed summary explains a gap (previous balance carried over), and the green tick no longer claims that Arth's records agree.
// SYNTHETIC statement PDF, invented figures, real app in Chromium. A CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makePdf } from "../../src/domain/invoices/testing/pdfMaker.js";
const PORT = 4236, APP = `http://localhost:${PORT}/`;
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
const carried = join(dir, "carried.pdf"); writeFileSync(carried, mk("1,725.00", "575.10", "0.00", "2,300.10"));        // 1,725.00 carried over, nothing paid: total 2,300.10
const other = join(dir, "other.pdf"); writeFileSync(other, mk("0.00", "575.10", "0.00", "700.10"));                      // 125.00 of something that is NOT a previous balance
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }, { id: "cc1", name: "Test ICICI Card", type: "cc", last4: "8004", creditLimit: 100000, statementDay: 16, dueDay: 3 }]);
  const e = (id, date, amount, m) => ({ id, type: "expense", merchant: m, desc: m, amount, date, accId: "cc1", catId: "food", catIds: ["food"] });
  set("arth_txns", [e("z", "2026-10-06", 375.1, "Zomato"), e("a", "2026-10-08", 200, "Amazon Pay")]);
  // the PREVIOUS statement: the bank said 5,000.00, Arth had 3,275.00 (1,725.00 short); Arth's lower figure was then paid
  set("arth_bills", [{ id: "old", isCcStatement: true, accId: "cc1", billerCategory: "Credit Card", name: "Test ICICI Card Statement", periodFrom: "2026-08-16", periodTo: "2026-09-16", arthAmount: 3275, amount: 3275, bankAmount: 5000, verification: "mismatch", verifiedAt: null, dueDate: "2026-10-03", status: "unpaid", adjustments: [], createdAt: "2026-09-17" }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
const open = async () => { await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(700);
  await T("card-import-statement").dispatchEvent("click"); await page.waitForTimeout(500); };
try {
  await open(); await T("stmt-file").setInputFiles(carried); await page.waitForTimeout(2300);
  const bc = (await T("stmt-bill-card").innerText()).replace(/\s+/g, " ");
  rec("G1 the bill card shows the gap: statement ₹2,300.10, Arth ₹575.10, ₹1,725.00 short", /2,300\.10/.test(bc) && /575\.10/.test(bc) && /1,725\.00 short/.test(bc), bc.slice(0, 200));
  const an = (await T("stmt-gap-anatomy").innerText().catch(() => "")).replace(/\s+/g, " ");
  rec("G2 it spells out the statement's own sum: previous balance ₹1,725.00 + purchases ₹575.10 − payments ₹0.00", /1,725\.00/.test(an) && /575\.10/.test(an) && /payments and credits/.test(an), an.slice(0, 220));
  rec("G3 and says the previous balance not paid off IS the difference, nothing missing from Arth", (await T("stmt-gap-exact").count()) === 1 && /previous balance not paid off \(₹1,725\.00\)/.test(await T("stmt-gap-exact").innerText()), {});
  const last = (await T("stmt-gap-last").innerText().catch(() => "")).replace(/\s+/g, " ");
  rec("G3a it also shows LAST statement's figures (bank ₹5,000.00, Arth ₹3,275.00, ₹1,725.00 short) and says that is this statement's carried-over ₹1,725.00", /5,000\.00/.test(last) && /3,275\.00/.test(last) && /1,725\.00 short/.test(last) && (await T("stmt-gap-last-match").count()) === 1, last.slice(0, 260));
  await T("stmt-bill-set").click(); await page.waitForTimeout(600);
  await page.reload(); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await open(); await T("stmt-file").setInputFiles(carried); await page.waitForTimeout(2300);
  rec("G4 the same PDF again: the green tick is gone; it says the bill holds the PDF's figures and that Arth's records are still ₹1,725.00 short", (await T("stmt-bill-same").count()) === 0 && /does not mean Arth's records agree/.test(await T("stmt-bill-same-diff").innerText().catch(() => "")) && /1,725\.00 short/.test(await T("stmt-bill-same-diff").innerText().catch(() => "")), (await T("stmt-bill-same-diff").innerText().catch(() => "")).replace(/\s+/g, " "));
  await page.reload(); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await open(); await T("stmt-file").setInputFiles(other); await page.waitForTimeout(2300);
  rec("G5a when the carried amount (₹0.00) is NOT last time's difference (₹1,725.00) it does not claim a match, and says what would carry", (await T("stmt-gap-last-match").count()) === 0 && /If you paid the lower figure/.test(await T("stmt-gap-last").innerText().catch(() => "")), {});
  rec("G5 a gap that the previous balance does not explain says so and points at what else it could be", (await T("stmt-gap-partial").count()) === 1 && /could be refunds you already recorded|fee or charge/.test(await T("stmt-gap-partial").innerText()), (await T("stmt-gap-partial").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 200));
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);
