// Does "Settle" on a bill's own detail reduce what the person owes? Unpaid bill and a paid bill (its split lives on the payment entry). SYNTHETIC data, real app in Chromium.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4281, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "r", name: "Ravi" }]);
  const owes = (amount, settledAmt = 0) => ({ amount, mode: "owes", settled: settledAmt >= amount, settledAmt, remainingAmt: Math.max(0, amount - settledAmt) });
  set("arth_bills", [
    { id: "b1", name: "Electricity", merchant: "Electricity", billDate: "2026-07-27", dueDate: "2026-09-09", status: "unpaid", amount: 9000, createdDate: "2026-07-27", splitPeople: { r: owes(3000) } },
    { id: "b2", name: "Water", merchant: "Water", billDate: "2026-07-27", dueDate: "2026-08-02", status: "paid", amount: 3000, createdDate: "2026-07-27", paidByTxnId: "tw", paidDate: "2026-08-02", splitPeople: { r: owes(1000) } }]);
  set("arth_txns", [{ id: "tw", type: "expense", date: "2026-08-02", desc: "Water", amount: 3000, accId: "bank1", paidBillId: "b2", isBillPayment: true, people: { r: owes(1000) } }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
const owesOnPeople = async () => { await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(300); await page.getByText(/^people$/i).last().dispatchEvent("click"); await page.waitForTimeout(900);
  const t = await text(); const m = /Ravi ☆ \+₹([\d,]+) owes you/.exec(t); return m ? Number(m[1].replace(/,/g, "")) : (/TOTAL TO RECOVER ₹([\d,]+)/.exec(t) || [])[1] ? Number(/TOTAL TO RECOVER ₹([\d,]+)/.exec(t)[1].replace(/,/g, "")) : 0; };
const openBill = async id => { await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(300); await page.getByText(/^payments$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await T(`bill-row-${id}`).dispatchEvent("click"); await page.waitForTimeout(800); };
try {
  const before = await owesOnPeople();
  rec("B0 before: Ravi owes ₹4,000 (3,000 unpaid bill + 1,000 share of the paid bill)", before === 4000, before);
  // unpaid bill
  await openBill("b1");
  await page.getByRole("button", { name: /Settle/ }).first().dispatchEvent("click"); await page.waitForTimeout(700);
  await page.getByRole("button", { name: /Ravi paid/ }).first().dispatchEvent("click"); await page.waitForTimeout(900);
  const b1 = (await ls("arth_bills")).find(b => b.id === "b1"), s1 = (await ls("arth_txns")).filter(t => t.type === "settlement_in");
  rec("U1 unpaid bill: the bill's own split for Ravi is settled and a repayment entry links to that bill", b1.splitPeople.r.settled === true && b1.splitPeople.r.settledAmt === 3000 && s1.length === 1 && s1[0].settlementLinks.some(l => l.kind === "bill" && l.id === "b1" && l.personId === "r" && l.amount === 3000), { split: b1.splitPeople.r, links: s1[0] && s1[0].settlementLinks });
  const afterU = await owesOnPeople();
  rec("U2 unpaid bill: what Ravi owes you goes down by ₹3,000 (to ₹1,000)", afterU === 1000, afterU);
  // paid bill: the share lives on the payment entry
  await openBill("b2");
  await page.getByRole("button", { name: /Settle/ }).first().dispatchEvent("click"); await page.waitForTimeout(700);
  await page.getByRole("button", { name: /Ravi paid/ }).first().dispatchEvent("click"); await page.waitForTimeout(900);
  const tw = (await ls("arth_txns")).find(t => t.id === "tw"), s2 = (await ls("arth_txns")).filter(t => t.type === "settlement_in");
  rec("P1 paid bill: the share on the PAYMENT entry is settled and a repayment entry links to it", tw.people.r.settled === true && tw.people.r.settledAmt === 1000 && s2.length === 2 && s2.some(t => t.settlementLinks.some(l => l.kind === "txn" && l.id === "tw" && l.personId === "r" && l.amount === 1000)), { people: tw.people.r, links: s2.map(t => t.settlementLinks) });
  const afterP = await owesOnPeople();
  rec("P2 paid bill: what Ravi owes you goes down by ₹1,000 (to nothing)", afterP === 0, afterP);
} catch (e) { rec("RUN", false, String(e).slice(0, 500)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
console.log(results.every(r => r.pass) ? "ALL PASS" : "SOME FAILED"); process.exit(results.every(r => r.pass) ? 0 : 1);
