# Batch 1 — Home Module (H001–H015)
## Low-Fidelity Wireframes + User Flows

Structure only — no color, icons, or fonts. Screen Registry version 2.0.0.

---

### H001 — Home Dashboard

**User Flow:** `Launch App -> Home -> (tap any widget) -> Money/Outlook/Insights/Timeline`

```
+-----------------------------+
| Good Morning, [Name]        |
|                             |
| Financial Health            |
| oooooooooooo..  82/100      |
|                             |
| Safe to Spend                |
| Rs 18,450                    |
|                             |
| Today's Focus                |
| - Electricity Bill due today  |
| - Salary expected tomorrow    |
| - Grocery budget at 81%       |
|                             |
| [Expense][Income][Transfer][Bill]|
|                             |
| Goals                 View All|
| oooooooo.. Emergency 72%     |
|                             |
| Recent Activity        See all|
| DMart              -Rs850     |
| Salary            +Rs75,000   |
+-----------------------------+
```

---

### H002 — Widget Customization

**User Flow:** `Home -> Arrange -> reorder/hide -> Save -> Home`

```
+-----------------------------+
| <- Arrange Home         Save |
+-----------------------------+
| = Financial Health      [x] |
| = Safe to Spend          [x] |
| = Today's Focus          [x] |
| = Goals                  [x] |
| = Events                 [x] |
| = Recent Activity        [x] |
+-----------------------------+
```

---

### H003 — Financial Health Detail

**User Flow:** `Home -> tap Financial Health -> Detail -> back`

```
+-----------------------------+
| <- Financial Health          |
+-----------------------------+
|        82/100  Excellent     |
|        (up) +4 vs last month |
+-----------------------------+
| Savings Rate         OK      |
| Budget Adherence     OK      |
| Bill Payment History Fair    |
| Debt Ratio           OK      |
+-----------------------------+
```

---

### H004 — Today's Focus (full screen)

**User Flow:** `Home (Today's Focus widget) -> View All -> Today's Focus (full) -> tap item -> source screen`

```
+-----------------------------+
| <- Today's Focus             |
+-----------------------------+
| Morning                       |
| - Electricity Bill due today  |
| - Salary expected tomorrow     |
|                                |
| Afternoon                       |
| - Rs1,500 outstanding - Amit    |
|                                |
| Evening                         |
| - Spent Rs620 less than yesterday|
+-----------------------------+
```

---

### H005 — Goals Preview (Home widget only)

```
+-----------------------------+
| Goals                  View All|
| oooooooo.. Emergency 72%      |
| ooo....... Vacation 34%       |
+-----------------------------+
```

---

### H006 — Events Preview

```
+-----------------------------+
| Trips & Outings                |
| Goa Trip - Rs12,500 / Rs20,000  |
+-----------------------------+
```

---

### H007 — Recent Activity

```
+-----------------------------+
| Recent Activity         See all|
| DMart               -Rs850     |
| Salary             +Rs75,000   |
+-----------------------------+
```

---

### H008 — Search entry point (full experience = H011/H012)

```
+-----------------------------+
| [Home Header]           (search)|
+-----------------------------+
```

---

### H009 — Notification Centre

**User Flow:** `Home (bell icon) -> Notification Centre -> tap item -> related screen`

```
+-----------------------------+
| <- Notifications               |
+-----------------------------+
| Today                          |
| ! Electricity Bill due today   |
| + Salary credited              |
|                                |
| Yesterday                       |
| ! Grocery budget at 81%        |
|                                |
| Earlier                         |
| * SIP executed                 |
+-----------------------------+
```
*(Empty state: "You're all caught up.")*

---

### H010 — Notification Detail

**User Flow:** `H009 -> tap notification -> Detail -> Pay Now/Dismiss`

```
+-----------------------------+
| <- Electricity Bill            |
+-----------------------------+
| Due Today                       |
| Amount          Rs2,350         |
| Account         HDFC            |
|                                |
|   [ Pay Now ]   [ Dismiss ]    |
+-----------------------------+
```

---

### H011/H012 — Universal Search (merged, 4 states)

**User Flow:** `Home (search) -> type -> live results -> tap result -> source screen`

```
State A - Idle              State B - Typing
+-------------------+       +-------------------+
| Search...          |       | Amazon|            |
|                    |       |  DMart Rs850 Today  |
| Recent Searches     |       |  Amit               |
|  Amazon              |       +-------------------+
|  Electricity          |
+-------------------+

State C - Results            State D - No Results
+-------------------+       +-------------------+
| Amazon              |       | xyz123              |
| Transactions (3)     |       |                     |
|  Amazon - Rs2,499     |       |   No results found   |
| Bills (1)              |       |                     |
|  Amazon Pay Bill        |       +-------------------+
+-------------------+
```

---

### H013 — Empty Home State

**User Flow:** `First launch -> Empty Home -> Quick Start choice -> guided first entry`

```
+-----------------------------+
|                                |
|      Welcome to Arth           |
|  Let's record your first       |
|      transaction.               |
|                                |
|  [Connect Bank]                 |
|  [Add First Transaction]        |
|  [Create Budget]                |
|                                |
+-----------------------------+
```

---

### H014 — Offline Mode

```
+-----------------------------+
| ! Offline                      |
| 3 pending changes               |
| Last synced: 8:42 AM            |
|                     [ Retry ]   |
+-----------------------------+
| [rest of Home]                  |
+-----------------------------+
```

---

### H015 — Home Error Recovery

```
+-----------------------------+
|                                |
|  We couldn't load your          |
|  dashboard.                     |
|                                |
|  [ Retry ]                      |
|  [ Continue Offline ]            |
|  [ Send Diagnostics ]             |
|  [ Copy Error ]                   |
|                                |
+-----------------------------+
```

---

## Batch 1 Navigation Map

```
                    Home (H001)
         /       |        |        |       \
   Widget    Financial  Today's   Goals   Events
   Custom    Health     Focus     Preview Preview
   (H002)    Detail     (H004)    (H005)  (H006)
             (H003)                |        |
                                Full Goals  Full Events
                                (own module)(own module)

  Home also branches to:
  - Recent Activity (H007) -> Timeline
  - Search (H008) -> Universal Search (H011/H012, 4 states)
  - Bell icon -> Notification Centre (H009) -> Notification Detail (H010)
  - First-run only -> Empty Home (H013) -> guided entry
  - System states -> Offline (H014), Error Recovery (H015) - overlay any time
```

## Interaction Notes (Batch 1)

- Today's Focus, Goals Preview, Events Preview, Recent Activity all use the same "preview card -> View All / See all -> full screen" interaction pattern — consistent across the module, not four different conventions.
- H014/H015 are overlay/banner states, not separate navigable destinations — they appear on top of whatever screen the user was already on.
- H011/H012's four states are transitions within one screen, never separate navigation pushes (matches PAT-001's "predictable Back behaviour" — Back from Results returns to Typing/Idle, not out of search entirely).
