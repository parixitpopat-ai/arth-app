# Transaction Domain — API Design

`2026-08-03` · TRX-001C, Team 7 deliverable · Status: **Draft — for review, contains a significant finding**

---

## Finding before the design: there is no existing per-aggregate API to audit

Checked `src/cloudSync.js` (the actual, only sync layer) before assuming an endpoint inventory existed. **It doesn't, in any form this exercise expected.** The entire persistence model today is:

```
saveCloudSnapshot(userId, snapshot)  →  upserts ONE row into `arth_snapshots`,
                                          `snapshot` = the entire app state as one JSON blob
loadCloudSnapshot(userId)            →  reads that one row back
```

Plus basic auth (`signUp`/`signIn`/`signOut`/`getCurrentCloudUser`). **That's the complete list.** There is no `transactions` table, no per-entity CRUD, no command of any kind — every `setTxns`/`setBills`/`setAccounts` call in `App.jsx` only ever mutates in-memory React state; the whole-app blob sync is a backup/restore mechanism, not a command API.

**This changes what "Team 7" actually is.** The original brief ("inventory every endpoint, mark Keep/Deprecate/Replace/New") assumes an existing API to audit. There isn't one — every command below is genuinely **New**, not a migration of something that exists. This is also a real, previously-unregistered architectural fact worth stating plainly: **none of the invariants frozen across Teams 1–6 (computed `settled`/`remaining_amt`, `SettlementTarget` contract, aggregate boundaries) are enforced anywhere except client-side JavaScript today.** The whole-blob sync has no schema, no validation, no per-command authorization — anything written client-side gets persisted as-is. Worth flagging to you directly rather than quietly designing vNext as if this were a normal migration: **moving from whole-blob sync to a real command API is a significant undertaking in its own right**, likely deserving its own ADR/ticket about the migration strategy (how existing users' blob data maps onto the new relational schema from Team 5), not something this API design should casually assume away.

---

## Command Design — "which aggregate owns each command," applied to a green field

| Command | Owner | Notes |
|---|---|---|
| `POST /transactions` | `Transaction` | Create. Validates against ADR-017's frozen type list server-side — currently not validated anywhere. |
| `PATCH /transactions/{id}` | `Transaction` | Edit |
| `DELETE /transactions/{id}` | `Transaction` | Permanent, per ADR-018 — no soft-delete endpoint exists or should exist |
| `POST /settlements` | `SettlementService` | The one orchestration endpoint — accepts a payment amount and optional target selection, returns the allocation breakdown. This is the **only** endpoint allowed to trigger settlement across multiple aggregate types in one call. |
| `POST /loans/{id}/payment` | `Loan` | Direct payment against a single loan, bypassing `SettlementService` — for when a user is explicitly paying one specific loan, not allocating a payment across candidates. **Open question, not decided here:** should this even exist as a separate endpoint, or should all loan payments route through `POST /settlements` with a single pre-selected target? Recommend resolving this before implementation — it affects whether `Loan.applySettlement()` has one caller or two. |
| `POST /payables/{id}/payment` | `Payable` | Same open question as above, for CC payments |
| `POST /loans` | `Loan` | Create — TRX-001A found 2 distinct creation paths (generic, CC-EMI-linked); this may need to be 2 commands, not 1, depending on how different their payloads really are — not resolved here |
| `POST /investments` | `Investment` | Create/update (TRX-001A confirmed these are genuinely one upsert operation) |
| `DELETE /investments/{id}` | `Investment` | Confirmed distinct operation (TRX-001A) |
| `GET /people/{id}/receivables` | Read-only query, no aggregate owner (read-side) | Backs the `SettlementService` candidate-dues list (`getPersonReceivableItems` today) — read models don't need a single aggregate owner the way commands do, since they're not mutating anything |

## Endpoints deliberately not designed here

- Anything Account-owned beyond what `Payable` needs (`POST /accounts`, balance queries) — out of TRX-001C's Transactions-domain scope
- Bill endpoints — Bills domain, not audited to this depth in this effort
- Auth endpoints — already exist (`cloudSync.js`), unaffected by this redesign

## What this deliberately does not answer

- Whether `Loan`/`Payable` get their own direct-payment endpoints or route everything through `SettlementService` (flagged above, needs a decision)
- The actual migration strategy from whole-blob sync to this command model — flagged as needing its own ADR/ticket, not decided here
- REST vs. RPC vs. Supabase Edge Function shape — implementation detail, not architecture
