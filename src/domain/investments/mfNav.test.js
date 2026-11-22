import test from "node:test";
import assert from "node:assert/strict";
import { latestUrl, historyUrl, searchUrl, toIsoDate, readNav, readSearch, navFailureMessage } from "./mfNav.js";

// SAMPLE_* are the shapes ASSUMED from memory of mfapi.in's docs (see the header of mfNav.js); they are not copied from a live response.
const SAMPLE_LATEST = { meta: { scheme_code: 119551, scheme_name: "Example Fund - Direct Plan - Growth" }, data: [{ date: "21-11-2026", nav: "123.4567" }], status: "SUCCESS" };
const SAMPLE_HISTORY = { meta: { scheme_name: "Example" }, data: [{ date: "21-11-2026", nav: "123.4567" }, { date: "20-11-2026", nav: "122.0000" }, { date: "19-11-2026", nav: "121.5" }] };
test("URLs", () => {
  assert.equal(latestUrl(" 119551 "), "https://api.mfapi.in/mf/119551/latest"); assert.equal(historyUrl("119551"), "https://api.mfapi.in/mf/119551");
  assert.equal(searchUrl("axis bluechip"), "https://api.mfapi.in/mf/search?q=axis%20bluechip");
});
test("dates in dd-mm-yyyy and yyyy-mm-dd are read; impossible dates are refused", () => {
  assert.equal(toIsoDate("21-11-2026"), "2026-11-21"); assert.equal(toIsoDate("2026-11-21"), "2026-11-21"); assert.equal(toIsoDate("1-2-2026"), "2026-02-01");
  for (const bad of ["31-02-2026", "", "yesterday", "2026/11/21", null]) assert.equal(toIsoDate(bad), "");
});
test("the newest NAV is taken whatever the order, strings and numbers both work", () => {
  assert.deepEqual(readNav(SAMPLE_LATEST), { ok: true, nav: 123.4567, date: "2026-11-21", name: "Example Fund - Direct Plan - Growth" });
  assert.equal(readNav({ data: [...SAMPLE_HISTORY.data].reverse() }).date, "2026-11-21");
  assert.equal(readNav({ data: [{ date: "21-11-2026", nav: 99.5 }] }).nav, 99.5);
  assert.equal(readNav({ data: [{ date: "21-11-2026", nav: "1,234.50" }] }).nav, 1234.5);
});
test("anything unexpected is refused, never turned into a number", () => {
  assert.deepEqual(readNav(null), { ok: false, reason: "bad-shape" }); assert.deepEqual(readNav({ data: "x" }), { ok: false, reason: "bad-shape" });
  assert.deepEqual(readNav({ data: [] }), { ok: false, reason: "no-nav" });
  assert.deepEqual(readNav({ data: [{ date: "21-11-2026", nav: "N.A." }] }), { ok: false, reason: "bad-nav" });
  assert.deepEqual(readNav({ data: [{ date: "soon", nav: "10" }] }), { ok: false, reason: "bad-date" });
  assert.equal(readNav({ data: [{ date: "21-11-2026", nav: "0" }] }).ok, false); assert.equal(readNav({ data: [{ date: "21-11-2026", nav: "-5" }] }).ok, false);
});
test("search results are read; junk rows are skipped; a non-list is refused", () => {
  assert.deepEqual(readSearch([{ schemeCode: 119551, schemeName: "A Fund" }, { schemeCode: "100", schemeName: " B " }, { nope: 1 }, null]), { ok: true, funds: [{ code: "119551", name: "A Fund" }, { code: "100", name: "B" }] });
  assert.deepEqual(readSearch({ error: "x" }), { ok: false, reason: "bad-shape" });
});
test("every failure has words", () => { for (const r of ["offline", "timeout", "blocked", "not-found", "no-nav", "bad-shape"]) assert.ok(navFailureMessage(r).length > 20); });
