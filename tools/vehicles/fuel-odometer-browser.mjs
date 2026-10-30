// Odometer asked on the FUEL EXPENSE, in the real app (Chromium, local Vite dev server, SYNTHETIC data, phone-width viewport).
// This is a CHROMIUM check. It says nothing about the Android app.   Run: node tools/vehicles/fuel-odometer-browser.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", "4183", "--strictPort"], { stdio: "ignore", detached: true });
const APP = "http://localhost:4183/";
for (let i = 0; i < 50; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Kolkata" });
await ctx.addInitScript(() => { if (localStorage.getItem("__init")) return; localStorage.setItem("__init", "1");
  localStorage.setItem("arth_accounts", JSON.stringify([{ id: "b1", name: "Test Bank", type: "bank", openingBalance: 100000, openingBalanceDate: "2026-01-01", last4: "9001" }]));
  localStorage.setItem("arth_vehicles", JSON.stringify([{ id: "v1", name: "Test Scooter", type: "bike", number: "XX00AB1234" }]));
  localStorage.setItem("arth_txns", "[]"); localStorage.setItem("arth_master_user_setup_complete", "true"); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
await page.goto(APP); await page.waitForTimeout(900);
for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(120); } await page.waitForTimeout(500); } }
const T = id => page.getByTestId(id);
const ls = key => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "[]"), key);
const reload = async () => { await page.goto(APP); await page.waitForTimeout(900); for (let i = 0; i < 2; i++) { if (await page.getByRole("button", { name: "1", exact: true }).count()) { for (let k = 0; k < 4; k++) { await page.getByRole("button", { name: "1", exact: true }).click(); await page.waitForTimeout(120); } await page.waitForTimeout(500); } } };
const openForm = async () => { await reload();
  await page.getByRole("button", { name: /➖/ }).first().click(); await page.waitForTimeout(500); await page.getByText("More options →").click(); await page.waitForTimeout(600); };
