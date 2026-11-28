// Someone pays more than they owe: the extra is recorded as an excess held for them, then settled from the person's profile. SYNTHETIC data, real app in Chromium. Run: node tools/people/excess-settle-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4599, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 1700 } });
const day = n => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
await ctx.addInitScript(d => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01" }, { id: "c1", name: "Test Cash", type: "cash", openingBalance: 1000, openingBalanceDate: "2026-01-01" }, { id: "cc1", name: "Test Card", type: "cc", limit: 100000, outstanding: 280, statementDate: 15, dueDate: 5, last4: "1234" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "x", name: "Xena" }]);
  set("arth_txns", [{ id: "e1", type: "expense", desc: "Goods for Xena", merchant: "Test Store", amount: 280, date: d, accId: "cc1", catId: "shopping", catIds: ["shopping"], trackingMode: "split", people: { x: { amount: 280, mode: "owes", settled: false, remainingAmt: 280 } } }]);
  set("arth_bills", []); localStorage.setItem("arth_master_user_setup_complete", "true"); }, day(-1));
const p = await ctx.newPage(); const errors = []; p.on("pageerror", e => errors.push(String(e)));
const body = async () => (await p.locator("body").innerText()).replace(/\s+/g, " ");
const txns = () => p.evaluate(() => JSON.parse(localStorage.getItem("arth_txns") || "[]"));
await p.goto(APP); await p.waitForTimeout(1300);
for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(100); } await p.waitForTimeout(500); }
await p.getByRole("button", { name: "+", exact: true }).first().click(); await p.waitForTimeout(700);
await p.getByText("More options →").click().catch(() => {}); await p.waitForTimeout(600);
await p.getByRole("button", { name: /^Received$/ }).first().dispatchEvent("click"); await p.waitForTimeout(500);
await p.getByTestId("what-repayment").dispatchEvent("click"); await p.waitForTimeout(600);
await p.getByPlaceholder(/e\.g\. ₹5,500|0/).first().fill("500"); await p.waitForTimeout(400);
await p.getByText("Xena", { exact: true }).last().dispatchEvent("click"); await p.waitForTimeout(700);
await p.getByText("💵 Test Cash").last().dispatchEvent("click"); await p.waitForTimeout(400);
const form = await body();
rec("X1 the received form says ₹220 is an excess held for them until it is settled (no 'advance')", /Applied ₹280 of ₹500 · ₹220 excess, held for them until you settle it/.test(form) && !/kept as advance/.test(form), form.match(/Applied[^.]{0,90}/)?.[0]);
await p.getByRole("button", { name: /Save|Add ✓/ }).last().dispatchEvent("click"); await p.waitForTimeout(1200);
let t = await txns();
const rin = t.find(x => x.type === "settlement_in");
rec("X2 saved: ₹500 into cash, ₹280 applied to the expense, ₹220 extra; the expense share is settled", rin && rin.accId === "c1" && rin.appliedAmount === 280 && rin.extraAmount === 220 && t.find(x => x.id === "e1").people.x.settled === true, rin && [rin.accId, rin.appliedAmount, rin.extraAmount]);
await p.getByText(/^people$/i).last().dispatchEvent("click"); await p.waitForTimeout(900);
await p.getByText("Xena", { exact: true }).first().dispatchEvent("click"); await p.waitForTimeout(900);
rec("X3 the profile shows 'You owe ₹220' and a Settle button", /You owe ₹220/.test(await body()) && /^Settle$/.test((await p.getByTestId("person-payback").innerText()).trim()), (await p.getByTestId("person-payback").innerText().catch(() => "")));
await p.getByTestId("person-payback").dispatchEvent("click"); await p.waitForTimeout(700);
const modal = (await p.getByTestId("payback-modal").innerText()).replace(/\s+/g, " ");
rec("X4 the sheet is 'Settle with Xena' and the button says Settle ₹220", /Settle with Xena/.test(modal) && /Settle ₹220/.test(modal) && !/Pay back/.test(modal.replace(/you are paying it back/i, "")), modal.slice(0, 160));
await p.getByTestId("payback-amount").fill("220"); await p.waitForTimeout(300);
await p.getByTestId("payback-save").dispatchEvent("click"); await p.waitForTimeout(1000);
t = await txns();
const tr = t.find(x => x.type === "transfer");
rec("X5 settling takes ₹220 from the bank, with no destination and not as spending", tr && tr.amount === 220 && tr.fromAccId === "b1" && !tr.toAccId && !t.some(x => x.type === "expense" && x.amount === 220), tr && [tr.amount, tr.fromAccId, tr.toAccId]);
rec("X6 the profile now says All settled", /All settled/i.test(await body()), {});
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await b.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
