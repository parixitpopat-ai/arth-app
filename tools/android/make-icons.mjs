// Draws Arth's launcher icon (white ₹ on deep green) into the Android res folders. Re-run: node tools/android/make-icons.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";
const RES = "android/app/src/main/res", GREEN = "#15803d";
const rupee = (stroke) => `<path d="M28 24 H72 M28 41 H72 M36 24 H48 C66 24 66 58 48 58 H36 L66 92" fill="none" stroke="${stroke}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
// glyph occupies the middle of the canvas so it survives every launcher mask (adaptive icons keep the centre ~66%)
const svg = (kind, px) => {
  const g = kind === "fg" ? `<g transform="translate(26 26) scale(0.48)">${rupee("#fff")}</g>` : `<g transform="translate(24 24) scale(0.52)">${rupee("#fff")}</g>`;
  const bg = kind === "square" ? `<rect width="100" height="100" rx="22" fill="${GREEN}"/>` : kind === "round" ? `<circle cx="50" cy="50" r="50" fill="${GREEN}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 100 100">${bg}${g}</svg>`;
};
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
const draw = async (kind, px, file) => {
  await page.setViewportSize({ width: px, height: px });
  await page.setContent(`<body style="margin:0;background:transparent">${svg(kind, px)}</body>`);
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: px, height: px } });
};
const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }, adaptive = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
for (const d of Object.keys(legacy)) {
  const dir = `${RES}/mipmap-${d}`; mkdirSync(dir, { recursive: true });
  await draw("square", legacy[d], `${dir}/ic_launcher.png`); await draw("round", legacy[d], `${dir}/ic_launcher_round.png`); await draw("fg", adaptive[d], `${dir}/ic_launcher_foreground.png`);
}
await page.setViewportSize({ width: 512, height: 512 }); await draw("square", 512, "/tmp/claude-0/-home-claude-repo/271b6b7c-7f32-56d9-9a55-d75ca8158c50/scratchpad/arth-icon-preview.png");
await browser.close();
