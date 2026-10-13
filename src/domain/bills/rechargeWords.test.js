import test from "node:test";
import assert from "node:assert/strict";
import { getRechargeWords } from "./rechargeWords.js";
import { isRechargeBiller, isSubscriptionBiller } from "./commitments.js";

test("a streaming subscription is paid first and used after, like a prepaid recharge, and reads as a renewal", () => {
  assert.equal(isRechargeBiller("OTT / Streaming"), true);
  assert.equal(isSubscriptionBiller("OTT / Streaming"), true);
  const w = getRechargeWords("OTT / Streaming");
  assert.equal(w.kind, "subscription");
  assert.equal(w.button, "Record renewal");
  assert.deepEqual(w.presets.map(p => p.days), [30, 90, 365]);
});

test("prepaid types keep the recharge wording and have no period presets", () => {
  for (const c of ["Mobile Prepaid", "DTH", "Fastag"]) {
    assert.equal(getRechargeWords(c).kind, "recharge");
    assert.equal(isSubscriptionBiller(c), false);
  }
  assert.equal(getRechargeWords("Mobile Prepaid").button, "Record recharge");
});

test("postpaid and utility bills are not paid-first connections", () => {
  for (const c of ["Mobile Postpaid", "Electricity", "Broadband", "Landline"]) assert.equal(isRechargeBiller(c), false, c);
});

test("the details heading follows the kind", () => {
  assert.equal(getRechargeWords("Mobile Prepaid").details, "RECHARGE DETAILS");
  assert.equal(getRechargeWords("OTT / Streaming").details, "SUBSCRIPTION DETAILS");
});
