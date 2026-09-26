// domain/group/defaultIntent.js
//
// QW-4 (UI-2C plan). A group's default intent decides whether a new expense
// with that group defaults to being tagged ("attributed") or split
// ("split"); "manual" means choose each time. It is stored on the group at
// creation from GROUP_TYPES[].default.
//
// Groups created before defaultIntent existed have no stored value; for them
// the app has always fallen back on typeId (family/business → attributed).
// That fallback lived inline in two places in App.jsx; this is the single copy.
//
// Group type is descriptive only (UI-2C). Editing a group's type must never
// change this value, so Edit Group preserves the group's *effective* intent,
// computed from its type as it was before the edit.

const LEGACY_ATTRIBUTED_TYPE_IDS = ["family", "business"];

export function getGroupDefaultIntent(group) {
  if (group?.defaultIntent) return group.defaultIntent;
  return LEGACY_ATTRIBUTED_TYPE_IDS.includes(group?.typeId) ? "attributed" : "split";
}
