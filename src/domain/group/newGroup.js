// domain/group/newGroup.js
//
// UI-2C G-11 — the record written by the one-screen Add Group. It is the
// same shape the old three-step wizard wrote (type label, typeId, icon,
// colour, members, includeMe, manualLimit, defaultIntent, modules), built
// the same way, so every existing group behaviour is unchanged. Budget and
// colour are set later from Edit group, so a new group starts with no
// budget (manualLimit 0), exactly as the wizard did when budget was left
// off. `description` is new and optional.

export function buildNewGroup({ name, typeId, members, includeMe = true, description } = {}, { genId, color, groupTypes = [], typeDefaultModules = {} }) {
  const clean = String(name || "").trim();
  if (!clean) throw new Error("A group needs a name.");
  if (typeof genId !== "function") throw new Error("genId is required.");
  const meta = groupTypes.find(t => t.id === typeId);
  const resolvedTypeId = typeId || "other";
  const record = {
    id: genId(),
    type: meta?.label || "Group",
    typeId: resolvedTypeId,
    name: clean,
    icon: meta?.icon || "👥",
    color,
    members: [...(members || [])],
    includeMe: includeMe !== false,
    manualLimit: 0,
    defaultIntent: meta?.default || "split",
    modules: [...(typeDefaultModules[resolvedTypeId] || typeDefaultModules.other || [])],
  };
  const desc = String(description || "").trim();
  if (desc) record.description = desc;
  return record;
}
