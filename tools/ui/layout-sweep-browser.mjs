// Layout sweep: the screens changed in this stretch, light and dark, at 390 and 320 px wide. Reports horizontal overflow (anything wider than the screen) and takes screenshots. SYNTHETIC data, real app in Chromium. CHROMIUM check only.
// Run: node tools/ui/layout-sweep-browser.mjs  (screenshots go to the folder in OUT)
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4611, APP = `http://localhost:${PORT}/`, OUT = process.env.OUT || "/tmp/claude-0/s/ui";
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const day = n => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const findings = [];
for (const W of [390, 320]) for (const dark of [false, true]) {
  const tag = `${W}-${dark ? "dark" : "light"}`;
  const ctx = await b.newContext({ viewport: { width: W, height: 844 }, timezoneId: "Asia/Kolkata" });
  await ctx.addInitScript(([d, d1, d5, t0, dk]) => { window.__ARTH_BIO_TEST__ = { available: true, result: true }; window.__ARTH_DAILY_TEST__ = { calls: [] }; window.__ARTH_WEEKLY_TEST__ = { calls: [] }; window.__ARTH_DUE_TEST__ = { calls: [] };
    if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    localStorage.setItem("arth_nav_v2", "1"); localStorage.setItem("arth_dark", JSON.stringify(dk));
    set("arth_accounts", [{ id: "b1", name: "Test Savings Account With A Long Name", type: "bank", openingBalance: 1284344.15, openingBalanceDate: "2026-01-01" }, { id: "c1", name: "Coral Credit Card", type: "cc", limit: 200000, outstanding: 54000 }]);
    set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "r", name: "Raj Test" }, { id: "m", name: "Mangal Test" }]);
    const owes = (a, s = false) => ({ amount: a, mode: "owes", settled: s, remainingAmt: s ? 0 : a });
    set("arth_groups", [{ id: "flat", name: "Flat", icon: "🏠", color: "#16a34a", typeId: "other", type: "Other", members: ["r", "m"], includeMe: true, manualLimit: 0, defaultIntent: "split", modules: [] }]);
    set("arth_loans", [{ id: "l1", name: "Car loan from a bank", direction: "taken", status: "active", principal: 300000, outstanding: 300000, dueDate: "2026-12-05", hasInterest: true, interestRate: 9 }, { id: "l2", name: "Raj Loan", direction: "given", status: "active", principal: 15000, outstanding: 15000 }]);
    set("arth_bills", [{ id: "r1", name: "Rent", billDate: d5, dueDate: d5, status: "unpaid", amount: 100000.15 }, { id: "r2", name: "Rent payment", billDate: d5, dueDate: d5, status: "unpaid", amount: 100000.15 }, { id: "w1", name: "Internet", billDate: d1, dueDate: d1, status: "unpaid", amount: 900, groupId: "flat", splitPeople: { r: owes(300), m: owes(300) } }]);
    set("arth_txns", [
      { id: "i1", type: "investment", desc: "Example Fund Direct Growth", merchant: "Example Fund", date: t0, amount: 5000, accId: "b1", investType: "mf", investFolio: "12345", investNav: 50, createdAt: 1 },
      { id: "e1", type: "expense", desc: "Electricity", date: d, amount: 3000, accId: "b1", groupId: "flat", catId: "food", catIds: ["food"], people: { r: owes(1000), m: owes(1000, true) }, createdAt: 2 },
      { id: "e2", type: "expense", desc: "Saj Burgers", merchant: "Saj Burgers", date: d, amount: 1800, accId: "b1", catId: "food", catIds: ["food"], createdAt: 3 }]);
    set("arth_wealth_snapshots", [{ date: d1, netWorth: 1000, cash: 500 }, { date: d, netWorth: 1500, cash: 300 }]);
    localStorage.setItem("arth_master_user_setup_complete", "true"); }, [day(-1), day(1), day(6), day(-20), dark]);
  const p = await ctx.newPage(); const errors = []; p.on("pageerror", e => errors.push(String(e)));
  const unlock = async () => { for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(80); } await p.waitForTimeout(450); } };
  const T = id => p.getByTestId(id);
  const check = async (name) => {
    await p.waitForTimeout(500);
    const r = await p.evaluate((vw) => { const over = []; for (const e of document.querySelectorAll("body *")) { const cs = getComputedStyle(e); if (cs.position === "fixed" && e.getBoundingClientRect().width === 0) continue; const b = e.getBoundingClientRect(); if (b.width > 0 && b.height > 0 && b.right > vw + 1 && !e.closest("[style*='overflow-x: auto'],[style*='overflow-x:auto']")) over.push(`${e.tagName}${e.dataset.testid ? "#" + e.dataset.testid : ""} ${Math.round(b.right)}>${vw} "${(e.textContent || "").trim().slice(0, 24)}"`); } return { sw: document.documentElement.scrollWidth, over: over.slice(0, 4) }; }, W);
    const bad = r.sw > W + 1 || r.over.length > 0;
    if (bad) findings.push(`${tag} ${name}: scrollWidth ${r.sw}${r.over.length ? " · " + r.over.join(" | ") : ""}`);
    await p.screenshot({ path: `${OUT}/${tag}-${name}.png` });
  };
  const openSettings = async () => { await p.locator("button", { hasText: "☰" }).first().click(); await p.waitForTimeout(400); await p.getByText(/Settings/).first().click(); await p.waitForTimeout(600); };
  await p.goto(APP); await p.waitForTimeout(1300); await unlock();
  await check("today");
  await T("nav-money").click(); await p.waitForTimeout(500); await check("money-activity");
  for (const v of ["accounts", "cards", "loans", "invest"]) { await T(`section-${v}`).click(); await p.waitForTimeout(500); await unlock(); await check(`money-${v}`); }
  await p.getByText(/^Mutual Fund/i).first().click().catch(() => {}); await p.waitForTimeout(500); await p.getByText("Folio 12345").first().click().catch(() => {}); await p.waitForTimeout(500); await check("holding-panel");
  await p.reload(); await p.waitForTimeout(1200); await unlock();
  await T("nav-plan").click(); await p.waitForTimeout(500); await check("plan-bills");
  await T("section-outlook").click(); await p.waitForTimeout(700); await check("plan-outlook");
  await p.getByTestId("home-bell").first().click().catch(() => {}); await p.waitForTimeout(400); await check("bell");
  await T("notif-dups").click().catch(() => {}); await p.waitForTimeout(600); await check("dup-review");
  await p.reload(); await p.waitForTimeout(1200); await unlock();
  await openSettings(); await check("settings");
  await p.getByText("Notifications", { exact: true }).first().click(); await p.waitForTimeout(500); await check("settings-notifications");
  await p.locator("button", { hasText: "←" }).first().click().catch(() => {}); await p.waitForTimeout(400);
  await p.getByText("PIN, fingerprint & lock").first().click().catch(() => {}); await p.waitForTimeout(500); await check("settings-security");
  await p.reload(); await p.waitForTimeout(1200); await unlock();
  await p.getByText(/^people$/i).last().dispatchEvent("click").catch(() => {}); await p.waitForTimeout(600); await p.getByText(/Groups/).first().dispatchEvent("click").catch(() => {}); await p.waitForTimeout(500); await p.getByText("Flat", { exact: true }).first().dispatchEvent("click").catch(() => {}); await p.waitForTimeout(600);
  await T("group-statement").scrollIntoViewIfNeeded().catch(() => {}); await T("group-statement").dispatchEvent("click").catch(() => {}); await p.waitForTimeout(600); await check("group-statement");
  if (errors.length) findings.push(`${tag}: page errors ${errors.slice(0, 2).join(" ; ")}`);
  await ctx.close();
}
await b.close(); try { process.kill(-server.pid); } catch {}
console.log(findings.length ? "FINDINGS:\n" + findings.join("\n") : "no overflow found"); process.exit(0);
