import test from "node:test";
import assert from "node:assert/strict";
import { afterFingerprintMiss, MAX_ASKS, PIN_MESSAGES } from "./fingerprintAttempts.js";

test("three misses in a row ask again; the fourth hands over to the PIN", () => {
  assert.equal(MAX_ASKS, 4);
  for (const asks of [1, 2, 3]) assert.equal(afterFingerprintMiss({ asks, code: "authenticationFailed" }).action, "ask-again");
  assert.deepEqual(afterFingerprintMiss({ asks: 4, code: "authenticationFailed" }), { action: "use-pin", reason: "tries" });
  assert.equal(afterFingerprintMiss({ asks: 5, code: "" }).action, "use-pin");
});
test("choosing the PIN, or the phone refusing the sensor, goes straight to the PIN at any count", () => {
  assert.deepEqual(afterFingerprintMiss({ asks: 1, code: "userCancel" }), { action: "use-pin", reason: "chosen" });
  assert.deepEqual(afterFingerprintMiss({ asks: 1, code: "userFallback" }), { action: "use-pin", reason: "chosen" });
  assert.deepEqual(afterFingerprintMiss({ asks: 1, code: "biometryLockout" }), { action: "use-pin", reason: "phone" });
  assert.equal(afterFingerprintMiss({ asks: 1, code: "biometryNotEnrolled" }).action, "use-pin");
});
test("an unknown ending counts as a miss, and the messages say what happened", () => {
  assert.equal(afterFingerprintMiss({ asks: 2, code: "something-new" }).action, "ask-again");
  assert.equal(PIN_MESSAGES.chosen, ""); assert.match(PIN_MESSAGES.tries, /did not match/); assert.match(PIN_MESSAGES.phone, /not available/);
});
