// The Welcome / session-unknown / first-run profile screens must fit a phone's width (no horizontal overflow). Chromium, local Vite server, no data. A CHROMIUM check only.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const PORT = 4209, APP = `http://localhost:${PORT}/`;
const server = spawn("node", ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch(APP)).ok) break; } catch {} await new Promise(r => setTimeout(r, 300)); }
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let bad = 0;
for (const w of [320, 360, 390]) for (const s of ["welcome", "unknown", "profile"]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: 740 }, deviceScaleFactor: 2 })).newPage();
  await page.goto(`${APP}tools/welcome-harness.html?s=${s}`); await page.waitForTimeout(1200);
  const m = await page.evaluate(() => { const els = [...document.querySelectorAll("input,button,div")].filter(e => e.offsetParent); let worst = 0; for (const e of els) worst = Math.max(worst, Math.ceil(e.getBoundingClientRect().right)); return { scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, worst, text: document.body.innerText.replace(/\s+/g, " ").slice(0, 40) }; });
  const ok = m.scrollW <= m.innerW && m.worst <= m.innerW; if (!ok) bad++;
  console.log(ok ? "FITS    " : "OVERFLOWS", w, s, JSON.stringify(m));
}
await browser.close(); try { process.kill(-server.pid); } catch {}
process.exit(bad ? 1 : 0);
