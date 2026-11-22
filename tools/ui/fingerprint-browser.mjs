// Fingerprint unlock: Settings row, turning it on, the lock screen. A stand-in for the phone (window.__ARTH_BIO_TEST__). SYNTHETIC data, real app in Chromium. CHROMIUM check only (the real sensor is only on the phone).
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4541, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
await ctx.addInitScript(() => { window.__ARTH_BIO_TEST__ = JSON.parse(sessionStorage.getItem("__bio") || '{"available":true,"result":true}'); if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 1000, openingBalanceDate: "2026-01-01" }]); set("arth_people", [{ id: "me", name: "Me", isMe: true }]); set("arth_txns", []); localStorage.setItem("arth_master_user_setup_complete", "true"); });
const p = await ctx.newPage(); const errors = []; p.on("pageerror", e => errors.push(String(e)));
const pin = async () => { for (let k = 0; k < 4; k++) { await p.getByRole("button", { name: "1", exact: true }).click(); await p.waitForTimeout(100); } await p.waitForTimeout(500); };
const text = () => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
await p.goto(APP); await p.waitForTimeout(1300);
for (let i = 0; i < 2; i++) if (await p.getByRole("button", { name: "1", exact: true }).count()) await pin();
rec("F1 no fingerprint button while it is off", (await p.getByTestId("unlock-fingerprint").count()) === 0, {});
await p.getByText("☰").first().click().catch(() => {}); await p.waitForTimeout(500);
await p.getByRole("button", { name: /settings/i }).first().click().catch(() => {}); await p.waitForTimeout(700);
rec("F2 Settings offers Unlock with fingerprint (Off)", /Unlock with fingerprint/.test(await text()) && /Off · touch the sensor/.test(await text()), {});
await p.getByText("Unlock with fingerprint").first().click(); await p.waitForTimeout(700);
rec("F3 turning it on works when the phone confirms", /On · the PIN is still the fallback/.test(await text()) && (await p.evaluate(() => localStorage.getItem("arth_biometric"))) === "1", {});
// reload = locked again; the fingerprint is asked at once and unlocks without typing
await p.reload(); await p.waitForTimeout(1800);
rec("F4 lock screen: fingerprint unlocks with no PIN typed", /Good (Morning|Afternoon|Evening)|Left in budget/i.test(await text()), (await text()).slice(0, 60));
// a miss leaves the PIN keypad and a button to try again
await p.evaluate(() => { sessionStorage.setItem("__bio", JSON.stringify({ available: true, result: false })); });
await p.reload(); await p.waitForTimeout(1800);
rec("F5 a miss keeps the keypad and shows Use fingerprint", (await p.getByTestId("unlock-fingerprint").count()) === 1 && /Enter your PIN/.test(await text()), {});
await p.evaluate(() => { window.__ARTH_BIO_TEST__ = { available: true, result: true }; });
await p.getByTestId("unlock-fingerprint").click(); await p.waitForTimeout(900);
rec("F6 tapping the button and confirming unlocks", /Good (Morning|Afternoon|Evening)|Left in budget/i.test(await text()), {});
await p.reload(); await p.waitForTimeout(1800);
await pin();
rec("F7 the PIN still unlocks when the fingerprint is off the table", /Good (Morning|Afternoon|Evening)|Left in budget/i.test(await text()), {});
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await b.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
