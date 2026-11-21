// A person's statement (from a date to a date) from their page, and the Work expenses filter in Transactions. SYNTHETIC data (an invented family), real app in Chromium.
// A CHROMIUM check only, not a phone.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4271, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }, { id: "upi1", name: "Sample UPI", type: "upi", handle: "sample@upi", linkedAccount: "bank1" },
    { id: "cc1", name: "Test Card", type: "cc", last4: "8004", creditLimit: 100000, statementDay: 16, dueDay: 3 }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "r", name: "Ravi" }, { id: "s", name: "Sunny" }, { id: "g", name: "Guru" }]);
  const owes = (amount, settledAmt = 0, extra = {}) => ({ amount, mode: "owes", settled: settledAmt >= amount, settledAmt, remainingAmt: Math.max(0, amount - settledAmt), ...extra });
  set("arth_biller_accounts", [{ id: "ba-el", name: "Sample Electricity", type: "Electricity" }, { id: "ba-wa", name: "Sample Water", type: "Water" }, { id: "ba-mt", name: "Sample Society", type: "Society Maintenance" }]);
  set("arth_bills", [
    { id: "b1", name: "Electricity", billDate: "2026-07-27", dueDate: "2026-09-09", billPeriodFrom: "2026-06-10", billPeriodTo: "2026-07-25", billerAccountId: "ba-el", status: "unpaid", amount: 9000, splitPeople: { r: owes(3000, 1000) } },
    { id: "b2", name: "Water", billDate: "2026-07-27", dueDate: "2026-08-02", billPeriodFrom: "2026-06-26", billPeriodTo: "2026-07-24", billerAccountId: "ba-wa", status: "paid", amount: 3000, paidByTxnId: "tw", splitPeople: { r: owes(1000) } },
    { id: "b3", name: "Maintenance: lift service", billDate: "2026-08-02", dueDate: "2026-08-20", billerAccountId: "ba-mt", status: "unpaid", amount: 7200, splitPeople: { r: owes(1200) } }]);
  set("arth_txns", [
    { id: "tw", type: "expense", date: "2026-08-02", desc: "Water", amount: 3000, accId: "bank1", paidBillId: "b2", people: { r: owes(1000, 650) } },
    { id: "e1", type: "expense", date: "2026-07-04", desc: "Plumber", amount: 800, accId: "bank1", people: { r: owes(800) } },
    { id: "e2", type: "expense", date: "2026-07-12", desc: "Repair", amount: 350, accId: "bank1", people: { s: owes(350, 350) } },
    { id: "e3", type: "expense", date: "2026-07-08", desc: "Gate fix", amount: 150, accId: "bank1", people: { g: owes(150, 150, { transferredTo: "r" }) } },
    { id: "e4", type: "expense", date: "2026-08-20", desc: "Transferred from Guru", note: "Debt transferred from Guru", amount: 150, accId: "bank1", people: { r: owes(150) } },
    { id: "pay1", type: "settlement_in", isRefund: false, date: "2026-08-05", desc: "Family payment", amount: 2000, accId: "bank1", fromGroupId: "fam", settlementLinks: [{ kind: "group-bill", id: "b1", personId: "r", amount: 1000 }, { kind: "group-bill", id: "b2", personId: "r", amount: 650 }, { kind: "group-txn", id: "e2", personId: "s", amount: 350 }] },
    { id: "w1", type: "expense", date: "2026-10-05", desc: "Work taxi", amount: 500, accId: "cc1", catId: "transport", catIds: ["transport"], reimbursable: true },
    { id: "w2", type: "expense", date: "2026-10-06", desc: "Work hotel", amount: 3000, accId: "cc1", catId: "travel", catIds: ["travel"], reimbursable: true, reimbursedByTxnId: "inc1" },
    { id: "n1", type: "expense", date: "2026-10-07", desc: "Groceries run", amount: 400, accId: "cc1", catId: "groceries", catIds: ["groceries"] }]);
  set("arth_groups", []); set("arth_bills_unused", []);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
