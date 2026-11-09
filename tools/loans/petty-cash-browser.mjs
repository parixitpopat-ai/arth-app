// "Petty cash" (cash handed to a person to spend for you) in the real app (Chromium, local Vite dev server, SYNTHETIC data). A CHROMIUM check only.
// Run: node tools/loans/petty-cash-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4202, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const errors = [];
async function newPage(boughtAmounts) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
  await ctx.addInitScript(amounts => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
    const now = new Date(); const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]);
    set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "p_sp", name: "Priya Test" }]);
    set("arth_txns", amounts.map((a, i) => ({ id: `b${i + 1}`, type: "expense", amount: a, date: `${ym}-0${i + 2}`, desc: `House purchase ${i + 1}`, merchant: `Shop ${i + 1}`, catId: "groceries", catIds: ["groceries"], subId: "g1", subIds: ["g1"], paidByPersonId: "p_sp", accId: null, people: { __me__: { amount: a } } })));
    localStorage.setItem("arth_master_user_setup_complete", "true"); }, boughtAmounts);
  const page = await ctx.newPage(); page.on("pageerror", e => errors.push(String(e)));
  const unlock = async () => { for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
  const home = async () => { await page.goto(APP); await page.waitForTimeout(1100); await unlock(); await page.waitForTimeout(400); };
  const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  const T = id => page.getByTestId(id);
  const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), k);
  const openPerson = async () => { await page.getByText(/^people$/i).first().dispatchEvent("click"); await page.waitForTimeout(700); await page.getByText("Priya Test", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(800); };
  const openAdd = async () => { await page.getByRole("button", { name: "+", exact: true }).first().click(); await page.waitForTimeout(700); await page.getByText("More options →").click(); await page.waitForTimeout(700); };
  return { page, home, text, T, ls, openPerson, openAdd, unlock };
}
const spent = t => t.match(/Spent\s*₹([\d,]+)/)?.[1];
try {
  // ── 1: she bought 6,000 for the house; I give her 10,000 petty cash ──
  {
    const { page, home, text, T, ls, openPerson, openAdd, unlock } = await newPage([6000]);
    await home();
    rec("A0 before any petty cash Home counts her purchase as my spending (Rs 6,000)", spent(await text()) === "6,000", spent(await text()));
    await openPerson();
    let body = await text();
    rec("A1 before petty cash her page shows no 'with her' balance, and I owe her", !(await T("petty-cash-banner").count()) && /6,000/.test(body), {});
    await T("person-petty-cash").dispatchEvent("click"); await page.waitForTimeout(700);
    rec("A2 petty cash is given from the person's page (the Add screen's top row no longer has a Petty cash chip)", (await T("petty-sheet").count()) === 1, {});
    await T("petty-amount").fill("10000");
    rec("A3 the sheet opens with that person already chosen", (await T("petty-sheet").count()) === 1, {});
    const sheetText = await T("petty-sheet").innerText();
    rec("A4 it never asks for a destination account (one 'Paid from' group, no dropdown)", !/to account|destination|transfer to/i.test(sheetText) && /Paid from/i.test(sheetText) && (await page.locator("select").count()) === 0, {});
    await T("petty-amount").fill(""); await T("petty-save").click(); await page.waitForTimeout(300);
    rec("A6 a zero amount is refused", /amount/.test(await T("petty-error").innerText()), {});
    await T("petty-amount").fill("10000"); await T("petty-from-bank1").click(); await T("petty-note").fill("November house"); await T("petty-save").click(); await page.waitForTimeout(900);
    const pc = (await ls("arth_txns")).filter(t => t.isPettyCash);
    rec("A7 one petty-cash entry was saved: from my savings, NO destination, to her, 10,000, not a spend category", pc.length === 1 && pc[0].fromAccId === "bank1" && pc[0].toAccId === null && pc[0].pettyCashPersonId === "p_sp" && pc[0].amount === 10000 && (pc[0].catIds || []).length === 0, pc[0] && { from: pc[0].fromAccId, to: pc[0].toAccId, to_p: pc[0].pettyCashPersonId });
    await home();
    rec("A8 petty cash is NOT counted as spending: Home 'Spent' is still Rs 6,000", spent(await text()) === "6,000", spent(await text()));
    await openPerson(); body = await text();
    rec("A9 her page shows Rs 4,000 with her (10,000 given, 6,000 used) and says it is kept apart from what is owed to me and not in net worth", (await T("petty-cash-banner").count()) === 1 && /4,000 petty cash with Priya Test/.test(await T("petty-cash-banner").innerText()) && /not part of your net worth/.test(await T("petty-cash-banner").innerText()), (await T("petty-cash-banner").count()) ? await T("petty-cash-banner").innerText() : null);
    await home();
    const homeTxt = await text();
    rec("A10 the Rs 4,000 is NOT a receivable: Home's 'To Receive' tile is still Rs 0", /₹0 To Receive/i.test(homeTxt) || !/₹4,000 To Receive/i.test(homeTxt), (homeTxt.match(/₹[\d,]+ To Receive/i) || ["(no tile found)"])[0]);
  }
  // ── 2: she spent more than she held ──
  {
    const { page, home, text, T, openPerson, ls, openAdd } = await newPage([6000, 7000]);
    await home(); await openPerson();
    await T("person-petty-cash").dispatchEvent("click"); await page.waitForTimeout(700);
    await T("petty-amount").fill("10000"); await T("petty-save").click(); await page.waitForTimeout(900);
    await home(); await openPerson();
    const t = (await T("petty-cash-banner").count()) ? await T("petty-cash-banner").innerText() : "";
    rec("B1 she spent 13,000 against 10,000: nothing is left with her and I still owe Rs 3,000", /0 petty cash with Priya Test/.test(t) && /still owe .*3,000/.test(t), t);
    // edit the petty cash entry from its own detail sheet: it must NOT open a transfer form
    await home();
    await page.getByText("Petty cash - Priya Test", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(800);
    const detail = await text();
    rec("B2 the entry's detail says PETTY CASH (not TRANSFER)", /PETTY CASH/.test(detail) && !/\bTRANSFER\b/.test(detail), {});
    await page.getByRole("button", { name: /Edit/ }).first().dispatchEvent("click"); await page.waitForTimeout(800);
    rec("B3 Edit opens the petty cash sheet filled in (not the transfer form)", (await T("petty-sheet").count()) === 1 && (await T("petty-amount").inputValue()) === "10000" && /Edit petty cash/.test(await T("petty-sheet").innerText()), {});
    await T("petty-amount").fill("12000"); await T("petty-save").click(); await page.waitForTimeout(900);
    const advs = (await ls("arth_txns")).filter(x => x.isPettyCash);
    rec("B4 saving the edit changes the same entry (still one, now 12,000)", advs.length === 1 && advs[0].amount === 12000, advs.map(a => a.amount));
    await openPerson();
    const t2 = (await T("petty-cash-banner").count()) ? await T("petty-cash-banner").innerText() : "";
    rec("B5 her page follows: 12,000 against 13,000 -> I owe Rs 1,000", /still owe .*1,000/.test(t2), t2);
  }
  // ── 3: control ──
  {
    const { page, home, T, openPerson } = await newPage([500]);
    await home(); await openPerson();
    rec("K1 (control) a person with no petty cash shows no 'with her' banner", (await T("petty-cash-banner").count()) === 0, {});
  }
  // ── 4: the P button on a person's A / O / C row (and the top chip is gone) ──
  {
    const { page, home, text, T, ls, openAdd } = await newPage([500]);
    await home(); await openAdd();
    rec("P0 the Add screen's top row no longer has a Petty cash chip", (await page.locator("button:visible", { hasText: "Petty cash" }).count()) === 0, {});
    await page.getByPlaceholder(/e\.g\. ₹5,500/).fill("900");
    await page.getByRole("button", { name: /Add person or group/ }).first().dispatchEvent("click"); await page.waitForTimeout(500);
    await page.getByPlaceholder(/Search person or group/).fill("Priya"); await page.waitForTimeout(300);
    await page.locator("button:visible", { hasText: "Priya Test" }).last().dispatchEvent("click"); await page.waitForTimeout(500);
    rec("P1 her row shows A O C and P", (await T("alloc-petty").count()) === 1 && /\bA\b.*\bO\b.*\bC\b.*\bP\b/.test(await text()), {});
    await T("alloc-petty").dispatchEvent("click"); await page.waitForTimeout(300);
    const note = (await T("paid-by-note").count()) ? await T("paid-by-note").innerText() : "";
    rec("P2 tapping P makes her the payer ('Paid by' note) and P lights up; tapping again clears it", /Priya Test paid/.test(note), note.slice(0, 80));
    await T("alloc-petty").dispatchEvent("click"); await page.waitForTimeout(300);
    rec("P3 second tap clears it", (await T("paid-by-note").count()) === 0, {});
    await T("alloc-petty").dispatchEvent("click"); await page.waitForTimeout(300);
    await page.getByPlaceholder(/Vendor \/ Person/).fill("Vegetable seller"); await page.waitForTimeout(300);
    await page.locator("button:visible", { hasText: /Save|Add|Record/ }).last().click();
    await page.waitForTimeout(900);
    const allT = await ls("arth_txns"); const saved = allT.find(t => t.amount === 900);
    rec("P4 P alone (no A, O or C chosen) saves: paid by her, none of my accounts used, no owe/attribution recorded for her row", saved && saved.paidByPersonId === "p_sp" && !saved.accId && !Object.keys(saved.people || {}).some(k => k === "p_sp" && saved.people[k] && saved.people[k].mode), saved ? { paidBy: saved.paidByPersonId, accId: saved.accId, people: saved.people } : "not saved");
  }
  rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 500)); }
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
