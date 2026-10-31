// TaskAssignModal.jsx — lidni Dizayn yoki Pechat bosqichiga o'tkazishda mas'ul va vazifa ma'lumotlarini kiritish
import { useMemo, useState } from "react";
import { Check, ChevronDown, FileImage, MessageCircle, Plus, Printer, Search, X } from "lucide-react";
import { avatarOf } from "../../lib/leadPriority.js";
import { roleLabel } from "../../constants.js";
import { Button, Field, Modal, getInputStyle } from "../../components/ui.jsx";
import { SC, THEME } from "../../theme.js";

const FILE_TYPES = ["CDR", "AI", "PSD", "PDF", "TIFF"];
const QUALITIES = ["720 dpi", "1080 dpi", "1440 dpi"];
const COLOR_PROFILES = ["CMYK", "CMYK + oq", "RGB"];
const MATERIALS = ["Shisha", "Oniks", "Akril", "Banner", "Plyonka", "Kompozit"];

export function TaskAssignModal({ lead, kind, employees, onSave, onCancel, attachment, me = null }) {
  const isDesign = kind === "design";
  const role = isDesign ? "designer" : "printer";
  const people = (employees || []).filter((e) => e.role === role);
  const printers = (employees || []).filter((e) => e.role === "printer");
  const existing = lead[kind] || {};

  const [f, setF] = useState({
    jobTitle: lead.jobTitle || "",
    assigneeId: existing.assigneeId || (people.length === 1 ? people[0].id : ""),
    deadline: existing.deadline || "",
    notes: existing.notes || "",
    format: existing.format || "",
    fileType: existing.fileType || "CDR",
    quality: existing.quality || "1440 dpi",
    colorProfile: existing.colorProfile || "CMYK",
    material: existing.material || "",
    area: existing.area || "",
    preassignPrinter: lead.print?.assigneeId || "",
    watchers: Array.isArray(existing.watchers) ? existing.watchers : [],
  });
  const [error, setError] = useState("");
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const input = { ...getInputStyle(), boxSizing: "border-box" };

  function submit() {
    if (isDesign) return submitDesign();
    if (!f.jobTitle.trim()) return setError("Ish nomini kiriting, masalan \"Fasad lavhasi\"");
    if (!f.assigneeId) return setError(isDesign ? "Dizaynerni tanlang" : "Pechatchini tanlang");
    const fields = isDesign
      ? { format: f.format.trim(), fileType: f.fileType.trim() }
      : { quality: f.quality.trim(), colorProfile: f.colorProfile.trim(), material: f.material.trim(), area: f.area ? Number(String(f.area).replace(",", ".")) || "" : "" };
    // Chatdan biriktirilgan mijoz rasmi — avvalgilariga qo'shiladi
    const refs = attachment ? [...(existing.refs || []).filter((r) => r.url !== attachment.url), attachment].slice(-10) : existing.refs;
    onSave({
      jobTitle: f.jobTitle.trim(),
      task: { assigneeId: f.assigneeId, deadline: f.deadline || null, notes: f.notes.trim(), ...fields, ...(refs ? { refs } : {}) },
      preassignPrinter: isDesign ? f.preassignPrinter || null : null,
    });
  }

  // 127/128-eskiz: dizayn vazifasi — Bitrix24 kabi: nima · beruvchi · ijrochi · muddat; format va fayl — «Muhokama» chatida
  function submitDesign() {
    if (!f.assigneeId) return setError("Ijrochini tanlang");
    const notes = f.notes.trim();
    const jobTitle = (lead.jobTitle || "").trim() || notes.split("\n")[0].slice(0, 60) || "Maket";
    const refs = attachment ? [...(existing.refs || []).filter((r) => r.url !== attachment.url), attachment].slice(-10) : existing.refs;
    onSave({
      jobTitle,
      task: { assigneeId: f.assigneeId, deadline: f.deadline || null, notes, watchers: f.watchers.filter((w) => w && w !== f.assigneeId), assignedBy: me?.name || existing.assignedBy || "", format: existing.format || "", fileType: existing.fileType || "CDR", ...(refs ? { refs } : {}) },
      preassignPrinter: f.preassignPrinter || null,
    });
  }
  if (isDesign) return <DesignForm {...{ lead, f, setF, error, onCancel, submit, attachment, employees, printers, me }} />;

  const Icon = isDesign ? FileImage : Printer;
  return (
    <Modal title={isDesign ? "Dizayn vazifasi" : "Pechat vazifasi"} onClose={onCancel}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: THEME.chip, fontSize: 13.5 }}>
          <Icon size={18} color={isDesign ? THEME.blue : THEME.cyan} />
          <span><b>{lead.customer}</b> — {isDesign ? "maket tayyorlash" : "bosma ish"}</span>
        </div>
        {attachment && (
          <div data-testid="task-attachment" style={{ display: "flex", alignItems: "center", gap: 12, padding: 8, border: `1px solid ${THEME.border}`, borderRadius: 10 }}>
            {attachment.kind === "document"
              ? <div style={{ width: 72, height: 54, borderRadius: 8, background: THEME.chip, display: "grid", placeItems: "center", color: THEME.muted, fontSize: 11 }}>Fayl</div>
              : <img src={attachment.url} alt="" style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 8, background: THEME.chip }} />}
            <div style={{ fontSize: 12.5, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>Mijoz chatidan biriktiriladi</div>
              <div style={{ color: THEME.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attachment.name || "Rasm"} · dizayner o'z ilovasida ko'radi</div>
            </div>
          </div>
        )}

        {people.length === 0 ? (
          <div style={{ padding: "12px 14px", borderRadius: 12, background: THEME.amberBg, color: THEME.text, fontSize: 13.5, lineHeight: 1.5 }}>
            Hali birorta {isDesign ? "dizayner" : "pechatchi"} yo'q. Avval <b>Xodimlar</b> bo'limida "{isDesign ? "Dizayner" : "Pechatchi"}" rolidagi xodim qo'shing.
          </div>
        ) : (
          <Field label={isDesign ? "Mas'ul dizayner" : "Mas'ul pechatchi"}>
            <select value={f.assigneeId} onChange={set("assigneeId")} style={input}>
              <option value="">— tanlang —</option>
              {people.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
        )}

        <Field label="Ish nomi">
          <input value={f.jobTitle} onChange={set("jobTitle")} style={input} placeholder="Masalan: Fasad lavhasi" />
        </Field>

        {isDesign ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Format / o'lcham">
              <input value={f.format} onChange={set("format")} style={input} placeholder="3×1.2 m" />
            </Field>
            <Field label="Fayl turi">
              <input value={f.fileType} onChange={set("fileType")} style={input} list="uvix-filetypes" />
              <datalist id="uvix-filetypes">{FILE_TYPES.map((x) => <option key={x} value={x} />)}</datalist>
            </Field>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Sifat">
                <input value={f.quality} onChange={set("quality")} style={input} list="uvix-qualities" />
                <datalist id="uvix-qualities">{QUALITIES.map((x) => <option key={x} value={x} />)}</datalist>
              </Field>
              <Field label="Rang profili">
                <input value={f.colorProfile} onChange={set("colorProfile")} style={input} list="uvix-profiles" />
                <datalist id="uvix-profiles">{COLOR_PROFILES.map((x) => <option key={x} value={x} />)}</datalist>
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Material">
                <input value={f.material} onChange={set("material")} style={input} list="uvix-materials" placeholder="Shisha" />
                <datalist id="uvix-materials">{MATERIALS.map((x) => <option key={x} value={x} />)}</datalist>
              </Field>
              <Field label="Hajmi (kv/m)">
                <input value={f.area} onChange={set("area")} style={input} inputMode="decimal" placeholder="3.6" />
              </Field>
            </div>
          </>
        )}

        <Field label="Muddat">
          <input type="date" value={f.deadline} onChange={set("deadline")} style={input} />
        </Field>
        <Field label="Izoh (ixtiyoriy)">
          <textarea value={f.notes} onChange={set("notes")} rows={2} style={{ ...input, resize: "vertical" }} placeholder={isDesign ? "Mijoz istaklari, ranglar, logotip..." : "Qirqish, laminatsiya, o'rnatish..."} />
        </Field>

        {isDesign && printers.length > 0 && (
          <Field label="Pechatchi (ixtiyoriy, oldindan)">
            <select value={f.preassignPrinter} onChange={set("preassignPrinter")} style={input}>
              <option value="">— dizayn tugagach tanlayman —</option>
              {printers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <div style={{ fontSize: 11.5, color: THEME.muted, marginTop: 6 }}>Tanlasangiz, maket tayyor bo'lganda ish avtomatik shu pechatchiga tushadi.</div>
          </Field>
        )}

        {error && <div role="alert" style={{ fontSize: 13, color: THEME.rose }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Button variant="ghost" onClick={onCancel}>Bekor qilish</Button>
          <Button onClick={submit} disabled={people.length === 0}>Tayinlash</Button>
        </div>
      </div>
    </Modal>
  );
}

// CRM kartochkalarida vazifa holatini ko'rsatish
const STATUS = { get new() { return ["Yangi", SC.blue]; }, get in_progress() { return ["Jarayonda", SC.amber]; }, get done() { return ["Tugallandi", SC.green]; }, get unassigned() { return ["Tayinlanmagan", SC.red]; } };

export function TaskChips({ lead, employees, onOpen, compact }) {
  const rows = [];
  for (const kind of ["design", "print"]) {
    const t = lead[kind];
    if (!t) continue;
    if (!t.status && kind === "print") {
      if (t.assigneeId) rows.push({ kind, name: nameOf(employees, t.assigneeId), st: ["Navbatda", THEME.muted] });
      continue;
    }
    rows.push({ kind, name: t.assigneeId ? nameOf(employees, t.assigneeId) : null, st: STATUS[t.status] || [t.status, THEME.muted] });
  }
  if (rows.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {rows.map((r) => {
        const Icon = r.kind === "design" ? FileImage : Printer;
        const unassigned = !r.name;
        return (
          <button key={r.kind} type="button" onClick={(e) => { e.stopPropagation(); onOpen?.(r.kind); }}
            style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: compact ? "5px 8px" : "7px 10px", borderRadius: 9, cursor: onOpen ? "pointer" : "default",
              border: `1px solid ${unassigned ? THEME.roseBorder : THEME.border}`, background: unassigned ? THEME.roseBg : THEME.chip, color: THEME.text, fontSize: 12, textAlign: "left", minHeight: compact ? 30 : 36 }}>
            <Icon size={13} color={r.kind === "design" ? THEME.blue : THEME.cyan} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
              {unassigned ? (r.kind === "print" ? "Pechatchi tayinlang" : "Dizayner tayinlang") : r.name}
            </span>
            <span style={{ fontWeight: 700, color: r.st[1], whiteSpace: "nowrap" }}>{r.st[0]}</span>
          </button>
        );
      })}
    </div>
  );
}
function nameOf(employees, id) {
  return (employees || []).find((e) => e.id === id)?.name || "Noma'lum xodim";
}

