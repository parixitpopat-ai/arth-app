# Arth — Product Roadmap & Scoping Document
**Living Document · Updated: 30 June 2026**
**Owner: Major (Parixit Popat) | Built with: Claude**
**Codebase: ~11,747 lines · 813 KB · Live: arth-app.vercel.app**
**Repo: github.com/parixitpopat-ai/arth-app (auto-deploy via Vercel)**

---

## Ground Rules
1. Bug fixes always first
2. No new features until current phase is stable
3. Fortnightly sprint cadence
4. Transaction is always the source of truth
5. Security and backup are non-negotiable foundations

---

## Architecture Decisions
- Transaction = source of truth always
- Membership = recharge model (like mobile number/recharge)
- No auto-transaction creation from membership/fee modals
- Group expense = group's debt only, members don't inherit it
- Account attribution = for wealth view only, not auto-recording
- Salary = not recurring (amount/date changes), add manually
- Recurring = investments only (SIP, PPF, RD)
- Lock mode replaces privacy mode entirely
- Modular split (0a) = dedicated sprint, not mixed with features

---

## Current Sprint — In Progress

### Lock Mode + Cleanup
- [ ] Lock mode — 🔒 button, PIN to unlock, 5 attempt lockout
- [ ] Remove old privacy code (privacyMode, maskVal, pinReveal etc — 40+ refs)
- [ ] Remove old Txn breakup dead code (allocRows, catAllocations, trackingMode)
- [ ] Edit group type on existing groups
- [ ] SMS paste bug fix (remove clipboard interception)
- [ ] Transaction search (free text in TXNS tab)

---

## What's Built ✅

### Infrastructure
- GitHub → Vercel auto-deploy pipeline
- Supabase cloud sync — email + password auth, auto-syncs every change
- Multi-device restore working
- Release Notes in Settings (auto-updates with version)
- Backup & Restore — download/upload JSON

### Bills & Subscriptions
- PhonePe-style Bills tab — 35 biller types, icons, 5 categories
- My Accounts horizontal scroll with active/lapsed status
- Biller Action Sheet — context-aware (membership/bill/hybrid)
- Membership system — recharge model, per person, grace days, active/lapsed
- Renew suggestion (soft, not forced)
- Fee payments — multi-month distribution with monthly breakdown
- Bill period From/To dates for utilities
- Prepaid recharge fields — validity, plan type, valid until auto-calc
- CC bills auto-appear in Bill History
- Delete biller with linked records warning
- Auto-generate next bill no longer resets bill date to payment date
- Transaction → Link to Biller (optional, inline dates)
- Biller badge shown on transaction cards

### Transaction Flow
- F8 — "Who is this for?" replaces Txn breakup/Split/Tag/Allocate
- Guest person — one-time, not saved to contacts
- EMI interest waiver + GST on interest fields
- EMI SMS auto-link helper
- Income settlement multi-select — settle outstanding in one shot
- Discount field (via existing price breakdown section)

### People & Groups
- Group types — 9 types with default intent
- Unified + Add button → Person or Group
- Account attribution to Person/Group (wealth view only)
- Tagged accounts displayed in Person/Group profile
- Group total outstanding includes member individual debts

### Accounts & Wealth
- Exclude from Net Worth toggle per account
- Vyom Wallet pattern — tracked separately, not in your wealth

### Security (partial)
- PIN screen on app open
- Physical keyboard support on PIN
- Mobile keyboard stays open on PIN

---

## Open Bugs

| ID | Bug | Status |
|----|-----|--------|
| B4 | Allocate cuts personal budget | Pending — F8 may fix, needs verification |
| B10 | To Receive unpaid splits not carrying forward | Pending |
| B-SMS | SMS paste requires two pastes | In current sprint |

---

## Phase 0 — Foundation

### 0a — Modular Architecture Refactor ⏳ DEFERRED
Split 11,747 line monolith into separate files per feature area.
Reason deferred: High risk, needs dedicated sprint with no feature mixing.
Target files: TxnModal, BillsPage, PeopleTab, WealthPage, Settings, Home, hooks.

