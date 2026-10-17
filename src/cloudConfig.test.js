import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCloudConfig, PRODUCTION_SUPABASE_URL, PRODUCTION_SUPABASE_ANON_KEY } from "./cloudConfig.js";

const LOCAL = { url: "http://localhost:54399", key: "synthetic" };

test("production, local and Android builds behave exactly as before (fall back to the production project; dev bypass on `npm run dev`)", () => {
  for (const vercelEnv of ["production", ""]) {
    const c = resolveCloudConfig({ vercelEnv, dev: false });
    assert.deepEqual([c.url, c.key, c.configured], [PRODUCTION_SUPABASE_URL, PRODUCTION_SUPABASE_ANON_KEY, true], vercelEnv);
  }
  assert.equal(resolveCloudConfig({ dev: true }).configured, false, "dev bypass");
  assert.equal(resolveCloudConfig({ dev: true, forceBypass: "false" }).configured, true, "opt back in");
  assert.equal(resolveCloudConfig({ ...LOCAL, dev: true, forceBypass: "false" }).url, LOCAL.url);
});

test("a Vercel PREVIEW or DEVELOPMENT build never falls back to the production project: it runs local-only", () => {
  for (const vercelEnv of ["preview", "development"]) {
    const c = resolveCloudConfig({ vercelEnv });
    assert.deepEqual([c.configured, c.url, c.key], [false, "", ""], vercelEnv);
    assert.match(c.reason, /without-an-explicit-backend/);
    assert.equal(resolveCloudConfig({ vercelEnv, url: LOCAL.url }).configured, false, "a URL without a key is not a backend");
  }
});

test("a preview build uses an explicitly configured test backend, and REFUSES the production project even if configured by mistake", () => {
  const ok = resolveCloudConfig({ vercelEnv: "preview", ...LOCAL });
  assert.deepEqual([ok.configured, ok.url], [true, LOCAL.url]);
  const bad = resolveCloudConfig({ vercelEnv: "preview", url: PRODUCTION_SUPABASE_URL, key: "anything" });
  assert.equal(bad.configured, false); assert.match(bad.reason, /may-not-use-the-production-backend/);
  const badHost = resolveCloudConfig({ vercelEnv: "preview", url: PRODUCTION_SUPABASE_URL + "/", key: "k" });
  assert.equal(badHost.configured, false, "trailing slash or path does not slip through");
  // production builds may of course use the production project
  assert.equal(resolveCloudConfig({ vercelEnv: "production", url: PRODUCTION_SUPABASE_URL, key: "k" }).configured, true);
});
