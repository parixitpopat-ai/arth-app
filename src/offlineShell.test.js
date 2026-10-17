import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = rel => readFileSync(new URL(rel, import.meta.url), "utf8");

test("the service worker is registered only in production builds, over http(s), outside the native app", () => {
  const main = read("./main.jsx");
  assert.ok(main.includes("import.meta.env.PROD"), "production only");
  assert.ok(main.includes("^https?:$"), "http(s) only (not file:// in the desktop app)");
  assert.ok(main.includes("Capacitor?.isNativePlatform?.()"), "not inside the native Android app");
  assert.ok(main.includes("register('/sw.js')"));
});
test("the service worker leaves everything but its own GET requests alone", () => {
  const sw = read("../public/sw.js");
  assert.ok(sw.includes('req.method !== "GET"'), "ignores non-GET");
  assert.ok(sw.includes("url.origin !== self.location.origin"), "ignores cross-origin (the cloud service)");
  assert.ok(!/localStorage|indexedDB|\/rest\/v1|\/auth\/v1|supabase/i.test(sw), "knows nothing about stored data or the cloud service");
});
test("the page is network first so a new deployment is used as soon as there is a connection", () => {
  const sw = read("../public/sw.js");
  const nav = sw.slice(sw.indexOf('req.mode === "navigate"'), sw.indexOf("url.pathname.startsWith"));
  assert.ok(nav.indexOf("await fetch(req)") !== -1 && nav.indexOf("caches.match") > nav.indexOf("await fetch(req)"), "network, then cache as the fallback");
});
test("offline resume wiring: cloud user stays empty and sync stays off while unverified; first-sign-in path after reconnect", () => {
  const app = read("./App.jsx");
  assert.ok(/function enterOfflineResume|const enterOfflineResume = \(\) => \{[\s\S]*?setCloudUser\(null\)/.test(app), "no cloud user while offline-resumed");
  assert.ok(app.includes("sessionRestoredOnBootRef.current = !fromOffline"), "not a plain returning device after an offline resume");
  assert.ok(app.includes("if(isCloudSyncConfigured && !offlineResume){"), "sign-in wall bypassed only while offline-resumed");
  assert.ok(app.includes("canResumeOffline({"), "resume gated by canResumeOffline");
});
