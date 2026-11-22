// One-tap WhatsApp (a bill's share to each person, and the Needs-you reminder) and phone bill reminders. SYNTHETIC data, real app in Chromium. CHROMIUM check only:
// window.open is captured (WhatsApp is not opened) and the phone-notification plugin is replaced by a test hook, so the Android side is NOT exercised here.
// Run: node tools/ui/whatsapp-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4541, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const ctx = await browser.newContext({ viewport: { width: 390, height: 1100 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(([due, past]) => { window.__ARTH_DUE_TEST__ = window.__ARTH_DUE_TEST__ || { granted: true, calls: [] };
  if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1"); const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set("arth_accounts", [{ id: "b1", name: "Test Savings", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01" }]);
  set("arth_people", [{ id: "me", name: "Me", isMe: true }, { id: "r", name: "Raj Test", phone: "98765 43210" }, { id: "m", name: "Mangal Test" }]);
  set("arth_bills", [{ id: "e1", name: "Electricity", billDate: past, dueDate: due, status: "unpaid", amount: 3045, splitPeople: { r: { amount: 1015, mode: "owes", settled: false, remainingAmt: 1015 }, m: { amount: 1015, mode: "owes", settled: false, remainingAmt: 1015 } } }]);
  set("arth_txns", [{ id: "x1", type: "expense", desc: "Dinner", date: past, amount: 1800, accId: "b1", catId: "food", catIds: ["food"], people: { r: { amount: 900, mode: "owes", settled: false } }, createdAt: 1 }]);
  localStorage.setItem("arth_master_user_setup_complete", "true"); }, [day(5), day(-3)]);
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
const T = id => page.getByTestId(id);
const unlock = async () => { for (let i = 0; i < 3; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(100); } await page.waitForTimeout(400); } } };
const opened = () => page.evaluate(() => window.__opened || []);
try {
  await page.goto(APP); await page.waitForTimeout(1300); await unlock(); await page.waitForTimeout(500);
  await page.evaluate(() => { window.__opened = []; window.open = u => { window.__opened.push(String(u)); return null; }; });
  // Needs you: Remind for Raj opens his chat with a reminder
  await T("needs-remind").click(); await page.waitForTimeout(500);
  let o = await opened();
  rec("W1 Remind opens WhatsApp to Raj's number (+91 added) with the reminder typed", o.length === 1 && o[0].startsWith("https://wa.me/919876543210?text=") && /gentle%20reminder/.test(o[0]), o[0]);
  // the bill: per-person WhatsApp button
  await page.getByText(/^payments$/i).last().dispatchEvent("click"); await page.waitForTimeout(900);
  await T("bill-row-e1").dispatchEvent("click"); await page.waitForTimeout(700);
  rec("W2 the bill's split shows a WhatsApp button for each person who owes", (await T("bill-whatsapp").count()) === 2, {});
  await T("bill-whatsapp").first().click(); await page.waitForTimeout(500);
  o = await opened(); const last = o[o.length - 1] || "";
  const text = decodeURIComponent(last.split("text=")[1] || "");
  rec("W3 it opens that person's chat, with their share and the due date in the message", /^https:\/\/wa\.me\/91\d{10}\?text=/.test(last) && /Your share of Electricity/.test(text) && /Your Share - ₹1,015/.test(text) && /Kindly pay before/.test(text), last.slice(0, 80));
  await T("bill-whatsapp").nth(1).click(); await page.waitForTimeout(500);
  o = await opened(); const last2 = o[o.length - 1] || "";
  rec("W4 a person with no number opens WhatsApp's own contact chooser with the message ready", /^https:\/\/wa\.me\/\?text=/.test(last2), last2.slice(0, 60));
  // phone reminders
  await page.getByRole("button", { name: /Close|✕/ }).first().click().catch(() => {}); await page.waitForTimeout(300);
  await page.goto(APP); await page.waitForTimeout(1200); await unlock(); await page.waitForTimeout(400);
  await page.locator("button", { hasText: "☰" }).first().click(); await page.waitForTimeout(700);
  await page.getByText(/Settings/).first().click(); await page.waitForTimeout(800);
  rec("W5 Settings offers 'Bill reminders', off to begin with", /Bill reminders\s*Off/.test(await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "))), {});
  await page.getByText("Bill reminders").first().dispatchEvent("click"); await page.waitForTimeout(2500);
  const calls = await page.evaluate(() => window.__ARTH_DUE_TEST__.calls);
  const sched = calls.filter(c => c.op === "schedule").pop();
  const hours = sched ? await page.evaluate(rs => rs.map(r => new Date(r.at).getHours()), sched.reminders) : [];   // in the phone's own time zone
  rec("W6 switching it on schedules this bill's reminders (3 days before and on the day, 9 am)", sched && sched.reminders.length === 2 && sched.reminders.every(r => /Electricity/.test(r.title)) && hours.every(x => x === 9), sched && [sched.reminders.map(r => r.title), hours]);
  await page.getByText("Bill reminders").first().dispatchEvent("click"); await page.waitForTimeout(1200);
  rec("W7 switching it off cancels them", (await page.evaluate(() => window.__ARTH_DUE_TEST__.calls)).some(c => c.op === "cancel"), {});
} catch (e) { rec("RUN", false, String(e).slice(0, 400)); }
rec("Z1 no page errors", errors.length === 0, errors.slice(0, 2));
await browser.close(); try { process.kill(-server.pid); } catch {}
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
