import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isNaturalLanguageEntryEnabled as on } from "./naturalLanguageGate.js";

test("off by default: no query, empty query, nothing passed", () => {
  for (const s of ["", "?", undefined, null, 0]) assert.equal(on(s), false, String(s));
});
test("on only for exactly nl=1, with or without a leading ?", () => {
  assert.equal(on("?nl=1"), true);
  assert.equal(on("nl=1"), true);
  // window.location.search never contains the #fragment, so a fragment cannot reach the gate.
});
test("unrelated query parameters neither enable it nor stop it being enabled", () => {
  for (const s of ["?foo=bar", "?utm_source=x&ref=y", "?cfError=1", "?debug=1", "?xnl=1", "?nl_=1", "?a=nl&b=1", "?q=nl%3D1"]) assert.equal(on(s), false, s);
  assert.equal(on("?utm=1&nl=1&foo=bar"), true);
  assert.equal(on("?foo=bar&nl=1"), true);
});
test("near misses stay off", () => {
  for (const s of ["?nl=0", "?nl=", "?nl", "?nl=true", "?nl=yes", "?nl=11", "?nl=%201", "?NL=1", "?nl=1&nl=0", "?nl=0&nl=1", "?nl=1&nl=1"]) assert.equal(on(s), false, s);
});
test("the gate is a pure function of the address: it keeps no state between calls", () => {
  assert.equal(on("?nl=1"), true);
  assert.equal(on(""), false, "a later call without the parameter is off again");
  assert.equal(on("?nl=1"), true);
});
test("App.jsx wiring: the input is rendered only when the gate is on, and parsing is inert without it", () => {
  const src = readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");
  assert.ok(src.includes('isNaturalLanguageEntryEnabled(window.location.search)'), "gate reads the address");
  assert.ok(/\{nlEnabled&&\(\s*<div data-testid="qa-nl"/.test(src), "input block is wrapped in the gate");
  assert.ok(/const fillFromText = \(\) => \{\s*if\(!nlEnabled\) return;/.test(src), "fill does nothing when off");
  assert.ok(!/localStorage[^\n]*\bnl\b/i.test(src.slice(src.indexOf("const [nlEnabled]"), src.indexOf("const fillFromText"))), "gate stores nothing");
});
