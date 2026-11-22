// Add screen, new look: the person rows say what each choice does, and a summary line says what will be owed. SYNTHETIC data, real app in Chromium. CHROMIUM check only. Run: node tools/ui/they-paid-browser.mjs
// A CHROMIUM check. It says nothing about the Android app.   Run: node tools/loans/loan-checkbox-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4471, APP = `http://localhost:${PORT}/`;
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
const addRaj = async () => { await page.getByRole("button", { name: /Add person or group/ }).first().dispatchEvent("click"); await page.waitForTimeout(400);
  await page.getByPlaceholder(/Search person or group/).fill("Raj"); await page.waitForTimeout(300);
  await page.locator("button:visible", { hasText: /Raj/ }).first().dispatchEvent("click"); await page.waitForTimeout(400); };
try {
  // 1: he paid 400 of 1000
  await openAdd();
  await page.getByPlaceholder(/e\.g\. ₹5,500/).fill("1000");
  await page.getByPlaceholder(/vendor|merchant|store/i).first().fill("TV");
  await addRaj();
  await page.locator("button[title='Own']").first().dispatchEvent("click"); await page.waitForTimeout(300);
  await page.locator("input[type='number'][placeholder='All of it']").first().fill("400"); await page.waitForTimeout(300);
  rec("T1 the row says he paid 400, you owe him, and your account is debited 600", /paid ₹400.*owe them ₹400.*debited ₹600/.test((await T("row-summary").innerText()).replace(/\s+/g, " ")), (await T("row-summary").innerText()).replace(/\s+/g, " "));
  rec("T2 the line above Add says the same", /You will owe Raj Test ₹400/.test(await T("save-result").innerText()) && /debited ₹600/.test(await T("save-result").innerText()), (await T("save-result").innerText()));
  await page.getByRole("button", { name: /^Add ✓$/ }).click(); await page.waitForTimeout(1000);
  const tx = (await ls("arth_txns")).filter(t => t.desc === "TV" || t.merchant === "TV");
  const mine = tx.find(t => !t.paidByPersonId), theirs = tx.find(t => t.paidByPersonId);
  rec("T3 saved as two entries: mine 600 from Test Savings, his 400 paid by him with none of my accounts", tx.length === 2 && mine && mine.amount === 600 && mine.accId === "bank1" && theirs && theirs.amount === 400 && !theirs.accId, tx.map(t => [t.amount, t.accId, t.paidByPersonId]));
  rec("T4 both keep the same category and date, so spending is the whole 1,000", mine && theirs && mine.date === theirs.date && (mine.catId || null) === (theirs.catId || null), {});
  await page.goto(APP); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(500);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(400);
  rec("T5 Test Savings went down by 600 only (₹1,00,000 to ₹99,400)", /Test Savings.{0,40}₹99,400/.test(await text()), (await text()).match(/Test Savings.{0,40}/)?.[0]);
  await page.getByText(/^home$/i).last().dispatchEvent("click"); await page.waitForTimeout(700);
  rec("T6 Home counts 1,000 as spent this month", /Spent ₹1,000/.test(await text()), (await text()).match(/Spent ₹[\d,]+/)?.[0]);
  // 2: more than the expense
  await openAdd();
  await page.getByPlaceholder(/e\.g\. ₹5,500/).fill("1000");
  await page.getByPlaceholder(/vendor|merchant|store/i).first().fill("Too much");
  await addRaj();
  await page.locator("button[title='Own']").first().dispatchEvent("click"); await page.waitForTimeout(300);
  await page.locator("input[type='number'][placeholder='All of it']").first().fill("1200"); await page.waitForTimeout(300);
  await page.getByRole("button", { name: /^Add ✓$/ }).click(); await page.waitForTimeout(700);
  rec("T7 he cannot have paid more than the expense: refused with the reason, nothing saved", /paid 1200 but the expense is 1000/.test(await text()) && !(await ls("arth_txns")).some(t => t.desc === "Too much"), {});
} catch (e) { rec("RUN", false, String(e).slice(0, 400)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
