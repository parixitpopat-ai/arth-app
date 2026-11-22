import test from "node:test";
import assert from "node:assert/strict";
import { detectSubscriptions, subscriptionTotals, merchantKey } from "./subscriptions.js";

const exp = (merchant, date, amount, o = {}) => ({ id: `${merchant}${date}`, type: "expense", merchant, date, amount, ...o });
const monthly = (m, amt, months) => months.map(mo => exp(m, `2026-${mo}-05`, amt));

test("a merchant paid every month for the same amount is a monthly subscription", () => {
  const r = detectSubscriptions({ txns: monthly("Netflix", 649, ["07", "08", "09", "10", "11"]), today: "2026-11-22" });
  assert.deepEqual(r.map(x => [x.merchant, x.cadence, x.amount, x.monthly, x.count, x.next, x.active]), [["Netflix", "monthly", 649, 649, 5, "2026-12-05", true]]);
});

test("two visits, a shop with varying amounts, or an uneven gap are not subscriptions", () => {
  assert.equal(detectSubscriptions({ txns: monthly("Gym", 1000, ["10", "11"]), today: "2026-11-22" }).length, 0);
  assert.equal(detectSubscriptions({ txns: [exp("Cafe", "2026-08-03", 200), exp("Cafe", "2026-09-04", 480), exp("Cafe", "2026-10-05", 90), exp("Cafe", "2026-11-05", 350)], today: "2026-11-22" }).length, 0);
  assert.equal(detectSubscriptions({ txns: [exp("Dosa", "2026-10-01", 100), exp("Dosa", "2026-10-03", 100), exp("Dosa", "2026-11-20", 100)], today: "2026-11-22" }).length, 0);
});

test("a yearly charge needs two years, and the price may creep up a little", () => {
  const r = detectSubscriptions({ txns: [exp("Amazon Prime", "2025-03-10", 1499), exp("Amazon Prime", "2026-03-10", 1499)], today: "2026-11-22" });
  assert.deepEqual([r[0].cadence, r[0].monthly], ["yearly", 124.92]);
  assert.equal(detectSubscriptions({ txns: [exp("Spotify", "2026-08-01", 119), exp("Spotify", "2026-09-01", 119), exp("Spotify", "2026-10-01", 129), exp("Spotify", "2026-11-01", 129)], today: "2026-11-22" }).length, 1);
});

test("one that stopped is listed as not active and left out of the total; dismissed and claim-only ones are skipped", () => {
  const old = monthly("OldApp", 100, ["01", "02", "03", "04"]);
  const r = detectSubscriptions({ txns: [...old, ...monthly("Netflix", 649, ["09", "10", "11"])], today: "2026-11-22" });
  assert.deepEqual(r.map(x => [x.merchant, x.active]), [["Netflix", true], ["OldApp", false]]);
  assert.deepEqual(subscriptionTotals(r), { count: 1, monthly: 649, yearly: 7788 });
  assert.equal(detectSubscriptions({ txns: monthly("Netflix", 649, ["09", "10", "11"]), today: "2026-11-22", dismissed: [merchantKey("Netflix")] }).length, 0);
  assert.equal(detectSubscriptions({ txns: monthly("Netflix", 649, ["09", "10", "11"]).map(t => ({ ...t, claimOnly: true })), today: "2026-11-22" }).length, 0);
});

test("the same merchant written differently counts once", () => {
  const t = [exp("NETFLIX.COM", "2026-09-05", 649), exp("Netflix India", "2026-10-05", 649), exp("netflix", "2026-11-05", 649)];
  assert.equal(detectSubscriptions({ txns: t, today: "2026-11-22" }).length, 1);
});
