// Charges (handling, delivery, platform fee…) on an itemised expense shared equally by the number of splits, in the real app (Chromium, local dev server, SYNTHETIC data). Chromium only: says nothing about Android.
//   Setup: npx vite --port 5203 --strictPort &     Run: node tools/invoice-import/itemised-people-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const APP = process.env.NL_APP || "http://localhost:5203/";
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function open(splitMode, noEdit = false) {
  const ctx = await browser.newContext({ timezoneId: "Asia/Kolkata", viewport: { width: 420, height: 900 } });
  await ctx.route(u => { try { return !["localhost", "127.0.0.1"].includes(new URL(u).hostname); } catch { return false; } }, r => r.abort());
  await ctx.addInitScript(sm => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
    localStorage.setItem("arth_accounts", JSON.stringify([{ id: "b1", name: "Test Bank", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]));
    localStorage.setItem("arth_people", JSON.stringify([{ id: "me", name: "Me", isMe: true, emoji: "🙂", color: "#22c55e" }, { id: "p1", name: "Vyom", emoji: "👤", color: "#06b6d4" }, { id: "p2", name: "Asha", emoji: "👤", color: "#a855f7" }]));
    localStorage.setItem("arth_groups", JSON.stringify([{ id: "g1", name: "Family", icon: "👪", color: "#f59e0b", members: ["me", "p1"] }]));
    localStorage.setItem("arth_txns", JSON.stringify([{ id: "t1", type: "expense", merchant: "Blinkit", desc: "Blinkit", date: "2026-10-20", amount: 93, accId: "b1", catId: "groceries", catIds: ["groceries"], subIds: [], people: {}, splitMode: sm, trackingMode: sm,
      lineItems: [{ id: "l1", label: "Chips", qty: 2, unitPrice: 20, amount: 40, catId: "groceries", subId: null, splits: null }, { id: "l2", label: "Coke", qty: 1, unitPrice: 40, amount: 40, catId: "groceries", subId: null, splits: null },
        { id: "l3", label: "Handling charge", qty: 1, unitPrice: 13, amount: 13, catId: "groceries", subId: null, splits: null, kind: "charge", chargeType: "handling" }] }]));
    localStorage.setItem("arth_master_user_setup_complete", "true"); localStorage.setItem("arth_vehicles", "[]"); }, splitMode);
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(APP); await page.waitForTimeout(900);
  for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(120); } await page.waitForTimeout(500); } }
  await page.getByText("Blinkit").first().click(); await page.waitForTimeout(600);
  if (noEdit) { await page.getByText(/^Details/).first().click().catch(() => {}); await page.waitForTimeout(400); }
  if (noEdit) return { ctx, page, errors, store: k => page.evaluate(x => JSON.parse(localStorage.getItem(x) || "[]"), k) };
  await page.getByText(/^Edit$|✏️ Edit|Edit/).first().click().catch(() => {}); await page.waitForTimeout(500);
  await page.getByText(/^Details/).first().click().catch(() => {}); await page.waitForTimeout(400);
  return { ctx, page, errors, store: k => page.evaluate(x => JSON.parse(localStorage.getItem(x) || "[]"), k) };
}
const who = page => page.getByText("Who is this for?").locator("xpath=..");
async function addTarget(page, name) { await page.getByText("+ Add person or group").click(); await page.getByPlaceholder("Search person or group...").fill(name); await who(page).getByRole("button", { name: new RegExp(name) }).first().click(); await page.waitForTimeout(300); }
const qtyInputs = page => page.locator('input[type="number"][max]');


