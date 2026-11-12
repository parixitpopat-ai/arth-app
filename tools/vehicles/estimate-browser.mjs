// Vehicle Fuel tab for someone who never fills to full: an ESTIMATE (clearly labelled) after 4 refuels / 20 L, a plain note before that, and the exact
// figure unchanged when full-tank refuels exist. Real app in Chromium, local Vite server, SYNTHETIC data. A CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4214, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const fill = (id, date, odometer, litres, amount, full) => ({ id, vehicleId: "v1", date, odometer, litres, amount, full });
const run = async (fills, check) => {
  const ctx = await browser.newContext({ timezoneId: "Asia/Kolkata", viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(f => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
    localStorage.setItem("arth_accounts", JSON.stringify([{ id: "b1", name: "Test Bank", type: "bank", openingBalance: 10000, openingBalanceDate: "2026-01-01", last4: "9001" }]));
    localStorage.setItem("arth_txns", "[]"); localStorage.setItem("arth_master_user_setup_complete", "true");
    localStorage.setItem("arth_vehicles", JSON.stringify([{ id: "v1", type: "bike", number: "MH12AB1234", name: "Test Bike", color: "#3b82f6" }]));
    localStorage.setItem("arth_fuel_fills", JSON.stringify(f)); }, fills);
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(APP); await page.waitForTimeout(1000);
  for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(120); } await page.waitForTimeout(600); } }
  await page.getByText("☰", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(500);
  await page.getByText("Vehicles").first().click(); await page.waitForTimeout(500);
  await page.getByText("Test Bike").first().click(); await page.waitForTimeout(500);
  await page.getByText("Fuel", { exact: true }).first().click(); await page.waitForTimeout(500);
  await check(page, errors); await ctx.close();
};
try {
  // a bike that really does 40 km/L, never filled to full: 4 refuels, 25 L after the first, 1000 km
  await run([fill("a", "2026-01-01", 1000, 5, 500, false), fill("b", "2026-01-10", 1200, 5, 500, false), fill("c", "2026-01-20", 1500, 7.5, 750, false), fill("d", "2026-02-01", 2000, 12.5, 1250, false)], async (page, errors) => {
    const avg = await page.getByTestId("mileage-avg").innerText(), body = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
    rec("E1 never-full fills: Avg km/L shows the estimate '≈ 40.0' and says '(est.)'", /≈ 40\.0/.test(avg) && /\(est\.\)/.test(body), { avg });
    rec("E2 a note explains it is an estimate (4 refuels, 1,000 km, 25 L) and how to get an exact figure", (await page.getByTestId("mileage-estimate-note").count()) === 1 && /Estimate from 4 refuels/.test(body) && /1,000 km/.test(body) && /Filled the tank to full/.test(body), body.slice(body.indexOf("Estimate"), body.indexOf("Estimate") + 160));
    rec("E3 fuel per km is the estimate too (₹2.50)", /≈ ₹2\.50/.test(await page.getByTestId("mileage-costkm").innerText()), await page.getByTestId("mileage-costkm").innerText());
    rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
  });
  // too few refuels: no number, a plain note
  await run([fill("a", "2026-01-01", 1000, 5, 500, false), fill("b", "2026-01-10", 1200, 5, 500, false)], async page => {
    const body = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
    rec("E4 with only 2 refuels there is no figure and the note says what is needed (4 refuels, about 20 L, or two full tanks)", (await page.getByTestId("mileage-avg").innerText()) === "—" && (await page.getByTestId("mileage-need-note").count()) === 1 && /4 refuels/.test(body) && /two full-tank refuels/.test(body), {});
  });
  // full-tank refuels exist: the exact figure, no estimate wording
  await run([fill("a", "2026-01-01", 1000, 30, 3000, true), fill("b", "2026-01-10", 1300, 20, 2000, false), fill("c", "2026-01-20", 1500, 20, 2000, true), fill("d", "2026-02-01", 1900, 25, 2750, true)], async page => {
    const body = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
    rec("E5 with full-tank refuels the exact figure is used (13.8) and nothing is called an estimate", (await page.getByTestId("mileage-avg").innerText()) === "13.8" && !/\(est\.\)/.test(body) && (await page.getByTestId("mileage-estimate-note").count()) === 0, {});
  });
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);
