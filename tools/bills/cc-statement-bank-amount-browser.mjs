// Credit card statement bill: a wrongly typed BANK amount can be changed (it could not once the sheet said "mismatch").
// SYNTHETIC data, real app in Chromium. A CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4230, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
const d = new Date(); const prev = new Date(d.getFullYear(), d.getMonth() - 1, 20); const ds = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
await ctx.addInitScript((txnDate) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 500000, openingBalanceDate: "2025-01-01", last4: "9001" }, { id: "cc1", name: "Test Card", type: "cc", last4: "8004", creditLimit: 100000, statementDay: 5, dueDay: 25 }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }]);
  set("arth_txns", [{ id: "t1", type: "expense", desc: "Shop", merchant: "Shop", amount: 1000, date: txnDate, accId: "cc1", catId: "food", catIds: ["food"] }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); }, ds(prev));
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(700); } } };
const bills = async () => JSON.parse(await page.evaluate(() => localStorage.getItem("arth_bills") || "[]"));
try {
  await page.goto(APP); await page.waitForTimeout(1500); await unlock(); await page.waitForTimeout(800);
  await page.getByText(/^payments$/i).last().dispatchEvent("click"); await page.waitForTimeout(1000);
  let b = (await bills()).find(x => x.isCcStatement);
  rec("S0 the card statement bill was generated from the card's transactions (₹1,000, needs verification)", b && b.amount === 1000 && b.verification === "needs_verification", b && { amount: b.amount, v: b.verification });
  await page.getByText("Test Card Statement", { exact: false }).first().dispatchEvent("click"); await page.waitForTimeout(700);
  await page.getByRole("button", { name: "No", exact: true }).click(); await page.waitForTimeout(300);
  await page.locator('input[type="number"]').last().fill("9999"); await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(500);
  b = (await bills()).find(x => x.isCcStatement);
  rec("S1 typing a wrong bank amount (₹9,999) puts the statement in 'mismatch'", b.verification === "mismatch" && b.bankAmount === 9999, { v: b.verification, bank: b.bankAmount });
  rec("S2 the sheet offers 'Typed the wrong bank amount? Change it'", (await T("cc-change-bank-amount").count()) === 1, {});
  await T("cc-change-bank-amount").click(); await page.waitForTimeout(300);
  const prefill = await page.locator('input[type="number"]').last().inputValue();
  rec("S3 the box opens with the amount typed before (₹9,999) so it can be corrected", prefill === "9999", prefill);
  await page.locator('input[type="number"]').last().fill("1000");
  await page.getByRole("button", { name: /Mark as matched|Continue/ }).click(); await page.waitForTimeout(500);
  b = (await bills()).find(x => x.isCcStatement);
  rec("S4 entering the right amount (₹1,000) matches the statement; Arth's own amount is untouched", b.verification === "matched" && b.bankAmount === 1000 && b.arthAmount === 1000 && b.amount === 1000, { v: b.verification, bank: b.bankAmount, arth: b.arthAmount });
  rec("S5 only one statement bill exists (no duplicate was created)", (await bills()).filter(x => x.isCcStatement).length === 1, {});
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);
