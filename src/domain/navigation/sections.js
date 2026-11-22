// domain/navigation/sections.js
//
// The four-section layout (Today / Money / People / Plan), switched on in Settings. It is a layer over the screens that already exist:
// nothing is moved or rewritten, each section is a group of the current tabs, with a switch of its parts at the top. Pure.
//   Today  : Home (and Insights, reached from Home).
//   Money  : Activity (the transactions list) and Accounts (the PIN-protected money hub).
//   People : People.
//   Plan   : Bills (Payments), Budget, Goals, Events, Outlook.

export const SECTIONS = [
  { id: "today", label: "Today", icon: "🏠", landing: "home", tabs: ["home", "insights"] },
  { id: "money", label: "Money", icon: "💰", landing: "transactions", tabs: ["transactions", "wealth"] },
  { id: "people", label: "People", icon: "👥", landing: "people", tabs: ["people"] },
  { id: "plan", label: "Plan", icon: "🗓️", landing: "bills", tabs: ["bills", "budget", "outlook"] },
];

/** @returns {string|null} the section a tab belongs to, or null for a tab outside them. */
export function sectionOfTab(tab) {
  const s = SECTIONS.find(x => x.tabs.includes(tab));
  return s ? s.id : null;
}

// What each section lets the person switch between. kind "tab" opens that tab; kind "modal" opens a list that is a sheet today.
const SEGMENTS = {
  money: [{ id: "activity", label: "Activity", kind: "tab", target: "transactions" }, { id: "accounts", label: "Accounts", kind: "tab", target: "wealth", private: true }],
  plan: [
    { id: "bills", label: "Bills", kind: "tab", target: "bills" }, { id: "budget", label: "Budget", kind: "tab", target: "budget" },
    { id: "goals", label: "Goals", kind: "modal", target: "goals" }, { id: "events", label: "Events", kind: "modal", target: "events" },
    { id: "outlook", label: "Outlook", kind: "tab", target: "outlook" },
  ],
};

/** The switch shown at the top of a section; [] when the section has just one screen (Today, People). */
export function segmentsFor(sectionId) { return SEGMENTS[sectionId] || []; }

/** Which segment of the section is showing for the current tab, or null. A sheet (kind "modal") is never the active one. */
export function activeSegmentId(tab) {
  const sec = sectionOfTab(tab); if (!sec) return null;
  const seg = segmentsFor(sec).find(s => s.kind === "tab" && s.target === tab);
  return seg ? seg.id : null;
}

/** The bottom bar for the new layout: four sections around the + button. */
export function bottomTabs() {
  const t = id => { const s = SECTIONS.find(x => x.id === id); return { id: s.landing, icon: s.icon, label: s.label, section: s.id }; };
  return [t("today"), t("money"), { id: "__fab__", icon: "➕", label: "" }, t("people"), t("plan")];
}

/** True when the tab should light up for a bottom-bar item (a section lights up for any of its tabs). */
export function isSectionTabActive(item, tab) { return Boolean(item.section) && sectionOfTab(tab) === item.section; }
