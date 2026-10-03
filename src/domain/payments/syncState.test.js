import { test } from "node:test";
import assert from "node:assert/strict";
import { isPendingSync, offlineStripText, offlineSavedText } from "./syncState.js";

test("pending only when sync is on and the change is newer than the last sync", () => {
  const synced = "2026-10-03T05:00:00.000Z";
  const after = Date.parse("2026-10-03T06:00:00.000Z");
  const before = Date.parse("2026-10-03T04:00:00.000Z");
  assert.equal(isPendingSync(after, synced, true), true);
  assert.equal(isPendingSync(before, synced, true), false);
  assert.equal(isPendingSync(after, synced, false), false, "no cloud sync -> never claims it will sync");
  assert.equal(isPendingSync(after, "", true), false, "never synced -> no basis to claim pending");
  assert.equal(isPendingSync(undefined, synced, true), false);
});

test("strip and toast wording never promise a sync that is not set up", () => {
  assert.equal(offlineStripText("10:42", true), "Offline · showing what was last synced 10:42");
  assert.equal(offlineStripText("10:42", false), "Offline · everything is saved on this phone");
  assert.equal(offlineStripText("", true), "Offline · everything is saved on this phone");
  assert.match(offlineSavedText("Society Meter", true), /will sync/);
  assert.doesNotMatch(offlineSavedText("Society Meter", false), /sync/);
});