const fillForm = async ({ vendor, amount, sub, vehicle = true }) => {
  await page.getByPlaceholder("Vendor / Person / Place *").fill(vendor);
  await page.getByPlaceholder(/e\.g\. ₹5,500/).fill(String(amount));
  await page.waitForTimeout(300);
  if (!(await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").includes("+ 🚗 Transport ▾")))) { await page.getByText(/None ▾|None/).first().click(); await page.waitForTimeout(300); await page.getByText("🚗 Transport").first().click(); await page.getByRole("button", { name: "Done" }).click(); await page.waitForTimeout(400); }
  if (vehicle) { await page.getByText(/Test Scooter/).first().click(); await page.waitForTimeout(300); }
  if (sub === "Fuel") {                                   // the app may already have chosen a sub-category from history (clicking it again would clear it)
    if (!(await T("fuel-odometer-block").count())) { await page.getByText("Fuel", { exact: true }).first().click(); await page.waitForTimeout(300); }
    if (vehicle && !(await T("fuel-odometer-block").count())) { await page.getByText("Fuel", { exact: true }).first().click(); await page.waitForTimeout(300); }
  } else { await page.getByText(sub, { exact: true }).first().click(); await page.waitForTimeout(300); }
};
const save = async () => { await page.getByRole("button", { name: /Add ✓|Save Changes ✓/ }).click(); await page.waitForTimeout(700); };

try {
  // F0/F1: the fields only appear for a FUEL expense with a vehicle
  await openForm(); await fillForm({ vendor: "Test Pump", amount: 500, sub: "Uber / Ola" });
  rec("F0 a Transport expense that is NOT fuel shows no odometer fields", (await T("fuel-odometer-block").count()) === 0, {});
  await page.getByText("Fuel", { exact: true }).first().click(); await page.waitForTimeout(300);
  rec("F1 Fuel + a vehicle shows the odometer, litres and 'filled to full' fields", (await T("fuel-odometer-block").count()) === 1 && (await T("fuel-full").isChecked()), {});
  await page.getByText(/Test Scooter/).first().click(); await page.waitForTimeout(300);
  rec("F1b Fuel with no vehicle chosen shows no odometer fields", (await T("fuel-odometer-block").count()) === 0, {});
  await page.getByText(/Test Scooter/).first().click(); await page.waitForTimeout(300);

  // F2: save with an odometer: one expense, one linked refuel built from it
  await T("fuel-odometer").fill("1000"); await T("fuel-litres").fill("5");
  await save();
  let txns = await ls("arth_txns"), fills = await ls("arth_fuel_fills");
  rec("F2 one expense and one refuel were saved; the refuel is linked to the expense and takes its date and amount", txns.length === 1 && fills.length === 1 && String(fills[0].txnId) === String(txns[0].id) && fills[0].date === txns[0].date && fills[0].amount === txns[0].amount && fills[0].odometer === 1000 && fills[0].litres === 5 && fills[0].full === true && fills[0].vehicleId === "v1", { txn: txns[0] && { id: txns[0].id, amount: txns[0].amount, date: txns[0].date, vehicleId: txns[0].vehicleId }, fill: fills[0] });

  // F3: a reading lower than the last one: the expense still saves, the refuel does not
  await openForm();
  await fillForm({ vendor: "Test Pump", amount: 400, sub: "Fuel" });
  await page.getByText(/Details ▾/).first().click(); await page.waitForTimeout(300);
  await page.locator('input[type="date"]').first().fill("2026-10-01");              // an EARLIER date with a HIGHER reading than the 30 Oct refuel: impossible
  await T("fuel-odometer").fill("1200"); await T("fuel-litres").fill("4"); await page.waitForTimeout(300);
  rec("F3a a reading that cannot be right for its date is flagged in the form, and says the expense will still be saved", (await T("fuel-odometer-error").count()) === 1 && /lower than the next reading/.test(await T("fuel-odometer-error").innerText()), await T("fuel-odometer-error").count() ? await T("fuel-odometer-error").innerText() : null);
  await save();
  txns = await ls("arth_txns"); fills = await ls("arth_fuel_fills");
  rec("F3b the expense was saved and no second refuel was created", txns.length === 2 && fills.length === 1, { txns: txns.length, fills: fills.length });

  // F4: a fuel expense with the odometer left blank: just an expense
  await openForm(); await fillForm({ vendor: "Test Pump", amount: 300, sub: "Fuel" });
  await save();
  rec("F4 a fuel expense with no odometer saves as an expense only", (await ls("arth_txns")).length === 3 && (await ls("arth_fuel_fills")).length === 1, {});

  // F5: a second valid refuel gives the mileage view two linked fills
  await openForm(); await fillForm({ vendor: "Test Pump", amount: 600, sub: "Fuel" });
  await T("fuel-odometer").fill("1150"); await T("fuel-litres").fill("6"); await save();
  fills = await ls("arth_fuel_fills"); txns = await ls("arth_txns");
  rec("F5 a second valid reading is added and linked to its own expense", fills.length === 2 && fills.every(f => txns.some(t => String(t.id) === String(f.txnId))), fills.map(f => ({ o: f.odometer, a: f.amount })));
  // F7: edit the first expense: its refuel follows (same row, new amount); F8: delete it: its refuel goes with it
  await reload();
  await page.getByText("Test Pump").first().click(); await page.waitForTimeout(600);
  const before6 = (await ls("arth_fuel_fills")).find(f => f.odometer === 1150);
  await page.getByText("✏️ Edit").click(); await page.waitForTimeout(700);
  rec("F7a editing the expense shows its refuel's odometer and litres already filled in", (await T("fuel-odometer").inputValue()) === "1150" && (await T("fuel-litres").inputValue()) === "6", {});
  await page.getByPlaceholder(/e\.g\. ₹5,500/).fill("650"); await save();
  const after6 = (await ls("arth_fuel_fills")).find(f => f.odometer === 1150), txn6 = (await ls("arth_txns")).find(t => String(t.id) === String(before6.txnId));
  rec("F7b changing the expense amount updates the SAME refuel (no duplicate), and the amounts agree", after6 && after6.id === before6.id && after6.amount === 650 && txn6.amount === 650 && (await ls("arth_fuel_fills")).length === 2, { before: before6 && before6.amount, after: after6 && after6.amount });
  await reload(); await page.getByText("Test Pump").first().click(); await page.waitForTimeout(500);
  await page.getByText("✏️ Edit").click(); await page.waitForTimeout(600);
  await T("fuel-odometer").fill(""); await save();
  rec("F7c clearing the odometer on the expense removes only that expense's refuel", (await ls("arth_fuel_fills")).length === 1 && (await ls("arth_fuel_fills"))[0].odometer === 1000, {});
  await reload(); await page.getByText("Test Pump").first().click(); await page.waitForTimeout(500);
  const delOne = async amountText => { await reload(); await page.getByText(amountText, { exact: true }).first().click(); await page.waitForTimeout(500); await page.getByText("🗑 Delete").click(); await page.waitForTimeout(400); await page.getByRole("button", { name: "Confirm" }).click(); await page.waitForTimeout(600); };
  const nT = (await ls("arth_txns")).length;
  await delOne("₹650");                                                // an expense that has NO refuel (its odometer was cleared)
  rec("F8a deleting an expense with no refuel leaves every refuel alone", (await ls("arth_txns")).length === nT - 1 && (await ls("arth_fuel_fills")).length === 1, {});
  await delOne("₹500");                                                // the expense the remaining refuel came from
  rec("F8b deleting the expense removes its linked refuel", (await ls("arth_txns")).length === nT - 2 && (await ls("arth_fuel_fills")).length === 0, { txns: (await ls("arth_txns")).length, fills: (await ls("arth_fuel_fills")).length });
  rec("F6 no page error", errors.length === 0, errors);
} catch (e) { rec("harness ran to the end", false, String(e).slice(0, 240)); if (process.env.FUEL_DEBUG) { await page.screenshot({ path: process.env.FUEL_DEBUG }); console.log((await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(500, 1600)); } }
await browser.close(); process.kill(-server.pid, "SIGTERM");
const failed = results.filter(r => !r.pass); console.log(`\n${results.length - failed.length}/${results.length} passed`); process.exit(failed.length ? 1 : 0);
