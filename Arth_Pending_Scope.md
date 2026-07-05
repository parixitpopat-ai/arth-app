# Arth — Pending Scope
**As of: 30 June 2026**
**Status: Lock mode bug just fixed (scope error), pending final deploy verification**

---

## 🔴 BUGS — NOT YET CONFIRMED FIXED

| ID | Bug | Status |
|----|-----|--------|
| B4 | Allocate cuts personal budget | Open — F8 replaced the UI but underlying engine not verified end-to-end |
| B10 | To Receive — unpaid splits not carrying forward | Open — not investigated this session |
| B-Lock | lockApp scope error ("ReferenceError: lockApp is not defined") | Just fixed — needs deploy + phone verification |
| B-Stale | Phone may still be running stale cached build (old privacy/masking code seen after supposed removal) | Needs hard refresh / clear site data verification |

---

## 🟡 FEATURES DISCUSSED BUT NOT BUILT

### Financial Health / Runway (NEW — high priority given job uncertainty)
- [ ] Essential vs Discretionary expense tagging (simple toggle per transaction/category)
- [ ] Runway calculator — savings ÷ essential monthly burn = months of survival
- [ ] Monthly discretionary spend rollup — single attackable number
- [ ] Month-over-month category trend comparison — spend creep detection
- [ ] Financial Health Dashboard — new Home screen section surfacing all of the above

### AI Embedding (NEW — scoped, not built)
- [ ] Pattern narration — Claude summarizes month's spend in plain language
- [ ] Anomaly flagging — Claude flags unusual transactions vs historical pattern
- [ ] Runway conversation — ask Claude "can I afford X" against real numbers
- [ ] Decision needed: auto-run on app open (cost implication) vs on-demand trigger

### Budgeting (Phase 3 — completely untouched this cycle)
- [ ] Per-person annual budgets (Vyom ₹10k/month etc.)
- [ ] Budget carryover + discipline reminders
- [ ] FY Budget vs Actual 12-month table
- [ ] Vyom's dashboard — spend vs budget, gift savings tracked separately

### Security (Phase 0c — partially done)
- [x] PIN screen on app open
- [x] Lock button (🔒) — locks app, requires PIN (just fixed)
- [ ] Wrong PIN lockout — 5 attempts → 30 min lock (was built, removed during scope-error cleanup, needs re-adding correctly this time)
- [ ] Session/idle auto-lock timer — exists but may be too aggressive or not resetting properly on tap (reported issue today)
- [ ] Biometric fingerprint login (WebAuthn)
- [ ] Login screen before PIN on new device
- [ ] Device management

### Transactions
- [ ] B4/B10 verification (see bugs above)
- [ ] Transaction detail view — tap to see full details (discount, EMI, biller link, membership dates)
- [ ] Duplicate transaction warning — same amount/account/date
- [ ] Debt transfer — move Jeet's debt to Sachin Masa or a group, by choice
- [ ] One-time group settlement — multi-select settle, no double counting (partially built, needs end-to-end test)
- [ ] Guest person amount — confirm it's actually saved to receivables, not just UI-only
- [ ] Transaction search — built, needs phone verification post stale-cache issues

### Investments / Recurring
- [ ] SIP/PPF → Transaction mapping — link monthly instalment to investment record
- [ ] SIP reminder on scheduled date — Confirm / Snooze / Change Date options
- [ ] Investment instalment history — date paid, amount, units per month
- [ ] EMI SMS auto-link — built (`tryAutoLinkEmi`), not tested live
- [ ] EMI interest waiver + GST fields — built, not tested live

### Bills & Billers
- [ ] Edit group type on existing groups — built, not deployed/verified
- [ ] Membership expiry notifications
- [ ] Recharge expiry notifications
- [ ] Free trial end date alerts
- [ ] SMS paste fix — built, not deployed/verified

### People & Groups
- [ ] Account attribution display — built, not deployed/verified
- [ ] Group total outstanding (member individual + group) — built, not deployed/verified

### Reports (Phase 5 — not started)
- [ ] Daily spend calendar — calendar view, green/red per day, tap → transactions
- [ ] Monthly spend report — category, person breakdown
- [ ] FY annual summary
- [ ] Net worth trend over time
- [ ] Cash flow visual
- [ ] Per-person spend report

### Intelligence (Phase 6 — not started)
- [ ] Smart category learning — merchant → auto category
- [ ] Bank statement upload → auto-import
- [ ] CC statement reconciliation

### Family / Co-users (Phase 7 — not started)
- [ ] Nidhi as co-user
- [ ] Multi-user with own accounts
- [ ] Role-based access

### KKG
- [ ] KKG expense tagging view — group exists, no dedicated view built yet

---

## 🔧 INFRASTRUCTURE / ARCHITECTURE CHANGES NEEDED

### Critical — caused today's bug
- [ ] **Document the App() / AppContent() split clearly.** Today's bug existed because a new feature (`lockApp`) was added to the outer `Arth()` wrapper while the button using it lived in the inner `AppContent()` function — two separate scopes that look like one file. This will happen again unless we either:
  - (a) Flatten back to one function, or
  - (b) Maintain a clear scope map of what lives in `Arth()` vs `AppContent()` before every edit

### Deferred — still pending, now more urgent
- [ ] **Modular refactor (Phase 0a)** — 11,745 line single file. Today's bug is a direct symptom of monolith risk: a function defined 10,000+ lines away from its usage, in a different scope, with no compiler/IDE catching it until runtime on your phone. Splitting into `TxnModal.jsx`, `BillsPage.jsx`, `PeopleTab.jsx`, `Settings.jsx`, `Home.jsx`, `AppContent.jsx` etc. would make this entire class of bug impossible.
- [ ] **Build-time safety net** — no TypeScript, no lint step catching undefined references before deploy. Worth adding even basic `eslint` with `no-undef` rule to the build to catch scope errors like today's before they reach Vercel.
- [ ] **Deploy verification step** — today's confusion partly came from not having a fast way to confirm "is the code I'm looking at actually what's deployed." Worth adding a visible build hash/commit SHA somewhere in the app (Settings → Release Notes already shows version stamp — confirm this is reliable and always check it first when debugging).

### Deferred — duplicate function names
- [ ] `submit`, `handleSave`, `save` exist in multiple component scopes. Confirmed safe (different scopes), but worth renaming during the eventual modular refactor for clarity.

---

## ✅ WHAT'S SOLID (built, deployed, working)

- Cloud sync (Supabase) — multi-device restore
- GitHub → Vercel auto-deploy pipeline
- Bills tab — PhonePe-style grid, 35 biller types
- Membership system — recharge model, grace days, active/lapsed
- Fee payments — multi-month distribution
- F8 — "Who is this for?" transaction flow
- Group types with default intent
- Account attribution (wealth view)
- Exclude from Net Worth toggle
- Vyom Wallet pattern
- Release Notes in Settings

---

## RECOMMENDED NEXT SPRINT (given job uncertainty context)

1. **Verify lock mode fix deploys clean** — close the loop on today's bug first
2. **Financial Health Dashboard** — runway number + essential/discretionary split (highest real-world value right now)
3. **B4 + B10** — verify/fix, these affect data integrity
4. **Budgeting (Phase 3)** — needed to make the runway number actionable, not just informational

AI embedding (pattern narration, anomaly flagging) is valuable but should come *after* the dashboard exists — AI needs good structured data and a UI surface to narrate into; building it first would mean narrating into a vacuum.
