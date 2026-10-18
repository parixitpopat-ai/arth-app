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

async function open(accounts, txns = [], query = "") {
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
async function fill(page, text) { if (await page.getByTestId("qa-nl-edit").count()) await page.getByTestId("qa-nl-edit").click(); await page.getByTestId("qa-nl-input").fill(text); await page.getByTestId("qa-nl-fill").click(); await page.waitForTimeout(250); }
const val = (page, ph) => page.getByPlaceholder(ph, { exact: true }).first().inputValue();
// The browser runs in Asia/Kolkata, so "today" must be computed there too (the machine itself runs in UTC).
const ymdIST = d => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const today = new Date(); const pad = n => String(n).padStart(2, "0");
const TODAY = ymdIST(today);
const SENTENCE = "I paid ₹3,000 to Domino's via credit card ending 3445.";

// NL1: the example sentence, card 3445 exists once. Fill writes nothing; Save (double-clicked) writes exactly one.
{
  const { ctx, page, errors } = await open([cards.bank, cards.a, cards.b]);
  await openQuickAdd(page);
  await fill(page, SENTENCE);
  const filled = { amount: await val(page, "0"), who: await val(page, "e.g. Petrol, Swiggy, Netflix"), account: await page.getByTestId("qa-account").inputValue(), note: await page.getByTestId("qa-nl-resolved").innerText() };
  const afterFill = (await txns(page)).length;
  await fill(page, SENTENCE); await fill(page, SENTENCE); // repeated parse: still nothing written
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
// NL3: two cards end in 3445 -> Save stays enabled but asks for the account; candidates sit under the Account field
{
  const { ctx, page } = await open([cards.bank, cards.a, cards.twin]);
  await openQuickAdd(page); await fill(page, SENTENCE);
  const q = await page.getByTestId("qa-nl-q-account-ambiguous").count();
  const cands = await page.getByTestId("qa-nl-candidate").count();
  const saveBtn = page.getByRole("button", { name: /Save Expense/ });
  const enabledBefore = !(await saveBtn.isDisabled());
  const accBefore = await page.getByTestId("qa-account").inputValue();
  await saveBtn.click(); await page.waitForTimeout(400);
  const errShown = (await page.getByTestId("qa-nl-acc-error").count()) === 1;
  const writtenAfterTap = (await txns(page)).length;
  await page.getByTestId("qa-nl-candidate").nth(1).click(); await page.waitForTimeout(200);
  const errGone = (await page.getByTestId("qa-nl-acc-error").count()) === 0;
  await saveBtn.click(); await page.waitForTimeout(500);
  const saved = await txns(page);
  rec("NL3 multiple matches: Save enabled, tapping it asks for the account and writes nothing; choosing a card then saves against that card only", q === 1 && cands === 2 && enabledBefore && accBefore === "" && errShown && writtenAfterTap === 0 && errGone && saved.length === 1 && saved[0].accId === "c3", { q, cands, enabledBefore, accBefore, errShown, writtenAfterTap, errGone, savedAcc: saved.map(t => t.accId) });
  await ctx.close();
}
// NL4: no card ends in 3445 -> clarification, nothing created, Save asks for the account, accounts unchanged
{
  const accs = [cards.bank, cards.b];
  const { ctx, page } = await open(accs);
  await openQuickAdd(page); await fill(page, SENTENCE);
  const msg = await page.getByTestId("qa-nl-q-account-none").innerText().catch(() => "");
  await page.getByRole("button", { name: /Save Expense/ }).click(); await page.waitForTimeout(400);
  const err = await page.getByTestId("qa-nl-acc-error").innerText().catch(() => "");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("arth_accounts")).map(a => a.id));
  rec("NL4 no match: says what is wrong and what to do, Save asks for an account, no account created, nothing written", /No card ending 3445\. Pick one below or check the number\./.test(msg) && /Choose an account to save/.test(err) && stored.length === accs.length && (await txns(page)).length === 0, { msg, err, stored });
  await ctx.close();
}
// NL5: 3445 is a DEBIT card only -> not accepted for a credit-card sentence
{
  const { ctx, page } = await open([cards.bank, cards.debit, cards.b]);
  await openQuickAdd(page); await fill(page, SENTENCE);
  const wrong = await page.getByTestId("qa-nl-q-account-wrong-type").count();
  await page.getByRole("button", { name: /Save Expense/ }).click(); await page.waitForTimeout(400);
  rec("NL5 same digits on the wrong account type are not used; Save asks for an account", wrong === 1 && (await page.getByTestId("qa-nl-acc-error").count()) === 1 && (await txns(page)).length === 0, { wrong });
  await ctx.close();
}
// NL6: card-bill payment and repayment are refused, say what was detected, and offer the full form with the amount
{
  const { ctx, page } = await open([cards.bank, cards.a]);
  await openQuickAdd(page);
  await fill(page, "paid ₹5,000 to my credit card ending 3445");
  const m1 = await page.getByTestId("qa-nl-refused").innerText().catch(() => "");
  const amt1 = await val(page, "0");
  await fill(page, "Rahul paid me back 500");
  const m2 = await page.getByTestId("qa-nl-refused").innerText().catch(() => "");
  rec("NL6 card-bill payment and repayment are refused with a clear message, form untouched, nothing written", /card bill payment\. Use the full form for that/.test(m1) && /a repayment\. Use the full form for that/.test(m2) && amt1 === "" && (await txns(page)).length === 0, { m1, m2, amt1 });
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
  const YD = ymdIST(new Date(today.getTime() - 86400000));
  rec("NL7 yesterday is used; unknown category is asked and left unassigned", q === 1 && date === YD && saved.length === 1 && saved[0].date === YD && !saved[0].catId, { q, date, saved: saved.map(t => ({ date: t.date, catId: t.catId })) });
  await ctx.close();
}
// NL8: repeat of an existing purchase is flagged, not blocked
{
  const existing = [{ id: "t0", type: "expense", amount: 3000, date: TODAY, merchant: "Domino's", desc: "Domino's", accId: "c1", catId: null, catIds: [], people: {} }];
  const { ctx, page } = await open([cards.bank, cards.a], existing);
  await openQuickAdd(page); await fill(page, SENTENCE);
  const dup = await page.getByTestId("qa-nl-q-duplicate").count();
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

// ═══ Designer review: one row, collapse, Filled tags, account prompt, messages, chip, card note, full-form hand-off ═══
const inputWithValue = (page, v) => page.evaluate(x => [...document.querySelectorAll("input")].some(i => i.value === x), v);
const fontPx = (page, testid) => page.getByTestId(testid).first().evaluate(e => parseFloat(getComputedStyle(e).fontSize));
// UX1: one 48 px row, ₹ placeholder, icon button (no "Fill" word), Enter runs the fill
{
  const { ctx, page } = await open([cards.bank, cards.a]);
  await openQuickAdd(page);
  const box = await page.getByTestId("qa-nl-input").evaluate(e => { const r = e.parentElement.getBoundingClientRect(); return { h: Math.round(r.height), ph: e.placeholder }; });
  const btn = await page.getByTestId("qa-nl-fill").innerText();
  await page.getByTestId("qa-nl-input").fill(SENTENCE); await page.getByTestId("qa-nl-input").press("Enter"); await page.waitForTimeout(300);
  const filledByEnter = (await val(page, "0")) === "3000";
  rec("UX1 one 48 px row with a ₹ placeholder and an icon button; Enter fills; nothing saved", box.h === 48 && box.ph === "Type it: ₹450 Swiggy on card 1234" && !/fill/i.test(btn) && filledByEnter && (await txns(page)).length === 0, { box, btn, filledByEnter });
  await ctx.close();
}
// UX2: collapses to one line with Edit; every filled field is tagged and the tag clears when that field is edited
{
  const { ctx, page } = await open([cards.bank, cards.a]);
  await openQuickAdd(page); await fill(page, "paid ₹250 to Cafe Mocha yesterday via credit card ending 3445");
  const summary = await page.getByTestId("qa-nl-summary").innerText().catch(() => "");
  const inputGone = (await page.getByTestId("qa-nl-input").count()) === 0;
  const tags0 = await page.getByTestId("qa-filled-tag").count();      // amount, what, account, date (stated) = 4
  await page.getByPlaceholder("0", { exact: true }).fill("260"); await page.waitForTimeout(150);
  const tags1 = await page.getByTestId("qa-filled-tag").count();
  await page.getByPlaceholder("e.g. Petrol, Swiggy, Netflix", { exact: true }).fill("Cafe Mocha 2"); await page.waitForTimeout(150);
  const tags2 = await page.getByTestId("qa-filled-tag").count();
  await page.getByTestId("qa-account").selectOption("b1"); await page.waitForTimeout(150);
  const tags3 = await page.getByTestId("qa-filled-tag").count();
  await page.locator('input[type="date"]').first().fill("2026-10-05"); await page.waitForTimeout(150);
  const tags4 = await page.getByTestId("qa-filled-tag").count();
  await page.getByTestId("qa-nl-edit").click(); await page.waitForTimeout(150);
  const reopened = (await page.getByTestId("qa-nl-input").inputValue()) === "paid ₹250 to Cafe Mocha yesterday via credit card ending 3445";
  rec("UX2 collapses to the sentence with Edit; each filled field is tagged 'Filled' and the tag clears when it is edited", /Cafe Mocha yesterday/.test(summary) && inputGone && tags0 === 4 && tags1 === 3 && tags2 === 2 && tags3 === 1 && tags4 === 0 && reopened, { summary: summary.slice(0, 50), tags: [tags0, tags1, tags2, tags3, tags4], reopened });
  await ctx.close();
}
// UX3: missing account: Save enabled, tap scrolls to / highlights the Account field with the reason; nothing written
{
  const { ctx, page } = await open([cards.bank, cards.a, cards.twin]);
  await openQuickAdd(page); await fill(page, SENTENCE);
  const opt = await page.getByTestId("qa-account").evaluate(e => ({ shown: e.options[e.selectedIndex].text, color: getComputedStyle(e).color }));
  await page.getByRole("button", { name: /Save Expense/ }).click(); await page.waitForTimeout(700);
  const err = await page.getByTestId("qa-nl-acc-error").innerText().catch(() => "");
  const hl = await page.getByTestId("qa-account").evaluate(e => getComputedStyle(e).outlineStyle !== "none" && parseFloat(getComputedStyle(e).outlineWidth) >= 2);
  const inView = await page.getByTestId("qa-account").evaluate(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  rec("UX3 'Choose account' shown as empty-field text; Save asks 'Choose an account to save', highlights and scrolls to the field, writes nothing", opt.shown === "Choose account" && /Choose an account to save/.test(err) && hl && inView && (await txns(page)).length === 0, { opt, err, hl, inView });
  await ctx.close();
}
// UX4: candidates directly under the Account field, labelled name ··1234, at least 44 px tall
{
  const { ctx, page } = await open([cards.bank, cards.a, cards.twin]);
  await openQuickAdd(page); await fill(page, SENTENCE);
  const info = await page.evaluate(() => { const sel = document.querySelector('[data-testid="qa-account"]').getBoundingClientRect(); const c = [...document.querySelectorAll('[data-testid="qa-nl-candidate"]')].map(b => { const r = b.getBoundingClientRect(); return { t: b.innerText, h: Math.round(r.height), below: r.top >= sel.bottom - 1 }; }); return c; });
  rec("UX4 matching cards sit under the Account field, named with ··last four, each at least 44 px tall", info.length === 2 && info.every(c => c.h >= 44 && c.below && /··3445$/.test(c.t)), { info });
  await ctx.close();
}
// UX5: category suggestion lives inside the Category field as "Name · Suggested" (no "tap to use"); saving without tapping leaves it empty
{
  const { ctx, page } = await open([cards.bank, cards.a]);
  await openQuickAdd(page); await fill(page, "paid ₹250 to Cafe Mocha via credit card ending 3445");
  const chip = await page.getByTestId("qa-nl-suggest-cat").innerText().catch(() => "");
  const inside = await page.getByTestId("qa-nl-suggest-cat").evaluate(e => { const f = e.parentElement.getBoundingClientRect(), c = e.getBoundingClientRect(); return c.left >= f.left && c.right <= f.right + 1 && c.top >= f.top && c.bottom <= f.bottom + 1; });
  await page.getByRole("button", { name: /Save Expense/ }).click(); await page.waitForTimeout(500);
  const saved = await txns(page);
  rec("UX5 suggestion chip sits inside the Category field as 'Name · Suggested'; not applied unless tapped", /· Suggested$/.test(chip) && !/tap to use/i.test(chip) && inside && saved.length === 1 && !saved[0].catId, { chip, inside, catId: saved[0]?.catId });
  await ctx.close();
}
// UX6: the "bank isn't debited" line shows only the first three times
{
  const { ctx, page } = await open([cards.bank, cards.a]);
  const seen = [];
  for (let i = 0; i < 4; i++) { await openQuickAdd(page); await fill(page, SENTENCE); seen.push(await page.getByTestId("qa-nl-resolved").count()); await page.getByRole("button", { name: "Cancel" }).click(); await page.waitForTimeout(250); }
  await openQuickAdd(page); await fill(page, SENTENCE);
  const text = await page.getByTestId("qa-nl-resolved").innerText().catch(() => "");
  rec("UX6 card note appears the first three times only, in the short wording, at least 12 px", JSON.stringify(seen) === "[1,1,1,0]" && text === "" , { seen });
  await ctx.close();
}
{
  const { ctx, page } = await open([cards.bank, cards.a]);
  await openQuickAdd(page); await fill(page, SENTENCE);
  const text = await page.getByTestId("qa-nl-resolved").innerText().catch(() => ""); const px = await fontPx(page, "qa-nl-resolved");
  rec("UX6b card note wording", text === "Recorded against Test Card A ··3445. Your bank isn't debited until the card bill is paid." && px >= 12, { text, px });
  await ctx.close();
}
// UX7: one message at a time, at least 13 px, with an icon
{
  const { ctx, page } = await open([cards.bank, cards.a, cards.twin]);
  await openQuickAdd(page); await fill(page, "paid to Zomato via credit card ending 3445");     // amount missing AND account ambiguous
  const n = await page.locator('[data-testid^="qa-nl-q-"]').count();
  const first = await page.locator('[data-testid^="qa-nl-q-"]').first().evaluate(e => ({ id: e.dataset.testid, px: parseFloat(getComputedStyle(e).fontSize), icon: e.innerText.includes("⚠") }));
  rec("UX7 one amber message at a time (the first open question), at least 13 px, with an icon", n === 1 && first.px >= 13 && first.icon, { n, first });
  await ctx.close();
}
// UX8: refused sentences name what was detected and open the full form with the amount carried over
for (const [text, want, formCheck] of [["paid my credit card bill 5000", /card bill payment/, 5000], ["salary credited 50000", /Income isn't supported here yet/, 50000]]) {
  const { ctx, page } = await open([cards.bank, cards.a]);
  await openQuickAdd(page); await fill(page, text);
  const msg = await page.getByTestId("qa-nl-refused").innerText().catch(() => "");
  await page.getByTestId("qa-nl-open-full").click(); await page.waitForTimeout(900);
  const carried = await inputWithValue(page, String(formCheck));
  rec(`UX8 "${text}": message names it, button opens the full form with ${formCheck} carried over`, want.test(msg) && /Open full form/.test(msg) && carried && (await txns(page)).length === 0, { msg: msg.replace(/\s+/g, " ").slice(0, 90), carried });
  await ctx.close();
}
// G1: no address switch: the typed-entry row is shown whatever the address says (including the old ?nl=0 / ?nl=1).
for (const query of ["", "?nl=0", "?nl=1", "?utm_source=x&nl=0&ref=y", "?foo=bar", "?v=4"]) {
  const { ctx, page } = await open([cards.bank, cards.a], [], query);
  await openQuickAdd(page);
  const n = await page.getByTestId("qa-nl-input").count();
  rec(`G1 ${query || "(plain address)"} -> typed entry shown`, n === 1, { n });
  await ctx.close();
}
// G2: ordinary keyboard entry is unchanged next to the typed row.
{
  const { ctx, page } = await open([cards.bank, cards.a], [], "");
  await openQuickAdd(page);
  await page.getByPlaceholder("0", { exact: true }).fill("120"); await page.getByPlaceholder("e.g. Petrol, Swiggy, Netflix", { exact: true }).fill("Tea");
  const acc = await page.getByTestId("qa-account").inputValue();
  await page.getByRole("button", { name: /Save Expense/ }).click(); await page.waitForTimeout(500);
  const saved = await txns(page);
  rec("G2 ordinary entry beside the typed row: default account preselected, one entry saved", acc === "b1" && saved.length === 1 && saved[0].amount === 120, { acc, n: saved.length });
  await ctx.close();
}
// G3: reload and in-app navigation keep it; nothing is stored about it.
{
  const { ctx, page } = await open([cards.bank, cards.a], [], "");
  await openQuickAdd(page); const first = await page.getByTestId("qa-nl-input").count();
  await page.getByRole("button", { name: "Cancel" }).click(); await page.waitForTimeout(300);
  const visited = [];
  for (const tab of ["Payments", "People", "Home"]) { await page.locator("span", { hasText: new RegExp(`^${tab}$`) }).last().click(); await page.waitForTimeout(400); visited.push(tab); }
  await openQuickAdd(page); const afterNav = await page.getByTestId("qa-nl-input").count();
  await page.reload(); await page.waitForTimeout(900);
  for (let i = 0; i < 2; i++) if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (const d of ["1", "2", "3", "4"]) { await page.getByRole("button", { name: d, exact: true }).click(); await page.waitForTimeout(60); } await page.waitForTimeout(500); }
  await openQuickAdd(page); const afterReload = await page.getByTestId("qa-nl-input").count();
  const stored = await page.evaluate(() => Object.keys(localStorage).filter(k => /\bnl\b|nl_/i.test(k) && !/arth_nl_card_note_seen/.test(k)));
  rec("G3 typed entry survives in-app navigation and reload; no setting stored", first === 1 && visited.length === 3 && afterNav === 1 && afterReload === 1 && stored.length === 0, { first, visited, afterNav, afterReload, storedKeys: stored });
  await ctx.close();
}
await browser.close();
rec("SAFE no non-local requests reached the network", blocked.filter(u => /supabase/.test(u)).length === 0, { blockedNonLocal: [...new Set(blocked.map(u => new URL(u).hostname))] });
console.log("\noutcome vector:", JSON.stringify(results));
process.exit(results.every(r => r.pass) ? 0 : 1);
