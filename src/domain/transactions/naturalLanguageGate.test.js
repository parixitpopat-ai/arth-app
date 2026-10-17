import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isNaturalLanguageEntryEnabled as on } from "./naturalLanguageGate.js";

test("on by default: no query, empty query, nothing passed", () => {
  for (const s of ["", "?", undefined, null, 0]) assert.equal(on(s), true, String(s));
});
test("?nl=1 and unrelated parameters leave it on", () => {
  for (const s of ["?nl=1", "nl=1", "?foo=bar", "?utm_source=x&ref=y", "?cfError=1", "?xnl=0", "?a=nl&b=0", "?q=nl%3D0", "?utm=1&nl=1&foo=bar"]) assert.equal(on(s), true, s);
});
test("off only for exactly one nl=0", () => {
  assert.equal(on("?nl=0"), false);
  assert.equal(on("nl=0"), false);
  assert.equal(on("?utm=1&nl=0&foo=bar"), false);
  assert.equal(on("?foo=bar&nl=0"), false);
});
test("near misses stay on (the switch never turns itself off by accident)", () => {
  for (const s of ["?nl=", "?nl", "?nl=false", "?nl=off", "?nl=00", "?nl=%200", "?NL=0", "?nl=0&nl=0", "?nl=0&nl=1", "?nl=1&nl=0"]) assert.equal(on(s), true, s);
});
test("the switch is a pure function of the address: it keeps no state between calls", () => {
  assert.equal(on("?nl=0"), false);
  assert.equal(on(""), true, "a later call without the parameter is on again");
  assert.equal(on("?nl=0"), false);
});
test("App.jsx wiring: the input is rendered through the switch, and parsing is inert when it is off", () => {
  const src = readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");
  assert.ok(src.includes("isNaturalLanguageEntryEnabled(window.location.search)"), "switch reads the address");
  assert.ok(/\{nlEnabled&&\(\(\)=>\{[\s\S]*?<div data-testid="qa-nl"/.test(src), "input block is wrapped in the switch");
  assert.ok(/const fillFromText = \(\) => \{\s*if\(!nlEnabled/.test(src), "fill does nothing when off");
  assert.ok(!/localStorage[^\n]*\bnl\b/i.test(src.slice(src.indexOf("const [nlEnabled]"), src.indexOf("const fillFromText"))), "the switch stores nothing");
});
