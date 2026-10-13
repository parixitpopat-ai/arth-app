// domain/bills/rechargeWords.js
//
// The wording for a paid-first, valid-for-a-period connection. A prepaid plan is "recharged"; a streaming subscription is "renewed". Same flow,
// same fields (amount, start date, validity, valid until); only the words differ.
import { isSubscriptionBiller } from "./commitments.js";

const RECHARGE = {
  kind: "recharge", details: "RECHARGE DETAILS", title: "Recharge", button: "Record recharge", amount: "Recharge amount", date: "Recharge Date", action: "Recharge",
  coverage: "Prepaid coverage", list: "Recharges", none: "No recharge recorded yet",
  noneBody: "Coverage starts from your first recharge. Record one and Arth shows the plan, its validity and what's left.",
  emptyList: "Recharges you record appear here.", intro: "A prepaid plan is paid first and used after. Add the date you recharged and how long it lasts; there is no due date.",
  planWord: "plan", presets: [],
};
const SUBSCRIPTION = {
  kind: "subscription", details: "SUBSCRIPTION DETAILS", title: "Renew subscription", button: "Record renewal", amount: "Subscription amount", date: "Start Date", action: "Renew",
  coverage: "Subscription coverage", list: "Renewals", none: "No renewal recorded yet",
  noneBody: "Coverage starts from your first renewal. Record one and Arth shows the plan, its validity and what's left.",
  emptyList: "Renewals you record appear here.", intro: "A subscription is paid first and used after. Add the date it starts and how long it lasts; there is no due date.",
  planWord: "plan", presets: [{ label: "Monthly", days: 30 }, { label: "Quarterly", days: 90 }, { label: "Yearly", days: 365 }],
};

/** Words for a recharge-type connection (see isRechargeBiller). */
export const getRechargeWords = billerCategory => (isSubscriptionBiller(billerCategory) ? SUBSCRIPTION : RECHARGE);
