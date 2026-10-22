import { test } from "node:test";
import assert from "node:assert/strict";
import { createSupabaseCasClient } from "./supabaseCasClient.js";

// A recording stand-in for the supabase-js query builder: every method returns the builder; awaiting it yields `result`.
function mockSupabase(result) {
  const calls = [];
  const builder = { then: (res, rej) => Promise.resolve(result).then(res, rej) };
  for (const m of ["from", "select", "insert", "update", "eq", "maybeSingle"]) builder[m] = (...args) => { calls.push([m, ...args]); return builder; };
  return { client: builder, calls };
}

test("read: one filtered select, returns the server token and snapshot, or null", async () => {
  let m = mockSupabase({ data: { snapshot: { txns: [] }, updated_at: "2026-10-15T06:00:00.123456+00:00" }, error: null });
  assert.deepEqual(await createSupabaseCasClient(m.client).read("u"), { token: "2026-10-15T06:00:00.123456+00:00", snapshot: { txns: [] } });
  assert.deepEqual(m.calls, [["from", "arth_snapshots"], ["select", "snapshot, updated_at"], ["eq", "user_id", "u"], ["maybeSingle"]]);
  m = mockSupabase({ data: null, error: null });
  assert.equal(await createSupabaseCasClient(m.client).read("u"), null);
});

test("swap is ONE conditional update: user and expected token in the same statement; zero rows is a conflict, not success", async () => {
  let m = mockSupabase({ data: [{ updated_at: "T1" }], error: null });
  assert.deepEqual(await createSupabaseCasClient(m.client).swap("u", "T0", { a: 1 }, "T1x"), { ok: true, token: "T1" });
  assert.deepEqual(m.calls, [["from", "arth_snapshots"], ["update", { snapshot: { a: 1 }, updated_at: "T1x" }], ["eq", "user_id", "u"], ["eq", "updated_at", "T0"], ["select", "updated_at"]]);
  assert.ok(!m.calls.some(c => c[0] === "insert" || c[0] === "upsert"), "never an unconditional write");
  m = mockSupabase({ data: [], error: null });
  assert.deepEqual(await createSupabaseCasClient(m.client).swap("u", "T0", {}, "T1"), { conflict: true });
});

test("errors are thrown (never read as 'no conflict'); a duplicate-key insert means someone else created the row", async () => {
  let m = mockSupabase({ data: null, error: { message: "TypeError: fetch failed", code: "" } });
  await assert.rejects(createSupabaseCasClient(m.client).swap("u", "T0", {}, "T1"), /fetch failed/);
  m = mockSupabase({ data: null, error: { message: "permission denied", code: "42501" } });
  await assert.rejects(createSupabaseCasClient(m.client).swap("u", "T0", {}, "T1"), e => e.code === "42501");
  await assert.rejects(createSupabaseCasClient(m.client).read("u"), /permission denied/);
  m = mockSupabase({ data: null, error: { message: "duplicate key", code: "23505" } });
  assert.deepEqual(await createSupabaseCasClient(m.client).insert("u", {}, "T"), { conflict: true });
  m = mockSupabase({ data: null, error: { message: "boom", code: "XX000" } });
  await assert.rejects(createSupabaseCasClient(m.client).insert("u", {}, "T"), /boom/);
});

test("a swap or insert the cloud does not confirm with a token is an error, not a success", async () => {
  await assert.rejects(createSupabaseCasClient(mockSupabase({ data: [{}], error: null }).client).swap("u", "T0", {}, "T1"), /did not return/);
  await assert.rejects(createSupabaseCasClient(mockSupabase({ data: [], error: null }).client).insert("u", {}, "T"), /did not confirm/);
});
