import React, { useState } from "react";
import BottomSheet from "./BottomSheet";
import AddVehicleModal from "./AddVehicleModal";
import LinkPicker from "./LinkPicker";
import { FONT, RADIUS, TOUCH } from "../constants/theme";

// T3.1 Part B2 — "Link to…" sheet. One BottomSheet, two stages: the type list (unchanged idea
// from B1) and, per type, the real LinkPicker (Arth UI-2B T3.1 B2 Link To Pickers.dc.html).
// Picking a type pushes the picker INSIDE this same sheet — Back returns to the type list
// without closing; only the type-list stage's backdrop tap, or a picker's commit, closes the
// whole sheet. No new domain model: every commit still writes the same existing fields
// (billerLinkId, eventId, vehicleId, and the membership coverage fields) this file never owns.

const VEHICLE_ICON = { car: "🚗", bike: "🏍️", truck: "🚛", auto: "🛺", other: "🚘" };
const VEHICLE_TYPE_LABEL = { car: "Car", bike: "Bike", truck: "Truck", auto: "Auto", other: "Other" };

const normalize = s => (s || "").toString().toLowerCase();
const daysBetween = (a, b) => {
  const da = a ? new Date(a) : null, db = b ? new Date(b) : null;
  if (!da || !db || Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return Infinity;
  return Math.round((da.getTime() - db.getTime()) / 86400000);
};

export default function LinkToSheet({
  T,
  onClose,
  initialStage = "types",
  // Data
  billerAccounts, schoolRelationships, events, vehicles, txns,
  billerLinkId, eventLinkId, vehicleId, showVehicle,
  detailsDate,
  // Helpers/lookups already owned by AddModal — reused, not reimplemented
  getBillerIcon, getBillerActionType, isSchoolRelationshipCurrent, todayStr,
  formatShortDate, EVENT_TYPES, getPerson, getGroup,
  // Membership coverage panel — same fields B1 already wrote, now rendered inline in the picker
  linkMemberPersonId, linkCycle, setLinkCycle, linkValidFrom, setLinkValidFrom,
  linkBulkMonths, setLinkBulkMonths, linkGraceDays, setLinkGraceDays, linkValidUntil,
  Segmented, lbl, inp,
  // Commits — the only writes this file ever performs, via the callbacks AddModal supplies
  onCommitBiller, onCommitTrip, onCommitVehicle,
  setVehicles,
  onNewBillerType, // (presetType) => opens the existing BillerAccountModal, sheet stays open
  onNewTrip,       // () => opens the existing AddEventModal, sheet stays open
}) {
  const [stage, setStage] = useState(initialStage);
  const [showNewVehicle, setShowNewVehicle] = useState(false);

  const billerName = ba => ba.name || ba.provider || "Biller";
  const attributionLabel = ba => {
    if (!ba.attributedTo) return null;
    if (ba.attributeType === "group") return getGroup(ba.attributedTo)?.name || null;
    return getPerson(ba.attributedTo)?.name || null;
  };
  const lastLinkedDate = (id, key) => txns
    .filter(t => t[key] === id)
    .reduce((max, t) => (t.date && (!max || t.date > max) ? t.date : max), null);

  // Bill / Membership / School fees all read the same billerAccounts array, partitioned by
  // getBillerActionType (per the per-picker spec table).
  const billerRow = ba => ({
    id: ba.id, icon: getBillerIcon(ba.type), title: billerName(ba),
    searchText: [ba.name, ba.provider, ba.consumerNo, attributionLabel(ba)].filter(Boolean).join(" "),
  });
  const buildBillerGroups = (list, { meta }) => {
    const withRecency = list.map(ba => ({ ba, recent: lastLinkedDate(ba.id, "billerLinkId") }));
    const recent3 = withRecency.filter(x => x.recent).sort((a, b) => (b.recent > a.recent ? 1 : -1)).slice(0, 3).map(x => x.ba.id);
    const rows = ba => ({ ...billerRow(ba), meta: meta(ba) });
    const recentGroup = { label: "Recently linked", rows: list.filter(ba => recent3.includes(ba.id)).sort((a, b) => recent3.indexOf(a.id) - recent3.indexOf(b.id)).map(rows) };
    const restGroup = { label: "All · A–Z", rows: list.filter(ba => !recent3.includes(ba.id)).sort((a, b) => billerName(a).localeCompare(billerName(b))).map(rows) };
    return [recentGroup, restGroup].filter(g => g.rows.length);
  };
  const buildBillerSingleList = (list, { meta }) => {
    const withRecency = list.map(ba => ({ ba, recent: lastLinkedDate(ba.id, "billerLinkId") }));
    const sorted = withRecency.sort((a, b) => {
      if (a.recent && b.recent) return a.recent > b.recent ? -1 : 1;
      if (a.recent) return -1;
      if (b.recent) return 1;
      return billerName(a.ba).localeCompare(billerName(b.ba));
    }).map(x => x.ba);
    return sorted.length ? [{ label: "", rows: sorted.map(ba => ({ ...billerRow(ba), meta: meta(ba) })) }] : [];
  };

  const isSchoolBiller = ba => ba.type === "School Fees" || ba.type === "Education Fees";
  const isMembershipBiller = ba => getBillerActionType(ba.type) === "membership" && !isSchoolBiller(ba);
  const billBillers = billerAccounts.filter(ba => !isMembershipBiller(ba) && !isSchoolBiller(ba));
  const membershipBillers = billerAccounts.filter(isMembershipBiller);
  const schoolBillers = billerAccounts.filter(isSchoolBiller);

  const linkedBiller = billerLinkId ? billerAccounts.find(b => b.id === billerLinkId) : null;
  const linkedIsMembership = linkedBiller && isMembershipBiller(linkedBiller);
  const linkedIsSchool = linkedBiller && isSchoolBiller(linkedBiller);

  // Trip or outing — sorted purely by |event date − Details date|, no vehicleId-style recency.
  const tripRow = ev => {
    const et = EVENT_TYPES.find(x => x.id === ev.occasionType) || EVENT_TYPES[EVENT_TYPES.length - 1];
    const dist = daysBetween(ev.date, detailsDate);
    return { id: ev.id, icon: et.icon, title: ev.name, dist, searchText: [ev.name, et.label].filter(Boolean).join(" "),
      metaNear: `${et.label} · ${formatShortDate(ev.date) || ev.date} · ${Math.abs(dist)} day${Math.abs(dist) === 1 ? "" : "s"} ${dist <= 0 ? "before" : "after"}`,
      metaFar: `${et.label} · ${formatShortDate(ev.date) || ev.date}` };
  };
  const tripRows = events.filter(ev => ev.id !== eventLinkId).map(tripRow).sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist));
  const tripGroups = [
    { label: "Near this expense", rows: tripRows.filter(r => Math.abs(r.dist) <= 30).map(r => ({ ...r, meta: r.metaNear })) },
    { label: "Other", rows: tripRows.filter(r => Math.abs(r.dist) > 30).map(r => ({ ...r, meta: r.metaFar })) },
  ].filter(g => g.rows.length);
  const linkedTrip = eventLinkId ? events.find(e => e.id === eventLinkId) : null;

  // Vehicle — existing Vehicle records from the (now-live) Vehicle experience. Archived
  // vehicles are excluded, matching the rest of the app's active-vehicle lists.
  const activeVehicles = vehicles.filter(v => !v.archived);
  const vehicleRow = v => ({
    id: v.id, icon: VEHICLE_ICON[v.type] || "🚗", title: v.name || v.number,
    meta: `${VEHICLE_TYPE_LABEL[v.type] || "Car"} · ${v.number}`,
    searchText: [v.name, v.number].filter(Boolean).join(" "),
  });
  const vehicleGroupsList = () => {
    const withRecency = activeVehicles.filter(v => v.id !== vehicleId).map(v => ({ v, recent: lastLinkedDate(v.id, "vehicleId") }));
    const sorted = withRecency.sort((a, b) => {
      if (a.recent && b.recent) return a.recent > b.recent ? -1 : 1;
      if (a.recent) return -1;
      if (b.recent) return 1;
      return (a.v.name || a.v.number).localeCompare(b.v.name || b.v.number);
    }).map(x => x.v);
    return sorted.length ? [{ label: "", rows: sorted.map(vehicleRow) }] : [];
  };
  const linkedVehicle = vehicleId ? vehicles.find(v => v.id === vehicleId) : null;

  const TYPE_ROWS = [
    { key: "bill", icon: "📎", label: "Bill", show: !billerLinkId },
    { key: "membership", icon: "👥", label: "Membership", show: !billerLinkId },
    { key: "school", icon: "🏫", label: "School fees", show: !billerLinkId },
    { key: "trip", icon: "✈️", label: "Trip or outing", show: !eventLinkId },
    { key: "vehicle", icon: "🚗", label: "Vehicle", show: showVehicle && !vehicleId },
  ].filter(r => r.show);

  // Closing the sheet vs. going back to the type list: per the spec, hardware back / Esc /
  // backdrop-tap inside a picker behave exactly like the Back button (return to types), and
  // only close the whole sheet from the type list itself.
  const effectiveClose = stage === "types" ? onClose : () => setStage("types");

  const membershipCoveragePanel = selectedId => {
    const ba = membershipBillers.find(b => b.id === selectedId) || (linkedIsMembership && linkedBiller?.id === selectedId ? linkedBiller : null);
    if (!ba || !selectedId) return null;
    return (
      <div style={{ marginTop: 14, background: T.input, border: `1px solid ${T.border}`, borderRadius: RADIUS.lg, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ color: T.sub, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>What this payment covers</div>
        <div style={{ color: T.sub, fontSize: 11 }}>For <span style={{ color: T.text, fontWeight: 800 }}>{linkMemberPersonId === "self" ? "Me" : (getPerson(linkMemberPersonId)?.name || ba.name)}</span> — {ba.name}</div>
        <Segmented options={["monthly", "quarterly", "halfyearly", "annual"]} value={linkCycle} onChange={setLinkCycle} T={T} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div><span style={lbl}>Valid From</span><input style={inp} type="date" value={linkValidFrom} onChange={e => setLinkValidFrom(e.target.value)} /></div>
          <div><span style={lbl}>No. of cycles</span><input style={inp} type="number" min="1" value={linkBulkMonths} onChange={e => setLinkBulkMonths(e.target.value)} /></div>
          <div><span style={lbl}>Grace days</span><input style={inp} type="number" min="0" value={linkGraceDays} onChange={e => setLinkGraceDays(e.target.value)} /></div>
        </div>
        {linkValidUntil && (
          <div style={{ background: T.success + "16", borderRadius: 10, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: T.sub, fontSize: 11 }}>Plan Ends</span><span style={{ color: T.success, fontSize: 12, fontWeight: 800 }}>{formatShortDate(linkValidUntil) || linkValidUntil}</span></div>
          </div>
        )}
      </div>
    );
  };

  let body;
  if (stage === "types") {
    body = (
      <>
        <div style={{ color: T.text, fontSize: 16, fontWeight: 800, fontFamily: FONT.sans, marginBottom: 14 }}>Link to…</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {TYPE_ROWS.map(r => (
            <div key={r.key} onClick={() => setStage(r.key)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: TOUCH.min, borderBottom: `1px solid ${T.border}`, cursor: "pointer", color: T.text, fontSize: 14, fontWeight: 700, fontFamily: FONT.sans }}>
              <span style={{ fontSize: 16 }}>{r.icon}</span><span>{r.label}</span>
            </div>
          ))}
          {TYPE_ROWS.length === 0 && <div style={{ color: T.sub, fontSize: 12, textAlign: "center", padding: "20px 0" }}>Nothing left to link — remove an existing link first.</div>}
        </div>
      </>
    );
  } else if (stage === "bill") {
    body = (
      <LinkPicker T={T} title="Bill" searchPlaceholder="Search bills"
        linkedRow={!linkedIsMembership && !linkedIsSchool && linkedBiller ? { ...billerRow(linkedBiller), meta: `${linkedBiller.type}${attributionLabel(linkedBiller) ? " · " + attributionLabel(linkedBiller) : ""}` } : null}
        groups={buildBillerGroups(billBillers, { meta: ba => [ba.type, ba.consumerNo ? `···${String(ba.consumerNo).slice(-4)}` : null, attributionLabel(ba)].filter(Boolean).join(" · ") })}
        itemNoun="bill" itemNounPlural="bills"
        emptyTitle="No bills yet" emptySubtitle="Add the provider once, such as your broadband or electricity account, and link future payments to it."
        onBack={effectiveClose}
        onCommit={id => onCommitBiller(billerAccounts.find(b => b.id === id))}
        onNewType={() => onNewBillerType("")}
      />
    );
  } else if (stage === "membership") {
    body = (
      <LinkPicker T={T} title="Membership" searchPlaceholder="Search memberships"
        linkedRow={linkedIsMembership ? { ...billerRow(linkedBiller), meta: linkedBiller.type } : null}
        groups={buildBillerGroups(membershipBillers, { meta: ba => [ba.type, attributionLabel(ba)].filter(Boolean).join(" · ") })}
        itemNoun="membership" itemNounPlural="memberships"
        emptyTitle="No memberships yet" emptySubtitle="Add a gym, club or subscription once, and link future payments to it."
        onBack={effectiveClose}
        onCommit={id => onCommitBiller(billerAccounts.find(b => b.id === id))}
        onNewType={() => onNewBillerType("")}
        extraContent={membershipCoveragePanel}
      />
    );
  } else if (stage === "school") {
    body = (
      <LinkPicker T={T} title="School fees" searchPlaceholder="Search schools"
        linkedRow={linkedIsSchool ? { ...billerRow(linkedBiller), meta: [linkedBiller.type, attributionLabel(linkedBiller)].filter(Boolean).join(" · ") } : null}
        groups={buildBillerSingleList(schoolBillers, { meta: ba => [ba.type, attributionLabel(ba), ba.consumerNo ? `···${String(ba.consumerNo).slice(-4)}` : null].filter(Boolean).join(" · ") })}
        itemNoun="school" itemNounPlural="schools"
        emptyTitle="No schools yet" emptySubtitle="Add the school once, and link fee payments to it."
        onBack={effectiveClose}
        onCommit={id => onCommitBiller(billerAccounts.find(b => b.id === id))}
        onNewType={() => onNewBillerType("School Fees")}
        extraContent={() => <div style={{ marginTop: 10, padding: "0 4px", color: T.sub, fontSize: 13, lineHeight: 1.5 }}>Which term or period this pays is assigned in School Fees.</div>}
      />
    );
  } else if (stage === "trip") {
    body = (
      <LinkPicker T={T} title="Trip or outing" searchPlaceholder="Search trips and outings"
        linkedRow={linkedTrip ? { ...tripRow(linkedTrip), meta: tripRow(linkedTrip).metaFar } : null}
        groups={tripGroups}
        itemNoun="trip or outing" itemNounPlural="trips or outings"
        emptyTitle="No trips or outings yet" emptySubtitle="Add one, and link expenses to it."
        onBack={effectiveClose}
        onCommit={id => onCommitTrip(id)}
        onNewType={() => onNewTrip()}
      />
    );
  } else if (stage === "vehicle") {
    body = (
      <>
        <LinkPicker T={T} title="Vehicle" searchPlaceholder="Search vehicles"
          linkedRow={linkedVehicle ? vehicleRow(linkedVehicle) : null}
          groups={vehicleGroupsList()}
          itemNoun="vehicle" itemNounPlural="vehicles"
          emptyTitle="No vehicles yet" emptySubtitle="Add a car or bike, and link expenses to it."
          onBack={effectiveClose}
          onCommit={id => onCommitVehicle(id)}
          onNewType={() => setShowNewVehicle(true)}
        />
        {showNewVehicle && (
          <AddVehicleModal
            vehicles={vehicles}
            setVehicles={setVehicles}
            onClose={() => setShowNewVehicle(false)}
            onCreated={v => { setShowNewVehicle(false); onCommitVehicle(v.id); }}
            T={T}
          />
        )}
      </>
    );
  }

  return (
    <BottomSheet onClose={effectiveClose} T={T} zIndex={340} maxHeight="88vh">
      <div style={{ display: "flex", flexDirection: "column", minHeight: 420 }}>{body}</div>
    </BottomSheet>
  );
}
