import test from "node:test";
import assert from "node:assert/strict";
import { classifyAuthCheck, canResumeOffline, isNetworkAuthError, OFFLINE_CHECK_TIMEOUT_MS } from "./offlineResume.js";

const retryable = Object.assign(new Error("Failed to fetch"), { name: "AuthRetryableFetchError" });
const sessionMissing = Object.assign(new Error("Auth session missing!"), { name: "AuthSessionMissingError" });
const apiError = Object.assign(new Error("invalid JWT"), { name: "AuthApiError", status: 401 });

test("a returned user is verified, whatever else is present", () => {
  assert.equal(classifyAuthCheck({ user: { id: "u1" } }), "verified");
  assert.equal(classifyAuthCheck({ user: { id: "u1" }, error: retryable }), "verified");
});
test("failing to reach the server (or not finishing in time) is 'unreachable', never 'signed-out'", () => {
  assert.equal(classifyAuthCheck({ error: retryable }), "unreachable");
  assert.equal(classifyAuthCheck({ error: new TypeError("Failed to fetch") }), "unreachable");
  assert.equal(classifyAuthCheck({ timedOut: true }), "unreachable");
});
test("a server answer that says there is no valid session is 'signed-out'", () => {
  assert.equal(classifyAuthCheck({ error: sessionMissing }), "signed-out");
  assert.equal(classifyAuthCheck({ error: apiError }), "signed-out");
  assert.equal(classifyAuthCheck({}), "signed-out");
  assert.equal(classifyAuthCheck(), "signed-out");
});
test("only network-type errors count as network errors", () => {
  assert.equal(isNetworkAuthError(retryable), true);
  assert.equal(isNetworkAuthError(sessionMissing), false);
  assert.equal(isNetworkAuthError(apiError), false);
  assert.equal(isNetworkAuthError(null), false);
});
test("offline resume needs a saved session AND finished setup AND saved data", () => {
  assert.equal(canResumeOffline({ sessionOnDevice: true, setupComplete: true, localMeaningful: true }), true);
  for (const missing of ["sessionOnDevice", "setupComplete", "localMeaningful"]) {
    const all = { sessionOnDevice: true, setupComplete: true, localMeaningful: true };
    assert.equal(canResumeOffline({ ...all, [missing]: false }), false, `without ${missing}`);
  }
  assert.equal(canResumeOffline(), false);
  assert.equal(canResumeOffline({}), false);
});
test("the startup wait is short enough to feel like offline, long enough for a slow link", () => {
  assert.ok(OFFLINE_CHECK_TIMEOUT_MS >= 3000 && OFFLINE_CHECK_TIMEOUT_MS <= 10000);
});
