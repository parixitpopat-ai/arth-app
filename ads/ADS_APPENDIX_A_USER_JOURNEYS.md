# ADS Appendix A — User Journeys

Same template throughout. J004 (Pay a Bill) already fully specified in
the prior message — not repeated here. This document fully details the
journeys that ground directly against real, confirmed session events
(not hypothetical), plus the complete catalogue for the rest.

---

# J028 — Resolve Sync Conflict

**Purpose:** Recover safely when a device's local data conflicts with the cloud, without silently losing data.

**Trigger:** A device opens the app and its local `savedAt` timestamp appears newer than the cloud's.

**Preconditions:** User signed in to Cloud Sync on 2+ devices.

**Primary Flow:**
```
Device opens
    |
    v
Pull attempted
    |
    v
Conflict detected (local newer than cloud)
    |
    v
Pre-sync backup created (this device's local state, before anything changes)
    |
    v
Pull blocked, auto-push also blocked
    |
    v
User sees: "Your device has newer local data than the cloud..."
    |
    v
User taps Sync Now again
    |
    v
Force-pull executes
    |
    v
Cloud data applied, conflict flag cleared
```

**Alternative Flows:** user never returns to resolve it — device stays on its own local data indefinitely, auto-push stays blocked, no data loss occurs either direction (safe default).

**Failure Scenarios — real, not hypothetical:** this exact flow **failed in production this session** before the fix: the block correctly prevented the pull, but auto-push was still allowed to fire moments later, silently overwriting the cloud with the blocked device's stale data. Confirmed root cause, confirmed fixed.

**Systems Involved:** Ledger Engine (data being synced), Settings Engine (sync/backup).

**Screens Involved:** S013 (Sync), S012 (Backup — pre-sync snapshot).

**Business Rules:**
1. Never discard local state without a recoverable path (pre-sync backup, always created before any pull applies).
2. Auto-push must be blocked whenever a conflict is unresolved — `cloudHydrated` alone is not a safe enough signal (this was the actual bug).
3. "Sync Now" tapped a second time must genuinely force-resolve, not silently re-block.

**Acceptance Criteria:**
- [ ] Conflict correctly detected when local is >60sec newer than cloud
- [ ] Auto-push does not fire while conflict is unresolved
- [ ] Pre-sync backup exists and is restorable before any overwrite
- [ ] Second "Sync Now" tap genuinely force-pulls

**Telemetry:** conflict detected, conflict resolved, time-to-resolution, force-pull invoked.

**Future Enhancements:** surface a clearer in-app diff ("Device A has 15 more transactions than the cloud") instead of a generic warning message.

---

# J020 — Create an Insurance Policy

**Purpose:** Record a policy's stable details as Manage master data.

**Trigger:** User taps + Add Policy (Manage → Insurance).

**Preconditions:** none — Progressive Enrichment applies, minimal fields required.

**Primary Flow:**
```
Manage -> Insurance -> + Add Policy
    |
    v
Enter Insurer, Premium Amount, Frequency, Renewal Date (required)
    |
    v
Save
    |
    v
Bill auto-generated (type: insurance_premium, linkedPolicyId set)
    |
    v
Outlook updated (new commitment visible)
```

**Alternative Flows:** policy linked to an existing Vehicle/Property asset (optional field).

**Failure Scenarios:** Renewal Date in the past on creation — warned, not hard-blocked (allows backdating real existing policies).

**Systems Involved:** Manage (new entity), Forecast Engine (auto-generated Bill).

**Screens Involved:** S007 (Insurance, Manage side).

