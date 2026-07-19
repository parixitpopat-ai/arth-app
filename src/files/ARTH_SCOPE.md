# Arth — Scope Lock v1.0

## Mission
Arth is a personal financial operating system that helps one person understand,
manage, and grow their money with minimal effort. If a feature doesn't support
this mission, it doesn't go into V1.

## North Star
Build the most intuitive personal finance app for yourself. Every feature must
either help you record money faster, understand money better, or plan money
more confidently. If it doesn't do one of those three things, it waits until V2.

## Pillar 1 — Non-Negotiables (V1)
- React (JavaScript, **not** TypeScript)
- Existing theme architecture (the `T` token object, `DARK`/`LIGHT`)
- Existing Supabase backend
- Inline styling (until the post-V1 component-library refactor, if ever)
- PWA first, offline-first
- Personal finance first — no family/business/tax features yet

## Pillar 2 — Frozen Navigation
Bottom nav: 🏠 Home · 📖 Timeline · ➕ (FAB) · 💰 Money · 👤 Me
No further navigation experiments unless a major usability issue is found.

## Pillar 3 — Frozen Screen List (18, V1)
1. Splash · 2. Onboarding · 3. Login & Security
4. Home · 5. Add Transaction · 6. Timeline
7. Money · 8. Bills · 9. Budgets · 10. Goals · 11. Events · 12. Reports
13. Wealth · 14. People
15. AI + Search · 16. Documents
17. Profile (Me) · 18. Settings

No new screens during V1. Everything else goes to the Parking Lot.

## Pillar 4 — Feature Freeze (Parking Lot, not V1)
Family Accounts · Business Accounting · Tax Filing · Insurance Marketplace ·
UPI Payments · Open Banking · Brokerage APIs · AI Decision Engine ·
Future Mirror · Time Capsule UI · Wear OS · iOS App

## Locked Product Decisions
| # | Decision |
|---|---|
| Brand color | Green primary (`#16a34a`/`#22c55e` family). Gold reserved for achievements/premium only. |
| Financial Health Score | 100 pts: Savings Rate 25, Bills On Time 20, Budget Adherence 15, Emergency Fund 15, Debt Ratio 10, Net Worth Growth 10, Consistency 5. |
| Login | Optional. Dashboard is never blocked by mandatory auth. |
| Onboarding permissions | Only real PWA permissions (Notifications, Camera, Storage, Biometric via WebAuthn). No SMS permission request — not available to a PWA. |
| Feature flags | Simple config object (`const FEATURES = {...}`), not a formal framework. |
| OCR / Firebase Push / PostHog | Deferred — hooks may exist in UI, no implementation until core app is stable. |
| Icons | Emoji (existing convention). Lucide is *not* adopted — flagged as a leftover from an earlier draft, not an actual decision. |
| Database changes | Always additive, backward-compatible, never destructive. Every new feature must degrade gracefully for records that predate it. |

## Change Control — Five Questions
Before adding anything not on this list, ask:
1. Does it support the mission?
2. Does it fit one of the 18 screens?
3. Can it reuse existing data structures?
4. Can it ship without new paid dependencies?
5. Will it delay V1 by more than one screen's worth of work?

If the answer to any is **No**, it goes to the Parking Lot, not the sprint.

## Coding Rules
- One screen per pull request/commit. Never redesign two screens together.
- Every change: backward compatible, data-safe, validated (syntax-checked)
  before shipping.
- No exceptions.

## Architecture Rule
Don't rewrite the app. Extract opportunistically: Monolith → extract the
screen being touched → import it back → repeat. See `CODING_STANDARDS.md`
for the extraction order and the Definition of Extractable.

## Definition of Done (per screen)
- UI finished
- Existing data still loads
- New data saves correctly
- Dark mode works
- Offline works
- No console errors, no regressions
- Performance acceptable
