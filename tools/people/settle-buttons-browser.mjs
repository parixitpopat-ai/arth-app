// Both Settle buttons on a person's profile open something when tapped (a real touch tap): the red one (you owe them) opens the Settle sheet; the green one (they owe you through a "they owe me back" tag) opens "Someone paid me back" for that person, and saving settles it. SYNTHETIC data, real app in Chromium. Run: node tools/people/settle-buttons-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4605, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const day = n => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
async function open(txns) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(([d, tx]) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01" }, { id: "c1", name: "Test Cash", type: "cash", openingBalance: 1000, openingBalanceDate: "2026-01-01" }]);
    set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "x", name: "Xena", emoji: "🙂" }]);
    set("arth_txns", tx.map(t => ({ ...t, date: d }))); set("arth_bills", []); localStorage.setItem("arth_master_user_setup_complete", "true"); }, [day(-1), txns]);
  const p = await ctx.newPage(); const errors = []; p.on("pageerror", e => errors.push(String(e)));
  await p.goto(APP); await p.waitForTimeout(1300);
  for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).tap(); await p.waitForTimeout(100); } await p.waitForTimeout(500); }
  await p.getByText(/^people$/i).last().tap(); await p.waitForTimeout(900);
  await p.getByText(/^\S*\s*Xena$/).first().tap(); await p.waitForTimeout(1000);
  await p.getByText("FINANCIAL POSITION", { exact: true }).first().tap().catch(() => {}); await p.waitForTimeout(700);
  return { p, errors, body: async () => (await p.locator("body").innerText()).replace(/\s+/g, " "), txns: () => p.evaluate(() => JSON.parse(localStorage.getItem("arth_txns") || "[]")) };
}
// A: you owe her 220 (she paid 500 against a 280 debt): the red Settle
{
  const a = await open([{ id: "e1", type: "expense", desc: "Goods for Xena", amount: 280, accId: "b1", catId: "shopping", catIds: ["shopping"], trackingMode: "split", people: { x: { amount: 280, mode: "owes", settled: true, remainingAmt: 0, settledAmt: 280 } } },
    { id: "s1", type: "settlement_in", desc: "Xena paid", amount: 500, appliedAmount: 280, extraAmount: 220, accId: "c1", fromPersonId: "x", settlementLinks: [{ kind: "txn", id: "e1", personId: "x", amount: 280 }] }]);
  await a.p.getByTestId("person-payback").scrollIntoViewIfNeeded(); await a.p.getByTestId("person-payback").tap(); await a.p.waitForTimeout(800);
  rec("S1 a tap on the red Settle (you owe her) opens the 'Settle with Xena' sheet", (await a.p.getByTestId("payback-modal").count()) === 1 && /Settle with Xena/.test(await a.body()), {});
  rec("Z1 no page errors (A)", a.errors.length === 0, a.errors.slice(0, 2));
}
// B: she owes you 500 through a "they owe me back" tag (no per-person share): the green Settle
{
  const c = await open([{ id: "e2", type: "expense", desc: "Lunch for Xena", merchant: "Test Cafe", amount: 500, accId: "b1", catId: "food", catIds: ["food"], forPerson: "x", tagMode: "person", tagPersonAmount: 500 }]);
  const settle = c.p.getByRole("button", { name: /^Settle$/ });
  rec("S2 the profile shows 'Owes you ₹500' and one Settle button", /Owes you ₹500/.test(await c.body()) && (await settle.count()) === 1, await settle.count());
  await settle.first().scrollIntoViewIfNeeded(); await settle.first().tap(); await c.p.waitForTimeout(900);
  const f = await c.body();
  rec("S3 a tap on the green Settle opens 'Someone paid me back' with Xena chosen and the lunch listed as a due", /WHAT IS IT\?/i.test(f) && /Lunch for Xena/.test(f) && /Xena/.test(f), f.match(/PERSON \(OPTIONAL\)[^R]{0,120}/)?.[0]);
  await c.p.getByPlaceholder(/e\.g\. ₹5,500|0/).first().fill("500"); await c.p.waitForTimeout(500);
  await c.p.getByText("💵 Test Cash").last().tap(); await c.p.waitForTimeout(400);
  await c.p.getByRole("button", { name: /Save|Add ✓/ }).last().tap(); await c.p.waitForTimeout(1200);
  const r = (await c.txns()).find(x => x.type === "settlement_in");
  rec("S4 saving settles it: ₹500 into cash, ₹500 applied to the lunch, no extra", r && r.accId === "c1" && r.appliedAmount === 500 && r.extraAmount === 0 && (r.settlementLinks || []).some(l => l.id === "e2"), r && [r.accId, r.appliedAmount, r.extraAmount]);
  rec("Z2 no page errors (B)", c.errors.length === 0, c.errors.slice(0, 2));
}
await b.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
