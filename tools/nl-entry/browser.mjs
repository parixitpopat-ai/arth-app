// Browser check for typed-sentence entry in Quick Add. SYNTHETIC accounts only; every non-local request is aborted
// and recorded; the app is built with a dead local backend URL, so nothing can reach Supabase.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const APP = process.env.NL_APP || "http://localhost:5197/";
const results = []; const blocked = [];
const rec = (id, pass, detail) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(detail)}`); };

const cards = {
  bank: { id: "b1", name: "Test Bank", type: "bank", openingBalance: 10000, openingBalanceDate: "2026-01-01", last4: "9001" },
  a: { id: "c1", name: "Test Card A", type: "cc", last4: "3445", statementDate: 15, dueDate: 5, limit: 100000 },
  b: { id: "c2", name: "Test Card B", type: "cc", last4: "7777", statementDate: 15, dueDate: 5, limit: 100000 },
  twin: { id: "c3", name: "Test Card C", type: "cc", last4: "3445", statementDate: 15, dueDate: 5, limit: 100000 },
  debit: { id: "d1", name: "Test Debit", type: "debit", last4: "3445", linkedBank: "b1" },
};
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function open(accounts, txns = [], query = "?nl=1") {
  const ctx = await browser.newContext({ timezoneId: "Asia/Kolkata", viewport: { width: 420, height: 900 } });
  await ctx.route(u => { try { return !["localhost", "127.0.0.1"].includes(new URL(u).hostname); } catch { return false; } }, r => { blocked.push(r.request().url()); r.abort(); });
  await ctx.addInitScript(({ accounts, txns }) => {
    if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
    localStorage.setItem("arth_accounts", JSON.stringify(accounts));
    localStorage.setItem("arth_txns", JSON.stringify(txns));
    localStorage.setItem("arth_master_user_setup_complete", "true");
  }, { accounts, txns });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(APP.replace(/\/?$/, "/") + query); await page.waitForTimeout(900);
  for (let i = 0; i < 2; i++) { // set / enter a PIN if asked
    if (await page.getByRole("button", { name: "1", exact: true }).count()) {
      for (const d of ["1", "2", "3", "4"]) { await page.getByRole("button", { name: d, exact: true }).click(); await page.waitForTimeout(60); }
      await page.waitForTimeout(500);
    }
  }
  return { ctx, page, errors };
}
const txns = page => page.evaluate(() => JSON.parse(localStorage.getItem("arth_txns") || "[]"));
async function openQuickAdd(page) { await page.getByText("+", { exact: true }).first().click(); await page.waitForTimeout(500); }
async function fill(page, text) { await page.getByTestId("qa-nl-input").fill(text); await page.getByTestId("qa-nl-fill").click(); await page.waitForTimeout(250); }
const val = (page, ph) => page.getByPlaceholder(ph, { exact: true }).first().inputValue();
const today = new Date(); const pad = n => String(n).padStart(2, "0");
const TODAY = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
const SENTENCE = "I paid ₹3,000 to Domino's via credit card ending 3445.";

// NL1: the example sentence, card 3445 exists once. Fill writes nothing; Save (double-clicked) writes exactly one.
{
  const { ctx, page, errors } = await open([cards.bank, cards.a, cards.b]);
  await openQuickAdd(page);
  await fill(page, SENTENCE);
  const filled = { amount: await val(page, "0"), who: await val(page, "e.g. Petrol, Swiggy, Netflix"), account: await page.getByTestId("qa-account").inputValue(), note: await page.getByTestId("qa-nl-resolved").innerText() };
  const afterFill = (await txns(page)).length;
  await page.getByTestId("qa-nl-fill").click(); await page.getByTestId("qa-nl-fill").click(); // repeated parse: still nothing written
  const afterRefill = (await txns(page)).length;
  const save = page.getByRole("button", { name: /Save Expense/ });
  await save.dblclick({ delay: 10 }).catch(() => {}); await page.waitForTimeout(600);
  const saved = await txns(page);
  rec("NL1 example sentence: fills the form, writes nothing until Save, double-tap saves exactly one", filled.amount === "3000" && filled.who === "Domino's" && filled.account === "c1" && /Test Card A/.test(filled.note) && afterFill === 0 && afterRefill === 0 && saved.length === 1 && saved[0].accId === "c1" && saved[0].amount === 3000 && saved[0].type === "expense" && saved[0].date === TODAY && !saved[0].paymentMethod, { filled, afterFill, afterRefill, savedCount: saved.length, saved: saved.map(t => ({ accId: t.accId, amount: t.amount, merchant: t.merchant, date: t.date, type: t.type })), errors });
  await ctx.close();
}
// NL2: curly apostrophe
{
  const { ctx, page } = await open([cards.bank, cards.a]);
  await openQuickAdd(page); await fill(page, "I paid ₹3,000 to Domino’s via credit card ending 3445.");
  const who = await val(page, "e.g. Petrol, Swiggy, Netflix");
  rec("NL2 curly apostrophe is kept in the merchant field", who === "Domino’s", { who });
  await ctx.close();
}
// NL3: two cards end in 3445 -> choice required; Save blocked until chosen
{
  const { ctx, page } = await open([cards.bank, cards.a, cards.twin]);
  await openQuickAdd(page); await fill(page, SENTENCE);
  const q = await page.getByTestId("qa-nl-q-account-ambiguous").count();
  const cands = await page.getByTestId("qa-nl-candidate").count();
  const disabledBefore = await page.getByRole("button", { name: /Save Expense/ }).isDisabled();
  const accBefore = await page.getByTestId("qa-account").inputValue();
  await page.getByTestId("qa-nl-candidate").nth(1).click(); await page.waitForTimeout(200);
  const disabledAfter = await page.getByRole("button", { name: /Save Expense/ }).isDisabled();
  await page.getByRole("button", { name: /Save Expense/ }).click(); await page.waitForTimeout(500);
  const saved = await txns(page);
  rec("NL3 multiple matches: asks, blocks Save, saves against the chosen card only", q === 1 && cands === 2 && disabledBefore && accBefore === "" && !disabledAfter && saved.length === 1 && saved[0].accId === "c3", { q, cands, disabledBefore, accBefore, savedAcc: saved.map(t => t.accId) });
  await ctx.close();
}
// NL4: no card ends in 3445 -> clarification, nothing created, Save blocked, accounts unchanged
{
  const accs = [cards.bank, cards.b];
  const { ctx, page } = await open(accs);
  await openQuickAdd(page); await fill(page, SENTENCE);
  const msg = await page.getByTestId("qa-nl-q-account-none").innerText().catch(() => "");
  const disabled = await page.getByRole("button", { name: /Save Expense/ }).isDisabled();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("arth_accounts")).map(a => a.id));
  rec("NL4 no match: asks, Save blocked, no account created, nothing written", /No credit card ends in 3445/.test(msg) && disabled && stored.length === accs.length && (await txns(page)).length === 0, { msg, disabled, stored });
  await ctx.close();
}
// NL5: 3445 is a DEBIT card only -> not accepted for a credit-card sentence
{
  const { ctx, page } = await open([cards.bank, cards.debit, cards.b]);
  await openQuickAdd(page); await fill(page, SENTENCE);
  const wrong = await page.getByTestId("qa-nl-q-account-wrong-type").count();
  const disabled = await page.getByRole("button", { name: /Save Expense/ }).isDisabled();
  rec("NL5 same digits on the wrong account type are not used", wrong === 1 && disabled, { wrong, disabled });
  await ctx.close();
}
// NL6: card-bill payment and repayment are refused and fill nothing
{
  const { ctx, page } = await open([cards.bank, cards.a]);
  await openQuickAdd(page);
  await fill(page, "paid ₹5,000 to my credit card ending 3445");
  const m1 = await page.getByTestId("qa-nl-refused").innerText().catch(() => "");
  const amt1 = await val(page, "0");
  await fill(page, "Rahul paid me back 500");
  const m2 = await page.getByTestId("qa-nl-refused").innerText().catch(() => "");
  rec("NL6 card-bill payment and repayment are refused, form untouched, nothing written", /credit-card bill/.test(m1) && /received|repayment/.test(m2) && amt1 === "" && (await txns(page)).length === 0, { m1, m2, amt1 });
  await ctx.close();
}
// NL7: stated date and a category that does not exist -> date used, category left unassigned and asked
{
  const { ctx, page } = await open([cards.bank, cards.a]);
  await openQuickAdd(page); await fill(page, "paid ₹250 to Cafe Mocha yesterday via credit card ending 3445 under pets");
  const q = await page.getByTestId("qa-nl-q-category-unmatched").count();
  const date = await page.locator('input[type="date"]').first().inputValue();
  await page.getByRole("button", { name: /Save Expense/ }).click(); await page.waitForTimeout(500);
  const saved = await txns(page);
  const y = new Date(today); y.setDate(y.getDate() - 1);
  const YD = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
  rec("NL7 yesterday is used; unknown category is asked and left unassigned", q === 1 && date === YD && saved.length === 1 && saved[0].date === YD && !saved[0].catId, { q, date, saved: saved.map(t => ({ date: t.date, catId: t.catId })) });
  await ctx.close();
}
// NL8: repeat of an existing purchase is flagged, not blocked
{
  const existing = [{ id: "t0", type: "expense", amount: 3000, date: TODAY, merchant: "Domino's", desc: "Domino's", accId: "c1", catId: null, catIds: [], people: {} }];
  const { ctx, page } = await open([cards.bank, cards.a], existing);
  await openQuickAdd(page); await fill(page, SENTENCE);
  const dup = await page.getByTestId("qa-nl-duplicate").count();
  const disabled = await page.getByRole("button", { name: /Save Expense/ }).isDisabled();
  rec("NL8 matching earlier entry is flagged but Save stays available", dup === 1 && !disabled, { dup, disabled });
  await ctx.close();
}
// NL9: the ordinary keyboard form is unchanged when the text box is not used
{
  const { ctx, page } = await open([cards.bank, cards.a]);
  await openQuickAdd(page);
  await page.getByPlaceholder("0", { exact: true }).fill("120"); await page.getByPlaceholder("e.g. Petrol, Swiggy, Netflix", { exact: true }).fill("Tea");
  const acc = await page.getByTestId("qa-account").inputValue();
  const disabled = await page.getByRole("button", { name: /Save Expense/ }).isDisabled();
  await page.getByRole("button", { name: /Save Expense/ }).click(); await page.waitForTimeout(500);
  const saved = await txns(page);
  rec("NL9 without the text box: default account still preselected, Save works as before", acc !== "" && !disabled && saved.length === 1 && saved[0].amount === 120, { acc, disabled, n: saved.length });
  await ctx.close();
}

// G1: default (no parameter): the input is absent and the ordinary Quick Add works exactly as before.
{
  const { ctx, page } = await open([cards.bank, cards.a], [], "");
  await openQuickAdd(page);
  const present = await page.getByTestId("qa-nl").count() + await page.getByTestId("qa-nl-input").count();
  await page.getByPlaceholder("0", { exact: true }).fill("120"); await page.getByPlaceholder("e.g. Petrol, Swiggy, Netflix", { exact: true }).fill("Tea");
  const acc = await page.getByTestId("qa-account").inputValue();
  await page.getByRole("button", { name: /Save Expense/ }).click(); await page.waitForTimeout(500);
  const saved = await txns(page);
  rec("G1 no parameter: input hidden, ordinary Quick Add saves as before", present === 0 && acc === "b1" && saved.length === 1 && saved[0].amount === 120, { present, acc, n: saved.length });
  await ctx.close();
}
// G2: ?nl=1 shows it; unrelated or near-miss parameters do not.
for (const [query, want] of [["?nl=1", 1], ["?utm_source=x&nl=1&ref=y", 1], ["?foo=bar", 0], ["?nl=0", 0], ["?nl=true", 0], ["?NL=1", 0], ["?nl=1&nl=0", 0], ["?cfError=1", 0]]) {
  const { ctx, page } = await open([cards.bank, cards.a], [], query);
  await openQuickAdd(page);
  const n = await page.getByTestId("qa-nl-input").count();
  rec(`G2 ${query || "(none)"} -> input ${want ? "shown" : "hidden"}`, n === want, { n });
  await ctx.close();
}
// G3: reload keeps it (the address is unchanged); navigating around the app and reopening keeps it; opening
// the app again WITHOUT the parameter hides it (nothing is remembered).
{
  const { ctx, page } = await open([cards.bank, cards.a], [], "?nl=1");
  await openQuickAdd(page); const first = await page.getByTestId("qa-nl-input").count();
  await page.getByRole("button", { name: "Cancel" }).click(); await page.waitForTimeout(300);
  const visited = [];
  for (const tab of ["Payments", "People", "Home"]) { await page.locator("span", { hasText: new RegExp(`^${tab}$`) }).last().click(); await page.waitForTimeout(400); visited.push(tab); }
  await openQuickAdd(page); const afterNav = await page.getByTestId("qa-nl-input").count();
  const urlAfterNav = new URL(page.url()).search;
  await page.reload(); await page.waitForTimeout(900);
  for (let i = 0; i < 2; i++) if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (const d of ["1", "2", "3", "4"]) { await page.getByRole("button", { name: d, exact: true }).click(); await page.waitForTimeout(60); } await page.waitForTimeout(500); }
  await openQuickAdd(page); const afterReload = await page.getByTestId("qa-nl-input").count();
  const stored = await page.evaluate(() => Object.keys(localStorage).filter(k => /nl/i.test(k) && !/arth_(txns|accounts|master)/.test(k)));
  await page.goto(APP); await page.waitForTimeout(900);
  for (let i = 0; i < 2; i++) if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (const d of ["1", "2", "3", "4"]) { await page.getByRole("button", { name: d, exact: true }).click(); await page.waitForTimeout(60); } await page.waitForTimeout(500); }
  await openQuickAdd(page); const withoutParam = await page.getByTestId("qa-nl-input").count();
  rec("G3 reload and in-app navigation keep it; nothing is remembered once the parameter is gone", first === 1 && visited.length === 3 && afterNav === 1 && afterReload === 1 && urlAfterNav === "?nl=1" && withoutParam === 0, { first, visited, afterNav, afterReload, urlAfterNav, storedKeys: stored, withoutParam });
  await ctx.close();
}
await browser.close();
rec("SAFE no non-local requests reached the network", blocked.filter(u => /supabase/.test(u)).length === 0, { blockedNonLocal: [...new Set(blocked.map(u => new URL(u).hostname))] });
console.log("\noutcome vector:", JSON.stringify(results));
process.exit(results.every(r => r.pass) ? 0 : 1);
