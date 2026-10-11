import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { getCardAlert, getCardAlerts } from "./alerts.js";
import { getCardSummary } from "./summaries.js";

const toDateOnly = v => { const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; };
const card = (extra = {}) => ({ id: "c1", type: "cc", name: "Amazon Visa", limit: 100000, alertPct: 10, statementDate: 15, dueDate: 5, ...extra });
const spend = (amount, date) => ({ id: `e${amount}${date}`, type: "expense", amount, date, accId: "c1" });
const summary = (c, txns) => getCardSummary(c, [c], txns, toDateOnly);
const withToday = (iso, fn) => { mock.timers.reset(); mock.timers.enable({ apis: ["Date"], now: new Date(`${iso}T12:00:00`) }); try { return fn(); } finally { mock.timers.reset(); } };

test("over the alert: one notification with the cycle in its id, the percentage and the amounts", () => {
  withToday("2026-10-11", () => {
    const c = card(), tx = [spend(12000, "2026-10-02")];
    const a = getCardAlert(c, summary(c, tx));
    assert.equal(a.cardId, "c1");
    assert.equal(a.pct, 12);
    assert.deepEqual([a.spend, a.limit, a.alertPct], [12000, 100000, 10]);
    assert.equal(a.id, "card_c1_2026-09-15");
  });
});

test("under the alert, no spend, no limit, or alert switched off: nothing", () => {
  withToday("2026-10-11", () => {
    const c = card(), tx = [spend(5000, "2026-10-02")];
    assert.equal(getCardAlert(c, summary(c, tx)), null);
    assert.equal(getCardAlert(c, summary(c, [])), null);
    const noLimit = card({ limit: 0 });
    assert.equal(getCardAlert(noLimit, summary(noLimit, [spend(12000, "2026-10-02")])), null);
    const off = card({ alertPct: 0 });
    assert.equal(getCardAlert(off, summary(off, [spend(12000, "2026-10-02")])), null);
    assert.equal(getCardAlert({ ...card(), type: "bank" }, summary(card(), tx)), null);
  });
});

test("dismissing silences the card for that cycle; the next cycle alerts again", () => {
  const c = card(), tx = [spend(12000, "2026-10-02")];
  const octAlerts = withToday("2026-10-11", () => getCardAlerts([c], k => summary(k, tx), []));
  assert.equal(octAlerts.length, 1);
  const dismissed = [octAlerts[0].id];
  assert.equal(withToday("2026-10-12", () => getCardAlerts([c], k => summary(k, tx), dismissed)).length, 0);
  const novTx = [...tx, spend(15000, "2026-11-20")];
  const nov = withToday("2026-11-21", () => getCardAlerts([c], k => summary(k, novTx), dismissed));
  assert.equal(nov.length, 1);
  assert.notEqual(nov[0].id, octAlerts[0].id);
});

test("several cards: highest use first, and a card with no alert is skipped", () => {
  withToday("2026-10-11", () => {
    const a = card({ id: "a", name: "A" }), b = card({ id: "b", name: "B" }), c = card({ id: "c", name: "C", alertPct: 90 });
    const txns = [{ ...spend(12000, "2026-10-02"), accId: "a" }, { ...spend(30000, "2026-10-03"), accId: "b" }, { ...spend(12000, "2026-10-04"), accId: "c" }];
    const out = getCardAlerts([a, b, c], k => getCardSummary(k, [a, b, c], txns, toDateOnly), []);
    assert.deepEqual(out.map(x => x.cardId), ["b", "a"]);
  });
});
