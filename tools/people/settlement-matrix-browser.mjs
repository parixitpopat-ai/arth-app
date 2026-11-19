// Settlement must work the same at BILL level, PERSON level and TRANSACTION level. This runs each level through the real app (synthetic data) and checks the same invariants every time:
//   what the person owes drops by exactly what was applied; ONE settlement entry with links that add up; every linked item's live share is reduced (nothing left "not reflected");
//   the other views agree afterwards. A CHROMIUM check only, not a phone.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { findRepaymentProblems } from "../../src/domain/person/repaymentCheck.js";
import { getFinancialPositionBreakdown } from "../../src/domain/person/financialPosition.js";
const PORT = 4321, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function scenario(name, fn) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
  await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }, { id: "cc1", name: "Test Card", type: "cc", last4: "8004", creditLimit: 100000, statementDay: 16, dueDay: 3 }]);
    set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "r", name: "Ravi" }]);
    const owes = (amount, settledAmt = 0) => ({ amount, mode: "owes", settled: settledAmt >= amount, settledAmt, remainingAmt: Math.max(0, amount - settledAmt) });
    set("arth_bills", [
      { id: "b1", name: "Electricity", merchant: "Electricity", billDate: "2026-07-27", dueDate: "2026-09-09", status: "unpaid", amount: 9000, createdDate: "2026-07-27", splitPeople: { r: owes(1000) } },
      { id: "b2", name: "Water", merchant: "Water", billDate: "2026-07-27", dueDate: "2026-08-02", status: "paid", amount: 3000, createdDate: "2026-07-27", paidByTxnId: "tw", paidDate: "2026-08-02", splitPeople: { r: owes(1000) } }]);
    set("arth_txns", [
      { id: "tw", type: "expense", date: "2026-08-02", desc: "Water", amount: 3000, accId: "bank1", paidBillId: "b2", isBillPayment: true, people: { r: owes(1000) } },
      { id: "e1", type: "expense", date: "2026-07-04", desc: "Plumber", amount: 800, accId: "cc1", catId: "housing", catIds: ["housing"], people: { r: owes(800) } }]);
    localStorage.setItem("arth_master_user_setup_complete", "true"); });
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
  const T = id => page.getByTestId(id);
  const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  const state = async () => page.evaluate(() => ({ txns: JSON.parse(localStorage.getItem("arth_txns") || "[]"), bills: JSON.parse(localStorage.getItem("arth_bills") || "[]") }));
  const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
  const boot = async () => { await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(300); };
  const owed = st => Math.round(getFinancialPositionBreakdown("r", st.txns, st.bills, "me").filter(i => i.mode === "owesMe").reduce((s, i) => s + i.amount * 100, 0)) / 100;
  const shares = st => { let s = 0; for (const t of st.txns) if (t.type === "expense" && t.people && t.people.r) s += Number(t.people.r.settledAmt || 0); for (const b of st.bills) if (b.splitPeople && b.splitPeople.r && !(b.paidByTxnId)) s += Number(b.splitPeople.r.settledAmt || 0); return Math.round(s * 100) / 100; };
  const ctxo = { page, T, text, state, boot, owed, shares, unlock };
  const before = await (async () => { await boot(); return state(); })();
  try { await fn(ctxo, before); } catch (e) { rec(`${name} RUN`, false, String(e).slice(0, 400)); }
  rec(`${name} Z no page errors`, errors.length === 0, errors.slice(0, 2)); await ctx.close();
}
// the invariants, the same for every level
async function invariants(name, c, before, { applied, extra = 0, settlements = 1 }) {
  const after = await c.state();
  const news = after.txns.filter(t => t.type === "settlement_in" && !before.txns.some(b => b.id === t.id));
  const linkSum = news.reduce((s, t) => s + (t.settlementLinks || []).reduce((u, l) => u + Number(l.amount || 0), 0), 0);
  rec(`${name} I1 what Ravi owes dropped by exactly what was applied (₹${applied})`, Math.round((c.owed(before) - c.owed(after)) * 100) / 100 === applied, { before: c.owed(before), after: c.owed(after) });
  rec(`${name} I2 ${settlements} settlement entr${settlements === 1 ? "y" : "ies"} created, links add up to the applied amount, extra kept as ₹${extra} advance`, news.length === settlements && Math.round(linkSum * 100) / 100 === applied && Math.round(news.reduce((s, t) => s + Number(t.extraAmount || 0), 0) * 100) / 100 === extra, news.map(t => ({ amount: t.amount, applied: t.appliedAmount, extra: t.extraAmount, links: t.settlementLinks })));
  const p = findRepaymentProblems({ personId: "r", txns: after.txns, bills: after.bills });
  rec(`${name} I3 nothing is left 'not reflected' (every linked item's live share was reduced)`, p.unreduced.length === 0 && p.unlinked.length === 0, p);
  return after;
}
const payFull = async (c) => { await c.page.getByRole("button", { name: /Ravi paid/ }).first().dispatchEvent("click"); await c.page.waitForTimeout(900); };
const openBill = async (c, id) => { await c.page.getByText(/^payments$/i).last().dispatchEvent("click"); await c.page.waitForTimeout(900); await c.T(`bill-row-${id}`).dispatchEvent("click"); await c.page.waitForTimeout(800); };
const openPersonSettle = async (c) => { await c.page.getByText(/^people$/i).last().dispatchEvent("click"); await c.page.waitForTimeout(900); await c.page.getByText("Ravi", { exact: true }).first().dispatchEvent("click"); await c.page.waitForTimeout(900);
  await c.page.getByText(/EXISTING CAPABILITIES/).first().dispatchEvent("click"); await c.page.waitForTimeout(500); await c.page.getByRole("button", { name: /^Settle$/ }).first().dispatchEvent("click"); await c.page.waitForTimeout(800); };
