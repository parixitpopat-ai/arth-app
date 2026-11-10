// A bill added from a connection: its category, the expense made by paying it, and the "this expense looks like the payment" suggestion.
// Chromium, local Vite dev server, SYNTHETIC data. A CHROMIUM check only. Run: node tools/bills/bill-category-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4207, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const errors = [];
const ymd = off => { const d = new Date(); d.setDate(d.getDate() + off); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
async function open(extraTxns) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
  await ctx.addInitScript(txns => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]);
    set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "p1", name: "Priya Test" }]);
    set("arth_biller_accounts", [{ id: "ba1", name: "Family plan", type: "Mobile Postpaid", provider: "Jio Postpaid", attributedTo: "p1", attributeType: "person", consumerNo: "9000000001" }]);
    set("arth_txns", txns);
    localStorage.setItem("arth_master_user_setup_complete", "true"); }, extraTxns);
  const page = await ctx.newPage(); page.on("pageerror", e => errors.push(String(e)));
  const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^payments$/i).last().dispatchEvent("click"); await page.waitForTimeout(800);
  await page.getByText("Billers", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(600);
  await page.getByText(/Broadband & Recharges/).first().dispatchEvent("click"); await page.waitForTimeout(500);
  await page.getByText(/Family plan/).first().dispatchEvent("click"); await page.waitForTimeout(700);
  await page.getByRole("button", { name: /\+ Add bill/ }).first().click(); await page.waitForTimeout(800);
  await page.locator("input[type=number]").first().fill("1200");
  await page.locator("input[type=date]").first().fill(ymd(10));
  return page;
}
const ls = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
const text = page => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const save = async page => { await page.getByRole("button", { name: "Add bill", exact: true }).last().click(); await page.waitForTimeout(900); };
try {
  // 1 ── no similar expense: the bill gets Utilities / Mobile Bills, and paying it makes a categorised expense
  {
    const page = await open([]);
    await save(page);
    const b = (await ls(page, "arth_bills"))[0];
    rec("B1 a bill from a Mobile Postpaid connection starts with Utilities / Mobile Bills (it used to have none)", b.catId === "utilities" && b.catIds[0] === "utilities" && b.subId === "u5", { catId: b.catId, subId: b.subId });
    rec("B2 no suggestion appears when there is no similar expense", (await page.getByTestId("bill-match-expense").count()) === 0, {});
    await page.getByText(/Family plan · /).first().dispatchEvent("click"); await page.waitForTimeout(700);
    await page.getByRole("button", { name: /^Record payment/ }).first().click(); await page.waitForTimeout(700);
    await page.locator("select:visible").last().selectOption("bank1"); await page.waitForTimeout(300);
    await page.getByRole("button", { name: /^Record payment ₹1,200$/ }).last().click(); await page.waitForTimeout(900);
    const tx = (await ls(page, "arth_txns"))[0];
    rec("B3 paying it records an expense from Test Savings, category Utilities / Mobile Bills", tx && tx.type === "expense" && tx.accId === "bank1" && tx.catIds[0] === "utilities" && tx.subId === "u5", tx && { catIds: tx.catIds, subId: tx.subId, accId: tx.accId });
    await page.close();
  }
  // 2 ── the reported case: an old Housing expense of the same amount must not be offered as the payment
  {
    const page = await open([{ id: "old", type: "expense", amount: 1200, date: ymd(-150), desc: "Old house repair", merchant: "Handyman", accId: "bank1", catId: "housing", catIds: ["housing"] }]);
    await save(page);
    rec("H1 an unrelated Housing expense of the same amount from months ago is NOT offered ('Bill matched' does not appear)", (await page.getByTestId("bill-match-expense").count()) === 0 && !/Bill matched/.test(await text(page)), {});
    const old = (await ls(page, "arth_txns")).find(t => t.id === "old");
    rec("H2 and that expense is untouched", old && !old.paidBillId && old.catId === "housing", {});
    await page.close();
  }
  // 3 ── a genuine match: shown with its details; 'Not this' opens Record payment; 'Yes' links it
  {
    const near = { id: "near", type: "expense", amount: 1200, date: ymd(-1), desc: "Jio bill", merchant: "Jio", accId: "bank1", catId: "utilities", catIds: ["utilities"], transactionRef: "UTR123" };
    const page = await open([near]);
    await save(page);
    const box = await page.getByTestId("bill-match-expense").count() ? await page.getByTestId("bill-match-expense").innerText() : "";
    rec("M1 a recent same-amount Utilities expense is offered, with its vendor, amount, date, account, reference and category shown", /Jio · ₹1,200/.test(box) && /Test Savings/.test(box) && /ref UTR123/.test(box) && /Utilities/.test(box), box);
    await page.getByTestId("bill-match-record").click(); await page.waitForTimeout(700);
    rec("M2 'Not this · record payment' opens the Record payment sheet (account, date, reference)", /Record payment/.test(await text(page)) && /REFERENCE/i.test(await text(page)) && (await page.getByTestId("bill-match-expense").count()) === 0, {});
    await page.close();
    const p2 = await open([near]);
    await save(p2);
    await p2.getByTestId("bill-match-yes").click(); await p2.waitForTimeout(800);
    const bills = await ls(p2, "arth_bills"), n = (await ls(p2, "arth_txns")).find(t => t.id === "near");
    rec("M3 'Yes, this is it' marks the bill paid with that expense as its payment (no new expense, expense keeps its details)", bills[0].status === "paid" && bills[0].paidByTxnId === "near" && n.paidBillId === bills[0].id && n.catIds[0] === "utilities" && n.transactionRef === "UTR123" && (await ls(p2, "arth_txns")).length === 1, { status: bills[0].status });
    await p2.close();
  }
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 600)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
