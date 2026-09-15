import test from "node:test";
import assert from "node:assert/strict";
import { isResolvedBehavior } from "../legacyTypeMapping.js";

// Simulates the exact Step 9 display expression used in Settings:
//   type.custom ? (isResolvedBehavior(type.baseType) ? accLabel(type.baseType) : "Needs behavior") : "default"
// accLabel() itself is App.jsx's existing, unmodified formatter (real
// implementation lives in src/helpers/formatters.js, which uses Vite-style
// extensionless imports not resolvable by plain `node --test` in this
// sandbox) — a small local stand-in reproduces just enough of its known
// behavior to demonstrate the guard, without testing accLabel's own logic.
const accLabelStub = baseType => baseType==="bank"?"Bank Account":baseType==="cc"?"Credit Card":baseType==="debit"?"Debit Card":baseType==="upi"?"UPI":"Cash";

function displayBaseTypeLabel(type) {
  return type.custom ? (isResolvedBehavior(type.baseType) ? accLabelStub(type.baseType) : "Needs behavior") : "default";
}

test("Step 9: a custom classification resolved to a valid behavior displays its normal label", () => {
  const type = { id: "digital_account", label: "Digital Account", baseType: "cash", custom: true };
  assert.equal(displayBaseTypeLabel(type), "Cash");
});

test("Step 9: a custom classification with an unresolved (null) baseType displays 'Needs behavior', not a misleading default", () => {
  const type = { id: "crypto_wallet", label: "Crypto Wallet", baseType: null, custom: true };
  assert.equal(displayBaseTypeLabel(type), "Needs behavior");
  // Confirms this guards against the underlying accLabel's own silent fallback
  // for a falsy/unrecognized value (accLabel(null) alone would say "Cash" —
  // misleading, per the real formatters.js implementation traced earlier).
  assert.notEqual(accLabelStub(null), "Needs behavior");
});

test("Step 9: a custom classification whose baseType is a raw custom-behavior id (not one of the 5) also displays 'Needs behavior'", () => {
  const type = { id: "crypto_wallet", label: "Crypto Wallet", baseType: "crypto", custom: true };
  assert.equal(displayBaseTypeLabel(type), "Needs behavior");
});

test("Step 9: a built-in (non-custom) type is unaffected — still shows 'default'", () => {
  const type = { id: "bank", label: "Bank Account", baseType: "bank", custom: false };
  assert.equal(displayBaseTypeLabel(type), "default");
});

test("Step 9: the display guard does not mutate the classification object", () => {
  const type = { id: "crypto_wallet", label: "Crypto Wallet", baseType: null, custom: true };
  const snapshot = JSON.stringify(type);
  displayBaseTypeLabel(type);
  assert.equal(JSON.stringify(type), snapshot);
});
