// The Budget page counted what others owe you as YOUR spend (it used amount minus refunds only).
// Real app in Chromium, SYNTHETIC data: one 13,056 expense fully owed back by a group. A CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4221, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
const month = new Date().toISOString().slice(0, 7);
await ctx.addInitScript((month) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "cc1", name: "Test Card", type: "cc", last4: "8004", creditLimit: 100000 }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }]);
  set("arth_groups", [{ id: "g1", name: "Shared Flat", members: [] }]);
  set("arth_cats", [{ id: "utilities", name: "Utilities", icon: "💡", color: "#f59e0b", budget: 5000 }]);
  set("arth_txns", [{ id: "t1", type: "expense", desc: "Meter payment", merchant: "Meter payment", amount: 13056, date: month + "-10", accId: "cc1", catId: "utilities", catIds: ["utilities"],
    trackingMode: "allocate", groupId: "g1", groupAllocations: [{ groupId: "g1", amount: 13056, mode: "owes" }], groupCollectiveAmount: 13056,
    allocations: [{ id: "r1", targetType: "group", targetId: "g1", amount: 13056, mode: "owes", items: [] }] }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); }, month);
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(700); } } };
try {
  await page.goto(APP); await page.waitForTimeout(1300); await unlock(); await page.waitForTimeout(500);
  const home = await text();
  rec("B0 Home: nothing over budget for the month (the full amount is owed back)", !/over budget/i.test(home), home.slice(0, 200));
  await page.getByText("Budget", { exact: true }).first().dispatchEvent("click").catch(() => {}); await page.waitForTimeout(900);
  const b = await text();
  rec("B1 Budget page does not report the owed-back 13,056 as your overspend", !/13,056/.test(b) || !/(over budget|overspent|over pace)/i.test(b), b.slice(0, 400));
  await page.getByText("Year view", { exact: true }).first().dispatchEvent("click").catch(() => {}); await page.waitForTimeout(900);
  const y = await text();
  const spentCard = (y.match(/₹[\d,]+(?= \d+% of annual budget used)/) || [""])[0];
  rec("B2 Year view: spend so far is ₹0 (not the owed-back 13,056)", spentCard === "₹0", { spentCard, snippet: y.slice(y.indexOf("annual budget used") - 80, y.indexOf("annual budget used") + 40) });
} catch (e) { rec("RUN", false, String(e).slice(0, 700)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);
