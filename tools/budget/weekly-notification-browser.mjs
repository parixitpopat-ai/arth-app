// Budget: limits are guides (never blocked), category limits live on Budget not Settings, and suggestions follow the real last 3 months.
// Real app in Chromium, SYNTHETIC data: one 13,056 expense fully owed back by a group. A CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4224, APP = `http://localhost:${PORT}/`;
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
await ctx.addInitScript(() => { window.__ARTH_WEEKLY_TEST__ = { granted: true, calls: [] }; });
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
  await page.locator("button", { hasText: "☰" }).first().click(); await page.waitForTimeout(700);
  await page.getByText(/Settings/).first().click(); await page.waitForTimeout(800);
  await page.getByText("Notifications", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(600);
  rec("N1 Notifications has the 'Weekly summary' row, Off by default", /Weekly summary\s*Off/.test(await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "))), {});
  await page.getByText("Weekly summary", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(2600);
  const calls = await page.evaluate(() => window.__ARTH_WEEKLY_TEST__.calls);
  const sch = calls.filter(c => c.op === "schedule").pop();
  rec("N2 turning it on schedules one notification", Boolean(sch), calls.map(c => c.op));
  rec("N3 it says the headline and the numbers (down by 50%, ₹1,000, month ₹3,000)", sch && /down by 50%/.test(sch.title) && /₹1,000 this week/.test(sch.body) && /This month ₹3,000/.test(sch.body), sch && { title: sch.title, body: sch.body });
  const ist = (d) => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", hour: "2-digit", hourCycle: "h23", day: "2-digit" }).formatToParts(d).map(x => [x.type, x.value])); return { wd: p.weekday, h: Number(p.hour), day: Number(p.day) }; };
  const at = sch && new Date(sch.at);
  rec("N4 it is set for a Sunday at 7 pm local, in the future", at && ist(at).wd === "Sun" && ist(at).h === 19 && at > new Date(), at && at.toString());
  rec("N5 it is inexact (no exact-alarm permission) and has Review/Later buttons wired", sch && sch.isExactNotification === false && sch.actionTypeId === "weekly-summary" && sch.extra?.route === "insights", sch && { exact: sch.isExactNotification, type: sch.actionTypeId });
  rec("N6 the choice is remembered on this phone", (await page.evaluate(() => localStorage.getItem("arth_weekly_notif"))) === "1", {});
  const before = (await page.evaluate(() => window.__ARTH_WEEKLY_TEST__.calls)).filter(c => c.op === "schedule").length;
  await page.evaluate(() => window.__ARTH_WEEKLY_TEST__.onAction("later")); await page.waitForTimeout(800);
  const afterCalls = (await page.evaluate(() => window.__ARTH_WEEKLY_TEST__.calls)).filter(c => c.op === "schedule");
  const snooze = afterCalls[afterCalls.length - 1], tm = new Date(snooze.at), tomorrow = new Date(Date.now() + 86400000);
  rec("N7 Later schedules the same summary for tomorrow at 7 pm", afterCalls.length === before + 1 && ist(tm).day === ist(tomorrow).day && ist(tm).h === 19, snooze.at);
  await page.evaluate(() => window.__ARTH_WEEKLY_TEST__.onAction("review")); await page.waitForTimeout(800);
  const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  rec("N8 Review opens Insights", /Insights/i.test(body) && !/Weekly summary/.test(body), body.slice(0, 160));
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(600);
  await page.locator("button", { hasText: "☰" }).first().click(); await page.waitForTimeout(700);
  await page.getByText(/Settings/).first().click(); await page.waitForTimeout(800);
  await page.getByText("Notifications", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(600);
  await page.getByText("Weekly summary", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(800);
  const last = (await page.evaluate(() => window.__ARTH_WEEKLY_TEST__.calls)).pop();
  rec("N9 turning it off cancels the scheduled notification", last && last.op === "cancel" && (await page.evaluate(() => localStorage.getItem("arth_weekly_notif"))) === "0", last);
} catch (e) { rec("RUN", false, String(e).slice(0, 700)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);
