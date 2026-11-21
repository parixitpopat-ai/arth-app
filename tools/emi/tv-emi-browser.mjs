// TV bought on a card EMI: what the app creates, and how Home, Budget and the loan react. SYNTHETIC data, real app in Chromium. CHROMIUM check only.
// Run: node tools/emi/tv-emi-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4381, APP = `http://localhost:${PORT}/`;
const server = spawn("node", [...(process.env.PREVIEW ? ["node_modules/vite/bin/vite.js", "preview", "--port"] : ["node_modules/vite/bin/vite.js", "--port"]), String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 1000 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 200000, openingBalanceDate: "2026-01-01", last4: "9001" },
    { id: "cc1", name: "Coral RuPay", type: "cc", limit: 200000, outstanding: 0, statementDate: 15, dueDate: 5, last4: "8004" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }]); set("arth_txns", []); set("arth_loans", []);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => { errors.push(String(e)); console.log("PAGEERR", String(e).slice(0,300)); });
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const shot = n => page.screenshot({ path: `/tmp/claude-0/-home-claude-repo/271b6b7c-7f32-56d9-9a55-d75ca8158c50/scratchpad/${n}.png` });
await page.goto(APP); await page.waitForTimeout(1300); await unlock(); await page.waitForTimeout(500);
await page.getByRole("button", { name: "+", exact: true }).first().click(); await page.waitForTimeout(700);
await page.getByText("More options →").click(); await page.waitForTimeout(600);
await page.getByPlaceholder(/e\.g\. ₹5,500/).fill("60000");
await page.getByPlaceholder(/vendor|merchant|store/i).first().fill("TV");
await page.getByText(/^Details/).first().click(); await page.waitForTimeout(500);
await page.getByText("Test Savings").first().click(); await page.waitForTimeout(400);
await page.getByText("Coral RuPay").last().click(); await page.waitForTimeout(500);
await page.getByRole("button", { name: /EMI$/ }).first().click(); await page.waitForTimeout(500);
await page.getByText("💳 Credit card EMI").click(); await page.waitForTimeout(300);
await page.getByText("❓ None").first().click(); await page.waitForTimeout(400);
await page.getByText("👗 Lifestyle").click(); await page.getByRole("button", { name: "Done" }).click(); await page.waitForTimeout(300);
await page.getByText("💸 Down payment").click(); await page.waitForTimeout(300);
await page.getByPlaceholder("e.g. ₹20,000").fill("6000");
await page.getByPlaceholder("e.g. 12").first().fill("9");
await page.getByPlaceholder("e.g. ₹2,500").fill("6000");
await page.waitForTimeout(300); await shot("emi3"); console.log((await text()).match(/EMI plan details.{0,500}/)?.[0]);
await page.getByRole("button", { name: /^Add ✓$/ }).click(); await page.waitForTimeout(1000);
const loans = await ls("arth_loans"), txns = await ls("arth_txns");
console.log("LOANS", JSON.stringify(loans.map(l => ({ name: l.name, dir: l.direction, principal: l.principal, outstanding: l.outstanding, emi: l.emiAmount, tenure: l.tenureMonths, due: l.dueDate, auto: l.autoScheduled, n: (l.scheduledInstallmentIds||[]).length, status: l.status }))));
console.log("TXNS", JSON.stringify(txns.map(t => [t.date, t.type, t.amount, t.desc, t.accId]).sort()));
console.log("ACC", JSON.stringify((await ls("arth_accounts")).map(a => [a.name, a.outstanding])));
await page.close();
for (const day of ["2026-11-22", "2026-12-10", "2026-12-16", "2027-01-16"]) {
  const pg = await ctx.newPage();
  await pg.clock.install({ time: new Date(day + "T10:00:00+05:30") });
  await pg.goto(APP); await pg.waitForTimeout(1500);
  for (let i = 0; i < 3; i++) { if (await pg.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await pg.getByRole("button", { name: "1", exact: true }).click(); await pg.waitForTimeout(100); } await pg.waitForTimeout(500); } }
  await pg.clock.resume().catch(() => {}); await pg.waitForTimeout(800);
  const t = (await pg.evaluate(() => document.body.innerText.replace(/\s+/g, " ")));
  const l = JSON.parse(await pg.evaluate(() => localStorage.getItem("arth_loans") || "[]"))[0];
  console.log("\n== " + day, "| loan outstanding", l?.outstanding, "due", l?.dueDate, l?.status);
  console.log("  RAW:", t.slice(0, 160));
  console.log("  HOME:", (t.match(/LEFT IN BUDGET.{0,160}/) || [""])[0]);
  console.log("  MONEY REQ:", (t.match(/MONEY REQUIRED.{0,60}/) || [""])[0], "| NEEDS:", (t.match(/NEEDS YOU.{0,140}/i) || [""])[0]);
  if (day === "2026-12-16") {
    console.log("  BILLS:", await pg.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("arth_bills") || "[]").map(b => [b.name, b.amount, b.dueDate, b.status, b.isCcStatement, b.accId]))));
    await pg.getByText("MONEY REQUIRED", { exact: false }).first().click(); await pg.waitForTimeout(900);
    console.log("  MR SCREEN:", (await pg.evaluate(() => document.body.innerText.replace(/\s+/g, " "))).slice(0, 900));
  }
  await pg.close();
}
await browser.close(); try { process.kill(-server.pid); } catch {}
