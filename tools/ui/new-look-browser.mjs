// New look (colours + font) in the real app, LIGHT theme, SYNTHETIC data. A CHROMIUM check only. Writes screenshots to the folder given as argv[2].
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const OUT = process.argv[2] || ".", PORT = 4331, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_dark", false);
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 312400, openingBalanceDate: "2026-01-01", last4: "9001" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "r", name: "Raj Test" }, { id: "s", name: "Sunny Test" }]);
  const d = new Date(); const ds = n => { const x = new Date(d); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
  set("arth_txns", [
    { id: "t1", type: "expense", date: ds(0), desc: "Saj Burgers", merchant: "Saj Burgers", amount: 1800, accId: "bank1", catId: "food", catIds: ["food"], people: { s: { amount: 900, mode: "owes", settled: false, remainingAmt: 900 } } },
    { id: "t2", type: "expense", date: ds(2), desc: "K Auto", merchant: "K Auto", amount: 1687, accId: "bank1", catId: "transport", catIds: ["transport"], people: { r: { amount: 1687, mode: "owes", settled: false, remainingAmt: 1687 } } },
    { id: "t3", type: "income", date: ds(5), desc: "Salary", amount: 120000, accId: "bank1" }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/home.png` });
const fontOk = await page.evaluate(() => getComputedStyle(document.body).fontFamily + " | " + [...document.querySelectorAll("div,span,button")].slice(0, 400).map(e => getComputedStyle(e).fontFamily).filter(f => /Inter/.test(f)).length);
console.log("FONT", fontOk);
const bg = await page.evaluate(() => getComputedStyle(document.querySelector("#root > div") || document.body).backgroundColor); console.log("BG", bg);
await page.getByText(/^people$/i).first().dispatchEvent("click", { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/people.png` });
await page.getByText(/^txns$|^transactions$|^money$/i).first().dispatchEvent("click", { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/txns.png` });
console.log("ERRORS", errors.length, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
