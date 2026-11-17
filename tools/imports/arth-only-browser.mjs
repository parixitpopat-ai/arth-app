// Card statement preview: entries Arth has that the file does not ("Entries that do not match"), with pair hints and a View button.
// SYNTHETIC statement file and data, real app in Chromium. A CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 4232, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const dir = mkdtempSync(join(tmpdir(), "stmt-")); const csv = join(dir, "card.csv"), csv2 = join(dir, "card2.csv");
writeFileSync(csv, ["Date,SerNo.,Transaction Details,Amount (in₹)", "20/10/2026,1,COFFEE SHOP,1000.00", "25/10/2026,2,GROCER,500.00", "02/11/2026,3,BIG STORE,4999.00", "01/11/2026,4,REFUND SHOP,500.00 CR"].join("\n"));
writeFileSync(csv2, ["Date,SerNo.,Transaction Details,Amount (in₹)", "20/10/2026,1,COFFEE SHOP,1000.00", "25/10/2026,2,GROCER,500.00", "28/10/2026,3,PHARMACY,777.50", "29/10/2026,4,BIG STORE,4999.00"].join("\n"));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }, { id: "cc1", name: "Test ICICI Card", type: "cc", last4: "8004", creditLimit: 100000 }]);
  const e = (id, date, amount, m) => ({ id, type: "expense", merchant: m, desc: m, amount, date, accId: "cc1", catId: "food", catIds: ["food"] });
  set("arth_txns", [e("t1", "2026-10-20", 1000, "Coffee Shop"), e("t2", "2026-10-25", 500, "Grocer"), e("t3", "2026-10-28", 777.5, "Pharmacy"), e("t4", "2026-10-29", 4999, "Big Store Arth")]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
const open = async () => { await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(700);
  await T("card-import-statement").dispatchEvent("click"); await page.waitForTimeout(500); };
try {
  await open();
  await T("stmt-file").setInputFiles(csv); await page.waitForTimeout(1800);
  rec("M1 the preview has an 'Entries that do not match' card", (await T("stmt-arth-only").count()) === 1, {});
  const rows = await T("stmt-arth-only-row").allInnerTexts();
  const norm = rows.map(r => r.replace(/\s+/g, " "));
  rec("M2 exactly the two Arth entries the file does not have are flagged (Pharmacy ₹777.50, Big Store Arth ₹4,999); the two matched ones are not", rows.length === 2 && /Pharmacy/.test(norm[0]) && /777\.50/.test(norm[0]) && /Big Store Arth/.test(norm[1]) && !norm.join().match(/Coffee|Grocer/), norm);
  const pair = await T("stmt-arth-only-pair").allInnerTexts();
  rec("M3 the Arth entry of ₹4,999 is paired with the statement's new 02-11-2026 row of ₹4,999 (same amount, 4 days apart)", pair.length === 1 && /02-11-2026/.test(pair[0]) && /4,999/.test(pair[0]) && /same amount, 4 days apart/.test(pair[0]), pair);
  const body = await text();
  rec("M4 it says the two rows the statement has and Arth lacks are listed below as New", /2 rows on the statement are not in Arth/.test(body), {});
  const cr = await T("stmt-credit-row").allInnerTexts();
  rec("M4a a payment/refund on the statement that Arth lacks is listed with its total (the usual reason for a gap while every purchase matches)", (await T("stmt-credits-gap").count()) === 1 && cr.length === 1 && /REFUND SHOP/.test(cr[0]) && /500\.00/.test(cr[0]), cr);
  await T("stmt-arth-only-open").first().click(); await page.waitForTimeout(700);
  rec("M5 View opens that entry (Pharmacy) so it can be fixed or deleted", /Pharmacy/.test(await text()) && (await page.getByText("Delete", { exact: false }).count()) > 0, {});
  // a file that has everything: nothing flagged
  await page.reload(); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await open(); await T("stmt-file").setInputFiles(csv2); await page.waitForTimeout(1800);
  rec("M6 when the file has every Arth entry, the card says everything is on the statement and lists nothing", (await T("stmt-arth-only-none").count()) === 1 && (await T("stmt-arth-only-row").count()) === 0, (await T("stmt-arth-only").innerText().catch(() => "")).replace(/\s+/g, " "));
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);
