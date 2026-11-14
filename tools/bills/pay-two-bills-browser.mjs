// One earlier payment (₹13,056 on a card) used for TWO open bills of one connection through Record payment; nothing counted twice, nothing rounded.
// Real app in Chromium, local Vite server, SYNTHETIC data shaped like the reported case. A CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4220, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }, { id: "cc1", name: "Test Card", type: "cc", last4: "8004", creditLimit: 200000 }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }]);
  set("arth_billers", [{ id: "bl1", name: "Goa Electricity", type: "Electricity" }]);
  set("arth_biller_accounts", [{ id: "ba1", name: "Common Meter", type: "Electricity", provider: "Goa Electricity", billerId: "bl1", attributeType: "house" }]);
  const bill = (id, name, amount, dueDate) => ({ id, name, type: "Electricity", amount, dueDate, billDate: dueDate, status: "unpaid", billerAccountId: "ba1", catId: "utilities", catIds: ["utilities"], splitPeople: {}, createdDate: "2026-10-01", createdAt: 1 });
  set("arth_bills", [bill("b-aug", "Common Meter · August", 6017, "2026-10-12"), bill("b-sep", "Common Meter Electricity Bill · September", 7039.46, "2026-11-13")]);
  set("arth_txns", [{ id: "t1", type: "expense", desc: "UPI payment", merchant: "UPI payment", amount: 13056, date: "2026-11-13", accId: "cc1", billerLinkId: "ba1", catId: "utilities", catIds: ["utilities"], people: {} }]);
  set("arth_contributions", []);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(700); } } };
try {
  await page.goto(APP); await page.waitForTimeout(1300); await unlock(); await page.waitForTimeout(500);
  await page.getByText(/^payments$/i).last().dispatchEvent("click"); await page.waitForTimeout(900);
  await T("bill-row-b-sep").dispatchEvent("click"); await page.waitForTimeout(700);
  await T("bill-record-payment").dispatchEvent("click"); await page.waitForTimeout(700);
  rec("P1 Record payment on the September bill offers 'Already paid? Use an earlier payment' (it was only offered for recharges before)", (await T("record-payment-link-toggle").count()) === 1, {});
  await T("record-payment-link-toggle").dispatchEvent("click"); await page.waitForTimeout(400);
  const item = await T("record-payment-existing-item").innerText();
  rec("P2 your ₹13,056 card expense is listed, and the oldest-first cover shows August ₹6,017 and September ₹7,039 with ₹0.46 still due (not rounded)", /13,056/.test(item) && /6,017/.test(item) && /7,039/.test(item) && /0\.46 still due/.test(item), item.replace(/\n/g, " | ").slice(0, 260));
  rec("P3 the 'this bill only' choice shows ₹7,039.46 and that ₹6,016.54 stays available for other bills", /7,039\.46/.test(item) && /6,016\.54 stays available/.test(item), {});
  const nBefore = (await ls("arth_txns")).length, balBefore = JSON.stringify((await ls("arth_accounts")).map(a => [a.id, a.outstanding || 0]));
  await T("existing-cover").dispatchEvent("click"); await page.waitForTimeout(900);
  const bills = await ls("arth_bills"), aug = bills.find(b => b.id === "b-aug"), sep = bills.find(b => b.id === "b-sep"), con = await ls("arth_contributions"), txn = (await ls("arth_txns")).find(t => t.id === "t1");
  rec("P4 no second payment was created and no account changed (nothing counted twice)", (await ls("arth_txns")).length === nBefore && JSON.stringify((await ls("arth_accounts")).map(a => [a.id, a.outstanding || 0])) === balBefore, { txns: (await ls("arth_txns")).length });
  rec("P5 August is paid; September is still open (₹0.46 left); two contributions from the one payment", aug.status === "paid" && sep.status === "unpaid" && con.length === 2 && con.every(c => String(c.txnId) === "t1") && con.some(c => c.obligationId === "b-sep" && c.amount === 7039) , { aug: aug.status, sep: sep.status, con: con.map(c => [c.obligationId, c.amount]) });
  rec("P6 the expense now counts as a bill payment and has no money left to give", txn.isBillPayment === true && txn.paidBillId === "b-aug", { paidBillId: txn.paidBillId });
  await T("bill-row-b-sep").dispatchEvent("click").catch(() => {}); await page.waitForTimeout(500);
  const body = await text();
  rec("P7 the Bills screen shows September as partly paid: ₹7,039 of ₹7,039.46, still open and overdue", /7,039 of ₹7,039\.46/.test(body) && /1 day overdue/.test(body), body.slice(body.indexOf("Sep") - 20, body.indexOf("Sep") + 160));
  // deleting the payment reopens BOTH bills and removes both contributions
  await page.goto(APP); await page.waitForTimeout(1000); await unlock(); await page.waitForTimeout(500);
  await page.getByText(/^transactions$/i).last().dispatchEvent("click").catch(() => {});
  await page.getByText("See all", { exact: false }).first().dispatchEvent("click").catch(() => {}); await page.waitForTimeout(800);
  await page.getByText("₹13,056", { exact: true }).first().click().catch(() => {}); await page.waitForTimeout(600);
  const del = page.getByText("🗑 Delete"); 
  if (await del.count()) { await del.click(); await page.waitForTimeout(400); await page.getByRole("button", { name: "Confirm" }).click(); await page.waitForTimeout(800); }
  const after = await ls("arth_bills"), conAfter = await ls("arth_contributions"), txAfter = await ls("arth_txns");
  rec("D1 deleting the ₹13,056 payment reopens BOTH bills (neither is left falsely paid) and removes both contributions", txAfter.length === 0 && after.every(b => b.status === "unpaid" && !b.paidByTxnId) && conAfter.length === 0, { txns: txAfter.length, bills: after.map(b => [b.id, b.status, b.paidByTxnId || null]), con: conAfter.length });
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 700)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const failed = results.filter(r => !r.pass).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0);
