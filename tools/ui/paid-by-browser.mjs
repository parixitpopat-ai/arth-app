// Add form: "Paid by" shows Me and the name of anyone holding petty cash; choosing them uses none of my accounts. SYNTHETIC data, real app in Chromium. Run: node tools/ui/paid-by-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4595, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 1700 } });
const day = n => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
await ctx.addInitScript(d => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "x", name: "Xena" }, { id: "y", name: "Yash" }]);
  set("arth_txns", [{ id: "pc1", type: "transfer", desc: "Petty cash - Xena", merchant: "Xena", amount: 5000, date: d, fromAccId: "b1", toAccId: null, accId: null, isPettyCash: true, pettyCashPersonId: "x", trackingMode: "none", people: {}, catIds: [] }]);
  set("arth_bills", []); localStorage.setItem("arth_master_user_setup_complete", "true"); }, day(-3));
const p = await ctx.newPage(); const errors = []; p.on("pageerror", e => errors.push(String(e)));
const T = id => p.getByTestId(id); const body = async () => (await p.locator("body").innerText()).replace(/\s+/g, " ");
await p.goto(APP); await p.waitForTimeout(1300);
for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(100); } await p.waitForTimeout(500); }
await p.getByRole("button", { name: "+", exact: true }).first().click(); await p.waitForTimeout(700);
await p.getByText("More options →").click().catch(() => {}); await p.waitForTimeout(600);
await p.getByPlaceholder(/e\.g\. ₹5,500/).fill("500"); await p.waitForTimeout(400);
const row = await T("paid-by").innerText().catch(() => "");
rec("PB1 'Paid by' is shown, with Me and Xena (she holds petty cash)", (await T("paid-by").count()) === 1 && /Me/.test(row) && /Xena/.test(row), row);
rec("PB2 Yash (no petty cash) is not offered", !/Yash/.test(row), {});
rec("PB3 the hint explains the two ways", (await T("paid-by-hint").count()) === 1 && /They paid\. I owe them/.test(await T("paid-by-hint").innerText()), {});
await T("paid-by").getByText(/Xena/).dispatchEvent("click"); await p.waitForTimeout(500);
const note = await T("paid-by-note").innerText().catch(() => "");
rec("PB4 choosing Xena says she paid from her own pocket and none of my accounts is used", /Xena paid for this/.test(note) && /None of your accounts is used/.test(note), note.slice(0, 120));
await p.getByPlaceholder("Vendor / Person / Place *").fill("Test Store"); await p.waitForTimeout(300);
await p.getByRole("button", { name: /Save|Add ✓/ }).last().dispatchEvent("click"); await p.waitForTimeout(1200);
const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("arth_txns") || "[]").find(t => t.type === "expense"));
rec("PB5 saved: paid by Xena, no account used", saved && saved.paidByPersonId === "x" && !saved.accId, saved && [saved.paidByPersonId, saved.accId]);
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await b.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