**Business Rules:** Policy never creates Transactions directly — always Policy → Bill → Transaction (UX-004's core rule, non-negotiable).

**Acceptance Criteria:**
- [ ] Policy saves with minimal required fields only
- [ ] Bill auto-generated immediately on save, correct type/amount/frequency
- [ ] Policy detail screen (from UX-004) shows the linked Bill

**Telemetry:** policy created, fields left blank (progressive enrichment usage), linked-asset usage rate.

**Future Enhancements:** claims tracking (flagged as genuinely new domain work in an earlier conversation, not scoped for v2.0).

---

# J021 — Pay Insurance Premium

**Purpose:** Settle a generated premium Bill through the ordinary payment flow.

**Trigger:** User taps Pay Now on an Insurance Premium bill (Outlook or Commitment Detail, O019).

**Primary Flow:**
```
Outlook -> Insurance Premium Bill -> Pay Now
    |
    v
Transaction created (isBillPayment, paidBillId set - same mechanism every Bill type uses)
    |
    v
Bill's next due date rolled forward (computeNextDueDate, reused, not reimplemented)
    |
    v
Policy's renewal date synced to match
    |
    v
Timeline, Money, Home all reflect the payment
```

**Business Rules:** no insurance-specific payment UI — reuses the exact same confirm sheet every other Bill type already uses.

**Systems Involved:** Ledger Engine, Forecast Engine, Manage (Policy renewal sync).

**Screens Involved:** O019 Commitment Detail.

**Acceptance Criteria:**
- [ ] Payment creates a real Transaction, no new shape
- [ ] Bill due date and Policy renewal date both update, in sync with each other
- [ ] No separate insurance payment screen exists

**Telemetry:** premium paid, payment source account distribution.

---

# J026 — First Launch

**Purpose:** Get a brand-new user to their first recorded transaction with confidence.

**Trigger:** App opened for the very first time, no existing data.

**Preconditions:** none — this journey exists specifically because none currently do (Onboarding confirmed 0% built).

**Primary Flow (target — does not exist yet):**
```
App opens
    |
    v
Empty Home State (H013): "Welcome to Arth"
    |
    v
Suggested Quick Start: Connect Bank / Add First Transaction / Create Budget
    |
    v
User picks one
    |
    v
Guided first entry
    |
    v
Home populates for the first time
```

**Failure Scenarios:** user abandons before completing the first entry — should leave Arth in a clean, re-enterable state, not a half-created account/transaction.

**Systems Involved:** Home (presentation only, per "Home owns nothing").

**Screens Involved:** H013 (Empty Home).

**Business Rules:** never fabricate demo/placeholder data to make Home look populated — an honest empty state beats fake numbers, consistent with the Architecture Freeze Enforcement rule ("placeholder screens are acceptable, placeholder business logic is not").

**Acceptance Criteria:**
- [ ] Zero fabricated data shown at any point
- [ ] User reaches a real, saved first transaction within the flow
- [ ] Abandoning mid-flow leaves no orphaned partial data

**Telemetry:** first-launch started, quick-start option chosen, first transaction completion rate, time-to-first-transaction.

**Future Enhancements:** bank-connect integration (not scoped for v2.0 — "Connect Bank" as a Quick Start option would need to gracefully degrade to manual entry today, since no bank integration exists).

---

## Full Journey Catalogue (all 28)

### Core Financial
| ID | Journey | Priority | Status vs. real app |
|---|---|---|---|
| J001 | Record an Expense | P0 | Existing (UX-001) |
| J002 | Record Income | P0 | Existing |
| J003 | Transfer Between Accounts | P0 | Existing |
| J004 | Pay a Bill | P0 | Existing (fully specced, prior message) |
| J005 | Receive Salary | P0 | Existing (Expected Income mechanism) |
| J006 | Create a Budget | P0 | Existing |
| J007 | Create a Goal | P1 | Existing |

### Planning
| ID | Journey | Priority | Status |
|---|---|---|---|
| J008 | Review Cash Forecast | P0 | **Newly unblocked** — engine functions now real (this session) |
| J009 | Skip a SIP | P1 | Blocked — per-instance Skip doesn't exist on Bill yet (O019 gap) |
| J010 | Pause a Subscription | P1 | Existing (`isPaused`, whole-series only) |
| J011 | Renew Insurance | P1 | Same as J021 above |
| J012 | Review Monthly Planner | P0 | Blocked on O014/O017 (not built) |

### Money
| ID | Journey | Priority | Status |
|---|---|---|---|
| J013 | Add an Asset | P1 | Existing |
| J014 | Record a Liability | P1 | Existing |
| J015 | Lend Money | P0 | Existing |
| J016 | Receive Money Owed | P0 | Existing |

### Account Management
| ID | Journey | Priority | Status |
|---|---|---|---|
| J017 | Add a Bank Account | P0 | Existing |
| J018 | Import Transactions | P1 | Blocked — Import (S010) confirmed New |
| J019 | Backup & Restore | P1 | Existing, hardened this session |

### Insurance
| ID | Journey | Priority | Status |
|---|---|---|---|
| J020 | Create an Insurance Policy | P1 | Fully specced above |
| J021 | Pay Insurance Premium | P1 | Fully specced above |
| J022 | Archive a Policy | P1 | Blocked — Insurance entity itself not built yet |

### Search
| ID | Journey | Priority | Status |
|---|---|---|---|
| J023 | Search for a Transaction | P0 | Existing (H012) |
| J024 | Search for a Person | P1 | Existing |
| J025 | Search for an Asset | P1 | Not confirmed — Assets may not be indexed in current search |

### System
| ID | Journey | Priority | Status |
|---|---|---|---|
| J026 | First Launch | P0 | Fully specced above — confirmed New |
| J027 | Offline Recovery | P1 | Blocked — H014 not built |
| J028 | Resolve Sync Conflict | P1 | Fully specced above — Existing, hardened this session |

## Summary

**4 journeys fully detailed here** (J020, J021, J026, J028), chosen specifically because they either ground directly against real bugs fixed this session (J028) or represent the flagship gap (J020/J021/J026) rather than picked arbitrarily. **The remaining 24 follow the same template** — can be fully detailed on request, but the catalogue above already flags which are Existing vs. genuinely Blocked, which is the actionable information for sprint planning.
