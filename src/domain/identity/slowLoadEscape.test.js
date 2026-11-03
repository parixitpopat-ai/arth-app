import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = rel => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

test("both account-loading screens offer the way in from the saved data after a wait, and the returning-device one can show a pending backup-file request", () => {
  const app = read("../../App.jsx");
  assert.match(app, /import SlowLoadEscape from "\.\/components\/SlowLoadEscape"/);
  assert.match(app, /<SlowLoadEscape T=\{T\} label="Checking your account…" onOpenLocal=\{\(\)=>offlineReenterRef\.current\?\.\(\)\}\/>/);
  assert.match(app, /return <>\{fileBackupSheet\}<SlowLoadEscape T=\{T\} label="Loading your data…" onOpenLocal=\{\(\)=>offlineReenterRef\.current\?\.\(\)\}\/><\/>;/);
  assert.equal(/>Loading your data…<\/div>/.test(app), false);          // no bare, endless "Loading your data…" is left
});

test("the escape appears after a delay, opens the saved data without deleting or changing anything, and offers a reload", () => {
  const c = read("../../components/SlowLoadEscape.jsx");
  assert.match(c, /afterMs = 12000/);
  assert.match(c, /data-testid="slow-load-open" onClick=\{onOpenLocal\}/);
  assert.match(c, /window\.location\.reload\(\)/);
  for (const bad of ["localStorage", "sessionStorage", "indexedDB", "removeItem", "clear(", "fetch(", "signOut"]) assert.equal(c.includes(bad), false, bad);
});
