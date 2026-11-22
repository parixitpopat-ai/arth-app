// A provider's bill message becomes a "New bill" proposal on Home and in the bell; Add this bill opens the form filled in. SYNTHETIC data; the phone's message queue is replaced by the test hook
// (window.__ARTH_SMS_TEST__), so the Android receiver itself is NOT exercised here. A CHROMIUM check only.
// Run: node tools/imports/bill-sms-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4551, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 1100 }, timezoneId: "Asia/Kolkata" });
const now = Date.now();
await ctx.addInitScript(([now]) => { window.__ARTH_SMS_TEST__ = window.__ARTH_SMS_TEST__ || { granted: true, receive: true, notify: true, pollMs: 1500, pending: [
    { id: "m1", address: "VM-TORPWR", date: now, body: "Dear customer, your electricity bill of Rs.3,045.00 for consumer no 1234567890 is due on 28-Jul-26. Pay online to avoid late fee." },
    { id: "m2", address: "VM-HDFCBK", date: now, body: "Rs.450.00 debited from A/c XX9001 on 22-11-26 to SWIGGY. Avl Bal Rs 50,000.00" }] };
  if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }]);
  set("arth_biller_accounts", [{ id: "ba1", billerId: "elec", name: "House Electricity", type: "Electricity", provider: "Torrent Power", consumerNo: "1234567890" }]);
  set("arth_bills", []); set("arth_txns", []); localStorage.setItem("arth_master_user_setup_complete", "true"); }, [now]);
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
try {
  await page.goto(APP); await page.waitForTimeout(1500); await unlock(); await page.waitForTimeout(3500);
  rec("B1 Home shows a NEW BILL row for the provider's message", (await T("needs-new-bill").count()) === 1, {});
  const row = (await T("needs-new-bill").innerText()).replace(/\s+/g, " ");
  rec("B2 it names the connection it matched, the amount and the due date", /House Electricity/.test(row) && /3,045/.test(row) && /Due 28-Jul-2026/.test(row), row);
  rec("B3 the bank debit message was not taken as a bill: it is still in the bell", (await page.evaluate(() => JSON.parse(localStorage.getItem("arth_sms_pending") || "[]").length)) === 1, {});
  await T("needs-new-bill-add").click(); await page.waitForTimeout(900);
  const vals = await page.locator("input").evaluateAll(els => els.map(e => e.value));
  rec("B4 Add this bill opens the Add Bill form with 3045 and the due date 2026-07-28 filled in", vals.includes("3045") && vals.includes("2026-07-28"), vals.filter(Boolean));
  rec("B5 the form shows the matched connection (House Electricity, Torrent Power) as the one chosen", /Add bill\s+✕\s+House Electricity\s+Torrent Power/.test(await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "))), {});
  rec("B6 the notice is finished: it is not offered again", (await page.evaluate(() => JSON.parse(localStorage.getItem("arth_sms_bills") || "[]").length)) === 0, {});
} catch (e) { rec("RUN", false, String(e).slice(0, 400)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
