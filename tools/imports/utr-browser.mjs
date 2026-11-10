// Import: a row with the same UPI reference (UTR) as an entry already in Arth is flagged as the same payment even when the dates differ. Chromium, local Vite dev server, SYNTHETIC data.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 4210, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const dir = mkdtempSync(join(tmpdir(), "utr-")), f = join(dir, "s.csv");
writeFileSync(f, ["Transaction Date,Particulars,Debit,Credit,Balance",
  "20-04-2026,UPI/DR/412345678901/SWIGGY/HDFC/swiggy@ic/Order,77.00,,9923.00",
  "21-04-2026,UPI/DR/999999999999/OTHER SHOP/HDFC/o@ic/x,77.00,,9846.00",
  "22-04-2026,UPI/CR/104354172499/NPCI BHI/HDFC/bhimcas/BHIMCASHBACK,,12.00,9858.00"].join("\n"));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 10000, openingBalanceDate: "2026-01-01", last4: "9001" }]);
  set("arth_txns", [{ id: "m1", type: "expense", merchant: "Swiggy", desc: "Swiggy", amount: 77, date: "2026-04-01", accId: "bank1", catIds: ["food"], transactionRef: "412345678901" }]);   // 19 days before the statement row
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
try {
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(700);
  await page.getByText("Test Savings").first().dispatchEvent("click"); await page.waitForTimeout(600);
  await T("acc-import-statement").dispatchEvent("click"); await page.waitForTimeout(500);
  await T("stmt-file").setInputFiles(f); await page.waitForTimeout(1500);
  const st = await page.locator('[data-testid="stmt-row"]').evaluateAll(els => els.map(e => e.dataset.status));
  rec("U1 the Swiggy row (same UPI reference, 19 days apart) is a match; the other two are new", st.join() === "probable-match,new,new", st);
  rec("U2 it says 'same UPI reference as an entry already in Arth'", /same UPI reference as an entry already in Arth/.test(await text()), {});
  await T("stmt-import").click(); await page.waitForTimeout(700);
  const tx = await ls("arth_txns"), other = tx.find(t => t.importKey && /OTHER/.test(t.bankNarration || "")), cash = tx.find(t => t.importKey && /BHIMCASHBACK/.test(t.bankNarration || ""));
  rec("U3 imported: the other shop's UTR is stored as its reference with vendor 'Other Shop'; the cashback credit is income 12.00, reference 104354172499, readable description", other && other.transactionRef === "999999999999" && other.paymentMethod === "UPI" && other.merchant === "Other Shop" && cash && cash.type === "income" && cash.amount === 12 && cash.transactionRef === "104354172499" && cash.desc === "NPCI BHI · BHIMCASHBACK", { other: other && [other.transactionRef, other.merchant], cash: cash && [cash.type, cash.transactionRef, cash.desc] });
  rec("U4 the existing Swiggy entry was not duplicated (3 entries: it + 2 imported)", tx.length === 3, tx.length);
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 500)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
