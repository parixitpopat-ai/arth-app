// Repeats already in the books (a hand-made entry + an imported copy on the same card): merge keeps mine, undo restores both. Chromium, SYNTHETIC data.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4212, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "cc1", name: "Test Card", type: "cc", limit: 100000, statementDate: 16, dueDate: 3 }, { id: "idfc", name: "Test IDFC", type: "bank", openingBalance: 50000, openingBalanceDate: "2026-01-01" }, { id: "icici", name: "Test ICICI", type: "bank", openingBalance: 5000, openingBalanceDate: "2026-01-01" }]);
  set("arth_txns", [
    { id: "m1", type: "expense", merchant: "McDonald's", desc: "McDonald's", amount: 365.71, date: "2026-10-16", accId: "cc1", catIds: ["food"] },
    { id: "i1", type: "expense", merchant: "Mcdonald S", desc: "UPI-171831146733-MCDONALD S IN", amount: 365.71, date: "2026-10-16", accId: "cc1", catIds: [], importKey: "K1", importBatchId: "B1", importSource: "bank-statement", transactionRef: "171831146733" },
    { id: "x1", type: "expense", merchant: "Other", desc: "Other", amount: 10, date: "2026-10-10", accId: "cc1", catIds: [] },
    // IDFC: a settlement I recorded + the import's income copy; a transfer IDFC -> ICICI I recorded + the import's debit leg (IDFC) and credit leg (ICICI)
    { id: "s1", type: "settlement_in", amount: 2500, date: "2026-10-05", accId: "idfc", fromPersonId: "p1" },
    { id: "ii", type: "income", desc: "IMPS FROM RAJ", amount: 2500, date: "2026-10-06", accId: "idfc", catIds: [], importKey: "KI", importBatchId: "B1", importSource: "bank-statement" },
    { id: "t1", type: "transfer", amount: 8000, date: "2026-10-08", fromAccId: "idfc", toAccId: "icici" },
    { id: "lo", type: "expense", desc: "IFT TO ICICI", amount: 8000, date: "2026-10-08", accId: "idfc", catIds: [], importKey: "KT1", importBatchId: "B1", importSource: "bank-statement" },
    { id: "li", type: "income", desc: "IFT FROM IDFC", amount: 8000, date: "2026-10-08", accId: "icici", catIds: [], importKey: "KT2", importBatchId: "B2", importSource: "bank-statement" }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
try {
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(700);
  await T("card-import-statement").dispatchEvent("click"); await page.waitForTimeout(600);
  rec("R1 the card's import screen lists the one repeat: my McDonald's and the import's copy", (await T("stmt-repeat").count()) === 1 && /McDonald's/.test(await T("stmt-repeat").innerText()) && /Mcdonald S/.test(await T("stmt-repeat").innerText()), {});
  await T("stmt-repeats-merge").click(); await page.waitForTimeout(500);
  let tx = await ls("arth_txns"), m = tx.find(t => t.id === "m1");
  rec("R2 merged: the import's copy is gone, my entry keeps its name and category and now carries the link and the UPI reference", !tx.find(t => t.id === "i1") && m.merchant === "McDonald's" && m.catIds[0] === "food" && m.importKey === "K1" && m.transactionRef === "171831146733", tx.map(t => t.id));
  await T("stmt-repeats-undo").click(); await page.waitForTimeout(500);
  tx = await ls("arth_txns");
  rec("R3 Undo puts both entries back exactly", !!tx.find(t => t.id === "i1") && !tx.find(t => t.id === "m1").importKey, tx.map(t => t.id));
  // IDFC: settlements and transfers
  await page.reload(); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(700);
  await page.getByText("Test IDFC").first().dispatchEvent("click"); await page.waitForTimeout(600);
  await T("acc-import-statement").dispatchEvent("click"); await page.waitForTimeout(600);
  rec("S1 IDFC lists 2 repeats: the settlement I recorded (vs the import's income copy) and my transfer (vs the import's debit leg)", (await T("stmt-repeat").count()) === 2, await T("stmt-repeat").allInnerTexts());
  await T("stmt-repeats-merge").click(); await page.waitForTimeout(500);
  tx = await ls("arth_txns");
  rec("S2 merged: the copies 'ii' and 'lo' are gone; my settlement and transfer are kept (types unchanged) and carry the links", !tx.find(t => t.id === "ii") && !tx.find(t => t.id === "lo") && tx.find(t => t.id === "s1").type === "settlement_in" && tx.find(t => t.id === "t1").type === "transfer" && tx.find(t => t.id === "t1").importKeys.join() === "KT1", tx.map(t => t.id));
  // ICICI: the other leg of the same transfer
  await page.reload(); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(700);
  await page.getByText("Test ICICI").first().dispatchEvent("click"); await page.waitForTimeout(600);
  await T("acc-import-statement").dispatchEvent("click"); await page.waitForTimeout(600);
  rec("S3 ICICI lists the other leg of the same transfer; merging it gives the transfer two links and removes the credit copy", (await T("stmt-repeat").count()) === 1, {});
  await T("stmt-repeats-merge").click(); await page.waitForTimeout(500);
  tx = await ls("arth_txns");
  rec("S4 one transfer, two import keys, no copies left on either account", !tx.find(t => t.id === "li") && tx.find(t => t.id === "t1").importKeys.join() === "KT1,KT2" && tx.filter(t => t.type === "transfer").length === 1, tx.map(t => t.id));
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 500)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
