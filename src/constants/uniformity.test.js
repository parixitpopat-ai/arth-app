// The app uses one colour theme and one set of fonts. This fails if an old hard-coded interface colour, a second typeface, or black text on the accent comes back.
// Colours that identify a category, an investment type, a group or a person (theme.js, constants/appConstants.js, the vehicle chart colours, "#888" for an unknown one) are data, not interface, and are allowed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const files = [];
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|jsx)$/.test(n) && !/\.test\.js$/.test(n) && !/__test__|__tests__/.test(p) && !p.endsWith("constants/theme.js") && !p.endsWith("constants/appConstants.js") && !p.endsWith("domain/vehicles/vehicleFinancials.js")) files.push(p);
  }
})(root);

const BANNED = [
  [/#f0a500|rgba\(240, ?165, ?0,/i, "the old amber: use T.warn / T.attentionSoft (DARK.warn on a screen that is always dark)"],
  [/#16a34a|#22c55e/i, "the old greens: use T.success / T.accent (DARK.accent on a screen that is always dark)"],
  [/#f0fdf4|#1e1e28|#13131a|#5a5a7a|#2a2a3a|#888888/i, "an old interface colour: use the theme"],
  [/color: ?"#000"/, "black text on the accent: use T.accentInk"],
  [/IBM Plex|Nunito|Instrument Sans/, "a second typeface: the app uses Inter (Manrope only on big money numbers)"],
  [/fontFamily: ?"monospace"/, "a monospace font: the app uses Inter"],
];

test("no old hard-coded interface colours, no second typeface, no black text on the accent", () => {
  const hits = [];
  for (const f of files) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((l, i) => {
      if (/^\s*\/\//.test(l)) return;   // a comment may name the old colour
      for (const [rx, why] of BANNED) if (rx.test(l)) hits.push(`${f.replace(root, "src/")}:${i + 1} ${why}`);
    });
  }
  assert.deepEqual(hits, [], "\n" + hits.join("\n"));
});

test("fonts are bundled, not fetched from Google", () => {
  const main = readFileSync(join(root, "main.jsx"), "utf8");
  assert.match(main, /@fontsource\/inter\/latin-ext-400\.css/);      // the rupee sign lives only in the latin-ext files
  assert.match(main, /@fontsource\/manrope\/latin-ext-700\.css/);
  for (const f of files) assert.doesNotMatch(readFileSync(f, "utf8"), /fonts\.googleapis\.com/, f);
});

test("the page itself is Inter, and tick boxes follow the accent", () => {
  const app = readFileSync(join(root, "App.jsx"), "utf8");
  assert.match(app, /html,body\{font-family:Inter/);
  assert.match(app, /accent-color:\$\{T\.accent\}/);
});
