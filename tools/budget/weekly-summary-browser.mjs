// Budget: limits are guides (never blocked), category limits live on Budget not Settings, and suggestions follow the real last 3 months.
// Real app in Chromium, SYNTHETIC data: one 13,056 expense fully owed back by a group. A CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4223, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
const ds = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const now = new Date(); const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)); const lastMon = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() - 7);
const x = (id, date, amount, cat, extra = {}) => ({ id, type: "expense", desc: cat, merchant: cat, amount, date: ds(date), accId: "bank1", catId: cat, catIds: [cat], ...extra });
const seedTxns = [
  x("a", mon, 1000, "food"),
  x("b", lastMon, 2000, "shopping"),
  x("c", mon, 5000, "travel", { trackingMode: "allocate", groupAllocations: [{ groupId: "g1", amount: 5000, mode: "owes" }], groupCollectiveAmount: 5000 }),
];
await ctx.addInitScript((txns) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 500000, openingBalanceDate: "2025-01-01", last4: "9001" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }]);
  set("arth_groups", [{ id: "g1", name: "Flat", members: [] }]);
  set("arth_cats", [{ id: "food", name: "Food", icon: "F", color: "#16a34a", budget: 0, subs: [] }, { id: "shopping", name: "Shopping", icon: "S", color: "#9333ea", budget: 0, subs: [] }, { id: "travel", name: "Travel", icon: "T", color: "#0ea5e9", budget: 0, subs: [] }]);
  set("arth_txns", txns);
  localStorage.setItem("arth_master_user_setup_complete", "true"); }, seedTxns);
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(700); } } };
try {
  await page.goto(APP); await page.waitForTimeout(1300); await unlock(); await page.waitForTimeout(600);
  const card = page.getByTestId("weekly-summary");
  rec("W1 the weekly card is on Home", (await card.count()) === 1, {});
  const t = (await card.count()) ? (await card.innerText()).replace(/\s+/g, " ") : "";
  rec("W2 headline compares with the same days last week: 1,000 vs 2,000 = down by 50%", /Spends down by 50% this week/.test(t) && /₹1,000/.test(t) && /₹2,000/.test(t), t);
  rec("W3 money others owe you is not counted (the 5,000 owed-back trip is left out)", !/6,000|5,000 /.test(t.replace("₹2,000", "")) , t);
  rec("W4 it says which category moved (by the app's own category name): ₹2,000 lower than the same days last week", /\w+ is ₹2,000 lower than the same days last week/.test(t), t);
  await card.getByRole("button", { name: "Later" }).click(); await page.waitForTimeout(600);
  rec("W5 Later hides it", (await page.getByTestId("weekly-summary").count()) === 0, {});
  await page.reload(); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(600);
  rec("W6 it stays hidden after a reload (until next week)", (await page.getByTestId("weekly-summary").count()) === 0, {});
} catch (e) { rec("RUN", false, String(e).slice(0, 700)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);
