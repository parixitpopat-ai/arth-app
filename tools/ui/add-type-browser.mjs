// Add screen, new look step: the type switch (Spent / Received / Transfer / More). SYNTHETIC data, real app in Chromium. CHROMIUM check only.
// Run: node tools/ui/add-type-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4411, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01" }, { id: "bank2", name: "Test Current", type: "bank", openingBalance: 5000, openingBalanceDate: "2026-01-01" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }]); set("arth_txns", []);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
const pressed = async id => (await T(id).getAttribute("aria-pressed")) === "true";
try {
  await page.goto(APP); await page.waitForTimeout(1300); await unlock(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "+", exact: true }).first().click(); await page.waitForTimeout(600);
  await page.getByText("More options →").click(); await page.waitForTimeout(600);
  rec("A1 four choices, Spent chosen to begin with", (await T("type-expense").count()) === 1 && (await T("type-income").count()) === 1 && (await T("type-transfer").count()) === 1 && (await T("type-more").count()) === 1 && await pressed("type-expense"), {});
  rec("A2 Settlement and Invest are not shown until More", (await T("type-petty_cash").count()) === 0 && (await T("type-investment").count()) === 0, {});
  await T("type-income").click(); await page.waitForTimeout(300);
  rec("A3 Received switches to income (its source prompt appears)", await pressed("type-income") && (await page.getByPlaceholder(/Source \(e\.g\. Salary/).count()) === 1, {});
  rec("A3b under Received, 'What is it?' offers four choices, Salary or income first", (await T("what-is-it").count()) === 1 && (await T("what-is-it").locator("button").count()) === 4 && (await T("what-income").getAttribute("aria-pressed")) === "true", {});
  await T("what-repayment").click(); await page.waitForTimeout(300);
  rec("A3c 'Someone paid me back' keeps Received lit and opens the repayment form (no separate Tag chips)", await pressed("type-income") && (await T("what-repayment").getAttribute("aria-pressed")) === "true" && !/Tag this inflow as/.test(await page.evaluate(() => document.body.innerText)), {});
  await T("what-refund").click(); await T("what-reimbursement").click(); await page.waitForTimeout(300);
  rec("A3d refund and reimbursement are one tap each; reimbursement shows its list area", (await T("what-reimbursement").getAttribute("aria-pressed")) === "true" && (await T("what-refund").getAttribute("aria-pressed")) === "false", {});
  await T("what-income").click(); await page.waitForTimeout(300);
  rec("A3e Salary or income goes back to the income form", (await page.getByPlaceholder(/Source \(e\.g\. Salary/).count()) === 1, {});
  await T("type-transfer").click(); await page.waitForTimeout(300);
  rec("A4 Transfer switches to a transfer (a Note instead of a vendor)", await pressed("type-transfer") && (await page.getByPlaceholder("Note (optional)").count()) === 1, {});
  rec("A4b a Transfer offers no category, person or group tags", (await T("move-tag").count()) === 0 && !/Tag to/i.test(await page.evaluate(() => document.body.innerText)), {});
  const sels = page.locator("select"); await page.getByPlaceholder(/e\.g\. ₹5,500/).fill("500");
  await sels.nth(0).selectOption("bank1"); await sels.nth(1).selectOption("bank2");
  await page.getByRole("button", { name: /^Add ✓$/ }).click(); await page.waitForTimeout(900);
  const tr = (await page.evaluate(() => JSON.parse(localStorage.getItem("arth_txns") || "[]"))).find(t => t.type === "transfer");
  rec("A4c a Transfer entry saves as a transfer from Savings to Current", tr && tr.amount === 500 && tr.fromAccId === "bank1" && tr.toAccId === "bank2", tr && { amount: tr.amount, from: tr.fromAccId, to: tr.toAccId });
  await page.getByRole("button", { name: "+", exact: true }).first().click(); await page.waitForTimeout(600); await page.getByText("More options →").click(); await page.waitForTimeout(500);
  await T("type-more").click(); await page.waitForTimeout(300);
  rec("A5 More opens five choices (Invest, Give petty cash, Buy on card EMI, Pay a bill, Lend money), Invest chosen", await pressed("type-more") && (await T("more-types").locator("button").count()) === 5 && (await T("type-investment").count()) === 1, {});
  await T("type-card_emi").click(); await page.waitForTimeout(500);
  rec("A5b Buy on card EMI goes back to Spent with the EMI plan open (Credit card EMI)", await pressed("type-expense") && /EMI plan details/.test(await page.evaluate(() => document.body.innerText)), {});
  await T("type-more").click(); await page.waitForTimeout(300);
  rec("A6 Invest stays under More, and More stays lit", await pressed("type-more") && (await T("type-investment").count()) === 1, {});
  await T("type-expense").click(); await page.waitForTimeout(300);
  rec("A7 back to Spent hides the extra row", await pressed("type-expense") && (await T("type-investment").count()) === 0, {});
  await page.screenshot({ path: "/tmp/claude-0/-home-claude-repo/271b6b7c-7f32-56d9-9a55-d75ca8158c50/scratchpad/add-type.png" });
} catch (e) { rec("RUN", false, String(e).slice(0, 400)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
