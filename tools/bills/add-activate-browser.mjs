// Add Provider Account with several people (a family plan), in the real app (Chromium, local Vite dev server, SYNTHETIC data). A CHROMIUM check only.
// Run: node tools/bills/family-plan-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4213, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]);
  set("arth_billers", [{ id: "bl1", name: "Jio", type: "Mobile Postpaid" }]); set("arth_biller_accounts", [{ id: "ba1", name: "My number", type: "Mobile Postpaid", provider: "Jio", billerId: "bl1" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
const openSheet = async () => {
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^payments$/i).last().dispatchEvent("click"); await page.waitForTimeout(800);
  await page.getByText("Billers", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(600);
  await page.getByText(/Add \/ Activate/).first().dispatchEvent("click"); await page.waitForTimeout(700);
};
try {
  await openSheet();
  const m = await page.evaluate(() => { const e = document.querySelector('[data-testid="aa-sheet"]'); const r = e.getBoundingClientRect(); return { w: Math.round(r.width), x: Math.round(r.x), vw: window.innerWidth, sw: document.documentElement.scrollWidth, over: e.scrollWidth > e.clientWidth }; });
  rec("A1 the sheet is the full width of the phone (the old one was squeezed to two thirds) and nothing runs off its right edge", m.w === m.vw && m.x === 0 && !m.over && m.sw <= m.vw, m);
  const tiles = await page.$$eval('[data-testid^="aa-tile-"]', els => els.length);
  rec("A2 all 34 types are offered", tiles === 34, tiles);
  rec("A3 a type that is already set up is called out under 'Already set up'", (await T("aa-yours-Mobile Postpaid").count()) === 1 && /Already set up/i.test(await T("aa-sheet").innerText()), {});
  await T("aa-search").fill("gas"); await page.waitForTimeout(300);
  rec("A4 searching 'gas' leaves LPG Gas and Piped Gas only", (await page.$$eval('[data-testid^="aa-tile-"]', els => els.map(e => e.getAttribute("data-testid").slice(8)))).join() === "LPG Gas,Piped Gas", {});
  await T("aa-search").fill("zzzz"); await page.waitForTimeout(300);
  rec("A5 a search with no match says so and offers 'Add as Other'", (await T("aa-empty").count()) === 1 && (await T("aa-other").count()) === 1, {});
  await T("aa-search").fill(""); await page.waitForTimeout(200);
  await T("aa-tile-Mobile Prepaid").dispatchEvent("click"); await page.waitForTimeout(800);
  rec("A6 tapping a type routes as before: the sheet closes and the Add Provider form opens for it", (await T("aa-sheet").count()) === 0 && /Add Provider/.test(await text()) && /Mobile Prepaid/.test(await text()), (await text()).slice(0, 160));
  await openSheet();
  await T("aa-oneoff").dispatchEvent("click"); await page.waitForTimeout(800);
  rec("A7 'Add a one-off bill' closes the sheet and opens the Add Bill form", (await T("aa-sheet").count()) === 0 && /bill/i.test(await text()), {});
  await openSheet();
  await T("aa-close").dispatchEvent("click"); await page.waitForTimeout(600);
  rec("A8 the close button closes it", (await T("aa-sheet").count()) === 0, {});
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);
