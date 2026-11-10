// The sign-in screen must fit the phone's width (no horizontal overflow). Chromium, local Vite dev server, no data. A CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4208, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(APP + "tools/auth-harness.html"); await page.waitForTimeout(1500);
const body = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 200);
console.log("START", await body());
console.log("AFTER", await body());
const m = await page.evaluate(() => { const els = [...document.querySelectorAll("input,button")].filter(e => e.offsetParent); return { scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, worst: Math.max(0, ...els.map(e => Math.round(e.getBoundingClientRect().right))) }; });
console.log("METRICS", JSON.stringify(m), m.scrollW <= m.innerW && m.worst <= m.innerW ? "FITS" : "OVERFLOWS");
await page.screenshot({ path: "/tmp/claude-0/-home-claude-repo/271b6b7c-7f32-56d9-9a55-d75ca8158c50/scratchpad/auth.png" });
await browser.close(); try { process.kill(-server.pid); } catch {}
