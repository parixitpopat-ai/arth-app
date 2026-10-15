import { test } from "node:test";
import assert from "node:assert/strict";
import { decideSync, SYNC_ACTIONS as A } from "./decideSync.js";

const base = { networkOk: true, hasBase: true, baseToken: "T0", baseDigest: "D0", localDigest: "D0", localMeaningful: true, cloud: { token: "T0", digest: "D0", meaningful: true } };
const d = over => decideSync({ ...base, ...over, cloud: over.cloud === undefined ? base.cloud : over.cloud });

test("cloud unreachable: change nothing", () => assert.equal(d({ networkOk: false }).action, A.RETRY_LATER));

test("with history: in sync, local changed, cloud changed, both changed", () => {
  assert.equal(d({}).action, A.NOOP);
  assert.deepEqual([d({ localDigest: "D1" }).action, d({ localDigest: "D1" }).expectedToken], [A.PUSH, "T0"]);
  assert.equal(d({ cloud: { token: "T1", digest: "D2", meaningful: true } }).action, A.FAST_FORWARD);
  assert.equal(d({ localDigest: "D1", cloud: { token: "T1", digest: "D2", meaningful: true } }).action, A.CONFLICT);
});

test("with history: cloud moved but holds identical content (e.g. our own lost-reply write) is adopted, not a conflict", () => {
  assert.equal(d({ localDigest: "D1", cloud: { token: "T1", digest: "D1", meaningful: true } }).action, A.ADOPT_BASE);
});

test("timestamps and ages are not inputs: the decision depends only on tokens and digests", () => {
  assert.equal(decideSync.length, 1);
  assert.ok(!/savedAt|Date|now\(/.test(decideSync.toString()));
});

test("no cloud row: insert when there is data, otherwise nothing", () => {
  assert.equal(d({ cloud: null }).action, A.INSERT);
  assert.equal(d({ cloud: null, hasBase: false, baseToken: undefined, baseDigest: undefined, localMeaningful: false, localDigest: "E" }).action, A.NOOP);
});

test("no history (existing install, new device, account switch)", () => {
  const nh = { hasBase: false, baseToken: undefined, baseDigest: undefined };
  assert.equal(d({ ...nh, localDigest: "D2", cloud: { token: "T9", digest: "D2", meaningful: true } }).action, A.ADOPT_BASE, "identical: nothing differs");
  assert.equal(d({ ...nh, localMeaningful: false, localDigest: "E", cloud: { token: "T9", digest: "D2", meaningful: true } }).action, A.FAST_FORWARD, "empty device takes the cloud");
  assert.equal(d({ ...nh, localMeaningful: false, localDigest: "E", cloud: { token: "T9", digest: "E2", meaningful: false } }).action, A.ADOPT_BASE, "both empty");
  const p = d({ ...nh, localDigest: "L", cloud: { token: "T9", digest: "E2", meaningful: false } });
  assert.deepEqual([p.action, p.expectedToken], [A.PUSH, "T9"], "an empty cloud row is safely filled");
  assert.equal(d({ ...nh, localDigest: "L", cloud: { token: "T9", digest: "D2", meaningful: true } }).action, A.CONFLICT, "both have different data and no history: ask");
});

test("a conflict never carries an expected token to write against", () => {
  assert.equal(d({ localDigest: "D1", cloud: { token: "T1", digest: "D2", meaningful: true } }).expectedToken, undefined);
});
