# PAY-TOGETHER-002 — Known limitations after the 30-day cash integration

Status: documentation only. Nothing here is approved for implementation. Written alongside the Pay together /
30-day cash change (branch `feat-pay-together-30day`).

## What the change does

Grouped instalments count in Home "Money Required", Outlook "Needed", the Outlook timeline and the rhythm lists on
the group's payment date, once (`applyGroupDates`, `domain/payTogether/group.js`). Readiness keeps cash in the
group's month and budget in each fee's own due month. One instalment belongs to one group: the earliest created
(then lowest id) keeps it (`effectiveGroups`).

## Limitation 1 — Outlook overdue label

An overdue fee that is grouped for today or a later date is shown on the group date, not as overdue. The Outlook
"overdue" total excludes it and the row carries no overdue marker, although the fee is still unpaid past its due
date. The event keeps `originalDate`, but no screen reads it.

Why accepted for now: the requirement is that cash counts on the date the user plans to pay.
Possible follow-up (not approved): show "was due <originalDate>" on grouped rows and keep an overdue marker.

## Limitation 2 — Other screens still show the original due date

These read the unmodified Future Money list or their own sources, so they show original due dates for grouped fees:
the financial calendar's due items (`projectDueItems`), the Payments renewal reminders (school fee reminders), the
recurring-cost summaries, and the Bills / School Fees lists. A total computed by summing fees by due date on those
screens can differ from Home's Money Required when a group exists. This is by design of "due dates stay as they are".

Possible follow-up (not approved): decide per screen whether it answers "when is it due" (keep) or "when does cash
leave" (planned date).

## Limitation 3 — Behaviours to know

- A stored group whose payment date has passed is not rejected; its unpaid fees then count as overdue on that date.
- If all but one fee in a group are paid, the last one stays on the group's payment date.
- Groups are never removed automatically after payment; paid fees just drop out of them.
- When duplicate groups exist (sync or older app versions), the stored records are left as they are; every reader
  applies the earliest-group-wins rule. The later group's screen row shows only the fees it still holds.
- Not verified on a device or in the live app; checked by unit tests, wiring tests and a production build only.
