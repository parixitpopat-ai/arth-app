// Odometer capture in the real app (local-only dev server, SYNTHETIC vehicle). Drives: menu -> Vehicles -> vehicle -> Fuel tab -> refuels.
//   Setup: npx vite --port 5197 --strictPort &     Run: node tools/odometer/browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const APP = process.env.NL_APP || "http://localhost:5197/";
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ timezoneId: "Asia/Kolkata", viewport: { width: 420, height: 900 } });
await ctx.route(u => { try { return !["localhost", "127.0.0.1"].includes(new URL(u).hostname); } catch { return false; } }, r => r.abort());
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
  localStorage.setItem("arth_accounts", JSON.stringify([{ id: "b1", name: "Test Bank", type: "bank", openingBalance: 10000, openingBalanceDate: "2026-01-01", last4: "9001" }]));
  localStorage.setItem("arth_txns", "[]"); localStorage.setItem("arth_master_user_setup_complete", "true");
  localStorage.setItem("arth_vehicles", JSON.stringify([{ id: "v1", type: "car", number: "MH12AB1234", name: "Test Car", color: "#3b82f6" }])); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e))); page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300)); });
await page.goto(APP); await page.waitForTimeout(900);
for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(120); } await page.waitForTimeout(500); } }
await page.getByText("☰", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(500);
await page.getByText(/^🚗?\s*Vehicles$/).first().click().catch(async () => { await page.getByText("Vehicles").first().click(); }); await page.waitForTimeout(500);
await page.getByText("Test Car").first().click(); await page.waitForTimeout(500);
await page.getByText("Fuel", { exact: true }).first().click(); await page.waitForTimeout(500);
const body = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("arth_fuel_fills") || "[]"));
rec("OD1 Fuel tab shows the mileage section with an empty-state prompt", (await page.getByTestId("mileage-section").count()) === 1 && /Note the odometer at every refuel/.test(await body()), {});
async function add({ date, odo, litres, amount, full = true }) {
  await page.getByTestId("add-refuel").click(); await page.waitForTimeout(300);
  await page.getByTestId("fill-date").fill(date); await page.getByTestId("fill-odometer").fill(String(odo)); await page.getByTestId("fill-litres").fill(String(litres));
  await page.getByTestId("fill-amount").fill(amount == null ? "" : String(amount));
  if (full !== (await page.getByTestId("fill-full").isChecked())) await page.getByTestId("fill-full").click();
  await page.getByTestId("fill-save").click(); await page.waitForTimeout(400);
}
await add({ date: "2026-01-01", odo: 1000, litres: 30, amount: 3000 });
rec("OD2 a first refuel is saved and shown; km/L needs two full tanks", (await stored()).length === 1 && (await page.getByTestId("refuel-row").count()) === 1 && /two full-tank refuels/.test(await body()) && (await page.getByTestId("mileage-avg").innerText()) === "—", { stored: (await stored()).length });
await add({ date: "2026-01-10", odo: 1300, litres: 20, amount: 2000, full: false });
await add({ date: "2026-01-20", odo: 1500, litres: 20, amount: 2000 });
await add({ date: "2026-02-01", odo: 1900, litres: 25, amount: 2750 });
rec("OD3 mileage figures match the hand calculation: 13.8 km/L average, last 16.0, fuel 7.50 per km, odometer 1,900 km", (await page.getByTestId("mileage-avg").innerText()) === "13.8" && (await page.getByTestId("mileage-costkm").innerText()) === "₹7.50" && /1,900 km/.test(await page.getByTestId("mileage-odometer").innerText()) && (await page.getByTestId("refuel-kmpl").allInnerTexts()).join("|") === "16.0 km/L|12.5 km/L", { avg: await page.getByTestId("mileage-avg").innerText(), kmpls: await page.getByTestId("refuel-kmpl").allInnerTexts() });
// a reading lower than the previous one is refused with the reason, and nothing is saved
await page.getByTestId("add-refuel").click(); await page.waitForTimeout(300);
await page.getByTestId("fill-date").fill("2026-02-10"); await page.getByTestId("fill-odometer").fill("1800"); await page.getByTestId("fill-litres").fill("10"); await page.getByTestId("fill-save").click(); await page.waitForTimeout(300);
const refused = await page.getByTestId("fill-error-odometer").innerText().catch(() => "");
rec("OD4 an odometer reading lower than the previous one is refused with the reason; the sheet stays open; nothing saved", /higher than the previous reading \(1900 km/.test(refused) && (await page.getByTestId("fuel-fill-sheet").count()) === 1 && (await stored()).length === 4, { refused, stored: (await stored()).length });
await page.getByTestId("fill-odometer").fill("2000"); await page.getByTestId("fill-save").click(); await page.waitForTimeout(400);
rec("OD5 correcting the reading saves it", (await stored()).length === 5 && (await page.getByTestId("fuel-fill-sheet").count()) === 0, {});
// edit then delete
await page.getByTestId("refuel-row").first().click(); await page.waitForTimeout(300);
await page.getByTestId("fill-delete").click(); await page.getByTestId("fill-delete-confirm").click(); await page.waitForTimeout(400);
rec("OD6 delete needs confirmation, then removes the refuel and the figures return to the earlier values", (await stored()).length === 4 && (await page.getByTestId("mileage-avg").innerText()) === "13.8", { stored: (await stored()).length });
// persistence: reload and come back
await page.reload(); await page.waitForTimeout(900);
for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(120); } await page.waitForTimeout(500); } }
rec("OD7 refuels survive a reload (stored on the phone)", (await stored()).length === 4, { stored: (await stored()).length });
const real = errors.filter(e => !/Failed to load resource/.test(e));
rec("OD8 no page errors", real.length === 0, real.slice(0, 2));
console.log("outcome vector:", JSON.stringify(results));
await browser.close(); process.exit(results.every(r => r.pass) ? 0 : 1);