const openPerson = async name => {
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^people$/i).last().dispatchEvent("click"); await page.waitForTimeout(900);
  await page.getByText(name, { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(800);
  await page.getByText(/EXISTING CAPABILITIES/).first().dispatchEvent("click"); await page.waitForTimeout(500);
  await T("person-statement-share").scrollIntoViewIfNeeded().catch(() => {});
  await T("person-statement-share").dispatchEvent("click"); await page.waitForTimeout(700);
};
const full = async () => { await T("stmt-mode-full").click(); await page.waitForTimeout(300); };
const range = async (f, t) => { await T("stmt-from").fill(f); await T("stmt-to").fill(t); await page.waitForTimeout(400); };
try {
  await openPerson("Ravi");
  rec("S1 the person page's Statement button opens the statement sheet", (await T("person-statement-sheet").count()) === 1, {});
  await range("2026-07-01", "2026-08-31");
  // the default is the SIMPLE list: "Item - amount" lines you tick, then a total
  const lines0 = await T("sel-line").allInnerTexts();
  rec("L1 the default view is a tick-list of Ravi's items at what is still due (5 items), each ticked", lines0.length === 5 && (await T("sel-check").evaluateAll(els => els.every(e => e.checked))), lines0.map(x => x.replace(/\s+/g, " ")));
  const m0 = await T("stmt-message").innerText();
  rec("L2 the message is exactly Item - amount lines and a total (₹4,500 = his balance), then the UPI line", m0 === ["Plumber - 800", "Transferred from Guru - 150", "July Electricity Bill - 2000", "July Water Bill - 350", "August Maintenance: lift service - 1200", "", "Total = 4500", "Pay to: sample@upi"].join("\n"), m0);
  rec("L3 a part-paid item says so (Water: ₹650 already paid of ₹1,000)", /₹650(\.00)? already paid of ₹1,000(\.00)?/.test(lines0.join(" ").replace(/\s+/g, " ")), {});
  await T("sel-check").first().uncheck(); await page.waitForTimeout(300);
  const m1 = await T("stmt-message").innerText();
  rec("L4 unticking an item drops it from the message and the total (Plumber out: ₹3,700)", !/Plumber/.test(m1) && /Total = 3700/.test(m1), m1);
  await T("sel-none").click(); await page.waitForTimeout(300);
  rec("L5 with nothing ticked there is no message and no Share button, and it says so", (await T("stmt-message").count()) === 0 && (await T("stmt-share").count()) === 0 && (await T("stmt-none-ticked").count()) === 1, {});
  await T("sel-all").click(); await page.waitForTimeout(300);
  rec("L6 All brings everything back", /Total = 4500/.test(await T("stmt-message").innerText()), {});
  await full();
  const body = await text();
  rec("S2 charges are grouped by bill type, with the bill date, due date and reading period", /July Electricity Bill/.test(body) && /July Water Bill/.test(body) && /Society Maintenance/.test(body) && /July Electricity Bill, 10 Jun – 25 Jul/.test(body) && /Bill 27 Jul · due 9 Sep/.test(body), body.slice(body.indexOf("Statement from"), body.indexOf("Statement from") + 300));
  rec("S3 each charge shows paid and still due; an unpaid one says so", /paid ₹1,000(\.00)? · still due ₹2,000(\.00)?/.test(body) && /paid ₹650(\.00)? · still due ₹350(\.00)?/.test(body) && /not paid yet/.test(body), {});
  rec("S4 the payment names the bills it went to, with bill date and reading period", /→ July Electricity Bill \(bill 27 Jul, 10 Jun – 25 Jul\) ₹1,000(\.00)?/.test(body) && /→ July Water Bill \(bill 27 Jul, 26 Jun – 24 Jul\) ₹650(\.00)?/.test(body), {});
  rec("S5 charges ₹6,150, paid ₹1,650, balance due ₹4,500", /Charges ₹6,150(\.00)?/.test(body) && /Balance due ₹4,500(\.00)?/.test(body) && /−₹1,650(\.00)?/.test(body), {});
  rec("S6 the debt moved from Guru is a charge on Ravi's statement", /Transferred from Guru/.test(body), {});
  const msg = await T("stmt-message").innerText();
  rec("S7 the message has the sections, paid, balance due and the saved UPI handle", /Electricity ₹3,000/.test(msg) && /Paid −₹1,650/.test(msg) && /Balance due ₹4,500/.test(msg) && /Pay to: sample@upi/.test(msg), msg);
  rec("S8 no mismatch warning for a range that ends before today (the safeguard only applies to 'until today')", (await T("stmt-mismatch").count()) === 0, {});
  await T("stmt-preset-all").click(); await page.waitForTimeout(400);
  rec("S9 'Everything' ends today, and the balance still equals the person's page (no mismatch note)", /Balance due ₹4,500(\.00)?/.test(await text()) && (await T("stmt-mismatch").count()) === 0, {});
  await range("2026-08-01", "2026-08-31");
  const aug = await text();
  rec("S10 a later start date brings earlier charges forward and the balance stays ₹4,500", /Brought forward ₹4,800(\.00)?/.test(aug) && /Balance due ₹4,500(\.00)?/.test(aug), aug.slice(aug.indexOf("Statement from"), aug.indexOf("Statement from") + 200));
  await T("stmt-to").fill("2026-06-01"); await page.waitForTimeout(300);
  rec("S11 an end date before the start date is refused with a plain message", (await T("stmt-bad-range").count()) === 1, {});
  // Guru: charge moved to Ravi
  await openPerson("Guru"); await range("2026-07-01", "2026-08-31");
  const gl = await T("sel-line").allInnerTexts();
  rec("L7 Guru's moved item is listed but nothing is due, so it is unticked and cannot be ticked", gl.length === 1 && (await T("sel-check").first().isDisabled()) && !(await T("sel-check").first().isChecked()) && (await T("stmt-message").count()) === 0, gl.map(x => x.replace(/\s+/g, " ")));
  await full();
  const g = await text();
  rec("S12 Guru's statement shows the move, not a payment, and is settled", /moved to Ravi on 20 Aug/.test(g) && (await T("stmt-moved").count()) === 1 && /Settled/.test(await T("stmt-balance").innerText()), {});
  // Sunny: the part of the family payment applied to him
  await openPerson("Sunny"); await range("2026-07-01", "2026-08-31"); await full();
  const sn = await text();
  rec("S13 Sunny sees only the part of the family payment applied to him and owes nothing", /Repair/.test(sn) && /−₹350(\.00)?/.test(sn) && !/→ Electricity/.test(sn) && /Settled/.test(await T("stmt-balance").innerText()), {});
  // Work expenses filter
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^money$/i).last().dispatchEvent("click"); await page.waitForTimeout(900); await unlock(); await page.waitForTimeout(700);
  await T("card-filter-txns").dispatchEvent("click"); await page.waitForTimeout(800);
  rec("W1 the Transactions list shows all three card entries before any work filter", /Work taxi/.test(await text()) && /Work hotel/.test(await text()) && /Groceries run/.test(await text()), {});
  await page.getByLabel("Open transaction filters").dispatchEvent("click"); await page.waitForTimeout(600);
  rec("W2 the filters have a Work expenses control with four choices", (await T("txn-work-filter").count()) === 1 && (await T("txn-work-all").count()) === 1 && (await T("txn-work-waiting").count()) === 1 && (await T("txn-work-reimbursed").count()) === 1, {});
  await T("txn-work-all").click(); await page.waitForTimeout(500);
  const all = await text();
  rec("W3 'All work expenses' shows both work entries, not the groceries, with a summary", /Work taxi/.test(all) && /Work hotel/.test(all) && !/Groceries run/.test(all) && /Work expenses · 2 · ₹3,500(\.00)? · reimbursed ₹3,000(\.00)? · waiting ₹500(\.00)?/.test(all), (await T("txn-work-summary").innerText()));
  await T("txn-work-waiting").click(); await page.waitForTimeout(500);
  const w = await text();
  rec("W4 'Waiting for reimbursement' shows only the one not yet reimbursed", /Work taxi/.test(w) && !/Work hotel/.test(w) && /Waiting for reimbursement · 1 · ₹500/.test(w), {});
  await T("txn-work-reimbursed").click(); await page.waitForTimeout(500);
  const rb = await text();
  rec("W5 'Reimbursed' shows only the reimbursed one", !/Work taxi/.test(rb) && /Work hotel/.test(rb) && /Reimbursed · 1 · ₹3,000/.test(rb), {});
  await T("txn-work-off").click(); await page.waitForTimeout(500);
  rec("W6 'Off' brings everything back and the summary goes", (await T("txn-work-summary").count()) === 0 && /Groceries run/.test(await text()), {});
} catch (e) { rec("RUN", false, String(e).slice(0, 500)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
console.log(results.every(r => r.pass) ? "ALL PASS" : "SOME FAILED"); process.exit(results.every(r => r.pass) ? 0 : 1);
