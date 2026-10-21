import crypto from "node:crypto";
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
  const requestLog = []; const authLog = [];
  const faults = { latencyMs: 0, rejectWrites: 0, dropResponseWrites: 0, offline: false, corruptNext: false, precisionMs: 0 };
  const stats = { unconditionalWrites: 0 };
  let seq = 0;

  const send = (res, code, body, extra = {}) => {
    res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "access-control-expose-headers": "*", ...extra });
    res.end(body == null ? "" : JSON.stringify(body));
  };
  // Synthetic accounts for the sign-in flow (email -> user); the one-time code is always 123456. Tokens map to users.
  const pkcePending = new Map(), authCodes = new Map();
  const accounts = new Map(); const refreshTokens = new Map(); let userSeq = 0;
  const tokenUser = {};
  // The harness seeds sessions with this refresh token; make it valid for the seeded users (a refresh can then succeed).
  const seedRefresh = () => { for (const u of Object.values(users)) refreshTokens.set("synthetic-refresh", u); };
  const userForToken = auth => { const t = String(auth || "").replace(/^Bearer\s+/i, ""); return users[t] || tokenUser[t] || null; };
  const sessionFor = user => {
    const access = `synthetic-token-${user.id}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, refresh = `synthetic-refresh-${Math.random().toString(36).slice(2, 12)}`;
    tokenUser[access] = user; refreshTokens.set(refresh, user);
    return {
    access_token: access, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: refresh, user };
  };
  const mkUser = email => ({ id: `synthetic-user-${String(++userSeq).padStart(4, "0")}`, aud: "authenticated", role: "authenticated", email, app_metadata: { provider: "email" }, user_metadata: {}, created_at: new Date().toISOString() });
  const filter = (url, col) => { const v = url.searchParams.get(col); return v && v.startsWith("eq.") ? v.slice(3) : null; };
  const cloneSnap = s => JSON.parse(JSON.stringify(s));
  const txnIds = s => (s?.txns || []).map(t => String(t.id));

  seedRefresh();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (req.method === "OPTIONS") return send(res, 204, null);
    let raw = ""; for await (const c of req) raw += c;
    requestLog.push({ at: Date.now(), method: req.method, path: url.pathname + url.search });

    if (url.pathname.startsWith("/__ctl/")) {
      const op = url.pathname.slice(7);
      if (op === "issueCode") {   // stands in for tapping the emailed link: mints the one-time code for the latest pending sign-in
        const email = url.searchParams.get("email"), pend = pkcePending.get(email); if (!pend) return send(res, 404, { error: "no pending pkce sign-in" });
        const code = "authcode-" + Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 8);
        authCodes.set(code, { email, challenge: pend.challenge, used: false, expired: url.searchParams.get("expired") === "1" }); return send(res, 200, { code });
      }
      if (op === "authlog") return send(res, 200, authLog);
      if (op === "faults") { Object.assign(faults, JSON.parse(raw || "{}")); return send(res, 200, faults); }
      return send(res, 404, { error: "unknown control" });
    }
    if (faults.latencyMs) await new Promise(r => setTimeout(r, faults.latencyMs));
    if (faults.offline) { req.socket.destroy(); return; }

    if (url.pathname === "/auth/v1/otp" && req.method === "POST") {
      const body = JSON.parse(raw || "{}"); const email = String(body.email || "").toLowerCase();
      authLog.push({ op: "otp", email, create_user: body.create_user, pkce: Boolean(body.code_challenge), redirectTo: url.searchParams.get("redirect_to") || null });
      if (body.code_challenge) pkcePending.set(email, { challenge: body.code_challenge, method: body.code_challenge_method });
      if (!accounts.has(email)) { if (body.create_user === false) return send(res, 422, { code: 422, error_code: "otp_disabled", msg: "Signups not allowed for otp" }); accounts.set(email, mkUser(email)); }
      return send(res, 200, {});
    }
    if (url.pathname === "/auth/v1/verify" && req.method === "POST") {
      const body = JSON.parse(raw || "{}"); const email = String(body.email || "").toLowerCase();
      authLog.push({ op: "verify", email, ok: body.token === "123456" });
      if (!accounts.has(email) || body.token !== "123456") return send(res, 403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" });
      return send(res, 200, sessionFor(accounts.get(email)));
    }
    if (url.pathname === "/auth/v1/token" && req.method === "POST" && url.searchParams.get("grant_type") === "pkce") {
      const body = JSON.parse(raw || "{}"); const ent = authCodes.get(body.auth_code);
      const bad = (error_code, msg) => { authLog.push({ op: "pkce", ok: false, error_code }); return send(res, 400, { code: 400, error_code, msg }); };
      if (!ent) return bad("flow_state_not_found", "invalid flow state, no valid flow state found");
      if (ent.used) return bad("flow_state_not_found", "invalid flow state, no valid flow state found");
      if (ent.expired) return bad("flow_state_expired", "flow state expired");
      const verifier = String(body.code_verifier || "").split("/")[0];
      if (crypto.createHash("sha256").update(verifier).digest("base64url") !== ent.challenge) return bad("bad_code_verifier", "code challenge does not match previously saved code verifier");
      ent.used = true; authLog.push({ op: "pkce", ok: true, email: ent.email });
      return send(res, 200, sessionFor(accounts.get(ent.email)));
    }
    if (url.pathname === "/auth/v1/token" && req.method === "POST") {
      const body = JSON.parse(raw || "{}"); const u = refreshTokens.get(body.refresh_token);
      if (!u) return send(res, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
      return send(res, 200, sessionFor(u));
    }
    if (url.pathname === "/auth/v1/logout") { authLog.push({ op: "logout" }); return send(res, 204, null); }
    if (url.pathname === "/auth/v1/user") { const u = userForToken(req.headers.authorization); return u ? send(res, 200, u) : send(res, 401, { message: "invalid token" }); }
    if (url.pathname !== "/rest/v1/arth_snapshots") return send(res, 404, { message: "not found" });
    const u = userForToken(req.headers.authorization);
    if (!u) return send(res, 401, { message: "JWT invalid" });

    if (req.method === "GET") {
      const want = filter(url, "user_id");
      const row = rows.get(u.id);
      // PostgREST: a request that asks for ONE object (Accept: application/vnd.pgrst.object+json, which supabase-js .single()
      // sends) gets the object, or HTTP 406 with code PGRST116 when there is no such row. Otherwise an array.
      const wantsObject = /vnd\.pgrst\.object/.test(String(req.headers.accept || ""));
      if (want !== u.id || !row) return wantsObject ? send(res, 406, { code: "PGRST116", details: "The result contains 0 rows", hint: null, message: "JSON object requested, multiple (or no) rows returned" }) : send(res, 200, []);   // row-level security: only your own row
      return send(res, 200, wantsObject ? { snapshot: row.snapshot, updated_at: fmt(row.micros) } : [{ snapshot: row.snapshot, updated_at: fmt(row.micros) }]);
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
    port, rows, writeLog, requestLog, authLog, faults, stats, accounts,
    revokeRefresh: () => refreshTokens.delete("synthetic-refresh"),
    resetAccounts() { accounts.clear(); userSeq = 0; },      // so the next account is synthetic-user-0001 again
    addAccount(email) { const u = mkUser(email.toLowerCase()); accounts.set(email.toLowerCase(), u); return u; },
    seed(userId, snapshot, tokenIso = new Date().toISOString()) { rows.set(userId, { snapshot: cloneSnap(snapshot), micros: microsOf(tokenIso) }); writeLog.push({ seq: ++seq, kind: "seed", outcome: "seeded", token: tokenIso, txnIds: txnIds(snapshot) }); return fmt(microsOf(tokenIso)); },
    cloudIds: userId => txnIds(rows.get(userId)?.snapshot).sort(),
    close: () => new Promise(r => server.close(r)),
  })));
}
