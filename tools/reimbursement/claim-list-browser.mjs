// Reimbursement received: the list of waiting work expenses, in the real app (Chromium, local Vite, SYNTHETIC data). A CHROMIUM check only.
// Run: node tools/reimbursement/claim-list-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4341, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const errors = [];
async function newPage(withWork) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
  await ctx.addInitScript(withWork => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]);
    set("arth_people", [{ id: "me", name: "Me", isMe: true }]);
    const w = (id, date, desc, amount, extra = {}) => ({ id, type: "expense", reimbursable: true, date, desc, amount, accId: "bank1", catId: "transport", catIds: ["transport"], ...extra });
    set("arth_txns", withWork ? [w("w1", "2026-11-12", "Taxi to airport", 1850), w("w2", "2026-11-12", "Hotel, 2 nights", 4800, { reimbursableAmount: 4000, createdAt: 2 }), w("w3", "2026-11-14", "Client lunch", 1150), w("w4", "2026-11-15", "Cab to client office", 600),
      w("w5", "2026-10-01", "Earlier trip", 500, { reimbursedByTxnId: "old" }), { id: "n1", type: "expense", date: "2026-11-10", desc: "Not a work expense", amount: 700, accId: "bank1", catId: "food", catIds: ["food"] }] : []);
    localStorage.setItem("arth_master_user_setup_complete", "true"); }, withWork);
  const page = await ctx.newPage(); page.on("pageerror", e => errors.push(String(e)));
  const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
  const T = id => page.getByTestId(id); const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
  const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  const openReimb = async amount => { await page.goto(APP); await page.waitForTimeout(1000); await unlock(); await page.waitForTimeout(500);
    await page.getByRole("button", { name: "+", exact: true }).first().click(); await page.waitForTimeout(700); await page.getByText("More options →").click(); await page.waitForTimeout(700);
    await page.locator("button:visible", { hasText: "Settlement" }).first().dispatchEvent("click"); await page.waitForTimeout(500);
    await page.getByPlaceholder(/e\.g\. ₹5,500/).fill(String(amount)); await page.waitForTimeout(300);
    await page.locator("button:visible", { hasText: /Reimbursement/ }).first().dispatchEvent("click"); await page.waitForTimeout(500); };
  return { page, T, ls, text, openReimb };
}
const save = async page => { await page.locator("button:visible", { hasText: /Add ✓|Save|Record/ }).last().click(); await page.waitForTimeout(900); };
try {
  { const { page, T, ls, text, openReimb } = await newPage(true);
    await openReimb(7000);
    rec("R1 the list shows the 4 waiting work expenses (not the reimbursed one, not the plain expense)", (await T("reimb-list").count()) === 1 && (await page.locator("[data-testid^='reimb-row-']").count()) === 4 && !/Earlier trip|Not a work expense/.test(await T("reimb-list").innerText()), await page.locator("[data-testid^='reimb-row-']").count());
    const lt = await T("reimb-list").innerText();
    rec("R2 oldest first, and the hotel shows what was spent and what is reimbursable", lt.indexOf("Taxi to airport") < lt.indexOf("Hotel") && lt.indexOf("Hotel") < lt.indexOf("Client lunch") && /4,800 spent, ₹4,000 reimbursable/.test(lt), lt.slice(0, 160));
    const sum = await T("reimb-summary").innerText();
    rec("R3 ₹7,000 ticks the first three exactly: '3 ticked · ₹7,000 of ₹7,000 received · nothing left over'", /3 ticked/.test(sum) && /7,000 of ₹7,000/.test(sum) && /nothing left over/.test(sum), sum);
    await T("reimb-row-w3").click(); await page.waitForTimeout(300);
    const sum2 = await T("reimb-summary").innerText();
    rec("R4 unticking the lunch leaves ₹1,150 not matched, and the ticks stay as I set them", /2 ticked/.test(sum2) && /1,150 not matched/.test(sum2), sum2);
    await T("reimb-row-w4").click(); await T("reimb-row-w3").click(); await page.waitForTimeout(300);
    const sum3 = await T("reimb-summary").innerText();
    rec("R5 ticking all four is ₹600 more than received and Save is refused with a plain message", /600 more than you received/.test(sum3), sum3);
    await save(page);
    rec("R5b nothing was saved while over-ticked", (await ls("arth_txns")).filter(t => t.type === "settlement_in").length === 0 && /more than you received/.test(await text()), {});
    await T("reimb-row-w4").click(); await page.waitForTimeout(300);
    await save(page);
    const all = await ls("arth_txns"); const inc = all.find(t => t.type === "settlement_in");
    rec("R6 saved: one settlement of ₹7,000, and exactly the three ticked expenses are marked reimbursed by it", inc && inc.amount === 7000 && all.filter(t => t.reimbursedByTxnId === inc.id).map(t => t.id).sort().join() === "w1,w2,w3", { inc: inc && inc.id, marked: all.filter(t => t.reimbursedByTxnId === inc?.id).map(t => t.id) });
    rec("R7 the cab stays waiting, the earlier reimbursement is not overwritten, the plain expense is untouched", !all.find(t => t.id === "w4").reimbursedByTxnId && all.find(t => t.id === "w5").reimbursedByTxnId === "old" && !all.find(t => t.id === "n1").reimbursedByTxnId, {});
    rec("R8 the old 'Mark all reimbursed' pop-up did not appear", !/Mark all reimbursed/.test(await text()), {}); }
  { const { page, T, ls, text, openReimb } = await newPage(false);
    await openReimb(3000);
    rec("E1 with nothing waiting the list says so and tells me how to mark work expenses", (await T("reimb-empty").count()) === 1 && /Work expense/.test(await T("reimb-empty").innerText()), {});
    await save(page);
    rec("E2 a reimbursement can still be saved with nothing to tick", (await ls("arth_txns")).filter(t => t.type === "settlement_in").length === 1, {}); }
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 500)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