const body = page => page.locator("body").innerText().then(t => t.replace(/\s+/g, " "));
{ const s = await open("none"); const { page } = s;
  rec("CS1 the handling line shows as a charge, and the charges breakup lists it", (await page.getByText("Charge", { exact: true }).count()) >= 1 && /CHARGES IN THIS EXPENSE/i.test(await body(page)) && /Handling charge ₹13/.test(await body(page)), {});
  await addTarget(page, "Vyom"); await page.getByText(/Link to specific items instead/).click(); await page.waitForTimeout(300);
  rec("CS2 a charge line cannot be given to a person as an item (only Chips and Coke have quantity boxes)", (await qtyInputs(page).count()) === 2, { n: await qtyInputs(page).count() });
  await qtyInputs(page).nth(0).fill("1"); await qtyInputs(page).nth(1).fill("1"); await page.waitForTimeout(200);
  await addTarget(page, "Asha"); await page.getByText(/Link to specific items instead/).click(); await page.waitForTimeout(300);
  await qtyInputs(page).nth(2).fill("1"); await page.waitForTimeout(300);
  let t = await body(page);
  rec("CS3 charges are shared equally between 3 splits, you included (your part ₹4.34 with the odd paisa)", /Charges ₹13 are shared equally between 3 splits, you included \(your part ₹4\.34\)/.test(t), { t: t.slice(t.indexOf("Charges ₹"), t.indexOf("Charges ₹") + 120) });
  rec("CS4 Vyom: items ₹60 + charges ₹4.33 = ₹64.33; Asha: items ₹20 + charges ₹4.33 = ₹24.33", /₹64\.33 \(items ₹60 \+ charges ₹4\.33\)/.test(t) && /₹24\.33 \(items ₹20 \+ charges ₹4\.33\)/.test(t), {});
  rec("CS5 total allocated is the two people's amounts, out of ₹93", /Total allocated: ₹88\.66 of ₹93/.test(t), {});
  await page.locator('button[title="Collect"]').nth(0).click(); await page.locator('button[title="Collect"]').nth(1).click(); await page.waitForTimeout(200);
  await page.getByTestId("charge-include-me").uncheck(); await page.waitForTimeout(300);
  t = await body(page);
  rec("CS6 'Count me in' off: 2 splits, ₹6.50 each, Vyom ₹66.50", /shared equally between 2 splits/.test(t) && /₹66\.50 \(items ₹60 \+ charges ₹6\.50\)/.test(t), {});
  await page.getByTestId("charge-include-me").check(); await page.waitForTimeout(200);
  await page.getByText(/Save Changes/).click(); await page.waitForTimeout(2500);
  const tx = (await s.store("arth_txns")).find(x => x.id === "t1");
  const av = (tx.allocations || []).find(a => a.targetId === "p1"), aa = (tx.allocations || []).find(a => a.targetId === "p2");
  rec("CS7 saved: Vyom 64.33 and Asha 24.33 (charge part 4.33 each); the expense total 93 and its lines are unchanged", tx.amount === 93 && tx.lineItems.length === 3 && av && av.amount === 64.33 && av.chargeAmount === 4.33 && aa && aa.amount === 24.33, { av: av && [av.amount, av.chargeAmount], aa: aa && aa.amount });
  rec("CS8 the people's amounts on the expense agree (Vyom 64.33, Asha 24.33)", tx.people && tx.people.p1 && tx.people.p1.amount === 64.33 && tx.people.p2 && tx.people.p2.amount === 24.33, { p: tx.people });
  const h = tx.lineItems.find(l => l.id === "l3");
  rec("CS9 the handling line is still a charge after saving, and 'count me' is remembered", h && h.kind === "charge" && h.chargeType === "handling" && tx.chargeIncludeMe === true, { h });
  rec("CS10 no page errors", s.errors.length === 0, s.errors.slice(0, 2));
  await s.ctx.close(); }

// ---- adding a charge by hand on an itemised expense ----
{ const s = await open("none"); const { page } = s;
  await page.getByText("+ Add item").click(); await page.waitForTimeout(400);
  await page.getByPlaceholder("e.g. Milk, Petrol, Shampoo").fill("Platform fee");
  await page.getByTestId("line-kind").selectOption("platform");
  const note = await body(page);
  rec("CS11 the item sheet can mark a line as a charge, and says how it is shared", /A charge is shared equally between the people and groups/.test(note), {});
  rec("CS12 no page errors while adding", s.errors.length === 0, s.errors.slice(0, 2));
  await s.ctx.close(); }

{ const s = await open("none", true); const { page } = s;
  const t = await body(page);
  rec("CS13 the expense's detail view shows the charges breakup (Handling charge ₹13)", /Charges in this expense/i.test(t) && /Handling charge ₹13/.test(t), { t: t.slice(t.search(/Charges in this/i), t.search(/Charges in this/i) + 80) });
  await s.ctx.close(); }

{ const s = await open("none"); const { page } = s;
  const first = await page.locator('[data-testid^="item-calc-"]').first().getAttribute("data-testid");
  rec("CS14 the charge line is listed first in the items, above Chips and Coke", first === "item-calc-l3", { first });
  await s.ctx.close(); }

console.log("outcome vector:", JSON.stringify(results));
await browser.close(); process.exit(results.every(r => r.pass) ? 0 : 1);
