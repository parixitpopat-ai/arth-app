// Account-switching parity check: the same steps on two builds must give the same outcome.
//   device signs in as A (cloud holds A's data) -> signs out -> signs in as B (cloud empty or holds other data).
// Usage: OFFLINE_DIST=<build made against the fake backend> node tools/offline-startup/switch.mjs   (prints one JSON line)
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { startFakeSupabase } from "./fakeSupabase.mjs";
import * as L from "./lib.mjs";
const DIST = process.env.OFFLINE_DIST;
const web = http.createServer((req, res) => { const p = new URL(req.url, "http://x").pathname; let f = path.join(DIST, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, "index.html"); res.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".css") ? "text/css" : "text/html" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => web.listen(5233, r)); const URL_ = "http://localhost:5233/";
const fake = await startFakeSupabase({ users: {} });
const A = "account-a@example.invalid", B = "account-b@example.invalid";
const BASE = L.syntheticTxns("A", 12), BTXNS = L.syntheticTxns("Z", 5);
const snap = txns => ({ ...L.syntheticSnapshot(txns, new Date().toISOString()), masterUserSetupComplete: true });
fake.resetAccounts(); const ua = fake.addAccount(A), ub = fake.addAccount(B);
fake.rows.set(ua.id, { snapshot: JSON.parse(JSON.stringify(snap(BASE))), micros: BigInt(Date.now()) * 1000n });
if (process.env.B_HAS_DATA === "1") fake.rows.set(ub.id, { snapshot: JSON.parse(JSON.stringify(snap(BTXNS))), micros: BigInt(Date.now()) * 1000n });
const { browser, device } = await L.launch();
const d = await device("phone", { signedIn: false }); const page = d.page;
const body = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
async function login(email) {
  await page.goto(URL_, { waitUntil: "networkidle" }); await page.waitForTimeout(600);
  await page.getByText("Sign In", { exact: true }).click(); await page.waitForTimeout(400);
  await page.getByPlaceholder("Email address").fill(email); await page.getByRole("button", { name: "Send OTP" }).click(); await page.waitForTimeout(700);
  await page.getByPlaceholder("······").fill("123456"); await page.getByRole("button", { name: /Verify/ }).click(); await page.waitForTimeout(3000);
  if (await page.getByPlaceholder("e.g. Priya Sharma").count()) { await page.getByPlaceholder("e.g. Priya Sharma").fill("Synthetic Tester"); await page.getByRole("button", { name: /Continue into Arth/ }).click(); await page.waitForTimeout(1500); }
  await L.pin(page, true).catch(() => {}); await page.waitForTimeout(2500);
}
await login(A);
const aIds = await L.localTxnIds(page);
await L.openCloudSettings(page); await page.getByText("Sign Out", { exact: true }).click(); await page.waitForTimeout(2000);
const afterOut = { welcome: /Welcome to Arth/.test(await body()), localKept: (await L.localTxnIds(page)).length };
await login(B);
let sawChoice = /Two versions of your data found/.test(await body());
if (sawChoice && process.env.CHOICE) { await page.getByRole("button", { name: new RegExp(process.env.CHOICE === "local" ? "Keep this device" : "Use the cloud version") }).click(); await page.waitForTimeout(3000); }
await page.waitForTimeout(2500);
const out = {
  step1_A_localIds: aIds.length, afterSignOut: afterOut,
  afterSignInAsB: { choiceScreen: sawChoice, local: (await L.localTxnIds(page)).sort().join(",").slice(0, 60) + "…", localCount: (await L.localTxnIds(page)).length },
  cloudA: (fake.rows.get(ua.id)?.snapshot?.txns || []).length, cloudB: (fake.rows.get(ub.id)?.snapshot?.txns || []).length,
};
console.log("SWITCH " + JSON.stringify(out));
await browser.close(); web.close(); process.exit(0);
