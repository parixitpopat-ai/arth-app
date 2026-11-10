// A card/bank row that repeats an entry recorded on ANOTHER account is offered as a match (not silently added), and names an earlier version left as "Dr" / "Upi-<ref>-…" can be tidied. Chromium, SYNTHETIC data.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 4211, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const dir = mkdtempSync(join(tmpdir(), "dup-")), f = join(dir, "card.csv");
writeFileSync(f, ["Date,SerNo.,Transaction Details,Amount (in ₹)", "16/10/2026,1,UPI-171831146733-MCDONALD S IN,365.71", "16/10/2026,2,UPI-203941997994-WOW MOMO FOODS IN,574.96"].join("\n"));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 10000, openingBalanceDate: "2026-01-01" }, { id: "cc1", name: "Test Card", type: "cc", limit: 100000, statementDate: 16, dueDate: 3 }]);
  set("arth_txns", [
    { id: "m1", type: "expense", merchant: "McDonald's", desc: "McDonald's", amount: 365.71, date: "2026-10-16", accId: "bank1", catIds: ["food"] },        // the same payment, entered against the bank
    { id: "d1", type: "expense", merchant: "Dr", desc: "UPI/DR/412345678901/SWIGGY/HDFC/s@ic/x", amount: 130, date: "2026-10-19", accId: "bank1", catIds: [], importKey: "k1", importBatchId: "B0", importSource: "bank-statement" },
    { id: "d2", type: "expense", merchant: "Upi-211737389994-Vipulach Al Enterprise In", desc: "UPI-211737389994-VIPULACH AL ENTERPRISE IN", amount: 650, date: "2026-10-16", accId: "cc1", catIds: [], importKey: "k2", importBatchId: "B0", importSource: "bank-statement" }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
try {
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(700);
  await T("card-import-statement").dispatchEvent("click"); await page.waitForTimeout(600);
  rec("D1 the import screen offers to tidy 2 untidy names (\"Dr\" and \"Upi-…\")", (await T("stmt-tidy").count()) === 1 && /2 imported entries/.test(await T("stmt-tidy").innerText()), (await T("stmt-tidy").innerText()).slice(0, 120));
  await T("stmt-tidy-fix").click(); await page.waitForTimeout(500);
  let tx = await ls("arth_txns");
  rec("D2 fixing renames only the vendor: \"Dr\" → Swiggy, \"Upi-…\" → Vipulach Al Enterprise; amounts and dates untouched", tx.find(t => t.id === "d1").merchant === "Swiggy" && tx.find(t => t.id === "d2").merchant === "Vipulach Al Enterprise" && tx.find(t => t.id === "d1").amount === 130, tx.map(t => t.merchant));
  await T("stmt-tidy-undo").click(); await page.waitForTimeout(400);
  tx = await ls("arth_txns");
  rec("D3 Undo puts both names back", tx.find(t => t.id === "d1").merchant === "Dr" && /^Upi-/.test(tx.find(t => t.id === "d2").merchant), {});
  await T("stmt-file").setInputFiles(f); await page.waitForTimeout(1500);
  const st = await page.locator('[data-testid="stmt-row"]').evaluateAll(els => els.map(e => e.dataset.status));
  rec("D4 the McDonald's row (entered against the bank) is offered as a match, not added again; Wow Momo is new", st.join() === "probable-match,new", st);
  const body = await text();
  rec("D5 it says it is on another account, names it, and that merging only links", /same amount and date as an entry on another account/.test(body) && /McDonald's · 16-10-2026 · ₹365\.71 · Test Savings/.test(body) && (await T("stmt-other-account-note").count()) === 1, {});
  await T("stmt-import").click(); await page.waitForTimeout(700);
  tx = await ls("arth_txns");
  const imported = tx.filter(t => t.importKey && t.importBatchId && t.id !== "d1" && t.id !== "d2");
  rec("D6 only Wow Momo was added (vendor 'Wow Momo Foods', reference = its UPI reference); the McDonald's entry is unchanged", imported.length === 1 && imported[0].merchant === "Wow Momo Foods" && imported[0].transactionRef === "203941997994" && tx.find(t => t.id === "m1").accId === "bank1" && !tx.find(t => t.id === "m1").importKey, imported.map(t => [t.merchant, t.transactionRef]));
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 500)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
