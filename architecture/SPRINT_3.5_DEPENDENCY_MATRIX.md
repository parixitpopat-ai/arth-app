# Sprint 3.5 — Developer Dependency Matrix

The final document before Settings. Tells engineering what **cannot**
be built in parallel — complements the screen specs, doesn't repeat them.

## Engine Consumption Matrix

| Engine | Consumed By |
|---|---|
| Ledger | Home, Money, Outlook, Insights |
| Balance | Home, Money, Insights |
| Forecast | Home, Outlook |
| Analytics | Home, Insights |
| Goals | Home |
| AI | Home, Outlook, Insights (all deferred/parked) |
| Settings | All |

## Screen Blocking Matrix (what can't start until what finishes)

| Screen | Blocks |
|---|---|
| Forecast Engine (`calculateProjectedBalance`, `calculateSafeToSpend`) | O014 |
| O014 Cash Forecast | O001, O017, O018 |
| O001 Outlook Dashboard | (nothing further — it's a leaf once O014 exists) |
| O016 Alerts (centralization) | H004 Today's Focus |
| H004 Today's Focus | (nothing further — leaf) |
| M013 Credit Cards | Credit Limit schema field (not a screen — a data model gap) |
| M019 Vehicles | Purchase Value schema field (same — data model gap) |
| Analytics Engine (doesn't exist) | All 15 Insights screens |
| Bill `type` field + metadata store (ADR-016/018 gap) | O007, O008, O009, O010 (Subscriptions/SIP filtering) |
| ~~Insurance Policy entity (UX-004, not yet coded)~~ Confirmed built (grep evidence) | O011 Insurance — no longer blocked |
| Bill per-instance Skip/Snooze fields | O019 Commitment Detail |

## What this tells engineering, explicitly

1. **Nothing in Outlook past O014 can be honestly finished until the two Forecast Engine stubs are real** — building O001/O017/O018 first means building on placeholder data that will need rework.
2. **Insights cannot start in parallel with Home/Money/Outlook** — it has no existing engine to lean on; the Analytics Engine is a prerequisite for all 15 screens, not just some.
3. **Two small schema changes (Credit Limit, Purchase Value) are decoupled from any screen work** — they can be done any time, by anyone, without waiting on other Money screens. Cheap, parallelizable wins.
4. **H004 and O016 are coupled** — fixing Today's Focus's "ask, don't calculate" gap requires O016 to exist first; they should ship together, not independently.

## Documentation stack, complete

- ✅ Frozen Information Architecture (`ARTH_V2_IA.md`)
- ✅ Complete Screen Inventory (`PHASE2_SCREEN_INVENTORY.md`, v1.1 with Engine/Priority)
- ✅ Module Specifications (Home, Money, Outlook, Insights — full UX Bible)
- ✅ Critical Path (Outlook's dependency graph)
- ✅ Build Order (this matrix)
- ✅ Engine Ownership (Engine Consumption Matrix above)

This is enough to implement Arth v2 systematically without guessing where a feature belongs or in what order to build it. Settings + Shared (Sprint 3E) remains, then real code work begins.
