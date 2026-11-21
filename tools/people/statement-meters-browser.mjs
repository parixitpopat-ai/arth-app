// Several meters under one biller (house, office, building): the statement names each bill's meter. SYNTHETIC data, real app in Chromium. A CHROMIUM check only.
// Run: node tools/people/statement-meters-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4361, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "r", name: "Ravi" }]);
  set("arth_biller_accounts", [{ id: "a1", billerId: "water", name: "Office", type: "Water", provider: "City Water", consumerNo: "WT-77120045" }, { id: "a2", billerId: "water", name: "House", type: "Water", provider: "City Water", consumerNo: "WT-55610321" }, { id: "a3", billerId: "elec", name: "Home meter", type: "Electricity", provider: "Test Power", consumerNo: "9001" }]);
  const owes = a => ({ amount: a, mode: "owes", settled: false, settledAmt: 0, remainingAmt: a });
  set("arth_bills", [
    { id: "w1", name: "Water", billDate: "2026-07-27", dueDate: "2026-08-02", billerAccountId: "a1", status: "unpaid", amount: 500, splitPeople: { r: owes(500) } },
    { id: "w2", name: "Water", billDate: "2026-07-28", dueDate: "2026-08-03", billerAccountId: "a2", status: "unpaid", amount: 700, splitPeople: { r: owes(700) } },
    { id: "e1", name: "Electricity", billDate: "2026-07-20", dueDate: "2026-08-10", billerAccountId: "a3", status: "unpaid", amount: 900, splitPeople: { r: owes(900) } }]);
  set("arth_txns", []);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
try {
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^people$/i).last().dispatchEvent("click"); await page.waitForTimeout(900);
  await page.getByText("Ravi", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(800);
  await page.getByText(/EXISTING CAPABILITIES/).first().dispatchEvent("click"); await page.waitForTimeout(500);
  await T("person-statement-share").scrollIntoViewIfNeeded().catch(() => {}); await T("person-statement-share").dispatchEvent("click"); await page.waitForTimeout(700);
  await T("stmt-from").fill("2026-07-01"); await T("stmt-to").fill("2026-07-31"); await page.waitForTimeout(500);
  const lines = (await T("sel-line").allInnerTexts()).map(x => x.replace(/\s+/g, " ").trim());
  rec("M1 each water bill names its meter, and the lone electricity meter stays plain", lines.some(l => /July Water Bill \(Office\)/.test(l)) && lines.some(l => /July Water Bill \(House\)/.test(l)) && lines.some(l => /July Electricity Bill\b(?! \()/.test(l)), lines);
  const msg = await T("stmt-message").innerText();
  rec("M2 the message to send says the same, with the total", /July Water Bill \(Office\) - 500/.test(msg) && /July Water Bill \(House\) - 700/.test(msg) && /Total = 2100/.test(msg), msg);
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^people$/i).last().dispatchEvent("click"); await page.waitForTimeout(900);
  await page.getByText("Ravi", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(900);
  const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  rec("M3 the person's page names the old bills by month too (July Water Bill with its meter)", /July Water Bill \(Office\)/.test(body) && /July Water Bill \(House\)/.test(body) && /July Electricity Bill/.test(body), body.slice(body.search(/July/), body.search(/July/) + 200));
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 400)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
