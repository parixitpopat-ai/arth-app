// What an investment is worth now: units x price in net worth, the panel on a holding, the NAV lookup (a STAND-IN for the NAV service; its real answer shape is unverified), failures kept honest. SYNTHETIC data, real app in Chromium. CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4591, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 1400 } });
const day = n => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
await ctx.addInitScript(([t0, t1]) => {
  const q = JSON.parse(sessionStorage.getItem("__nav") || "null");
  window.__ARTH_NAV_TEST__ = q || { calls: [], responses: {
    "https://api.mfapi.in/mf/119551/latest": { meta: { scheme_name: "Example Fund Direct Growth" }, data: [{ date: t1, nav: "60.0000" }] },
    "https://api.mfapi.in/mf/search?q=example": [{ schemeCode: 119551, schemeName: "Example Fund Direct Growth" }] } };
  window.__ARTH_NAV_TEST__.calls = [];
  if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  localStorage.setItem("arth_nav_v2", "1");
  set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01" }]); set("arth_people", [{ id: "me", name: "Me", isMe: true }]);
  set("arth_txns", [
    { id: "i1", type: "investment", desc: "Example Fund", merchant: "Example Fund", date: t0, amount: 5000, accId: "b1", investType: "mf", investFolio: "12345", investNav: 50, createdAt: 1 },
    { id: "i2", type: "investment", desc: "Example Fund", merchant: "Example Fund", date: t1, amount: 5000, accId: "b1", investType: "mf", investFolio: "12345", investNav: 40, createdAt: 2 }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); }, [day(-30), day(0)]);
const p = await ctx.newPage(); const errors = []; p.on("pageerror", e => errors.push(String(e)));
const T = id => p.getByTestId(id); const body = async () => (await p.locator("body").innerText()).replace(/\s+/g, " ");
const unlock = async () => { for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(100); } await p.waitForTimeout(500); } };
const gotoInvest = async () => { await T("nav-money").click(); await p.waitForTimeout(500); await T("section-invest").click(); await p.waitForTimeout(500); await unlock(); await p.waitForTimeout(500); };
await p.goto(APP); await p.waitForTimeout(1300); await unlock();
await gotoInvest();
rec("V1 before any price, net worth counts what was put in (₹10,000)", /Mutual Fund/i.test(await body()) && /₹10,000/.test(await body()), (await body()).match(/Mutual Fund[^S]*/i)?.[0]);
await p.getByText(/^Mutual Fund/i).first().click(); await p.waitForTimeout(700);
await p.getByText("Folio 12345").first().click(); await p.waitForTimeout(700);
rec("V2 the holding has a 'What it is worth now' panel that says it counts what was put in", (await T("holding-value-panel").count()) === 1 && /Net worth counts the ₹10,000 put in/.test(await body()), {});
rec("V3 units are worked out from the entries (5000/50 + 5000/40 = 225) and shown", /worked out from your entries: 225/.test(await body()), (await body()).match(/worked out[^.]*/)?.[0]);
await T("holding-price").fill("60"); await T("holding-save").click(); await p.waitForTimeout(600);
rec("V4 typing today's NAV 60 values it at 225 x 60 = ₹13,500, gain ₹3,500 (+35%)", /₹13,500/.test(await body()) && /\+₹3,500 \(\+35%\)/.test(await body()), (await body()).match(/₹13,500[^·]*/)?.[0]);
await p.getByText("✕").last().click(); await p.waitForTimeout(500);
rec("V5 the folio row and the Invest total now show the market value and the gain", /₹13,500/.test(await body()) && (await T("folio-gain").count()) === 1, {});
// lookup by name, then NAV
await p.getByText("Folio 12345").first().click(); await p.waitForTimeout(600);
await T("holding-price").fill(""); await T("holding-search").fill("example"); await T("holding-search-go").click(); await p.waitForTimeout(600);
rec("V6 searching by name lists the fund", (await T("holding-fund").count()) === 1, await p.evaluate(() => window.__ARTH_NAV_TEST__.calls));
await T("holding-fund").click(); await p.waitForTimeout(900);
rec("V7 choosing it gets the NAV (60) and saves the scheme code", /NAV 60 as of/.test(await body()) && (await p.evaluate(() => JSON.parse(localStorage.getItem("arth_holding_values"))["mf|folio|12345"].schemeCode)) === "119551", await p.evaluate(() => localStorage.getItem("arth_holding_values")));
// a failing lookup keeps the old value and says why
await p.evaluate(() => { sessionStorage.setItem("__nav", JSON.stringify({ calls: [], responses: { "https://api.mfapi.in/mf/119551/latest": { __fail: "offline" }, "https://api.mfapi.in/mf/119551": { __fail: "offline" } } })); });
await p.reload(); await p.waitForTimeout(1300); await unlock(); await gotoInvest();
await p.getByText(/^Mutual Fund/i).first().click(); await p.waitForTimeout(600); await T("invest-refresh-navs").click(); await p.waitForTimeout(900);
rec("V8 a failed refresh says why and the value stays ₹13,500", /No internet connection/.test(await body()) && /₹13,500/.test(await body()), (await body()).match(/(0 of 1|No internet)[^.]*\./)?.[0]);
// garbage answer is refused
await p.evaluate(() => { sessionStorage.setItem("__nav", JSON.stringify({ calls: [], responses: { "https://api.mfapi.in/mf/119551/latest": { surprise: true }, "https://api.mfapi.in/mf/119551": { surprise: true } } })); });
await p.reload(); await p.waitForTimeout(1300); await unlock(); await gotoInvest();
await p.getByText(/^Mutual Fund/i).first().click(); await p.waitForTimeout(600); await T("invest-refresh-navs").click(); await p.waitForTimeout(900);
rec("V9 an answer that does not look like a NAV is refused (could not read), the old value stays", /could not read/i.test(await body()) && /₹13,500/.test(await body()), {});
// clear
await p.getByText("Folio 12345").first().click(); await p.waitForTimeout(600); await T("holding-clear").click(); await p.waitForTimeout(500); await p.getByText("✕").last().click(); await p.waitForTimeout(400);
rec("V10 Clear goes back to counting what was put in (₹10,000)", /₹10,000/.test(await body()) && !/₹13,500/.test(await body()), {});
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await b.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