### 0b — Cloud Sync ✅ DONE

### 0c — Security & Identity ⏳ IN PROGRESS
- [ ] Lock mode — 🔒 button in header, PIN to unlock (current sprint)
- [ ] Wrong PIN lockout — 5 attempts → 30 min lock
- [ ] Session timeout — auto-lock after X minutes inactivity
- [ ] Biometric fingerprint login — WebAuthn
- [ ] Login screen before PIN on new device
- [ ] Device management

---

## Phase 2 — Core UX

- [ ] B4 fix — verify after F8 or fix properly
- [ ] B10 fix — To Receive unpaid splits carrying forward
- [ ] Transaction detail view — tap to see full details
- [ ] Duplicate transaction warning — same amount, account, date
- [ ] Debt transfer — move Jeet's debt to Sachin Masa or group
- [ ] One-time group settlement — multi-select, no double counting (partially built)
- [ ] Daily spend calendar — each date shows spend, tap → transactions
- [ ] F-Quick-1 — Guest person amount properly saved to receivables

---

## Phase 3 — Budgeting & People

- [ ] Vyom dashboard — your spend vs budget + his gift savings separate
- [ ] Per-person annual budgets (F9)
- [ ] Budget carryover + discipline reminders
- [ ] FY Budget vs Actual 12-month table
- [ ] KKG expense tagging view (no P&L needed, just categorisation)

---

## Phase 4 — Investments & Recurring

- [ ] SIP/PPF → Transaction mapping — link instalment to investment record
- [ ] SIP reminder on scheduled date — Confirm/Snooze/Change Date
- [ ] Investment instalment history — date paid, amount, units per month
- [ ] Start date stays original, each payment has own date
- [ ] Item memory — remembers name/category/unit/price
- [ ] Notification triggers — membership expiry, bill due, recharge expiry
- [ ] Fee payment linked to transaction (currently standalone)

---

## Phase 5 — Reports

- [ ] Daily spend calendar — calendar view, green/red per day
- [ ] Monthly spend report — category, person breakdown
- [ ] FY annual summary
- [ ] Net worth trend over time
- [ ] Cash flow visual
- [ ] Per-person spend report

---

## Phase 6 — Intelligence

- [ ] Transaction search — free text in TXNS tab (current sprint)
- [ ] Smart category learning — merchant → auto category
- [ ] Bank statement upload → auto-import
- [ ] CC statement reconciliation
- [ ] Duplicate transaction warning

---

## Phase 7 — Family & Co-users

- [ ] Nidhi as co-user — sees her data, you see household
- [ ] Multi-user with own accounts
- [ ] Role-based access — read-only / contributor
- [ ] You as co-user in someone else's Arth

---

## Phase 8 — AI

- [ ] Paste any text → Claude auto-fills transaction
- [ ] Financial advisor — "how did I do this month?"
- [ ] Receipt photo → auto-fill
- [ ] Proactive nudges — unusual spend, budget alerts

---

## Deferred (Not Forgotten)

| Item | Reason |
|------|--------|
| Duplicate function names (submit, handleSave, save) | Different scopes, safe as-is, high risk to rename |
| Modular refactor (0a) | Dedicated sprint needed, too risky mid-feature |
| Biometric login | Phase 0c, after lock mode stable |
| Admin panel for group types | Later |
| Co-user system | Phase 7 |

---

## Deployment Flow

```bash
cd D:/arth-app
cp ~/Downloads/Arth.jsx src/App.jsx
git add .
git commit -m "description"
git push
# Vercel auto-deploys in ~60 seconds
# Live at: arth-app.vercel.app
```

---

## Tech Stack
- React + Vite (PWA)
- Supabase (Auth + Database)
- Recharts (charts)
- Vercel (hosting + auto-deploy)
- GitHub: parixitpopat-ai/arth-app
