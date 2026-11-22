// Outlook: possible duplicates are flagged on the rows and listed in a card, and "These are different" clears a pair. SYNTHETIC data, real app in Chromium. CHROMIUM check only. Run: node tools/ui/outlook-duplicates-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4571, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 1400 } });
const day = n => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
await ctx.addInitScript(([d5, d6]) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem("arth_nav_v2", "1");
  set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01" }]); set("arth_people", [{ id: "me", name: "Me", isMe: true }]); set("arth_txns", []);
  set("arth_bills", [
    { id: "r1", name: "Rent", billDate: d5, dueDate: d5, status: "unpaid", amount: 20000 },
    { id: "r2", name: "Rent payment", billDate: d6, dueDate: d6, status: "unpaid", amount: 20000 },
    { id: "w1", name: "Water", billDate: d5, dueDate: d5, status: "unpaid", amount: 500 }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); }, [day(5), day(6)]);
const p = await ctx.newPage(); const errors = []; p.on("pageerror", e => errors.push(String(e)));
const T = id => p.getByTestId(id); const body = async () => (await p.locator("body").innerText()).replace(/\s+/g, " ");
await p.goto(APP); await p.waitForTimeout(1300);
for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(100); } await p.waitForTimeout(500); }
await T("nav-plan").click(); await p.waitForTimeout(600); await T("section-outlook").click(); await p.waitForTimeout(900);
rec("D1 the card lists one possible pair: the two Rent entries", (await T("dup-card").count()) === 1 && (await T("dup-pair").count()) === 1 && /Possible duplicates · 1/.test(await body()), (await body()).match(/Possible duplicates[^₹]*/)?.[0]);
rec("D2 both Rent rows carry the badge, Water does not", (await T("dup-badge").count()) === 2, await T("dup-badge").count());
await T("dup-not").click(); await p.waitForTimeout(500);
rec("D3 'These are different' clears the card and the badges", (await T("dup-card").count()) === 0 && (await T("dup-badge").count()) === 0, {});
await p.reload(); await p.waitForTimeout(1200); for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(100); } await p.waitForTimeout(500); }
await T("nav-plan").click(); await p.waitForTimeout(600); await T("section-outlook").click(); await p.waitForTimeout(900);
rec("D4 the choice is remembered after a restart", (await T("dup-card").count()) === 0, {});
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await b.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
