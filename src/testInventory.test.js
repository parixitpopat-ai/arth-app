// Every *.test.js file must be in the explicit `npm test` list (package.json), or it silently never runs.
// A file may be left out only if it is named here with its reason.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RETIRED = {
  "adapter.test.js": "Stray root-level copy of an early (255-line) domain/allocations/adapter.js. Nothing imports the root adapter.js; the live adapter and its tests are in domain/allocations/. It asserts superseded behaviour (e.g. a household zero override falling through), which contradicts the locked D4 rule. See docs/engineering/TEST-INVENTORY-001.md.",
};

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else if (name.endsWith(".test.js")) out.push(p.replace(/^\.\//, ""));
  }
  return out;
};

test("every test file is registered in npm test, or retired here with a reason", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const registered = new Set(pkg.scripts.test.split(/\s+/).filter(x => x.endsWith(".test.js")));
  const missing = walk(".").filter(f => !registered.has(f) && !(f in RETIRED));
  assert.deepEqual(missing, [], `Not in npm test: ${missing.join(", ")}`);
});

test("every registered test file exists", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const gone = pkg.scripts.test.split(/\s+/).filter(x => x.endsWith(".test.js")).filter(f => { try { statSync(f); return false; } catch { return true; } });
  assert.deepEqual(gone, []);
});
