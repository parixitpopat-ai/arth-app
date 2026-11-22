// The "Paste" button under Bank SMS import: it pastes when allowed, and says so when it is not (it used to do nothing). SYNTHETIC data, real app in Chromium. CHROMIUM check only; the Android app uses the Capacitor Clipboard plugin, which this does not exercise.
// Run: node tools/ui/sms-paste-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4531, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const SMS = "Rs 450.00 debited from A/c XX9001 on 22-11-26 to SWIGGY. Avl Bal Rs 50,000.00";
async function run(perms, clip) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1100 }, ...(perms ? { permissions: ["clipboard-read", "clipboard-write"] } : {}) });
  await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]);
    set("arth_people", [{ id: "me", name: "Me", isMe: true }]); set("arth_txns", []); localStorage.setItem("arth_master_user_setup_complete", "true"); });
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(APP); await page.waitForTimeout(1100);
  for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } }
  if (perms) await page.evaluate(t => navigator.clipboard.writeText(t), clip);
  await page.getByRole("button", { name: "+", exact: true }).first().click(); await page.waitForTimeout(600);
  await page.getByText("More options →").click(); await page.waitForTimeout(500);
  await page.getByText("Bank SMS import").click(); await page.waitForTimeout(400);
  await page.getByTestId("sms-paste-button").click(); await page.waitForTimeout(700);
  const out = { value: await page.locator('textarea[placeholder="Paste bank SMS here..."]').inputValue(), body: await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ")), errors };
  await ctx.close(); return out;
}
try {
  const ok = await run(true, SMS);
  rec("P1 with clipboard access the SMS lands in the box", ok.value === SMS, ok.value.slice(0, 60));
  const empty = await run(true, " ");
  rec("P2 an empty clipboard says so", /Your clipboard is empty/.test(empty.body) && empty.value === "", {});
  const blocked = await run(false, "");
  rec("P3 with access refused it says automatic paste is not available and how to paste by hand (it used to do nothing)", /Automatic paste is not available here\. Long-press the box and choose Paste\./.test(blocked.body), (blocked.body.match(/Automatic paste[^.]*\./) || ["none"])[0]);
  rec("Z1 no page errors", ok.errors.length + empty.errors.length + blocked.errors.length === 0, {});
} catch (e) { rec("RUN", false, String(e).slice(0, 400)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
