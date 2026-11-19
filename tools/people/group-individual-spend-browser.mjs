// Group page: Individual Spend lists EVERY member and counts shares recorded on bills (once), the budget card names its month, and each tile names its time range.
// SYNTHETIC data (an invented group), real app in Chromium. A CHROMIUM check only, not a phone.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4301, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "bank1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "r", name: "Ravi" }, { id: "s", name: "Sunny" }, { id: "m", name: "Mangal" }, { id: "g", name: "Guru" }, { id: "n", name: "Nisha" }]);
  const owes = (amount, settledAmt = 0) => ({ amount, mode: "owes", settled: settledAmt >= amount, settledAmt, remainingAmt: Math.max(0, amount - settledAmt) });
  set("arth_groups", [{ id: "fam", name: "Sample Family", icon: "🏠", color: "#16a34a", typeId: "other", type: "Relatives", members: ["r", "s", "m", "g", "n"], includeMe: false, manualLimit: 0, defaultIntent: "split", modules: [] }]);
  set("arth_bills", [
    { id: "b1", name: "Electricity", merchant: "Electricity", groupId: "fam", billDate: "2026-07-27", dueDate: "2026-09-09", status: "unpaid", amount: 9000, createdDate: "2026-07-27", splitPeople: { r: owes(3000), s: owes(2000), m: owes(1500), g: owes(1000) } },
    { id: "b2", name: "Water", merchant: "Water", groupId: "fam", billDate: "2026-07-27", dueDate: "2026-08-02", status: "paid", amount: 3000, createdDate: "2026-07-27", paidByTxnId: "tw", splitPeople: { r: owes(1000), s: owes(500) } },
    { id: "b3", name: "Lift", merchant: "Lift", groupId: "fam", billDate: "2026-08-02", dueDate: "2026-08-20", status: "paid", amount: 500, createdDate: "2026-08-02", paidByTxnId: "te", splitPeople: { g: owes(200) } }]);
  set("arth_txns", [
    { id: "tw", type: "expense", date: "2026-08-02", desc: "Water", amount: 3000, accId: "bank1", paidBillId: "b2", isBillPayment: true, people: { r: owes(1000), s: owes(500) } },          // payment entry NOT tagged to the group
    { id: "te", type: "expense", date: "2026-08-20", desc: "Lift", amount: 500, accId: "bank1", paidBillId: "b3", isBillPayment: true, groupId: "fam", people: { g: owes(200) } },      // payment entry that IS in the group's transactions: counted once
    { id: "e1", type: "expense", date: "2026-07-04", desc: "Plumber", amount: 800, accId: "bank1", groupId: "fam", people: { r: owes(800) } }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(500); } } };
try {
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.getByText(/^people$/i).last().dispatchEvent("click"); await page.waitForTimeout(900);
  await page.getByText(/Groups/).first().dispatchEvent("click"); await page.waitForTimeout(700);
  await page.getByText("Sample Family", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(1000);
  const t = await text();
  const at = t.search(/individual spend/i), sect = t.slice(at, at + 400);
  rec("G1 Individual Spend lists every member, including one with nothing", ["Ravi", "Sunny", "Mangal", "Guru", "Nisha"].every(n => sect.includes(n)), sect);
  const amt = n => { const m = new RegExp(`${n} ₹([\\d,]+)`).exec(sect); return m ? Number(m[1].replace(/,/g, "")) : null; };
  rec("G2 amounts include shares recorded on bills: Ravi 4,800 (bill 3,000 + water 1,000 + expense 800), Sunny 2,500, Mangal 1,500, Nisha 0", amt("Ravi") === 4800 && amt("Sunny") === 2500 && amt("Mangal") === 1500 && amt("Nisha") === 0, { r: amt("Ravi"), s: amt("Sunny"), m: amt("Mangal"), n: amt("Nisha") });
  rec("G3 a paid bill whose payment entry is already a group transaction is counted ONCE: Guru 1,200 (bill 1,000 + lift 200), not 1,400", amt("Guru") === 1200, amt("Guru"));
  const spent = await T("group-spent").innerText();
  rec("G4 the budget card says which month it is for", /Spent in [A-Z][a-z]{2} 20\d\d:/.test(spent), spent);
  rec("G5 each tile names its time range", /FY 2026-27 · expenses only/.test(t) && /FY 2026-27 · after others' shares/.test(t) && (t.match(/all time, unpaid/g) || []).length >= 2, {});
  const owesTexts = await T("member-owes").allInnerTexts();
  const flat = owesTexts.join(" | ").replace(/\s+/g, " ");
  rec("G7 each member tile shows what that person owes you in TOTAL (as on the People tab) and how much of it is tagged to this group: Ravi 4,800 in total, 3,800 tagged (the water share is on a payment entry not tagged to the group)", /Owes you ₹4,800 in total ₹3,800 of it tagged to this group/.test(flat) && /Owes you ₹2,500 in total ₹2,000 of it tagged/.test(flat) && /Owes you ₹1,200 in total ₹1,200 of it tagged/.test(flat), flat);
  rec("G8 a member who owes nothing says so", /Owes you nothing/.test(flat), flat);
  const split = await T("group-owes-split").innerText();
  rec("G9 Group owes is ONLY what is tagged to the group (₹8,500), not clubbed with members' own untagged shares; the line says so and gives what the members owe in total (₹10,000)", /Group owes ₹8,500: only what is tagged to this group \(₹8,500 from members\)/.test(split) && /outside the group is not in it/.test(split) && /₹10,000 in total/.test(split), split);
  rec("G10 the header and the Request button use the same group-only figure (₹8,500)", /₹8,500 owes you/.test(t) && /Request ₹8,500 from group/.test(t), {});
  rec("G6 the existing You owe tile and Statement button are still there", (await T("group-you-owe").count()) === 1 && (await T("group-statement").count()) === 1, {});
} catch (e) { rec("RUN", false, String(e).slice(0, 500)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
console.log(results.every(r => r.pass) ? "ALL PASS" : "SOME FAILED"); process.exit(results.every(r => r.pass) ? 0 : 1);
