# TRX-002A — Application Layer: Complete

`2026-08-03` · First implementation ticket of the TRX-002 workstream · Status: **Done**

## Success criterion (stated, then proven)

> A command can travel through the complete pipeline: UI Intent → Command → Command Handler → Repository → Aggregate → Domain Events → Snapshot Adapter → `saveCloudSnapshot()`

**Proven, not claimed** — 4 tests, run for real, all passing:

```
$ npm test
ok 1 - TRX-002A pipeline: command travels from intent to snapshot persistence
ok 2 - TRX-002A pipeline: aggregate validation failure never throws past the Dispatcher
ok 3 - CommandDispatcher: exactly one handler per command type is enforced
ok 4 - CommandDispatcher: unknown command type returns a failure, not a throw
# pass 4
# fail 0
```

## What was built

- **`CommandDispatcher`** — routes commands to registered handlers, one handler per type enforced at registration (the command-side mirror of Team 6's "one publisher per event")
- **`CommandResult`** — uniform success/failure shape every handler returns; aggregate validation errors never reach the Dispatcher as thrown exceptions
- **`AggregateRoot`** (base contract) — id + event collection only, no business behavior
- **`Repository`** / **`DomainEventPublisher`** (contracts) — throw-if-not-implemented base classes, since plain JS has no real interfaces
- **`InMemoryRepository`** / **`InMemoryEventPublisher`** — proof-of-pipeline implementations, explicitly not production persistence
- **`SnapshotAdapter`** — the ADR-034-compliant serializer boundary around `saveCloudSnapshot()`/`loadCloudSnapshot()`, dependency-injected so it's testable without a real Supabase project
- **`Tag`** — the trivial example aggregate (deliberately not `Transaction`), with `CreateTagHandler` showing the exact shape every real handler (`TRX-002B` onward) will follow

## What was deliberately not built (per the agreed scope)

No `TransactionAggregate`, no `SettlementService`, no `Payable`, no database migration, no UI changes. This ticket proves the plumbing, not the business.

## A consequence worth naming directly

**This is the first automated test this repository has ever had.** RSK-002 in the Risk Register ("No automated tests exist") is no longer true in the absolute — 4 tests exist, using Node's built-in `node:test` (zero new dependencies, deliberately not a framework decision this narrow ticket should make). The Risk Register entry should be updated to reflect this, not closed — 4 tests covering the Application Layer's plumbing doesn't address the zero coverage across the actual 16,349-line `App.jsx`, but it's a real, structural change worth recording rather than leaving the register stale.

## Next

`TRX-002B` — Transaction Aggregate implementation, built on this plumbing.
