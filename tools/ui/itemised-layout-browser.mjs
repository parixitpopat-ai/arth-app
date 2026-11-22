// Itemised purchase, new look: items first, then charges; a bar card shows what each category gets when there are two or more. SYNTHETIC data, real app in Chromium. CHROMIUM check only.
// Run: node tools/ui/itemised-layout-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4501, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 1400 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }]);
  set("arth_txns", [{ id: "t1", type: "expense", merchant: "Test Mart", desc: "Test Mart", date: "2026-11-10", amount: 1000, accId: "b1", catId: "groceries", catIds: ["groceries", "housing"], subIds: [], people: {}, splitMode: "none", trackingMode: "none",
    lineItems: [{ id: "l1", label: "Rice", qty: 1, unitPrice: 600, amount: 600, catId: "groceries", subId: null, splits: null }, { id: "l2", label: "Detergent", qty: 1, unitPrice: 400, amount: 400, catId: "housing", subId: null, splits: null }] }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
try {
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(500);
  await page.getByText("Test Mart").first().click(); await page.waitForTimeout(600);
  await page.getByText(/^Edit$|✏️ Edit|Edit/).first().click(); await page.waitForTimeout(700);
  const body = await page.evaluate(() => document.body.innerText);
  rec("I1 the items come before the charges", body.indexOf("ITEMS") > -1 && body.indexOf("ITEMS") < body.indexOf("CHARGES"), { items: body.indexOf("ITEMS"), charges: body.indexOf("CHARGES") });
  rec("I2 two categories show an 'Items by category' card with Groceries 600 and Housing 400", (await T("items-by-category").count()) === 1 && /Groceries[\s\S]*600/.test(await T("items-by-category").innerText()) && /Housing[\s\S]*400/.test(await T("items-by-category").innerText()), (await T("items-by-category").count()) ? (await T("items-by-category").innerText()).replace(/\s+/g, " ") : "none");
  rec("I3 the 'Lines add up to' total is still under the items", /Lines add up to/.test(body) && body.indexOf("Lines add up to") < body.indexOf("CHARGES"), {});
  await page.screenshot({ path: "/tmp/claude-0/-home-claude-repo/271b6b7c-7f32-56d9-9a55-d75ca8158c50/scratchpad/items2.png" });
} catch (e) { rec("RUN", false, String(e).slice(0, 400)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
