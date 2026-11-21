// A family (group) statement and ONE request for the whole family, from the group page. SYNTHETIC data (an invented family), real app in Chromium.
// A CHROMIUM check only, not a phone.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4291, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }, { id: "upi1", name: "Sample UPI", type: "upi", handle: "sample@upi", linkedAccount: "bank1" },
    { id: "cc1", name: "Test Card", type: "cc", last4: "8004", creditLimit: 100000, statementDay: 16, dueDay: 3 }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "r", name: "Ravi" }, { id: "s", name: "Sunny" }, { id: "m", name: "Mangal" }, { id: "g", name: "Guru" }]);
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
    { id: "pay2", type: "settlement_in", isRefund: false, date: "2026-08-12", desc: "Family payment, no member chosen", amount: 500, accId: "bank1", fromGroupId: "fam", settlementLinks: [] },
    { id: "w1", type: "expense", date: "2026-10-05", desc: "Work taxi", amount: 500, accId: "cc1", catId: "transport", catIds: ["transport"], reimbursable: true },
    { id: "w2", type: "expense", date: "2026-10-06", desc: "Work hotel", amount: 3000, accId: "cc1", catId: "travel", catIds: ["travel"], reimbursable: true, reimbursedByTxnId: "inc1" },
    { id: "n1", type: "expense", date: "2026-10-07", desc: "Groceries run", amount: 400, accId: "cc1", catId: "groceries", catIds: ["groceries"] }]);
  set("arth_groups", [{ id: "fam", name: "Suryamandal", icon: "🏠", color: "#16a34a", typeId: "other", type: "Other", members: ["r", "s", "m", "g"], includeMe: true, manualLimit: 0, defaultIntent: "split", modules: [] }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
try {
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^people$/i).last().dispatchEvent("click"); await page.waitForTimeout(900);
  const pt = await text();
  console.log("PEOPLE TEXT:", pt.slice(0, 260));
  await page.getByText(/Groups/).first().dispatchEvent("click"); await page.waitForTimeout(700);
  await page.getByText("Suryamandal", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(900);
  rec("F1 the group page has a Statement button for the family", (await T("group-statement").count()) === 1, (await text()).slice(0, 200));
  rec("F1b nothing is tagged to the group here, so the group owes ₹0 and the old 'Request from group' button is not shown, while the family Statement button still is", !/Request .* from group/.test(await text()) && (await T("group-statement").count()) === 1, {});
  await T("group-statement").scrollIntoViewIfNeeded().catch(() => {}); await T("group-statement").dispatchEvent("click"); await page.waitForTimeout(700);
  rec("F2 the family sheet opens", (await T("family-statement-sheet").count()) === 1, {});
  await T("fam-from").fill("2026-07-01"); await T("fam-to").fill("2026-08-31"); await page.waitForTimeout(500);
  const fl = await T("famsel-line").allInnerTexts();
  rec("FL1 the default view is a tick-list naming each member; only what is still due is ticked", fl.length >= 5 && (await T("famsel-check").evaluateAll(els => els.filter(e => e.checked).length)) === 5, fl.length);
  const fm = await T("fam-message").innerText();
  rec("FL2 the message is 'Member: Item - amount' lines, a total (₹4,500) and the UPI line", fm === ["Ravi: Plumber - 800", "Ravi: Transferred from Guru - 150", "Ravi: July Electricity Bill - 2000", "Ravi: July Water Bill - 350", "Ravi: August Maintenance: lift service - 1200", "", "Total = 4500", "Pay to: sample@upi"].join("\n"), fm);
  await T("famsel-check").first().uncheck(); await page.waitForTimeout(300);
  rec("FL3 unticking a line changes the total", /Total = 3700/.test(await T("fam-message").innerText()), {});
  await T("fam-mode-full").click(); await page.waitForTimeout(400);
  const b = await text();
  rec("F3 family totals: charges ₹6,500 (a move inside the family is netted out), paid by the family ₹2,000, balance due ₹4,500", /Charges ₹6,500(\.00)?/.test(b) && /Paid by the family −₹2,000(\.00)?/.test(b) && /Balance due\s*₹4,500(\.00)?/.test(await T("fam-balance").innerText()) , (await T("fam-summary").innerText()).slice(0, 300));
  const who = await T("fam-person").allInnerTexts();
  rec("F4 by person: Ravi ₹4,500, the other three settled", who.length === 4 && /Ravi\s*₹4,500/.test(who.join(" ")) && who.filter(x => /Settled/.test(x)).length === 3 && who.some(x => /Mangal/.test(x)), who);
  const msg = await T("fam-message").innerText();
  rec("F5 ONE message for the whole family: sections added up, paid, balance due, who owes, the pay-to line", /Electricity ₹3,000/.test(msg) && /Paid by the family −₹2,000/.test(msg) && /Balance due ₹4,500/.test(msg) && /By person: Ravi ₹4,500/.test(msg) && /Pay to: sample@upi/.test(msg), msg);
  rec("F6 the button asks for the family's total", /Request ₹4,500(\.00)? from the family/.test(await T("fam-share").innerText()), await T("fam-share").innerText());
  rec("F7 a family payment with no member chosen is flagged and not in anyone's balance", (await T("fam-unapplied").count()) === 1 && /₹500(\.00)? paid by the family is not applied/.test(await T("fam-unapplied").innerText()), {});
  await T("fam-member").first().locator("summary").click(); await page.waitForTimeout(400);
  rec("F8 each member's own statement opens under the total (Ravi: the bills it went to)", /Ravi's statement/.test(await text()) && (await T("fam-member").count()) >= 1 && /→ July Electricity Bill \(bill 27 Jul/.test(await text()), (await T("fam-member").count()));
  await T("fam-from").fill("2026-09-01"); await T("fam-to").fill("2026-09-30"); await page.waitForTimeout(400);
  rec("F9 a period with nothing new still carries the balance forward and asks for it", /Brought forward ₹4,500(\.00)?/.test(await text()), (await T("fam-summary").innerText()).slice(0, 200));
  await T("fam-to").fill("2026-06-01"); await page.waitForTimeout(300);
  rec("F10 an end date before the start date is refused with a plain message", (await T("fam-bad-range").count()) === 1, {});
} catch (e) { rec("RUN", false, String(e).slice(0, 500)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
console.log(results.every(r => r.pass) ? "ALL PASS" : "SOME FAILED"); process.exit(results.every(r => r.pass) ? 0 : 1);
