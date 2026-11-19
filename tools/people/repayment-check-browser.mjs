// "Repayments not reflected" on a person's page: a repayment linked to a paid bill whose live share was never reduced, and repayments saved without choosing an item.
// SYNTHETIC data, real app in Chromium. A CHROMIUM check only, not a phone.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4311, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "r", name: "Ravi" }]);
  const owes = (amount, settledAmt = 0) => ({ amount, mode: "owes", settled: settledAmt >= amount, settledAmt, remainingAmt: Math.max(0, amount - settledAmt) });
  const ex = (id, date, desc, amount) => ({ id, type: "expense", date, desc, amount, accId: "bank1", people: { r: owes(amount) } });
  set("arth_bills", [{ id: "b2", name: "Water", merchant: "Water", billDate: "2026-07-27", dueDate: "2026-08-02", status: "paid", amount: 3000, createdDate: "2026-07-27", paidByTxnId: "tw", splitPeople: { r: owes(1000, 1000) } }]);   // stale copy settled
  const rep = (id, date, desc, amount, links) => ({ id, type: "settlement_in", isRefund: false, date, desc, amount, appliedAmount: links.length ? amount : 0, extraAmount: links.length ? 0 : amount, accId: "bank1", fromPersonId: "r", settlementLinks: links });
  set("arth_txns", [
    { id: "tw", type: "expense", date: "2026-08-02", desc: "Water", amount: 3000, accId: "bank1", paidBillId: "b2", isBillPayment: true, people: { r: owes(1000) } },
    ex("e1", "2026-07-04", "Plumber", 800), ex("e6", "2026-05-01", "Meter A", 858.4), ex("e7", "2026-06-01", "Meter B", 858.4), ex("e8", "2026-06-03", "Tank cleaning", 1089),
    rep("s1", "2026-08-10", "Ravi water settlement", 1000, [{ kind: "bill", id: "b2", personId: "r", amount: 1000, title: "Water" }]),
    rep("s2", "2026-08-12", "Ravi paid plumber", 800, []), rep("s3", "2026-08-14", "Ravi July received", 858.4, []), rep("s4", "2026-08-16", "Ravi tank share", 1089, [])]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
const owesNow = async () => { const t = await text(); const m = /They owe me[^₹]*₹([\d,.]+)/.exec(t); return m ? Number(m[1].replace(/,/g, "")) : null; };
try {
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^people$/i).last().dispatchEvent("click"); await page.waitForTimeout(900);
  await page.getByText("Ravi", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(900);
  await page.getByText(/FINANCIAL POSITION/).first().dispatchEvent("click"); await page.waitForTimeout(600);
  rec("R0 before: Ravi shows as owing ₹4,605.80 although he has paid", (await owesNow()) === 4605.8, await owesNow());
  rec("R1 the card appears and counts 4 repayments not reflected (1 linked-but-unreduced, 3 unlinked)", (await T("repayment-check").count()) === 1 && (await T("rc-unreduced").count()) === 1 && (await T("rc-unlinked").count()) === 3 && /not reflected \(4\)/.test(await T("repayment-check").innerText()), (await T("repayment-check").innerText()).slice(0, 200));
  // class B: linked but unreduced
  await T("rc-apply-unreduced").dispatchEvent("click"); await page.waitForTimeout(300);
  rec("R2 a confirm step says exactly what will change and that the repayment itself is not changed", /Mark ₹1,000(\.00)? of "Water" as received/.test(await T("rc-confirm").innerText()) && (await ls("arth_txns")).find(t => t.id === "tw").people.r.settledAmt === 0, await T("rc-confirm").innerText());
  await T("rc-confirm-no").dispatchEvent("click"); await page.waitForTimeout(200);
  rec("R3 Cancel changes nothing", (await T("rc-confirm").count()) === 0 && (await ls("arth_txns")).find(t => t.id === "tw").people.r.settledAmt === 0, {});
  await T("rc-apply-unreduced").dispatchEvent("click"); await T("rc-confirm-yes").dispatchEvent("click"); await page.waitForTimeout(700);
  const t1 = await ls("arth_txns"), tw = t1.find(t => t.id === "tw"), s1 = t1.find(t => t.id === "s1");
  rec("R4 the live share (the payment entry) is now settled; the repayment is untouched; no money entry was created", tw.people.r.settledAmt === 1000 && tw.people.r.settled === true && s1.amount === 1000 && s1.settlementLinks.length === 1 && t1.length === 9, { tw: tw.people.r, n: t1.length });
  rec("R5 what Ravi owes drops by ₹1,000 and the card says what was done, with Undo", (await owesNow()) === 3605.8 && (await T("rc-done").count()) === 1 && (await T("rc-undo").count()) === 1, { owes: await owesNow() });
  await T("rc-undo").dispatchEvent("click"); await page.waitForTimeout(600);
  rec("R6 Undo puts the share back exactly and the problem is listed again", (await ls("arth_txns")).find(t => t.id === "tw").people.r.settledAmt === 0 && (await owesNow()) === 4605.8 && (await T("rc-unreduced").count()) === 1, {});
  await T("rc-apply-unreduced").dispatchEvent("click"); await T("rc-confirm-yes").dispatchEvent("click"); await page.waitForTimeout(600);
  // class A: unlinked repayments
  const firstPick = await T("rc-pick").first().inputValue();
  rec("R7 the unlinked ₹800 repayment is matched to the ₹800 plumber item and preselected", firstPick === "txn:e1", firstPick);
  const picks = await T("rc-pick").evaluateAll(els => els.map(e => e.value));
  rec("R8 the ₹858.40 repayment matches TWO items exactly, so nothing is chosen for you and Apply is off", picks[1] === "" && (await T("rc-apply-link").nth(1).isDisabled()), picks);
  await T("rc-apply-link").first().dispatchEvent("click"); await T("rc-confirm-yes").dispatchEvent("click"); await page.waitForTimeout(600);
  const t2 = await ls("arth_txns"), s2 = t2.find(t => t.id === "s2"), e1 = t2.find(t => t.id === "e1");
  rec("R9 applying links the repayment to the item and reduces it, with no new money entry", s2.settlementLinks.length === 1 && s2.settlementLinks[0].id === "e1" && s2.extraAmount === 0 && e1.people.r.settled === true && t2.length === 9, { links: s2.settlementLinks, e1: e1.people.r });
  await T("rc-pick").first().selectOption("txn:e6"); await T("rc-apply-link").first().dispatchEvent("click"); await T("rc-confirm-yes").dispatchEvent("click"); await page.waitForTimeout(600);   // ambiguous one: chosen by hand
  const t3 = await ls("arth_txns");
  rec("R10 the ambiguous repayment is applied to the item you chose (Meter A), not the other", t3.find(t => t.id === "e6").people.r.settled === true && t3.find(t => t.id === "e7").people.r.settled === false, {});
  await T("rc-apply-link").first().dispatchEvent("click"); await T("rc-confirm-yes").dispatchEvent("click"); await page.waitForTimeout(700);
  rec("R11 the last repayment (₹1,089) is applied to its matching item", (await ls("arth_txns")).find(t => t.id === "e8").people.r.settled === true, {});
  const after = await owesNow();
  rec("R12 what Ravi owes ends at ₹858.40 (only Meter B, which no repayment covers), and nothing is left to fix", after === 858.4 && (await T("rc-unlinked").count()) === 0 && (await T("rc-unreduced").count()) === 0, after);
} catch (e) { rec("RUN", false, String(e).slice(0, 500)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
console.log(results.every(r => r.pass) ? "ALL PASS" : "SOME FAILED"); process.exit(results.every(r => r.pass) ? 0 : 1);
