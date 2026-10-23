// Breaking an itemised expense up by item for a person or a group, in the real app (Chromium, local dev server, SYNTHETIC data). Chromium only: says nothing about Android.
//   Setup: npx vite --port 5203 --strictPort &     Run: node tools/invoice-import/itemised-people-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const APP = process.env.NL_APP || "http://localhost:5203/";
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function open(splitMode) {
  const ctx = await browser.newContext({ timezoneId: "Asia/Kolkata", viewport: { width: 420, height: 900 } });
  await ctx.route(u => { try { return !["localhost", "127.0.0.1"].includes(new URL(u).hostname); } catch { return false; } }, r => r.abort());
  await ctx.addInitScript(sm => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
    localStorage.setItem("arth_accounts", JSON.stringify([{ id: "b1", name: "Test Bank", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]));
    localStorage.setItem("arth_people", JSON.stringify([{ id: "me", name: "Me", isMe: true, emoji: "🙂", color: "#22c55e" }, { id: "p1", name: "Vyom", emoji: "👤", color: "#06b6d4" }]));
    localStorage.setItem("arth_groups", JSON.stringify([{ id: "g1", name: "Family", icon: "👪", color: "#f59e0b", members: ["me", "p1"] }]));
    localStorage.setItem("arth_txns", JSON.stringify([{ id: "t1", type: "expense", merchant: "Blinkit", desc: "Blinkit", date: "2026-10-20", amount: 300, accId: "b1", catId: "groceries", catIds: ["groceries"], subIds: [], people: {}, splitMode: sm, trackingMode: sm,
      lineItems: [{ id: "l1", label: "Atta", qty: 2, unitPrice: 100, amount: 200, catId: "groceries", subId: null, splits: null }, { id: "l2", label: "Milk", qty: 1, unitPrice: 100, amount: 100, catId: "groceries", subId: null, splits: null }] }]));
    localStorage.setItem("arth_master_user_setup_complete", "true"); localStorage.setItem("arth_vehicles", "[]"); }, splitMode);
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(APP); await page.waitForTimeout(900);
  for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(120); } await page.waitForTimeout(500); } }
  await page.getByText("Blinkit").first().click(); await page.waitForTimeout(600);
  await page.getByText(/^Edit$|✏️ Edit|Edit/).first().click().catch(() => {}); await page.waitForTimeout(500);
  await page.getByText(/^Details/).first().click().catch(() => {}); await page.waitForTimeout(400);
  return { ctx, page, errors, store: k => page.evaluate(x => JSON.parse(localStorage.getItem(x) || "[]"), k) };
}
const who = page => page.getByText("Who is this for?").locator("xpath=..");
async function addTarget(page, name) { await page.getByText("+ Add person or group").click(); await page.getByPlaceholder("Search person or group...").fill(name); await who(page).getByRole("button", { name: new RegExp(name) }).first().click(); await page.waitForTimeout(300); }
const qtyInputs = page => page.locator('input[type="number"][max]');

