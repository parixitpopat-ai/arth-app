// Repeating payments on Insights, found from the person's own entries. SYNTHETIC data, real app in Chromium. CHROMIUM check only.
// Run: node tools/ui/subscriptions-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4561, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 1200 }, timezoneId: "Asia/Kolkata" });
const monthsAgo = (n, dom) => { const d = new Date(); d.setMonth(d.getMonth() - n, dom); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
await ctx.addInitScript(([d0, d1, d2, d3, g0, g1]) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }]);
  const e = (id, m, date, amt) => ({ id, type: "expense", merchant: m, desc: m, date, amount: amt, accId: "b1", catId: "entertainment", catIds: ["entertainment"], createdAt: Number(id.replace(/\D/g, "")) });
  set("arth_txns", [e("n1", "Netflix", d3, 649), e("n2", "Netflix", d2, 649), e("n3", "Netflix", d1, 649), e("n4", "Netflix", d0, 649), e("g1", "Gym", g1, 1000), e("g2", "Gym", g0, 1000), e("c1", "Cafe", d1, 120), e("c2", "Cafe", d0, 480)]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); }, [monthsAgo(0, 2), monthsAgo(1, 2), monthsAgo(2, 2), monthsAgo(3, 2), monthsAgo(0, 3), monthsAgo(1, 3)]);
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
try {
  await page.goto(APP); await page.waitForTimeout(1300); await unlock(); await page.waitForTimeout(500);
  await page.getByText(/Insights for you/).first().click(); await page.waitForTimeout(900);
  rec("S1 Insights shows a Repeating payments card", (await T("subscriptions-card").count()) === 1, {});
  const txt = (await T("subscriptions-card").innerText()).replace(/\s+/g, " ");
  rec("S2 Netflix is found (monthly, ₹649) and the varying cafe and the twice-only gym are not", /Netflix/.test(txt) && /Monthly/.test(txt) && !/Cafe/.test(txt) && !/Gym/.test(txt), txt.slice(0, 200));
  rec("S3 the total says ₹649 a month and ₹7,788 a year", /649 a month/.test(txt) && /7,788 a year/.test(txt), (txt.match(/₹[\d,]+ a month · ₹[\d,]+ a year/) || ["none"])[0]);
  await T("subscription-make-bill").click(); await page.waitForTimeout(900);
  const vals = await page.locator("input").evaluateAll(els => els.map(e => e.value));
  rec("S4 Make a bill opens Add Bill with Netflix and 649 filled in", vals.includes("Netflix") && vals.includes("649"), vals.filter(Boolean));
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/Insights for you/).first().click(); await page.waitForTimeout(900);
  await T("subscription-dismiss").click(); await page.waitForTimeout(500);
  rec("S5 'Not a subscription' removes it", (await T("subscriptions-card").count()) === 0, {});
  await page.reload(); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/Insights for you/).first().click(); await page.waitForTimeout(900);
  rec("S6 and it stays removed after a reload", (await T("subscriptions-card").count()) === 0, {});
} catch (e) { rec("RUN", false, String(e).slice(0, 400)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
