// Today (Home): "Needs you" and "Between people" cards and the restyled "Left in budget" card, real app, SYNTHETIC data. A CHROMIUM check only.
// Run: node tools/ui/today-browser.mjs [screenshot folder]
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const OUT = process.argv[2] || "", PORT = 4351, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const errors = [];
async function open(dark, withData) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
  await ctx.addInitScript(([dark, withData]) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set("arth_dark", dark);
    const d = new Date(); const ds = n => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
    const ym = ds(0).slice(0, 7);
    set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 312400, openingBalanceDate: "2026-01-01", last4: "9001" }]);
    set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "r", name: "Raj Test" }, { id: "s", name: "Sunny Test" }]);
    if (withData) {
      const owes = (a, settledAmt = 0) => ({ amount: a, mode: "owes", settled: settledAmt >= a, settledAmt, remainingAmt: Math.max(0, a - settledAmt) });
      set("arth_txns", [
        { id: "t1", type: "expense", date: `${ym}-01`, desc: "Saj Burgers", amount: 1800, accId: "bank1", catId: "food", catIds: ["food"], people: { s: owes(900) } },
        { id: "t2", type: "expense", date: `${ym}-01`, desc: "K Auto", amount: 1687, accId: "bank1", catId: "transport", catIds: ["transport"], people: { r: owes(1687) } },
        { id: "rep1", type: "settlement_in", isRefund: false, date: `${ym}-01`, desc: "Raj paid plumber", amount: 800, appliedAmount: 0, extraAmount: 800, accId: "bank1", fromPersonId: "r", settlementLinks: [] }]);
      set("arth_bills", [{ id: "b1", name: "Electricity", merchant: "Electricity", status: "unpaid", amount: 3045, dueDate: ds(2), billDate: ds(-10), createdDate: ds(-10) }]);
      set("arth_loans", [{ id: "l1", direction: "given", name: "Sunny Test", personId: "s", principal: 15000, outstanding: 15000, startDate: `${ym}-01`, status: "active", repayments: [] }]);
      set("arth_budget", 50000);
    } else set("arth_txns", []);
    localStorage.setItem("arth_master_user_setup_complete", "true"); }, [dark, withData]);
  const page = await ctx.newPage(); page.on("pageerror", e => errors.push(String(e)));
  const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(900);
  return page;
}
try {
  { const page = await open(false, true); const T = id => page.getByTestId(id);
    if (OUT) await page.screenshot({ path: `${OUT}/today-light.png` });
    rec("T1 'Needs you' shows on Home, with the bill due soon first", (await T("home-needs-you").count()) === 1 && (await T("needs-bill").count()) === 1 && /Electricity/.test(await T("needs-bill").innerText()) && /Due in 2 days/.test(await T("needs-bill").innerText()), (await T("needs-bill").count()) ? await T("needs-bill").innerText() : "");
    rec("T2 repayments not applied is listed (Raj's ₹800 repayment has no item chosen)", (await T("needs-repayments").count()) === 1 && /1 repayment not applied/.test(await T("needs-repayments").innerText()), (await T("needs-repayments").count()) ? await T("needs-repayments").innerText() : "");
    rec("T3 the person who owes most is listed", (await T("needs-owed").count()) === 1 && /Raj Test owes you/.test(await T("needs-owed").innerText()), (await T("needs-owed").count()) ? await T("needs-owed").innerText() : "");
    rec("T3a each bill row has Pay and each person row has Remind", (await T("needs-pay").count()) === 1 && (await T("needs-remind").count()) === 1, {});
    await T("needs-archive").first().click(); await page.waitForTimeout(400);
    rec("T3b archiving the bill row removes it and offers 'Show 1 archived'", (await T("needs-bill").count()) === 0 && /Show 1 archived/.test(await T("needs-show-archived").innerText()), {});
    await page.reload(); await page.waitForTimeout(1200); for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } await page.waitForTimeout(500);
    rec("T3c it stays archived after a reload", (await T("needs-bill").count()) === 0 && (await T("needs-show-archived").count()) === 1, {});
    await T("needs-show-archived").click(); await page.waitForTimeout(400);
    rec("T3d 'Show archived' brings it back", (await T("needs-bill").count()) === 1, {});
    rec("T4 'Between people' shows coming to you including the ₹15,000 loan, and that it includes a loan", (await T("home-between-people").count()) === 1 && /15,000 lent/.test(await T("home-between-people").innerText()), (await T("home-between-people").count()) ? (await T("home-between-people").innerText()).replace(/\s+/g, " ") : "");
    await T("needs-owed").click(); await page.waitForTimeout(900);
    rec("T5 tapping the person row opens that person's page", /Raj Test/.test(await page.evaluate(() => document.body.innerText)) && /FINANCIAL POSITION|Financial position|Statement/i.test(await page.evaluate(() => document.body.innerText)), {}); }
  { const page = await open(false, false);
    rec("T6 with nothing to show, neither new card appears (no empty boxes)", (await page.getByTestId("home-needs-you").count()) === 0 && (await page.getByTestId("home-between-people").count()) === 0, {}); }
  { const page = await open(true, true);
    if (OUT) await page.screenshot({ path: `${OUT}/today-dark.png` });
    rec("T7 the dark theme shows the new cards too", (await page.getByTestId("home-needs-you").count()) === 1 && (await page.getByTestId("home-between-people").count()) === 1, {}); }
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 500)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
