// Guards for two defects that stopped a person/group breakup by item on an itemised expense (found on a real phone). The behaviour itself is exercised end to end by
// tools/invoice-import/itemised-people-browser.mjs (real screen). These static checks keep the two fixes from being reverted by accident.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(here, "..", "..", "App.jsx"), "utf8");

test("editing an expense saved with no split opens in the normal mode, so 'Who is this for?' (allocate/unified only) is available", () => {
  assert.match(app, /const initialTrackingMode = savedTrackingMode==="none" \? "unified" : savedTrackingMode;/);
  assert.match(app, /txnType==="expense"&&\(splitMode==="allocate"\|\|splitMode==="unified"\)&&\(\s*\n\s*<div>\s*\n\s*<span style=\{lbl\}>Who is this for\?/);
});

test("'Link to specific items instead' really switches item mode on (and 'Use flat amount instead' switches it off)", () => {
  assert.match(app, /const useItems = Boolean\(row\.byItems\) \|\| \(row\.items\|\|\[\]\)\.length>0;/);
  assert.match(app, /useItems\?\{\.\.\.r,items:\[\],byItems:false\}:\{\.\.\.r,items:\[\],byItems:true,amount:""\}/);
  assert.doesNotMatch(app, /r\.id===row\.id\?\{\.\.\.r,items: \[\]\}:r\)\)\} style=\{\{ background:"none"/);     // the old no-op toggle
});
