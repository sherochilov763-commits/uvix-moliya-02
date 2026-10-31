// SectionTabs.jsx — bo'lim ichidagi tablar (Kassalar tablari uslubida). Menyu A varianti: Xodimlar · Davomat.
import { THEME } from "../theme.js";

// tabs: [[key, label, Icon], ...]; value — tanlangan key
export function SectionTabs({ value, onChange, tabs }) {
  return (
    <div role="tablist" className="uvix-noscrollbar" data-testid="section-tabs" style={{ display: "flex", gap: 22, borderBottom: `1px solid ${THEME.border}`, overflowX: "auto", overflowY: "hidden" }}>
      {tabs.map(([v, l, I]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v} data-tab={v} onClick={() => value !== v && onChange(v)}
          style={{ border: 0, background: "none", padding: "10px 2px", marginBottom: -1, borderBottom: `2.5px solid ${value === v ? THEME.text : "transparent"}`, color: value === v ? THEME.text : THEME.muted, fontWeight: value === v ? 700 : 600, whiteSpace: "nowrap", fontSize: 14.5, fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>{I && <I size={15} />}{l}</button>
      ))}
    </div>
  );
}
