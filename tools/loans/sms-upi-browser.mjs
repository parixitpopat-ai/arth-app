// Bank SMS import in the real Add screen (Chromium, local Vite dev server, SYNTHETIC account). A CHROMIUM check only.
// Run: node tools/loans/sms-upi-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4197, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
  localStorage.setItem("arth_accounts", JSON.stringify([
    { id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" },
    { id: "cc1", name: "Test ICICI Card", type: "cc", limit: 100000, outstanding: 0, statementDate: 15, dueDate: 5, last4: "8004" }]));
  localStorage.setItem("arth_txns", "[]"); localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const unlock = async () => { for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
const paste = async text => {
  await page.goto(APP); await page.waitForTimeout(900); await unlock();
  await page.getByRole("button", { name: "+", exact: true }).first().click(); await page.waitForTimeout(700);
  await page.getByText("More options →").click(); await page.waitForTimeout(700);
  await page.getByText("Bank SMS import").click(); await page.waitForTimeout(400);
  await page.getByPlaceholder("Paste bank SMS here...").fill(text); await page.waitForTimeout(700);
  if (await page.getByText(/Details ▾/).count()) { await page.getByText(/Details ▾/).first().click(); await page.waitForTimeout(400); }
  return page.evaluate(() => ({ vals: [...document.querySelectorAll("input")].map(i => i.value).filter(Boolean) }));
};
try {
  const REAL = "[BP-ICICIT-S] ICICI Bank Credit Card XX8004 debited for INR 670.01 on 04-Nov-26 for UPI--PAX INNO. To dispute call 18001080/SMS BLOCK 8004 to 9215676766";
  const r = await paste(REAL);
  rec("U1 merchant is read as 'Pax Inno'", r.vals.includes("Pax Inno"), r.vals);
  rec("U2 the date 04-Nov-26 is read as 2026-11-04 (shown in the date box)", r.vals.some(v => v === "2026-11-04" || v === "04/11/2026" || v === "11/04/2026") || /04.?11.?2026|2026-11-04/.test(r.vals.join(" ")), r.vals);
  rec("U3 the amount 670.01 is still read (not the merchant)", r.vals.includes("670.01"), r.vals);
  const body = await page.evaluate(() => document.body.innerText);
  rec("U4 the card ending 8004 is still matched", /Test ICICI Card/.test(body), {});
  const r2 = await paste("Rs 250.00 debited from a/c XX9001 on 05-Nov-26 UPI/P2M/412345678901/SWIGGY INSTAMART Ref 55");
  rec("U5 UPI/P2M/<ref>/NAME: merchant 'Swiggy Instamart' and date 2026-11-05", r2.vals.includes("Swiggy Instamart") && /2026-11-05|05.?11.?2026/.test(r2.vals.join(" ")), r2.vals);
  const r3 = await paste("INR 99.00 debited on 06-Nov-26 for groceries. Avl bal INR 5000.");
  rec("U6 (control) a debit with no UPI name does not take 'INR 99' as the merchant", !r3.vals.some(v => /^INR\s*\d/i.test(v)), r3.vals);
  rec("U7 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 400)); }
finally { await browser.close(); try { process.kill(-server.pid); } catch {} }
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
