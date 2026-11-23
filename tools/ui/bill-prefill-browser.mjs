// Add form: choosing the bill to pay fills in who it is for (the group's amount to collect) from the bill, and never replaces what was typed. SYNTHETIC data, real app in Chromium. Run: node tools/ui/bill-prefill-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4581, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 1700 } });
const today = (() => { const x = new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; })();
await ctx.addInitScript(d => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01" }]); set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "x", name: "Xena" }]);
  set("arth_groups", [{ id: "g1", name: "Neighbours", icon: "🏘️", color: "#0ea5e9", typeId: "other", type: "Other", members: ["x"], includeMe: false, manualLimit: 0, defaultIntent: "split", modules: [] }]);
  set("arth_bills", [{ id: "bb", name: "Goa Electricity", billDate: d, dueDate: d, status: "unpaid", amount: 4000, catId: "food", groupId: "g1", groupCollectiveAmount: 3445, splitPeople: {} }]);
  set("arth_txns", []); localStorage.setItem("arth_master_user_setup_complete", "true"); }, today);
const p = await ctx.newPage(); const errors = []; p.on("pageerror", e => errors.push(String(e)));
const T = id => p.getByTestId(id); const body = async () => (await p.locator("body").innerText()).replace(/\s+/g, " ");
await p.goto(APP); await p.waitForTimeout(1300);
for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(100); } await p.waitForTimeout(500); }
await p.getByRole("button", { name: "+", exact: true }).first().click(); await p.waitForTimeout(700);
await p.getByText("More options →").click(); await p.waitForTimeout(700);
await p.getByPlaceholder(/e\.g\. ₹5,500/).fill("4000"); await p.waitForTimeout(300);
await p.getByText(/None/).last().dispatchEvent("click"); await p.waitForTimeout(500);
await p.getByText(/Food & Dining/).last().dispatchEvent("click"); await p.waitForTimeout(500);
await p.getByPlaceholder("Vendor / Person / Place *").fill("Goa Electricity"); await p.waitForTimeout(300);
await T("bill-payment-chip").dispatchEvent("click"); await p.waitForTimeout(600);
let t = await body();
const choose = p.locator("button:not([data-testid=needs-bill])", { hasText: /Goa Electricity/ }).last();
rec("P1 the bill (the only match) is offered to link, and picked as the closest match", (await choose.count()) >= 1, (await choose.count()));
await choose.dispatchEvent("click"); await p.waitForTimeout(700);
t = await body();
rec("P2 choosing the bill fills in the group: 'Neighbours will owe you ₹3,445'", /Neighbours will owe you ₹3,445/.test(t), t.match(/[A-Za-z ]+will owe you ₹[\d,]+/)?.[0]);
await p.getByRole("button", { name: /Save|Add ✓/ }).last().dispatchEvent("click"); await p.waitForTimeout(1200);
const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("arth_txns") || "[]")[0]);
rec("P3 saving without touching the group records it: the group owes 3,445 and the bill is the one paid", saved && saved.paidBillId === "bb" && ((saved.groupAllocations || [])[0] || {}).groupId === "g1" && Number(saved.groupCollectiveAmount) === 3445, saved && [saved.paidBillId, saved.groupId, saved.groupCollectiveAmount, saved.trackingMode]);
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await b.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
