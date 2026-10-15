// Synthetic Supabase stand-in for sync-safety tests (SYNTHETIC DATA ONLY; listens on 127.0.0.1; never talks to the network).
// Models only what src/cloudSync.js + src/sync/supabaseCasClient.js use:
//   GET   /auth/v1/user                                                (restore a stored session)
//   GET   /rest/v1/arth_snapshots?user_id=eq.<id>&select=...           -> [row] | []
//   POST  /rest/v1/arth_snapshots   (insert; 409 + code 23505 when the row exists)
//   PATCH /rest/v1/arth_snapshots?user_id=eq.<id>&updated_at=eq.<t>    -> [{updated_at}] when it matched, [] when it did not
// Zero-row PATCH => [] is how PostgREST is expected to behave; that is a MODEL here, UNVERIFIED against real Supabase.
// Tokens are returned PostgREST-style ("2026-10-15T06:00:01.100000+00:00") and compared as instants at microsecond precision.
// An UNCONDITIONAL write (upsert / merge-duplicates) is applied but counted in `unconditionalWrites`; the harness fails if any occur.
import http from "node:http";

const microsOf = str => {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d+))?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(String(str).trim());
  if (!m) return null;
  const off = m[4] && m[4] !== "Z" ? (m[4].length === 3 ? m[4] + ":00" : m[4].includes(":") ? m[4] : m[4].slice(0, 3) + ":" + m[4].slice(3)) : "Z";
  const ms = Date.parse(`${m[1]}T${m[2]}${off}`);
  const frac = (m[3] || "").padEnd(6, "0").slice(0, 6);
  return BigInt(ms) * 1000n + BigInt(frac);
};
const fmt = micros => { const ms = Number(micros / 1000n), us = String(micros % 1000n * 1000n + 0n).padStart(6, "0"); const d = new Date(ms).toISOString().slice(0, 19); return `${d}.${String(Number(micros % 1000000n)).padStart(6, "0")}+00:00`; };

export function startFakeSupabase({ port = 54399, users = {} } = {}) {
  const rows = new Map();       // user_id -> { snapshot, micros }
  const writeLog = [];          // append-only
  const requestLog = [];
  const faults = { latencyMs: 0, rejectWrites: 0, dropResponseWrites: 0, offline: false, corruptNext: false, precisionMs: 0 };
  const stats = { unconditionalWrites: 0 };
  let seq = 0;

  const send = (res, code, body, extra = {}) => {
    res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "access-control-expose-headers": "*", ...extra });
    res.end(body == null ? "" : JSON.stringify(body));
  };
  const userForToken = auth => users[String(auth || "").replace(/^Bearer\s+/i, "")] || null;
  const filter = (url, col) => { const v = url.searchParams.get(col); return v && v.startsWith("eq.") ? v.slice(3) : null; };
  const cloneSnap = s => JSON.parse(JSON.stringify(s));
  const txnIds = s => (s?.txns || []).map(t => String(t.id));

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (req.method === "OPTIONS") return send(res, 204, null);
    let raw = ""; for await (const c of req) raw += c;
    requestLog.push({ at: Date.now(), method: req.method, path: url.pathname + url.search });

    if (url.pathname.startsWith("/__ctl/")) {
      const op = url.pathname.slice(7);
      if (op === "faults") { Object.assign(faults, JSON.parse(raw || "{}")); return send(res, 200, faults); }
      return send(res, 404, { error: "unknown control" });
    }
    if (faults.latencyMs) await new Promise(r => setTimeout(r, faults.latencyMs));
    if (faults.offline) { req.socket.destroy(); return; }

    if (url.pathname === "/auth/v1/user") { const u = userForToken(req.headers.authorization); return u ? send(res, 200, u) : send(res, 401, { message: "invalid token" }); }
    if (url.pathname !== "/rest/v1/arth_snapshots") return send(res, 404, { message: "not found" });
    const u = userForToken(req.headers.authorization);
    if (!u) return send(res, 401, { message: "JWT invalid" });

    if (req.method === "GET") {
      const want = filter(url, "user_id");
      const row = rows.get(u.id);
      if (want !== u.id || !row) return send(res, 200, []);              // row-level security: only your own row
      return send(res, 200, [{ snapshot: row.snapshot, updated_at: fmt(row.micros) }]);
    }

    const writeCommon = (kind, newMicros, snapshot, userId) => {
      if (faults.rejectWrites > 0) { faults.rejectWrites--; writeLog.push({ seq: ++seq, kind, outcome: "rejected-500" }); send(res, 500, { message: "injected write failure" }); return null; }
      const stored = cloneSnap(snapshot);
      if (faults.corruptNext) { faults.corruptNext = false; if (stored.txns?.length) stored.txns.pop(); }
      if (faults.precisionMs) { const p = BigInt(faults.precisionMs) * 1000n; newMicros = (newMicros / p) * p; }   // model a coarse timestamp column
      rows.set(userId, { snapshot: stored, micros: newMicros });
      writeLog.push({ seq: ++seq, kind, outcome: "applied", token: fmt(newMicros), txnIds: txnIds(stored) });
      if (faults.dropResponseWrites > 0) { faults.dropResponseWrites--; req.socket.destroy(); return null; }   // applied, but the client never hears back
      return fmt(newMicros);
    };

    if (req.method === "POST") {
      const body = JSON.parse(raw || "{}"); const rec = Array.isArray(body) ? body[0] : body;
      if (rec.user_id !== u.id) return send(res, 403, { code: "42501", message: "new row violates row-level security policy" });
      const prefer = String(req.headers.prefer || "");
      const unconditional = url.searchParams.has("on_conflict") || /resolution=(merge|ignore)-duplicates/.test(prefer);
      if (unconditional) { stats.unconditionalWrites++; }
      else if (rows.has(u.id)) { writeLog.push({ seq: ++seq, kind: "insert", outcome: "duplicate-409" }); return send(res, 409, { code: "23505", message: "duplicate key value violates unique constraint" }); }
      const t = writeCommon(unconditional ? "UPSERT(unconditional)" : "insert", microsOf(rec.updated_at) ?? BigInt(Date.now()) * 1000n, rec.snapshot, u.id);
      return t == null ? undefined : send(res, 201, [{ updated_at: t }]);
    }

    if (req.method === "PATCH") {
      const body = JSON.parse(raw || "{}");
      const want = filter(url, "user_id"), tok = filter(url, "updated_at");
      const row = rows.get(u.id);
      if (want !== u.id || !row || tok == null || microsOf(tok) !== row.micros) { writeLog.push({ seq: ++seq, kind: "swap", outcome: "0-rows" }); return send(res, 200, []); }
      if (tok == null) { stats.unconditionalWrites++; }
      const t = writeCommon("swap", microsOf(body.updated_at) ?? BigInt(Date.now()) * 1000n, body.snapshot, u.id);
      return t == null ? undefined : send(res, 200, [{ updated_at: t }]);
    }
    return send(res, 405, { message: "method not allowed" });
  });

  return new Promise(resolve => server.listen(port, "127.0.0.1", () => resolve({
    port, rows, writeLog, requestLog, faults, stats,
    seed(userId, snapshot, tokenIso = new Date().toISOString()) { rows.set(userId, { snapshot: cloneSnap(snapshot), micros: microsOf(tokenIso) }); writeLog.push({ seq: ++seq, kind: "seed", outcome: "seeded", token: tokenIso, txnIds: txnIds(snapshot) }); return fmt(microsOf(tokenIso)); },
    cloudIds: userId => txnIds(rows.get(userId)?.snapshot).sort(),
    close: () => new Promise(r => server.close(r)),
  })));
}
