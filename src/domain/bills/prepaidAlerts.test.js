import test from "node:test";
import assert from "node:assert/strict";
import { getPrepaidAlerts, isConnectionLive, connectionInactiveState, prepaidAlertText } from "./prepaidAlerts.js";

const ba = { id: "b1", type: "Mobile Prepaid", name: "Jio 899" };
const bill = (validUntil, validFrom = "2026-08-02", extra = {}) => ({ id: "x" + validUntil, billerAccountId: "b1", billerCategory: "Mobile Prepaid", validFrom, validUntil, ...extra });
const at = ymd => { const [y, m, d] = ymd.split("-").map(Number); return new Date(y, m - 1, d, 10); };
const run = (until, today, extra = {}) => getPrepaidAlerts({ billerAccounts: [ba], bills: [bill(until)], relationships: [], today: at(today), ...extra });

test("alerts: three stages — 3 days before, on the last day, after it ended; nothing earlier", () => {
  assert.equal(run("2026-11-10", "2026-11-04").length, 0);                       // 6 days left: nothing yet
  assert.deepEqual(run("2026-11-10", "2026-11-07").map(a => a.stage), ["pre"]);   // 3 days left
  assert.deepEqual(run("2026-11-10", "2026-11-09").map(a => a.stage), ["pre"]);   // 1 day left
  assert.deepEqual(run("2026-11-10", "2026-11-10").map(a => a.stage), ["day"]);   // ends today
  assert.deepEqual(run("2026-10-31", "2026-11-10").map(a => a.stage), ["post"]);  // ended 10 days ago (the reported case)
  assert.equal(run("2026-09-01", "2026-11-10").length, 0);                         // long gone (>30 days): stop nagging
});
test("alerts: each stage is its own notification, so dismissing one does not hide the next", () => {
  const pre = run("2026-11-10", "2026-11-08")[0];
  assert.equal(run("2026-11-10", "2026-11-08", { dismissed: [pre.id] }).length, 0);
  assert.equal(run("2026-11-10", "2026-11-10", { dismissed: [pre.id] }).length, 1);
  assert.notEqual(pre.id, run("2026-11-10", "2026-11-10")[0].id);
});
test("alerts: a connection that was ended or paused raises none; one with no relationship, or an active one, does", () => {
  const rel = status => [{ id: "r", billerAccountId: "b1", status }];
  assert.equal(run("2026-10-31", "2026-11-10", { relationships: rel("ended") }).length, 0);
  assert.equal(run("2026-10-31", "2026-11-10", { relationships: rel("paused") }).length, 0);
  assert.equal(run("2026-10-31", "2026-11-10", { relationships: rel("active") }).length, 1);
  assert.equal(run("2026-10-31", "2026-11-10", { relationships: [{ id: "r1", billerAccountId: "b1", status: "ended" }, { id: "r2", billerAccountId: "b1", status: "active" }] }).length, 1);
  assert.equal(isConnectionLive("b1", []), true);
  assert.equal(connectionInactiveState("b1", rel("ended")), "ended"); assert.equal(connectionInactiveState("b1", rel("paused")), "paused"); assert.equal(connectionInactiveState("b1", rel("active")), null);
  assert.equal(connectionInactiveState("b1", [{ billerAccountId: "other", status: "ended" }]), null);
});
test("alerts: recharging again removes the alert (the newest period decides); non-recharge connections are ignored; text", () => {
  const rech = getPrepaidAlerts({ billerAccounts: [ba], bills: [bill("2026-10-31"), bill("2027-01-30", "2026-11-01")], relationships: [], today: at("2026-11-10") });
  assert.equal(rech.length, 0);
  assert.equal(getPrepaidAlerts({ billerAccounts: [{ id: "b1", type: "Electricity", name: "E" }], bills: [bill("2026-10-31")], relationships: [], today: at("2026-11-10") }).length, 0);
  assert.equal(prepaidAlertText(run("2026-10-31", "2026-11-10")[0]), "Jio 899 ended 10 days ago");
  assert.equal(prepaidAlertText(run("2026-11-10", "2026-11-10")[0]), "Jio 899 ends today");
  assert.equal(prepaidAlertText(run("2026-11-10", "2026-11-09")[0]), "Jio 899 ends in 1 day");
});
