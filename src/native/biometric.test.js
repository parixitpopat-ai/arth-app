import test from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis.window || {};
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
const { biometricOn, setBiometricOn, biometricAvailable, confirmBiometric } = await import("./biometric.js");

test("off until the person turns it on, and the choice is kept", () => {
  assert.equal(biometricOn(), false);
  setBiometricOn(true); assert.equal(biometricOn(), true);
  setBiometricOn(false); assert.equal(biometricOn(), false);
});
test("on a phone with a fingerprint it is offered; confirmation is true only when the phone says so", async () => {
  window.__ARTH_BIO_TEST__ = { available: true, result: true };
  assert.equal(await biometricAvailable(), true); assert.equal(await confirmBiometric(), true);
  window.__ARTH_BIO_TEST__ = { available: true, result: false };
  assert.equal(await confirmBiometric(), false);
  window.__ARTH_BIO_TEST__ = { available: true, result: "error" };
  assert.equal(await confirmBiometric(), false);
  window.__ARTH_BIO_TEST__ = { available: false, result: true };
  assert.equal(await biometricAvailable(), false);
});
test("in a browser (no phone, no test hook) it is never offered and never confirms", async () => {
  delete window.__ARTH_BIO_TEST__;
  assert.equal(await biometricAvailable(), false); assert.equal(await confirmBiometric(), false);
});
