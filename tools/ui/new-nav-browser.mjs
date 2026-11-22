// New navigation (Today / Money / People / Plan) behind a Settings switch. SYNTHETIC data, real app in Chromium. CHROMIUM check only. Run: node tools/ui/new-nav-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4551, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 1000, openingBalanceDate: "2026-01-01" }, { id: "c1", name: "Coral Card", type: "cc", limit: 100000, outstanding: 0 }]);
  set("arth_loans", [{ id: "l1", name: "Car loan", direction: "taken", status: "active", principal: 300000, outstanding: 300000, dueDate: "2026-12-05", hasInterest: true, interestRate: 9 }, { id: "l2", name: "Raj Loan", direction: "given", status: "active", principal: 15000, outstanding: 15000 }]); set("arth_people", [{ id: "me", name: "Me", isMe: true }]);
  set("arth_txns", [{ id: "a", type: "expense", desc: "Saj Burgers", merchant: "Saj Burgers", date: new Date().toISOString().slice(0, 10), amount: 1800, accId: "b1", catId: "food", catIds: ["food"], createdAt: 1 }]); localStorage.setItem("arth_master_user_setup_complete", "true"); });
const p = await ctx.newPage(); const errors = []; p.on("pageerror", e => errors.push(String(e)));
const T = id => p.getByTestId(id);
const text = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const nav = () => p.evaluate(() => [...document.querySelectorAll("[data-testid^='nav-']")].map(e => e.textContent.trim()));
await p.goto(APP); await p.waitForTimeout(1300);
for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(100); } await p.waitForTimeout(500); }
rec("N1 off by default: the current bottom bar and no section switch", (await nav()).join("|").toLowerCase().includes("payments") && (await T("section-switch").count()) === 0, await nav());
await p.getByText("☰").first().click(); await p.waitForTimeout(400); await p.getByRole("button", { name: /settings/i }).first().click(); await p.waitForTimeout(700);
await p.getByText("New navigation").first().click(); await p.waitForTimeout(600);
rec("N2 Settings switch turns it on", /On · Today, Money, People, Plan/.test(await text()), {});
await p.getByText("☰").first().click().catch(() => {}); await p.waitForTimeout(300);
await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => /^home$/i.test(x.textContent.trim()) || /^today$/i.test(x.textContent.replace(/[^A-Za-z]/g, ""))); });
await p.reload(); await p.waitForTimeout(1200); for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(100); } await p.waitForTimeout(500); }
const n = (await nav()).map(x => x.replace(/[^A-Za-z]/g, "").toLowerCase());
rec("N3 the bar is Today, Money, People, Plan", JSON.stringify(n.filter(Boolean)) === JSON.stringify(["today", "money", "people", "plan"]), n);
await T("nav-money").click(); await p.waitForTimeout(800);
rec("N4 Money opens on Activity (the list) with no PIN, with Activity and Accounts", /Saj Burgers/.test(await text()) && (await T("section-activity").count()) === 1 && (await T("section-accounts").count()) === 1, {});
await T("section-accounts").click(); await p.waitForTimeout(700);
rec("N5 Accounts asks for the PIN", /Enter your PIN/i.test(await text()), (await text()).slice(-80));
for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click().catch(() => {}); await p.waitForTimeout(100); } await p.waitForTimeout(800);
rec("N6 after the PIN, the accounts hub shows (Test Savings) and the Money switch stays", /Test Savings/.test(await text()) && (await T("section-accounts").count()) === 1 && !/Enter your PIN/i.test(await text()), (await text()).slice(0, 90));
const body = async () => (await p.locator("body").innerText()).replace(/\s+/g, " ");
await p.waitForTimeout(500);
rec("N6b Accounts: net worth and Cash, none of the card, loan or investment boxes", /NET WORTH/i.test(await body()) && /\bCash\b/i.test(await body()) && !/Credit Cards|Money to Receive|Vehicles/i.test(await body()), {});
await T("section-cards").click(); await p.waitForTimeout(700);
rec("N6c Cards: Credit Cards, no net worth, no PIN asked again", /Credit Cards/i.test(await body()) && !/NET WORTH/i.test(await body()) && !/Enter your PIN/i.test(await body()), (await body()).slice(100, 180));
await T("section-loans").click(); await p.waitForTimeout(700);
rec("N6d Loans: the list shows the car loan (you owe) and Raj (you gave), with a total", (await T("loans-view").count()) === 1 && /Car loan/.test(await body()) && /You owe/.test(await body()) && /Raj Loan/.test(await body()) && /You owe ₹3,00,000 · you gave ₹15,000/.test(await body()) && !/NET WORTH/i.test(await body()), (await body()).slice(100, 260));
await T("loans-add").click(); await p.waitForTimeout(500);
rec("N6e + Add a loan opens the loan sheet", /loan/i.test(await body()) && (await p.getByRole("button", { name: /save|add loan/i }).count()) > 0, {});
await p.keyboard.press("Escape"); await p.getByText("✕").first().click().catch(() => {}); await p.waitForTimeout(300);
await T("section-invest").click(); await p.waitForTimeout(700);
rec("N6f Invest: Investments and Vehicles, no loans, no net worth", /Investments/i.test(await body()) && /Vehicles/i.test(await body()) && !/Money to Receive|NET WORTH|Credit Cards/i.test(await body()), (await body()).slice(100, 200));
await T("nav-plan").click(); await p.waitForTimeout(800);
const seg = await p.evaluate(() => [...document.querySelectorAll("[data-testid^='section-']:not([data-testid='section-switch'])")].map(e => e.textContent.trim()));
rec("N7 Plan opens on Bills with Bills, Budget, Goals, Events, Outlook", JSON.stringify(seg) === JSON.stringify(["Bills", "Budget", "Goals", "Events", "Outlook"]), seg);
await T("section-budget").click(); await p.waitForTimeout(800);
rec("N8 Budget opens and Plan stays lit", /budget/i.test(await text()) && (await T("section-switch").count()) === 1, {});
await T("section-outlook").click(); await p.waitForTimeout(800);
rec("N9 Outlook opens", /Outlook/.test(await text()), {});
await T("section-goals").click(); await p.waitForTimeout(700);
rec("N10 Goals opens its list", /goal/i.test(await text()), (await text()).slice(0, 60));
await p.keyboard.press("Escape"); await p.reload(); await p.waitForTimeout(1200); for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(100); } await p.waitForTimeout(500); }
await T("nav-people").click(); await p.waitForTimeout(700);
rec("N11 People has no switch", (await T("section-switch").count()) === 0, {});
await T("nav-today").click(); await p.waitForTimeout(700);
rec("N12 Today is Home, no switch", /Left in budget|Good (Morning|Afternoon|Evening)/.test(await text()) && (await T("section-switch").count()) === 0, {});
await p.getByText("☰").first().click(); await p.waitForTimeout(400); await p.getByRole("button", { name: /settings/i }).first().click(); await p.waitForTimeout(700);
await p.getByText("New navigation").first().click(); await p.waitForTimeout(600);
await p.reload(); await p.waitForTimeout(1200); for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(100); } await p.waitForTimeout(500); }
rec("N13 switching it off brings the current bar back", (await nav()).join("|").toLowerCase().includes("payments"), await nav());
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await b.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
