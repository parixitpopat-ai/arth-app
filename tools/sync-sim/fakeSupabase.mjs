// Synthetic Supabase stand-in for sync-safety tests. Implements only what src/cloudSync.js uses:
//   GET  /auth/v1/user                      (restore a stored session)
//   GET  /rest/v1/arth_snapshots?user_id=eq.<id>&select=snapshot,updated_at   (.single())
//   POST /rest/v1/arth_snapshots?on_conflict=user_id   (upsert + .select().single())
// It never talks to the network. Every accepted write is appended to an in-memory, append-only log
// (versions are never overwritten), so what the "cloud" held at any moment can be reconstructed.
// Fault injection via /__ctl/*: latency, reject next N writes (500), apply-but-drop-response, offline.
import http from "node:http";

export function startFakeSupabase({ port = 54399, users = {} } = {}) {
  const rows = new Map();       // user_id -> { snapshot, updated_at }
  const writeLog = [];          // append-only: { seq, at, user_id, snapshot, outcome }
  const requestLog = [];
  const faults = { latencyMs: 0, rejectWrites: 0, dropResponseWrites: 0, offline: false };
  let seq = 0;

  const send = (res, code, body, extra = {}) => {
    res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", ...extra });
    res.end(body == null ? "" : JSON.stringify(body));
  };
  const userForToken = auth => { const t = String(auth || "").replace(/^Bearer\s+/i, ""); return users[t] || null; };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (req.method === "OPTIONS") return send(res, 204, null);
    let raw = ""; for await (const c of req) raw += c;
    requestLog.push({ at: Date.now(), method: req.method, path: url.pathname + url.search });

    if (url.pathname.startsWith("/__ctl/")) {
      const op = url.pathname.slice(7);
      if (op === "faults") { Object.assign(faults, JSON.parse(raw || "{}")); return send(res, 200, faults); }
      if (op === "state") return send(res, 200, { rows: Object.fromEntries(rows), writes: writeLog.length });
      return send(res, 404, { error: "unknown control" });
    }
    if (faults.latencyMs) await new Promise(r => setTimeout(r, faults.latencyMs));
    if (faults.offline) { req.socket.destroy(); return; }

    if (url.pathname === "/auth/v1/user") {
      const u = userForToken(req.headers.authorization);
      return u ? send(res, 200, u) : send(res, 401, { message: "invalid token" });
    }
    if (url.pathname === "/rest/v1/arth_snapshots") {
      const u = userForToken(req.headers.authorization);
      if (!u) return send(res, 401, { message: "JWT invalid" });
      if (req.method === "GET") {
        const want = (url.searchParams.get("user_id") || "").replace(/^eq\./, "");
        if (want !== u.id) return send(res, 200, []);              // row-level security: only your own row
        const row = rows.get(u.id);
        if (!row) return send(res, 406, { code: "PGRST116", message: "no rows", details: "The result contains 0 rows" });
        return send(res, 200, row);
      }
      if (req.method === "POST") {
        const body = JSON.parse(raw || "{}"); const rec = Array.isArray(body) ? body[0] : body;
        if (rec.user_id !== u.id) return send(res, 403, { message: "new row violates row-level security policy" });
        if (faults.rejectWrites > 0) { faults.rejectWrites--; writeLog.push({ seq: ++seq, at: Date.now(), user_id: u.id, outcome: "rejected-500" }); return send(res, 500, { message: "injected write failure" }); }
        const row = { snapshot: rec.snapshot, updated_at: new Date().toISOString() };
        rows.set(u.id, row);
        writeLog.push({ seq: ++seq, at: Date.now(), user_id: u.id, snapshot: JSON.parse(JSON.stringify(rec.snapshot)), outcome: "applied" });
        if (faults.dropResponseWrites > 0) { faults.dropResponseWrites--; req.socket.destroy(); return; }   // applied, but the client never hears back
        return send(res, 200, { updated_at: row.updated_at });
      }
    }
    return send(res, 404, { message: "not found" });
  });

  return new Promise(resolve => server.listen(port, "127.0.0.1", () => resolve({
    port, rows, writeLog, requestLog, faults,
    seed(userId, snapshot) { rows.set(userId, { snapshot, updated_at: new Date().toISOString() }); writeLog.push({ seq: ++seq, at: Date.now(), user_id: userId, snapshot: JSON.parse(JSON.stringify(snapshot)), outcome: "seeded" }); },
    close: () => new Promise(r => server.close(r)),
  })));
}
