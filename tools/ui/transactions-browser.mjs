// Transactions list, new look: Spent / Came in header, quick filters (Everything, With people, Work, Loans), plain-words rows. SYNTHETIC data, real app in Chromium. CHROMIUM check only. Run: node tools/ui/transactions-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4521, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true, });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 1500 } });
const d = n => { const x = new Date(); x.setDate(x.getDate() - n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
await ctx.addInitScript(([t0, t1, t2]) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01" }, { id: "b2", name: "Test Current", type: "bank", openingBalance: 0, openingBalanceDate: "2026-01-01" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "r", name: "Raj Test" }]);
  set("arth_txns", [
    { id: "a", type: "expense", desc: "Saj Burgers", merchant: "Saj Burgers", date: t0, amount: 1800, accId: "b1", catId: "food", catIds: ["food"], people: { r: { amount: 900, mode: "owes", settled: false } }, createdAt: 3 },
    { id: "b", type: "expense", desc: "K Auto", merchant: "K Auto", date: t1, amount: 1687, accId: "b1", catId: "transport", catIds: ["transport"], createdAt: 2 },
    { id: "c", type: "income", desc: "Salary", date: t2, amount: 120000, accId: "b1", createdAt: 1 },
    { id: "d", type: "transfer", desc: "", date: t2, amount: 5000, fromAccId: "b1", toAccId: "b2", createdAt: 0 },
    { id: "e", type: "expense", desc: "Client lunch", date: t1, amount: 300, accId: "b1", catId: "food", catIds: ["food"], reimbursable: true, createdAt: 4 },
    { id: "f", type: "transfer", isLoanDisbursal: true, linkedLoanId: "L1", desc: "Loan to Raj", date: t2, amount: 2000, fromAccId: "b1", toAccId: null, createdAt: 5 }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); }, [d(0), d(1), d(3)]);
const p = await ctx.newPage();
await p.goto(APP); await p.waitForTimeout(1200);
for (let i = 0; i < 3; i++) { if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(100); } await p.waitForTimeout(500); } }
const T = id => p.getByTestId(id);
const text = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const errors = []; p.on("pageerror", e => errors.push(String(e)));
await p.getByText("See all", { exact: false }).first().dispatchEvent("click").catch(() => {}); await p.waitForTimeout(900);
let t = await text();
rec("M1 header shows what you spent (my share 900 + 1,687 + 300; money lent is not spending) and what came in", /Spent ₹2,887/.test(t) || /Spent ₹2,887/.test(t.replace(/\s+/g, " ")), (t.match(/Spent ₹[\d,]+/) || ["none"])[0]);
rec("M2 Came in is the 1,20,000 salary", /Came in ₹1,20,000/.test(t), (t.match(/Came in ₹[\d,]+/) || ["none"])[0]);
rec("M3 a split row says who owes you, in words", /Raj owes you ₹900/.test(t), (t.match(/Raj\w* owes? you[^A-Z]{0,12}/) || ["none"])[0]);
rec("M4 a transfer is named and shows from and to", /Transfer/.test(t) && /Test Savings → Test Current/.test(t), {});
await T("txn-quick-people").click(); await p.waitForTimeout(400); t = await text();
rec("M5 With people shows Saj Burgers only", /Saj Burgers/.test(t) && !/K Auto/.test(t) && !/Client lunch/.test(t), {});
await T("txn-quick-work").click(); await p.waitForTimeout(400); t = await text();
rec("M6 Work shows the reimbursable lunch only", /Client lunch/.test(t) && !/Saj Burgers/.test(t) && !/K Auto/.test(t), {});
await T("txn-quick-loans").click(); await p.waitForTimeout(400); t = await text();
rec("M7 Loans shows the money lent only", /Loan to Raj/.test(t) && !/Saj Burgers/.test(t), {});
await T("txn-quick-all").click(); await p.waitForTimeout(400); t = await text();
rec("M8 Everything brings them all back", /Saj Burgers/.test(t) && /K Auto/.test(t) && /Loan to Raj/.test(t), {});
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await b.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