// ---- A: an expense saved with "no split" (Quick Add / invoice import) now offers person and group breakup ----
{ const s = await open("none"); const { page } = s;
  rec("PG1 editing an expense saved with no split shows 'Who is this for?' and '+ Add person or group'", (await page.getByText("Who is this for?").count()) === 1 && (await page.getByText("+ Add person or group").count()) === 1, {});
  await addTarget(page, "Vyom");
  rec("PG2 'Link to specific items instead' opens a quantity box for every item line", (await page.getByText(/Link to specific items instead/).count()) === 1, {});
  await page.getByText(/Link to specific items instead/).click(); await page.waitForTimeout(300);
  rec("PG3 two quantity boxes (Atta 2, Milk 1) appear, and the button now offers the way back", (await qtyInputs(page).count()) === 2 && (await page.getByText(/Use flat amount instead/).count()) === 1, {});
  await qtyInputs(page).nth(0).fill("1"); await qtyInputs(page).nth(1).fill("1"); await page.waitForTimeout(300);
  rec("PG4 the person's share is worked out from the items: 1 Atta + 1 Milk = ₹200", /₹200 \(from items\)/.test(await page.locator("body").innerText()), {});
  await page.locator('button[title="Collect"]').first().click(); await page.waitForTimeout(200);          // the app asks you to choose Attribute / Own / Collect for a person
  const beforeSave = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  if (process.env.DEBUG) { const k = beforeSave.indexOf("Total allocated"); console.log("BEFORE SAVE:", beforeSave.slice(Math.max(0, k - 200), k + 120)); }
  await page.getByText(/Save Changes/).click(); await page.waitForTimeout(2500);
  if (process.env.DEBUG) console.log("TXNS:", JSON.stringify((await s.store("arth_txns")).map(x => [x.id, x.amount, x.splitMode, Object.keys(x.people || {}), (x.allocations || []).length])));
  const t = (await s.store("arth_txns")).find(x => x.id === "t1");
  const p1 = (t.people || {}).p1, al = (t.allocations || []).find(a => a.targetId === "p1");
  if (process.env.DEBUG) { console.log("SAVED:", JSON.stringify({ people: t.people, allocations: t.allocations, splitMode: t.splitMode, lineItems: t.lineItems && t.lineItems.length }).slice(0, 700)); console.log("BODY:", (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400)); }
  rec("PG5 saved: the person's amount is ₹200 (from the items), the expense total and its lines are unchanged", t.amount === 300 && t.lineItems.length === 2 && ((p1 && p1.amount === 200) || (al && al.amount === 200)), { p1, al, amount: t.amount });
  rec("PG6 the saved record remembers which items went to the person (qty per line)", JSON.stringify(t).includes('"sourceItemId":"l1"') && JSON.stringify(t).includes('"sourceItemId":"l2"'), {});
  rec("PG7 no page errors", s.errors.length === 0, s.errors.slice(0, 2));
  await s.ctx.close(); }

// ---- B: a group takes items too; the flat amount can be restored; too many units is refused ----
{ const s = await open("none"); const { page } = s;
  await addTarget(page, "Family"); await page.getByText(/Link to specific items instead/).click(); await page.waitForTimeout(300);
  await qtyInputs(page).nth(0).fill("2"); await page.waitForTimeout(200);
  rec("PG8 a group can take items by quantity (2 Atta = ₹200 from items)", /₹200 \(from items\)/.test(await page.locator("body").innerText()), {});
  await page.getByText(/Use flat amount instead/).click(); await page.waitForTimeout(300);
  rec("PG9 'Use flat amount instead' brings back the single amount box and clears the item quantities", (await qtyInputs(page).count()) === 0 && (await page.getByText(/Link to specific items instead/).count()) === 1, {});
  await page.getByText(/Link to specific items instead/).click(); await page.waitForTimeout(200);
  await qtyInputs(page).nth(0).fill("3"); await page.waitForTimeout(200);
  await page.getByText(/Save Changes/).click(); await page.waitForTimeout(800);
  const t = (await s.store("arth_txns")).find(x => x.id === "t1");
  rec("PG10 asking for 3 of the 2 bought Atta is refused with a message and nothing is saved", /exceeds bought qty/.test(await page.locator("body").innerText()) && !(t.allocations || []).length && !Object.keys(t.people || {}).length, {});
  await s.ctx.close(); }

// ---- C: an expense that already had the split mode still works the same ----
{ const s = await open("allocate"); const { page } = s;
  await addTarget(page, "Vyom"); await page.getByText(/Link to specific items instead/).click(); await page.waitForTimeout(200);
  rec("PG11 an expense already in allocate mode behaves the same (two quantity boxes)", (await qtyInputs(page).count()) === 2, {});
  await s.ctx.close(); }

console.log("outcome vector:", JSON.stringify(results));
await browser.close(); process.exit(results.every(r => r.pass) ? 0 : 1);
