// Draws Arth's start-up splash (white ₹ on deep green) over Capacitor's default blue "X" splash, in every size the Android project has.
// Re-run: node tools/android/make-splash.mjs
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const RES = "android/app/src/main/res", GREEN = "#15803d";
const rupee = `<path d="M28 24 H72 M28 41 H72 M36 24 H48 C66 24 66 58 48 58 H36 L66 92" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
const sizes = { "drawable": [480, 320], "drawable-land-mdpi": [480, 320], "drawable-land-hdpi": [800, 480], "drawable-land-xhdpi": [1280, 720], "drawable-land-xxhdpi": [1600, 960], "drawable-land-xxxhdpi": [1920, 1280],
  "drawable-port-mdpi": [320, 480], "drawable-port-hdpi": [480, 800], "drawable-port-xhdpi": [720, 1280], "drawable-port-xxhdpi": [960, 1600], "drawable-port-xxxhdpi": [1280, 1920] };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
for (const [dir, [w, h]] of Object.entries(sizes)) {
  const g = Math.round(Math.min(w, h) * 0.34);                 // glyph box: a third of the short side, centred
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<body style="margin:0;background:${GREEN}"><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><svg x="${(w - g) / 2}" y="${(h - g) / 2 - g * 0.08}" width="${g}" height="${g}" viewBox="0 0 100 100">${rupee}</svg></svg></body>`);
  await page.screenshot({ path: `${RES}/${dir}/splash.png`, clip: { x: 0, y: 0, width: w, height: h } });
}
await browser.close();
console.log("splash images drawn:", Object.keys(sizes).length);
