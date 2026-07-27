# ADS Appendix B — Business Rule Catalogue

Every global rule established across this entire specification, in one
place, so developers and QA don't need to hunt through 40+ documents.
Each rule links back to where it was actually decided.

## Ownership Rules

1. **Home owns nothing** — consumes from every engine, calculates nothing itself. (IA, ADR discussion)
2. **Money never shows schedules** — position only (balance, value); due dates/reminders belong to Outlook. (ADR-021)
3. **Outlook owns future commitments** — one Bill entity, multiple `Bill.type` values; never separate Subscription/EMI/SIP/Membership entities. (ADR-019/020/021)
4. **Insights never owns source data** — analyzes only, Ledger/Balance/Forecast own the underlying numbers. (IA)
5. **Manage owns nouns; every other engine owns verbs** — Manage stores definitions (Person, Vehicle, Insurance, Group, Account); calculations, settlements, and forecasts belong to the relevant engine. (ADR-021)
6. **A Policy never creates Transactions directly** — always Policy → Bill → Transaction. (UX-004)
7. **Every transaction has exactly one source account.**
8. **Attachments are a shared platform service** — never a per-entity `Vehicle.documents`/`Insurance.documents` implementation. (ADR-021)

## Data Integrity Rules

9. **Never fabricate a number when data is missing** — show "Not set"/"Value not set" instead (Credit Limit, Vehicle Purchase Value). Never a silent ₹0. (Progressive Enrichment, ADR-021 addendum)
10. **Progressive Enrichment applies to all Managed entities** — minimal required fields at creation, richer detail added later without affecting identity.
11. **Archived entities remain in history** — archiving is distinct from deleting; deleted data is permanently gone (per the frozen Delete decision, ADR-018), archived data is retrievable.
12. **Never silently create a financial commitment** — Suggested Next Steps (Vehicle/Property/Insurance/etc.) always requires explicit user confirmation, never auto-generates a Bill on the user's behalf.
13. **Pre-sync backups are created before any cloud pull overwrites local data** — recoverable path required at all times. (Real incident this session, J028)

## Recalculation Rules

14. **Forecast is recalculated after any financial event** — a Transaction, Bill payment, or Expected Income event triggers fresh computation, never a stale cached number.
15. **Safe to Spend has two versions that must not be confused** — the existing Home formula and the Financial Engine's version (`calculateSafeToSpend`) — upgrade in place eventually, never run as two silently-diverging numbers presented as the same thing.
16. **Recognition is a property of a Bill, never of a Transaction/Budget/Cash Flow calculation.** (ADR-016) — still blocked on schema (no `recognitionMethod`/`recognitionDuration` fields exist yet).

## UX Consistency Rules

17. **Every empty state explains why it's empty and what to do next** — never "No data." (PAT-002)
18. **Delete always requires confirmation; confirmation dialogs never exceed 2 buttons.** (PAT-004)
19. **Never more than 3 items in Today's Focus, never more than 5 in Recent Activity.** (Home Developer Rules)
20. **H004 (Today's Focus) and H009 (Notification Centre) are two views over one alert source (O016)** — never two separate alert-generating systems.
21. **Split-with (people) and Group tagging are mutually exclusive on a single transaction** — prevents the double-count bug found and fixed this session.
22. **No screen exceeds a 5-tab bottom navigation.** (PAT-001, currently exactly 5: Home/Money/Add/Outlook/Insights)

## Change Process Rule

23. Before any new feature is proposed: does it belong to an existing domain? Which engine owns it? Which screens are affected? Does it need a new shared component? Does it change an ADR? If any answer is unclear, ownership must be defined before building. (Stop Work Rule, Sprint Plan)

## Known, Explicitly Unresolved Gaps (not rules — deliberately listed separately so they aren't mistaken for settled decisions)

- Accessibility (PAT-012) has not been audited on any screen in the app.
- `calculateRecognition` is blocked on Bill schema fields that don't exist yet.
- The Analytics Engine doesn't exist — all 15 Insights screens depend on it, not incrementally.
