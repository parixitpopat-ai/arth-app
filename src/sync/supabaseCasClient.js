// src/sync/supabaseCasClient.js
//
// The one adapter between the sync engine and Supabase (SYNC-SAFETY-002 §3.3). Implements the CasClient contract:
//   read(userId)                              -> null | { token, snapshot }
//   insert(userId, snapshot, token)           -> { ok, token } | { conflict: true }
//   swap(userId, expectedToken, snapshot, nextToken) -> { ok, token } | { conflict: true }
// A swap is ONE conditional UPDATE (user_id and the expected updated_at in the same filter), so a concurrent write makes it
// match zero rows; it is never a read followed by a write. The token is always the value the server returns.
//
// VERIFICATION STATUS (see SYNC-SAFETY-002 §3.3): the conditional-UPDATE semantics were verified on a local PostgreSQL 16;
// how PostgREST/Supabase treats a zero-row UPDATE (expected: an empty array, no error), the production column type and any
// trigger, and the row-level-security policy for UPDATE are UNVERIFIED against the real service. Errors are therefore thrown,
// never interpreted as "no conflict".

const fail = error => {
  const e = new Error((error && (error.message || error.details)) || "request failed");
  e.code = error && error.code;
  throw e;
};

export function createSupabaseCasClient(supabase, table = "arth_snapshots") {
  return {
    async read(userId) {
      const { data, error } = await supabase.from(table).select("snapshot, updated_at").eq("user_id", userId).maybeSingle();
      if (error) fail(error);
      return data ? { token: data.updated_at, snapshot: data.snapshot } : null;
    },
    async insert(userId, snapshot, token) {
      const { data, error } = await supabase.from(table).insert({ user_id: userId, snapshot, updated_at: token }).select("updated_at");
      if (error) {
        if (error.code === "23505") return { conflict: true };       // a row appeared meanwhile: decide again
        fail(error);
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || !row.updated_at) fail({ message: "the cloud did not confirm the new row" });
      return { ok: true, token: row.updated_at };
    },
    async swap(userId, expectedToken, snapshot, nextToken) {
      const { data, error } = await supabase.from(table)
        .update({ snapshot, updated_at: nextToken })
        .eq("user_id", userId)
        .eq("updated_at", expectedToken)
        .select("updated_at");
      if (error) fail(error);
      if (!Array.isArray(data) || data.length === 0) return { conflict: true };
      if (!data[0].updated_at) fail({ message: "the cloud did not return the new version" });
      return { ok: true, token: data[0].updated_at };
    },
  };
}
