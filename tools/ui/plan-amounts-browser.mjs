// Plan ahead / Outlook: big amounts must not run into each other at phone width. SYNTHETIC data, real app in Chromium. CHROMIUM check only. Run: node tools/ui/plan-amounts-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4533, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ym = (add) => { const x = new Date(); x.setMonth(x.getMonth() + add, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; };
for (const W of [390, 320]) {
  const ctx = await b.newContext({ viewport: { width: W, height: 1400 }, timezoneId: "Asia/Kolkata" });
  await ctx.addInitScript(([m1]) => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 900000, openingBalanceDate: "2026-01-01" }]);
    set("arth_people", [{ id: "me", name: "Me", isMe: true }]);
    set("arth_bills", [
      { id: "r1", name: "Rent", billDate: `${m1}-01`, dueDate: `${m1}-05`, status: "unpaid", amount: 100000.15, recurring: true, frequency: "monthly", billingModel: "calendar" },
      { id: "r2", name: "Society", billDate: `${m1}-01`, dueDate: `${m1}-08`, status: "unpaid", amount: 28344, recurring: true, frequency: "monthly", billingModel: "calendar" }]);
    set("arth_txns", []); localStorage.setItem("arth_master_user_setup_complete", "true"); }, [ym(1)]);
  const p = await ctx.newPage(); const errors = []; p.on("pageerror", e => errors.push(String(e)));
  await p.goto(APP); await p.waitForTimeout(1300); console.log("loaded", W);
  for (let i = 0; i < 3; i++) { if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(100); } await p.waitForTimeout(400); } }
  console.log("unlocked", (await p.evaluate(() => document.body.innerText)).slice(0, 80).replace(/\n/g, " "));
  await p.getByText(/left in budget|safe to spend|budget/i).first().click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(900);
  const card = await p.getByTestId("plan-ahead-card").count(); if (!card) console.log((await p.evaluate(() => document.body.innerText)).slice(0, 200).replace(/\n/g, " | "));
  rec(`P0 ${W}px plan-ahead card found`, card > 0, { card });
  if (card) { await p.getByTestId("plan-ahead-card").dispatchEvent("click"); await p.waitForTimeout(800); }
  await p.screenshot({ path: `/tmp/claude-0/s/plan-${W}.png` });
  // any two text boxes of different elements that overlap on screen
  const clash = await p.evaluate(() => { const els = [...document.querySelectorAll("[data-testid='readiness-screen'] *")].filter(e => e.children.length === 0 && /₹/.test(e.textContent)); const out = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const a = els[i].getBoundingClientRect(), c = els[j].getBoundingClientRect(); const ox = Math.min(a.right, c.right) - Math.max(a.left, c.left), oy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top); if (ox > 2 && oy > 2) out.push([els[i].textContent, els[j].textContent]); }
    const over = [...document.querySelectorAll("[data-testid='readiness-screen'] *")].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow === "visible" && e.children.length === 0).map(e => e.textContent.slice(0, 30));
    return { out, over }; });
  rec(`P1 ${W}px no amounts overlap`, clash.out.length === 0, clash.out.slice(0, 2));
  rec(`P2 ${W}px no amount spills out of its box`, clash.over.length === 0, clash.over.slice(0, 3));
  rec(`Z1 ${W}px no page errors`, errors.length === 0, errors.slice(0, 2));
  await ctx.close();
}
await b.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
