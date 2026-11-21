// A SIP skipped for its coming month leaves Money Required. SYNTHETIC data, real app in Chromium (data seeded, the button's own click is not driven here). CHROMIUM check only.
// Run: node tools/bills/sip-skip-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4401, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const now = new Date(); const dayNext = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5).getDate(); // due in 5 days, inside the 30-day window
const nextKey = (() => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
const run = async (skippedMonths) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1000 }, timezoneId: "Asia/Kolkata" });
  await ctx.addInitScript(([day, skipped]) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 200000, openingBalanceDate: "2026-01-01" }]);
    set("arth_people", [{ id: "me", name: "Me", isMe: true }]); set("arth_txns", []);
    set("arth_recurring", [{ id: "r1", groupKey: "Index fund", name: "Index fund", investType: "mf", day, amount: 5000, accId: "bank1", active: true, ...(skipped ? { skippedMonths: skipped } : {}) }]);
    localStorage.setItem("arth_master_user_setup_complete", "true"); }, [dayNext, skippedMonths]);
  const page = await ctx.newPage();
  await page.goto(APP); await page.waitForTimeout(1300);
  for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } }
  await page.waitForTimeout(600);
  const t = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  await ctx.close(); return (t.match(/MONEY REQUIRED ₹[\d,]+/) || [""])[0];
};
try {
  const a = await run(null), b = await run([nextKey]), c = await run(["2020-01"]);
  rec("S1 a SIP due in 5 days counts ₹5,000 in Money Required", /₹5,000/.test(a), a);
  rec("S2 skipped for that month, it no longer counts", /₹0\b/.test(b), b);
  rec("S3 skipped for some other month, it still counts", /₹5,000/.test(c), c);
} catch (e) { rec("RUN", false, String(e).slice(0, 400)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