try {
  await scenario("BILL-unpaid", async (c, before) => { await openBill(c, "b1"); await c.page.getByRole("button", { name: /Settle/ }).first().dispatchEvent("click"); await c.page.waitForTimeout(700); await payFull(c); await invariants("BILL-unpaid", c, before, { applied: 1000 }); });
  await scenario("BILL-paid", async (c, before) => { await openBill(c, "b2"); await c.page.getByRole("button", { name: /Settle/ }).first().dispatchEvent("click"); await c.page.waitForTimeout(700); await payFull(c); await invariants("BILL-paid", c, before, { applied: 1000 }); });
  await scenario("TXN", async (c, before) => {
    await c.page.getByText(/^money$/i).last().dispatchEvent("click"); await c.page.waitForTimeout(900); await c.unlock(); await c.page.waitForTimeout(600);
    await c.T("card-filter-txns").dispatchEvent("click"); await c.page.waitForTimeout(800);
    await c.page.getByText("Plumber").first().click(); await c.page.waitForTimeout(600);       // the transaction's own detail sheet
    rec("TXN D the transaction detail sheet offers Settle", (await c.T("txn-detail-settle").count()) === 1, {});
    await c.T("txn-detail-settle").dispatchEvent("click"); await c.page.waitForTimeout(700); await payFull(c);
    await invariants("TXN", c, before, { applied: 800 });
  });
  await scenario("TXN-overpay", async (c, before) => {
    await c.page.getByText(/^money$/i).last().dispatchEvent("click"); await c.page.waitForTimeout(900); await c.unlock(); await c.page.waitForTimeout(600);
    await c.T("card-filter-txns").dispatchEvent("click"); await c.page.waitForTimeout(800);
    await c.page.getByText("Plumber").first().click(); await c.page.waitForTimeout(600); await c.T("txn-detail-settle").dispatchEvent("click"); await c.page.waitForTimeout(700);
    await c.page.locator("input[type='number']").first().fill("1000");
    await c.page.waitForTimeout(300); await payFull(c);
    await invariants("TXN-overpay", c, before, { applied: 800, extra: 200 });
  });
  await scenario("TXN-then-other-views", async (c, before) => {
    await c.page.getByText(/^money$/i).last().dispatchEvent("click"); await c.page.waitForTimeout(900); await c.unlock(); await c.page.waitForTimeout(600);
    await c.T("card-filter-txns").dispatchEvent("click"); await c.page.waitForTimeout(800);
    await c.page.getByText("Plumber").first().click(); await c.page.waitForTimeout(600); await c.T("txn-detail-settle").dispatchEvent("click"); await c.page.waitForTimeout(700); await payFull(c);
    await c.boot(); await c.page.getByText(/^people$/i).last().dispatchEvent("click"); await c.page.waitForTimeout(900);
    const t = await c.text();
    rec("TXN-then-other-views the People list now shows Ravi owing ₹2,000 (1,000 + 1,000), not ₹2,800", /Ravi[^₹]*₹2,000 owes you/.test(t) || /TOTAL TO RECOVER ₹2,000/.test(t), t.slice(0, 260));
  });
  await scenario("PERSON-full", async (c, before) => { await openPersonSettle(c); await payFull(c); const after = await invariants("PERSON-full", c, before, { applied: 2800 }); rec("PERSON-full X every item is settled and Ravi owes nothing", c.owed(after) === 0, c.owed(after)); });
  await scenario("PERSON-partial", async (c, before) => {
    await openPersonSettle(c);
    await c.page.locator("input[type='number']").first().fill("1500");
    await c.page.waitForTimeout(300); await payFull(c);
    const after = await invariants("PERSON-partial", c, before, { applied: 1500 });
    const per = after.txns.filter(t => t.type === "expense" && t.people && t.people.r).map(t => [t.id, t.people.r.settledAmt, t.people.r.amount]);
    rec("PERSON-partial X no item is settled beyond its share, and the total settled grew by exactly ₹1,500", per.every(([, s, a]) => s <= a) && Math.round((c.shares(after) - c.shares(before)) * 100) / 100 === 1500, { per, grew: c.shares(after) - c.shares(before) });
  });
} catch (e) { rec("RUN", false, String(e).slice(0, 400)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
console.log(results.every(r => r.pass) ? "ALL PASS" : "SOME FAILED"); process.exit(results.every(r => r.pass) ? 0 : 1);
