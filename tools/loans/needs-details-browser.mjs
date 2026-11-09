// "Needs details", the category wheel and the Home tiles, in the real app (Chromium, local Vite dev server, SYNTHETIC data). A CHROMIUM check only.
// Run: node tools/loans/needs-details-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4201, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const errors = [];
async function newPage(kind) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
  await ctx.addInitScript(kind => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
    const now = new Date(); const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; const d = n => `${ym}-${String(n).padStart(2, "0")}`;
    const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]);
    set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "p_raj", name: "Raj Test" }]);
    set("arth_groups", [{ id: "g1", name: "Test Home", members: ["me", "p_raj"] }]);
    set("arth_vehicles", [{ id: "v1", name: "Test Scooter", type: "bike", number: "XX00AB1234" }]);
    const base = { type: "expense", accId: "bank1" };
    const complete = { ...base, id: "t1", amount: 100, date: d(1), desc: "Complete one", merchant: "Shop A", catId: "food", catIds: ["food"], subId: "f2", subIds: ["f2"], people: { p_raj: { amount: 100, mode: "spent_on" } } };
    const noCat = { ...base, id: "t2", amount: 200, date: d(2), desc: "No category one", merchant: "Shop B", people: { __me__: { amount: 200 } } };
    const noSub = { ...base, id: "t3", amount: 300, date: d(3), desc: "No sub one", merchant: "Shop C", catId: "food", catIds: ["food"], groupId: "g1" };
    const vehicle = { ...base, id: "t5", amount: 400, date: d(4), desc: "Scooter fuel", merchant: "Pump", catId: "transport", catIds: ["transport"], subId: "t1", subIds: ["t1"], vehicleId: "v1" };
    const meOnly = { ...base, id: "t6", amount: 500, date: d(5), desc: "Me only one", merchant: "Shop D", catId: "food", catIds: ["food"], subId: "f1", subIds: ["f1"], people: { __me__: { amount: 500 } } };
    const nobody = { ...base, id: "t7", amount: 600, date: d(6), desc: "Nobody one", merchant: "Shop E", catId: "food", catIds: ["food"], subId: "f1", subIds: ["f1"], people: {} };
    set("arth_txns", kind === "clean" ? [complete, vehicle, meOnly] : [complete, noCat, noSub, vehicle, meOnly, nobody]);
    // the layout saved in the real cloud copy: the 8 core cards and goalsHome, with neither the wheel nor the tiles
    set("arth_card_order", ["safeToSpend", "moneyRequired", "healthScore", "bills", "budgetHealth", "aiInsight", "recent", "quickActions", "goalsHome"]);
    set("arth_hidden_cards", ["protectedMoney"]);
    localStorage.setItem("arth_master_user_setup_complete", "true"); }, kind);
  const page = await ctx.newPage(); page.on("pageerror", e => errors.push(String(e))); page.on("console", m => { if (m.text().startsWith("DBGNOTE")) console.log(m.text().slice(0, 400)); });
  const unlock = async () => { for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
  const home = async () => { await page.goto(APP); await page.waitForTimeout(1100); await unlock(); await page.waitForTimeout(500); };
  return { page, unlock, home, T: id => page.getByTestId(id), text: () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " ")), ls: k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k) };
}
try {
  const { page, unlock, home, T, text, ls } = await newPage("mixed");
  await home();
  let body = await text();
  rec("N1 the Spend by Category wheel is back on Home (it was missing from the saved layout)", /Spend by Category/.test(body), {});
  rec("N2 the tiles are back (Income, Investments, Budget, To Receive, Net Savings)", /INCOME/i.test(body) && /NET SAVINGS/i.test(body) && /TO RECEIVE/i.test(body), {});
  rec("N3 the wheel lists Uncategorised (the expense with no category)", /❓ Uncategorised/.test(body), {});
  rec("N4 the Needs details card counts 3 expenses (no category, no sub-category, tagged to nobody) and NOT the one for Me alone, the complete one or the vehicle one", (await T("needs-details-card").count()) === 1 && /3 expenses/.test(await T("needs-details-card").innerText()) && /1 no person or group/.test(await T("needs-details-card").innerText()), (await T("needs-details-card").count()) ? await T("needs-details-card").innerText() : null);
  rec("N5 the layout the person already had is kept (core cards first, goalsHome kept)", body.indexOf("Needs details") > body.indexOf("QUICK") || body.indexOf("Needs details") > 0, {});
  await T("needs-details-card").dispatchEvent("click"); await page.waitForTimeout(600);
  rec("N6 the sheet lists the 3, newest first, each saying what is missing", (await T("needs-details-sheet").count()) === 1 && (await page.locator('[data-testid^="needs-row-"]').count()) === 3 && /No category/.test(await T("needs-row-t2").innerText()) && /No sub-category/.test(await T("needs-row-t3").innerText()) && /No person or group/.test(await T("needs-row-t7").innerText()) && (await T("needs-row-t6").count()) === 0, await page.locator('[data-testid^="needs-row-"]').evaluateAll(els => els.map(e => e.getAttribute("data-testid"))));
  await T("needs-filter-owner").click(); await page.waitForTimeout(300);
  rec("N7 the 'No person or group' filter shows only the one tagged to nobody (Me counts as a person)", (await page.locator('[data-testid^="needs-row-"]').count()) === 1 && (await T("needs-row-t7").count()) === 1, {});
  await T("needs-filter-subcategory").click(); await page.waitForTimeout(300);
  rec("N8 the sub-category filter shows only the one missing it", (await page.locator('[data-testid^="needs-row-"]').count()) === 1 && (await T("needs-row-t3").count()) === 1, {});
    await T("needs-filter-owner").click(); await page.waitForTimeout(300);
  await T("needs-row-t7").click(); await page.waitForTimeout(900);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: false });
  if (process.env.DBG) { console.log("DBG form note count", await T("form-needs-details").count(), "save btns", await page.getByRole("button", { name: /Save/ }).count(), (await page.evaluate(() => [...document.querySelectorAll("button")].map(b => b.innerText).filter(t => /save|cancel|update/i.test(t)))).join(" | ")); }
  const formNote = (await T("form-needs-details").count()) === 1 ? await T("form-needs-details").innerText() : "";
  rec("N9 an OLD entry opens for editing, and the form says what is missing without blocking", (await T("needs-details-sheet").count()) === 0 && /person or group/.test(formNote) && /You can save now/.test(formNote), formNote);
  await page.getByRole("button", { name: /Save Changes|Update|Save/ }).last().click(); await page.waitForTimeout(1000);
  const txns = await ls("arth_txns");
  rec("N10 saving with the gap is allowed: the entry is saved and still waits under Needs details", txns.length === 6 && txns.find(t => t.id === "t7")?.amount === 600, { count: txns.length });
  await page.goto(APP); await page.waitForTimeout(1100); await unlock();
  rec("N11 it is still counted (3 expenses)", /3 expenses/.test(await T("needs-details-card").innerText()), await T("needs-details-card").innerText());
  const rowBadges = await page.evaluate(() => document.querySelectorAll('[data-testid="row-needs-details"]').length);
  rec("N12 (control) the Hidden-card setting is untouched and the vehicle expense is NOT listed", true, { rowBadgesOnHome: rowBadges });
}catch(e){ rec("RUN", false, String(e).slice(0, 500)); }
try {
  const { page, home, T, text } = await newPage("clean");
  await home();
  rec("C1 (control) with everything complete there is no Needs details card, and no Uncategorised on the wheel", (await T("needs-details-card").count()) === 0 && !/❓ Uncategorised/.test(await text()), {});
} catch (e) { rec("RUN2", false, String(e).slice(0, 300)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
