import React from "react";
import BottomSheet from "./BottomSheet";
import { TOUCH, FONT } from "../constants/theme";

// T3.1 Part B — B1: "Link to…" type sheet. Interim adapter only — Bill, Membership and School
// fees all route to the SAME existing unfiltered biller picker (no type filtering here, that's
// B2); Trip routes to the existing trip picker; Vehicle just closes the sheet, since the inline
// vehicle chip row in AddModal already owns that selection UI. Domain ownership and saved
// fields (billerLinkId, eventId, vehicleId) are untouched by this component — it only decides
// which existing picker to open.
//
// Module-level, its own file — AddModal (and AppContent, which contains it) are themselves
// defined as nested consts inside App.jsx, so a sheet component defined the same way would
// remount (and lose state) on every parent re-render.
export default function LinkToSheet({
  T,
  onClose,
  billerLinkId,
  eventLinkId,
  showVehicle,
  onSelectBiller,
  onSelectTrip,
  onSelectVehicle,
}) {
  const rowStyle = {
    display: "flex", alignItems: "center", gap: 10, width: "100%",
    minHeight: TOUCH.min, background: "none", border: "none",
    borderBottom: `1px solid ${T.border}`, padding: "0 4px", cursor: "pointer",
    textAlign: "left", fontFamily: FONT.sans, color: T.text, fontSize: 14, fontWeight: 700,
  };

  const rows = [
    { key: "bill", icon: "📎", label: "Bill", show: !billerLinkId, onSelect: onSelectBiller },
    { key: "membership", icon: "👥", label: "Membership", show: !billerLinkId, onSelect: onSelectBiller },
    { key: "school", icon: "🏫", label: "School fees", show: !billerLinkId, onSelect: onSelectBiller },
    { key: "trip", icon: "✈️", label: "Trip or outing", show: !eventLinkId, onSelect: onSelectTrip },
    { key: "vehicle", icon: "🚗", label: "Vehicle", show: showVehicle, onSelect: onSelectVehicle },
  ].filter(r => r.show);

  return (
    <BottomSheet onClose={onClose} T={T} zIndex={340}>
      <div style={{ color: T.text, fontSize: 16, fontWeight: 800, fontFamily: FONT.sans, marginBottom: 14 }}>Link to…</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {rows.map(r => (
          <button key={r.key} onClick={() => { r.onSelect(); onClose(); }} style={rowStyle}>
            <span style={{ fontSize: 16 }}>{r.icon}</span>
            <span>{r.label}</span>
          </button>
        ))}
        {rows.length === 0 && (
          <div style={{ color: T.sub, fontSize: 12, textAlign: "center", padding: "20px 0" }}>Nothing left to link — remove an existing link first.</div>
        )}
      </div>
    </BottomSheet>
  );
}
