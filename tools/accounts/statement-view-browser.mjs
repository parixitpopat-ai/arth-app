// Account page -> Statement: monthly bank-style view with opening/closing balance, running balance and CSV. Chromium, local Vite dev server, SYNTHETIC data.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
const PORT = 4209, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata", acceptDownloads: true });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 10000, openingBalanceDate: "2026-01-01", last4: "9001" }, { id: "cc1", name: "Test Card", type: "cc", last4: "8004", limit: 100000 }]);
  const ex = (id, date, amount, merchant, accId = "bank1") => ({ id, type: "expense", date, amount, merchant, desc: merchant, accId, catIds: [] });
  set("arth_txns", [ex("a1", "2026-09-10", 500, "Sept shop"), { id: "i1", type: "income", date: "2026-10-02", amount: 5000, desc: "Salary", accId: "bank1", catIds: [] }, ex("a2", "2026-10-05", 100.1, "Oct shop"), ex("a3", "2026-10-20", 49.9, "Oct cafe"),
    ex("c1", "2026-10-06", 375.1, "Zomato", "cc1"), ex("c2", "2026-09-20", 200, "Sept card", "cc1"), ex("a4", "2026-11-03", 10, "Nov shop")]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
try {
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(700);
  await page.getByText("Test Savings").first().dispatchEvent("click"); await page.waitForTimeout(600);
  rec("V1 the bank account page has a Statement button", (await T("acc-statement").count()) === 1, {});
  await T("acc-statement").dispatchEvent("click"); await page.waitForTimeout(500);
  rec("V2 it opens on the latest month with entries (November 2026)", /November 2026/.test(await T("stmt-month").innerText()), await T("stmt-month").innerText());
  await T("stmt-prev").click(); await page.waitForTimeout(300);
  const s = await T("stmt-summary").innerText();
  rec("V3 October: opening 9,500.00 (10,000 − 500 in September), in 5,000.00, out 150.00, closing 14,350.00", /OPENING\s*₹9,500\.00/i.test(s.replace(/\n/g, " ")) && /5,000\.00/.test(s) && /150\.00/.test(s) && /CLOSING\s*₹14,350\.00/i.test(s.replace(/\n/g, " ")), s.replace(/\n/g, " "));
  const lines = await T("stmt-line").allInnerTexts();
  rec("V4 three entries, oldest first, with a running balance (Salary → 14,500.00, Oct shop → 14,399.90, Oct cafe → 14,350.00)", lines.length === 3 && /Salary/.test(lines[0]) && /14,500\.00/.test(lines[0]) && /14,399\.90/.test(lines[1]) && /14,350\.00/.test(lines[2]), lines.map(l => l.replace(/\n/g, " ")));
  rec("V5 no mismatch warning against Arth's own balance", (await T("stmt-diff").count()) === 0, {});
  const dl = page.waitForEvent("download");
  await T("stmt-download").click(); const d = await dl; const path = await d.path();
  const csv = readFileSync(path, "utf8");
  rec("V6 CSV download: bank-style dates, opening and closing lines", /Date,Description,Debit,Credit,Balance/.test(csv) && /01-10-2026,Opening balance,,,9500\.00/.test(csv) && /31-10-2026,Closing balance,,,14350\.00/.test(csv) && /02-10-2026,Salary/.test(csv), csv.split("\n").slice(0, 3));
  await T("stmt-prev").click(); await page.waitForTimeout(300);
  rec("V7 September: opening 10,000.00, out 500.00, closing 9,500.00 (closing = last month's opening)", /OPENING\s*₹10,000\.00/i.test((await T("stmt-summary").innerText()).replace(/\n/g, " ")) && /CLOSING\s*₹9,500\.00/i.test((await T("stmt-summary").innerText()).replace(/\n/g, " ")), {});
  await T("stmt-custom").click(); await page.waitForTimeout(300);
  await T("stmt-from").fill("2026-10-03"); await T("stmt-to").fill("2026-10-10"); await page.waitForTimeout(300);
  const c = (await T("stmt-summary").innerText()).replace(/\n/g, " ");
  rec("V8 custom dates 03-10 to 10-10: opening 14,500.00 (after the salary), one entry, closing 14,399.90", /OPENING\s*₹14,500\.00/i.test(c) && /CLOSING\s*₹14,399\.90/i.test(c) && (await T("stmt-line").count()) === 1, c);
  // the card
  await page.reload(); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(700);
  await page.getByTestId("card-view-txns").dispatchEvent("click"); await page.waitForTimeout(700);
  await T("acc-statement").dispatchEvent("click"); await page.waitForTimeout(500);
  const cs = (await T("stmt-summary").innerText()).replace(/\n/g, " ");
  rec("V9 the card's October: Charges 375.10, Payments & credits 0.00, no opening/closing balance", /CHARGES\s*₹375\.10/i.test(cs) && !/OPENING/i.test(cs), cs);
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