// ---- Dizayn vazifasi oynasi (127/128-eskiz) ----
const ROLE_ORDER = { designer: 0, printer: 1, installer: 2, operator: 3, manager: 4, admin: 5 };
function Av({ name, size = 24 }) {
  const a = avatarOf(name || "?");
  return <span style={{ width: size, height: size, borderRadius: "50%", background: a.color, color: "#fff", fontSize: Math.round(size * 0.37), fontWeight: 800, display: "inline-grid", placeItems: "center", flexShrink: 0 }}>{a.text}</span>;
}
// Xodim tanlash ro'yxati (Bitrix24 kabi): qidiruv, rol bo'yicha tartib; multi — bir nechta
function PeoplePicker({ employees, value, multi = false, onPick, testid }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => [...(employees || [])].sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) || String(a.name).localeCompare(String(b.name))), [employees]);
  const sel = multi ? value : value ? [value] : [];
  const shown = list.filter((e) => !q.trim() || String(e.name).toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div data-testid={testid} style={{ border: `1px solid ${THEME.border}`, borderRadius: 12, background: THEME.card, boxShadow: THEME.shadowMd, padding: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", border: `1px solid ${THEME.blue}`, borderRadius: 9, padding: "5px 8px" }}>
        {sel.map((id) => { const e = list.find((x) => x.id === id); return e ? (
          <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 26, padding: "0 6px 0 3px", borderRadius: 13, background: THEME.blueBg, color: THEME.blue, fontSize: 12.5, fontWeight: 600 }}>
            <Av name={e.name} size={20} />{e.name}
            {multi && <button type="button" aria-label="Olib tashlash" onClick={() => onPick(id)} style={{ border: 0, background: "none", padding: 0, color: "inherit", cursor: "pointer", display: "flex" }}><X size={13} /></button>}
          </span>) : null; })}
        <Search size={14} color={THEME.dim} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="qidirish" style={{ flex: 1, minWidth: 80, border: 0, outline: "none", background: "none", color: THEME.text, fontSize: 13.5, fontFamily: "inherit", padding: "3px 0" }} />
      </div>
      <div className="uvix-scroll" style={{ maxHeight: 220, overflowY: "auto", marginTop: 4 }}>
        {shown.map((e) => { const on = sel.includes(e.id); return (
          <button key={e.id} type="button" data-person={e.id} onClick={() => onPick(e.id)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", border: 0, borderRadius: 8, background: on ? THEME.navActiveBg : "transparent", color: THEME.text, cursor: "pointer", fontFamily: "inherit", fontSize: 14, textAlign: "left" }}>
            <Av name={e.name} size={26} /><span style={{ flex: 1, minWidth: 0 }}>{e.name} <span style={{ color: THEME.dim, fontSize: 12.5 }}>· {roleLabel(e.role)}</span></span>
            {on && <Check size={16} color={THEME.blue} />}
          </button>); })}
        {shown.length === 0 && <div style={{ padding: 10, fontSize: 13, color: THEME.muted }}>Topilmadi</div>}
      </div>
    </div>
  );
}
function DesignForm({ lead, f, setF, error, onCancel, submit, attachment, employees, printers, me }) {
  const [open, setOpen] = useState(f.assigneeId ? null : "who"); // "who" | "watch" | null
  const [showPrinter, setShowPrinter] = useState(!!f.preassignPrinter);
  const staff = (employees || []).filter((e) => !e.archived && !e.deletedAt);
  const byId = (id) => staff.find((e) => e.id === id);
  const who = byId(f.assigneeId);
  const input = { ...getInputStyle(), boxSizing: "border-box" };
  const promise = lead.deadline ? lead.deadline.split("-").reverse().join(".") : "";
  const lbl = { color: THEME.muted, fontSize: 13.5 };
  const chipBtn = (on) => ({ height: 30, padding: "0 11px", borderRadius: 15, border: `1px solid ${on ? THEME.text : THEME.border2}`, background: on ? THEME.text : THEME.card, color: on ? THEME.card : THEME.mutedDark, fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 });
  return (
    <Modal title="Dizayn vazifasi" onClose={onCancel}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-testid="design-task-form">
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: THEME.chip, fontSize: 13.5 }}>
          <FileImage size={18} color={THEME.blue} />
          <span><b>{lead.customer}</b> — maket tayyorlash</span>
        </div>
        {attachment && (
          <div data-testid="task-attachment" style={{ display: "flex", alignItems: "center", gap: 12, padding: 8, border: `1px solid ${THEME.border}`, borderRadius: 10 }}>
            {attachment.kind === "document"
              ? <div style={{ width: 72, height: 54, borderRadius: 8, background: THEME.chip, display: "grid", placeItems: "center", color: THEME.muted, fontSize: 11 }}>Fayl</div>
              : <img src={attachment.url} alt="" style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 8, background: THEME.chip }} />}
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>Mijoz chatidan biriktiriladi</div>
          </div>
        )}
        <Field label="Nima qilish kerak">
          <textarea value={f.notes} onChange={(e) => setF((s) => ({ ...s, notes: e.target.value }))} rows={2} style={{ ...input, resize: "vertical" }} placeholder={lead.jobTitle ? `${lead.jobTitle} — rang, logotip, o'lcham…` : "Masalan: Fasad lavhasi, oq fonda, logotip chapda"} data-testid="task-notes" />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 16, rowGap: 10, alignItems: "center", border: `1px solid ${THEME.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 14 }}>
          <span style={lbl}>Topshiriq beruvchi</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }} data-testid="task-by">{me?.name ? <><Av name={me.name} />{me.name}</> : "—"}</span>
          <span style={lbl}>Ijrochi</span>
          <button type="button" data-testid="task-who" onClick={() => setOpen(open === "who" ? null : "who")} style={{ justifySelf: "start", display: "inline-flex", alignItems: "center", gap: 8, border: 0, background: "none", padding: 0, color: who ? THEME.text : THEME.blue, fontWeight: 600, fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>
            {who ? <><Av name={who.name} />{who.name}</> : "Tanlash"}<ChevronDown size={15} color={THEME.dim} />
          </button>
          <span style={lbl}>Muddat</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <input type="date" value={f.deadline} onChange={(e) => setF((s) => ({ ...s, deadline: e.target.value }))} style={{ ...input, width: "auto", height: 34, padding: "0 10px" }} data-testid="task-deadline" />
            {promise && <span style={{ fontSize: 12, color: THEME.muted }}>mijozga va'da: {promise}</span>}
          </span>
        </div>
        {open === "who" && <PeoplePicker employees={staff} value={f.assigneeId} testid="pick-who" onPick={(id) => { setF((s) => ({ ...s, assigneeId: id, watchers: s.watchers.filter((w) => w !== id) })); setOpen(null); }} />}
        {f.watchers.length > 0 && open !== "watch" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13, color: THEME.muted }} data-testid="task-watchers">
            Kuzatuvchilar: {f.watchers.map((id) => byId(id)).filter(Boolean).map((e) => <span key={e.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: THEME.text }}><Av name={e.name} size={20} />{e.name.split(" ")[0]}</span>)}
          </div>
        )}
        {open === "watch" && <PeoplePicker employees={staff.filter((e) => e.id !== f.assigneeId)} value={f.watchers} multi testid="pick-watch" onPick={(id) => setF((s) => ({ ...s, watchers: s.watchers.includes(id) ? s.watchers.filter((w) => w !== id) : [...s.watchers, id] }))} />}
        {showPrinter && printers.length > 0 && (
          <Field label="Pechatchi (maket tayyor bo'lganda ish unga o'tadi)">
            <select value={f.preassignPrinter} onChange={(e) => setF((s) => ({ ...s, preassignPrinter: e.target.value }))} style={input} data-testid="task-printer">
              <option value="">— dizayn tugagach tanlayman —</option>
              {printers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" data-testid="add-watchers" onClick={() => setOpen(open === "watch" ? null : "watch")} style={chipBtn(open === "watch")}>{open === "watch" ? <Check size={13} /> : <Plus size={13} />}Kuzatuvchilar{f.watchers.length ? ` · ${f.watchers.length}` : ""}</button>
          {printers.length > 0 && !showPrinter && <button type="button" data-testid="add-printer" onClick={() => setShowPrinter(true)} style={chipBtn(false)}><Plus size={13} />Pechatchi</button>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: THEME.muted }}><MessageCircle size={14} />Format, fayl va boshqa gaplar — vazifa berilgach lid panelidagi «Muhokama» chatida</div>
        {error && <div role="alert" style={{ fontSize: 13, color: THEME.rose }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Button variant="ghost" onClick={onCancel}>Bekor qilish</Button>
          <Button onClick={submit} data-testid="task-submit">Tayinlash</Button>
        </div>
      </div>
    </Modal>
  );
}
