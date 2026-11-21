// Add screen, new look: the person rows say what each choice does, and a summary line says what will be owed. SYNTHETIC data, real app in Chromium. CHROMIUM check only. Run: node tools/ui/add-cats-browser.mjs
// A CHROMIUM check. It says nothing about the Android app.   Run: node tools/loans/loan-checkbox-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4431, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
  localStorage.setItem("arth_accounts", JSON.stringify([
    { id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" },
    { id: "cc1", name: "Test Card", type: "cc", limit: 100000, outstanding: 0, statementDate: 15, dueDate: 5, last4: "4242" }]));
  localStorage.setItem("arth_people", JSON.stringify([{ id: "me", name: "Me", isMe: true }, { id: "p_raj", name: "Raj Test" }, { id: "p_sun", name: "Sunny Test" }, { id: "p_old", name: "Old Friend", archived: true }]));
  localStorage.setItem("arth_txns", JSON.stringify([...Array(3).fill(0).map((_, i) => ({ id: "f" + i, type: "expense", desc: "Lunch", date: "2026-11-1" + i, amount: 200, accId: "bank1", catId: "food", catIds: ["food"] })), ...Array(2).fill(0).map((_, i) => ({ id: "t" + i, type: "expense", desc: "Cab", date: "2026-11-0" + (i + 1), amount: 150, accId: "bank1", catId: "transport", catIds: ["transport"] })), { id: "h0", type: "expense", desc: "Rent", date: "2026-11-02", amount: 9000, accId: "bank1", catId: "housing", catIds: ["housing"] }])); localStorage.setItem("arth_loans", "[]"); localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const unlock = async () => { for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const openAdd = async () => { await page.goto(APP); await page.waitForTimeout(900); await unlock(); await page.getByRole("button", { name: "+", exact: true }).first().click(); await page.waitForTimeout(700); await page.getByText("More options →").click(); await page.waitForTimeout(700); };
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
try {
  await openAdd();
  await page.getByPlaceholder(/e\.g\. ₹5,500/).fill("100");
  rec("C1 the three most-used categories show as chips, most used first", (await T("quick-cats").count()) === 1 && (await T("quick-cat-food").count()) === 1 && (await T("quick-cat-transport").count()) === 1 && (await T("quick-cats").locator("button").count()) === 3, (await T("quick-cats").innerText()).replace(/\s+/g, " "));
  rec("C2 none is chosen to begin with", (await T("quick-cat-food").getAttribute("aria-pressed")) === "false", {});
  await T("quick-cat-transport").click(); await page.waitForTimeout(300);
  rec("C3 tapping one chooses it (lit)", (await T("quick-cat-transport").getAttribute("aria-pressed")) === "true" && (await T("quick-cat-food").getAttribute("aria-pressed")) === "false", {});
  await T("quick-cat-food").click(); await page.waitForTimeout(300);
  rec("C4 tapping another switches to it", (await T("quick-cat-food").getAttribute("aria-pressed")) === "true" && (await T("quick-cat-transport").getAttribute("aria-pressed")) === "false", {});
  await T("quick-cat-food").click(); await page.waitForTimeout(300);
  rec("C5 tapping the lit one clears it", (await T("quick-cat-food").getAttribute("aria-pressed")) === "false", {});
  await T("quick-cat-transport").click(); await page.waitForTimeout(300);
  await page.getByPlaceholder(/vendor|merchant|store/i).first().fill("Auto ride");
  await page.getByRole("button", { name: /^Add ✓$/ }).click(); await page.waitForTimeout(900);
  const saved = (await ls("arth_txns")).find(t => t.desc === "Auto ride" || t.merchant === "Auto ride");
  rec("C6 the saved expense carries that category", saved && saved.catId === "transport" && (saved.catIds || []).join() === "transport", saved && { catId: saved.catId, catIds: saved.catIds });
} catch (e) { rec("RUN", false, String(e).slice(0, 400)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
