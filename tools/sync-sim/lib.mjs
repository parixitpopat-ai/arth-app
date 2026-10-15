// Shared helpers for the isolated sync-safety harness. SYNTHETIC DATA ONLY.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const APP = "http://localhost:5196/";
export const FAKE = "http://127.0.0.1:54399";
export const USER = { id: "synthetic-user-0001", email: "sync-test-a@example.invalid", aud: "authenticated", role: "authenticated" };
export const TOKEN = "synthetic-token-A";

const day = n => new Date(Date.UTC(2026, 9, 1 + n)).toISOString().slice(0, 10);
export function syntheticTxns(prefix, n, startId = 1) {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${String(startId + i).padStart(3, "0")}`, type: "expense", desc: `Synthetic expense ${startId + i}`, merchant: "SYN",
    date: day(i % 12), amount: 100 + (startId + i) * 7, catId: "food", catIds: ["food"], accId: "syn_bank", people: {},
  }));
}
export function syntheticSnapshot(txns, savedAt) {
  return {
    version: 1, savedAt, dark: true, masterUserSetupComplete: true,
    accounts: [{ id: "syn_bank", name: "SYN Bank", type: "bank", balance: 100000, color: "#3b82f6" }],
    txns, bills: [], people: [], groups: [], billerAccounts: [], memberships: [], membershipRelationships: [],
    planNudges: {}, contributions: [], loans: [], investments: [],
  };
}
export const sha256 = s => crypto.createHash("sha256").update(s).digest("hex");

// Immutable export: written once, made read-only, hashed; verify() re-reads and compares.
export function writeImmutableExport(dir, name, obj) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name); const text = JSON.stringify(obj, null, 2);
  if (fs.existsSync(file)) { try { fs.chmodSync(file, 0o644); } catch {} }
  fs.writeFileSync(file, text); fs.chmodSync(file, 0o444);
  return { file, sha256: sha256(text), bytes: text.length };
}
export function verifyExport(e) { return sha256(fs.readFileSync(e.file, "utf8")) === e.sha256; }   // write-once + SHA-256; chmod 444 is advisory when run as root

export async function launch() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const blocked = [];     // any request that is not localhost = production leak attempt
  async function device(name, { seedLocal } = {}) {
    const ctx = await browser.newContext({ timezoneId: "Asia/Kolkata", viewport: { width: 420, height: 900 } });
    await ctx.route(url => { try { const h = new URL(url).hostname; return !["localhost", "127.0.0.1"].includes(h); } catch { return false; } },
      route => { blocked.push(route.request().url()); route.abort(); });
    await ctx.addInitScript(({ user, token, seed }) => {
      if (!localStorage.getItem("__init_done")) {
        localStorage.setItem("sb-localhost-auth-token", JSON.stringify({ access_token: token, refresh_token: "synthetic-refresh", token_type: "bearer", expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user }));
        localStorage.setItem("__init_done", "1");
        if (seed) for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
      }
    }, { user: USER, token: TOKEN, seed: seedLocal });
    const page = await ctx.newPage(); const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    return { name, ctx, page, errors };
  }
  return { browser, device, blocked };
}

export async function pin(page, firstTime) {
  const press = async () => { for (const d of ["1", "2", "3", "4"]) { await page.getByRole("button", { name: d, exact: true }).click(); await page.waitForTimeout(60); } await page.waitForTimeout(500); };
  await page.waitForTimeout(700);
  if (await page.getByRole("button", { name: "1", exact: true }).count()) { await press(); if (firstTime) await press(); }
}
export const localTxnIds = page => page.evaluate(() => JSON.parse(localStorage.getItem("arth_txns") || "[]").map(t => String(t.id)).sort());
export const cloudTxnIds = (fake, uid) => ((fake.rows.get(uid)?.snapshot?.txns) || []).map(t => String(t.id)).sort();

export async function addExpense(page, desc, amount) {
  await page.getByText("+", { exact: true }).first().click(); await page.waitForTimeout(500);
  await page.getByPlaceholder("0").first().fill(String(amount));
  await page.getByPlaceholder("e.g. Petrol, Swiggy, Netflix").fill(desc);
  await page.getByRole("button", { name: "Pick one" }).click(); await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Food & Dining/ }).click(); await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Save Expense/ }).click(); await page.waitForTimeout(150);
}
export const localTxns = page => page.evaluate(() => JSON.parse(localStorage.getItem("arth_txns") || "[]"));
export const localBackups = page => page.evaluate(() => JSON.parse(localStorage.getItem("arth_auto_backups") || "[]").map(b => ({ type: b.backupType, at: b.exportedAt, ids: (b.snapshot?.txns || []).map(t => String(t.id)) })));
export const setFaults = (f) => fetch(FAKE + "/__ctl/faults", { method: "POST", body: JSON.stringify(f) }).then(r => r.json());
export async function bodyText(page) { return page.evaluate(() => document.body.innerText); }
export const diff = (expected, actual) => ({ missing: expected.filter(x => !actual.includes(x)), unexpected: actual.filter(x => !expected.includes(x)) });

export async function openCloudSettings(page) {
  await page.getByText("☰", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/claude-0/-home-claude-repo/271b6b7c-7f32-56d9-9a55-d75ca8158c50/scratchpad/sync_dbg.png" });
  await page.getByText("⚙️", { exact: true }).first().dispatchEvent("click"); await page.waitForTimeout(500);
  await page.getByText("Cloud Sync & Account", { exact: true }).click(); await page.waitForTimeout(400);
}
export async function cloudPanelText(page) { await openCloudSettings(page); const t = await bodyText(page); return t.slice(t.indexOf("Cloud Sync & Account"), t.indexOf("HOME")).replace(/\n/g, " | "); }
export async function pressSyncNow(page) { await page.getByText("Sync Now").first().click(); await page.waitForTimeout(2000); }
