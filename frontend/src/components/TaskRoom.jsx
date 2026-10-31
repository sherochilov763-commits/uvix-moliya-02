// TaskRoom.jsx — vazifa va muhokama bitta panelda (129/130-eskiz, Bitrix24 «Vazifa» paneli kabi).
// Pastdan tepaga suzib chiqadigan katta panel: chapda vazifa kartalari (+ pastda «Boshlash/Tugallandi»), o'ngda vazifa chati.
// Telefonda: o'sha panel butun eni bo'ylab — tepada qisqa vazifa (bosilsa ochiladi), ostida chat.
// tasks: [{ kind, no, status, title, customer, notes, by, assignee, watchers: [ism], deadline, promise, onEdit }]
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, ChevronDown, ChevronUp, Eye, FileImage, MessagesSquare, Pencil, Printer, X } from "lucide-react";
import { TeamChat } from "./TeamChat.jsx";
import { avatarOf } from "../lib/leadPriority.js";
import { SC, THEME } from "../theme.js";
import { C } from "../views/crm/chatPalette.js";
import { useBackToClose } from "../lib/history.js";

const STATUS = { new: ["Yangi", "blue"], in_progress: ["Jarayonda", "amber"], done: ["Tugallandi", "green"], unassigned: ["Ijrochi yo'q", "red"], queued: ["Navbatda", "slate"] };
const KIND = { design: ["Dizayn", FileImage], print: ["Pechat", Printer] };
const ddmm = (ymd) => (ymd ? ymd.split("-").reverse().slice(0, 2).join(".") : "");
const overdue = (t) => t.deadline && t.status !== "done" && t.deadline < new Date().toISOString().slice(0, 10);

// Lid/buyurtmadagi dizayn/pechat vazifalarini panel ko'rinishiga keltirish
export function roomTasks(src, employees = [], { customer = "", title = "", promise = null } = {}) {
  const name = (id) => employees.find((e) => e.id === id)?.name || "";
  return ["design", "print"].map((kind) => {
    const t = src?.[kind];
    if (!t || (!t.assigneeId && !t.status)) return null;
    return {
      kind, customer, title, notes: t.notes || "",
      status: t.status || (t.assigneeId ? "queued" : "unassigned"),
      by: t.assignedBy || "", assignee: name(t.assigneeId),
      watchers: (Array.isArray(t.watchers) ? t.watchers : []).map(name).filter(Boolean),
      deadline: t.deadline || null, promise,
    };
  }).filter(Boolean);
}

function Av({ name, size = 24 }) {
  const a = avatarOf(name || "?");
  return <span title={name} style={{ width: size, height: size, borderRadius: "50%", background: a.color, color: "#fff", fontSize: Math.round(size * 0.37), fontWeight: 800, display: "inline-grid", placeItems: "center", flexShrink: 0 }}>{a.text}</span>;
}
function Pill({ status }) {
  const [l, k] = STATUS[status] || [status || "—", "blue"];
  const c = SC[k] || THEME.blue;
  return <span style={{ height: 24, padding: "0 10px", borderRadius: 12, background: `${c}1F`, color: c, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" }}>{l}</span>;
}
const card = () => ({ background: THEME.card, borderRadius: 12, padding: "16px 18px", border: `1px solid ${THEME.borderSoft}` });
const person = (n, bold) => <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: bold ? 600 : 500 }}><Av name={n} size={24} />{n}</span>;

// Bitta vazifa: 1-karta — nima qilish kerak (+ «Tahrirlash»), 2-karta — odamlar, muddat, holat
export function TaskCards({ t, phone }) {
  const [K, Icon] = KIND[t.kind] || ["Vazifa", FileImage];
  const late = overdue(t);
  const lbl = { color: THEME.muted, fontSize: 13 };
  return (
    <div data-room-task={t.kind} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={card()}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: THEME.muted, marginBottom: 6 }}><Icon size={14} />{K}{t.no ? ` · ${t.no}` : ""}</div>
        {!phone && <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>{t.customer}{t.title ? <span style={{ fontWeight: 500, color: THEME.muted }}> — {t.title}</span> : null}</div>}
        <div style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", color: t.notes ? THEME.text : THEME.dim }}>{t.notes || "Izoh yozilmagan"}</div>
        {t.onEdit && <button type="button" data-testid={`room-edit-${t.kind}`} onClick={t.onEdit} style={{ marginTop: 12, border: 0, background: "none", padding: 0, color: THEME.blue, fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><Pencil size={14} />Tahrirlash</button>}
      </div>
      <div style={{ ...card(), display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 20, rowGap: 14, alignItems: "center", fontSize: 13.5 }}>
        {t.by && <><span style={lbl}>Topshiriq beruvchi</span>{person(t.by)}</>}
        <span style={lbl}>Ijrochi</span>
        <span data-testid="room-assignee">{t.assignee ? person(t.assignee, true) : <span style={{ color: THEME.rose, fontWeight: 600 }}>tayinlanmagan</span>}</span>
        {t.watchers?.length > 0 && <><span style={lbl}>Kuzatuvchilar</span><span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>{t.watchers.map((w) => <span key={w} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Av name={w} size={22} />{w.split(" ")[0]}</span>)}</span></>}
        <span style={lbl}>Muddat</span>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: late ? THEME.rose : t.deadline ? THEME.text : THEME.muted, fontWeight: t.deadline ? 600 : 500 }}><CalendarClock size={15} style={{ color: late ? THEME.rose : THEME.blue }} />{t.deadline ? ddmm(t.deadline) : "belgilanmagan"}</span>
          {late && <span style={{ fontSize: 11.5, color: THEME.rose, border: `1px solid ${THEME.rose}55`, borderRadius: 10, padding: "1px 8px" }}>kechikdi</span>}
          {t.promise && <span style={{ fontSize: 12, color: THEME.muted }}>mijozga va'da: {ddmm(t.promise)}</span>}
        </span>
        <span style={lbl}>Holat</span>
        <span><Pill status={t.status} /></span>
      </div>
    </div>
  );
}

export function FilesCard({ files }) {
  if (!files.length) return null;
  return (
    <div style={{ ...card(), display: "flex", flexDirection: "column", gap: 8 }} data-testid="room-files">
      <div style={{ fontSize: 12, fontWeight: 700, color: THEME.muted, letterSpacing: 0.4 }}>FAYLLAR · {files.length}</div>
      {files.map((m) => (
        <a key={m.id} href={m.file.image ? m.file.url : `${m.file.url}?dl=1&name=${encodeURIComponent(m.file.name)}`} target={m.file.image ? "_blank" : undefined} rel="noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 10, color: THEME.text, textDecoration: "none", fontSize: 13 }}>
          {m.file.image
            ? <img src={m.file.url} alt="" style={{ width: 34, height: 34, borderRadius: 7, objectFit: "cover", flexShrink: 0 }} />
            : <span style={{ width: 34, height: 34, borderRadius: 7, background: THEME.blue, color: "#fff", fontSize: 9.5, fontWeight: 800, display: "grid", placeItems: "center", flexShrink: 0 }}>{(String(m.file.name).split(".").pop() || "").slice(0, 4).toUpperCase()}</span>}
          <span style={{ minWidth: 0 }}><b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.file.name}</b><span style={{ color: THEME.muted, fontSize: 12 }}>{String(m.author || "").split(" ")[0]} · {new Date(m.at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span></span>
        </a>
      ))}
    </div>
  );
}

// actions — pastki qatordagi tugmalar (xodim: «Boshlash» / «Tugallandi»); extra — vazifa yo'q bo'lsa
export function TaskRoom({ thread, me, tasks = [], title = "", phone = false, onClose, actions = null, extra = null }) {
  const [shown, setShown] = useState(false);
  const [files, setFiles] = useState([]);
  const [people, setPeople] = useState(0);
  const [open, setOpen] = useState(false);
  // Pastdan suzib chiqish / yopilganda pastga tushish
  useEffect(() => { const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true))); return () => cancelAnimationFrame(r); }, []);
  const close = useCallback(() => { setShown(false); setTimeout(onClose, 240); }, [onClose]);
  useBackToClose(true, close);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [close]);
  const onData = (d) => { setFiles((d.messages || []).filter((m) => m.file).slice().reverse()); setPeople((d.participants || []).length); };
  const main = tasks[0];
  const watchN = main?.watchers?.length || 0;

  const scrim = { position: "fixed", inset: 0, zIndex: 400, background: `rgba(0,0,0,${shown ? (THEME.isDark ? 0.55 : 0.32) : 0})`, transition: "background .25s ease" };
  const panel = {
    position: "fixed", zIndex: 401, display: "flex", overflow: "hidden", color: THEME.text, fontFamily: THEME.font,
    background: THEME.surface, boxShadow: "0 -12px 48px rgba(0,0,0,.22)",
    transform: shown ? "translateY(0)" : "translateY(100%)", transition: "transform .32s cubic-bezier(.2,.8,.2,1)",
    ...(phone
      ? { left: 0, right: 0, bottom: 0, top: "calc(10px + env(safe-area-inset-top, 0px))", borderRadius: "16px 16px 0 0", flexDirection: "column" }
      : { left: 64, right: 16, bottom: 0, top: 24, borderRadius: "14px 14px 0 0" }),
  };
  const chatHead = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: phone ? "12px 14px" : "12px 18px", background: THEME.card, borderBottom: `1px solid ${THEME.border}`, flexShrink: 0 }}>
      <span style={{ width: 34, height: 34, borderRadius: "50%", background: `${THEME.blue}18`, color: THEME.blue, display: "grid", placeItems: "center", flexShrink: 0 }}><MessagesSquare size={17} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{phone ? title || "Vazifa chati" : "Vazifa chati"}</div>
        <div style={{ fontSize: 12, color: THEME.muted }}>{people ? `${people} ishtirokchi · ` : ""}mijoz ko'rmaydi</div>
      </div>
      {phone && <button type="button" onClick={close} aria-label="Yopish" data-testid="task-room-close" style={{ width: 34, height: 34, border: 0, borderRadius: 9, background: THEME.chip, color: THEME.muted, cursor: "pointer", display: "grid", placeItems: "center" }}><X size={18} /></button>}
    </div>
  );

  if (phone) {
    const top = main && (
      <div data-testid="room-summary" style={{ background: THEME.card, borderBottom: `1px solid ${THEME.border}`, padding: "10px 14px", flexShrink: 0 }}>
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, border: 0, background: "none", padding: 0, color: THEME.text, fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}>
          {!open && <Pill status={main.status} />}
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: THEME.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {open ? "Vazifa" : `${main.assignee || "—"}${main.deadline ? ` · ${ddmm(main.deadline)}` : ""}`}
          </span>
          <span style={{ fontSize: 12.5, color: THEME.blue, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 2 }}>{open ? "Yopish" : "Ochish"}{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
        </button>
        {open && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "56vh", overflowY: "auto", background: THEME.surface, margin: "10px -14px -10px", padding: 12 }}>
            {tasks.map((t) => <TaskCards key={t.kind} t={t} phone />)}
            <FilesCard files={files} />
          </div>
        )}
        {actions && <div style={{ display: "flex", gap: 8, marginTop: open ? 20 : 10 }}>{actions}</div>}
      </div>
    );
    return (
      <>
        <div style={scrim} onClick={close} />
        <div data-testid="task-room" role="dialog" aria-modal="true" aria-label="Vazifa va chat" style={panel}>
          {chatHead}
          {!main && extra && <div style={{ padding: 12, background: THEME.card, borderBottom: `1px solid ${THEME.border}` }}>{extra}</div>}
          <TeamChat bare thread={thread} me={me} onData={onData} top={top} />
        </div>
      </>
    );
  }

  return (
    <>
      <div style={scrim} onClick={close} />
      <button type="button" onClick={close} aria-label="Yopish" data-testid="task-room-close"
        style={{ position: "fixed", zIndex: 402, left: 14, top: 34, width: 38, height: 38, borderRadius: "50%", border: 0, background: THEME.blue, color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", boxShadow: "0 4px 14px rgba(0,0,0,.25)", opacity: shown ? 1 : 0, transition: "opacity .2s" }}><X size={19} /></button>
      <div data-testid="task-room" role="dialog" aria-modal="true" aria-label="Vazifa va chat" style={panel}>
        <div style={{ width: "min(460px, 38%)", flexShrink: 0, display: "flex", flexDirection: "column", borderRight: `1px solid ${THEME.border}` }}>
          <div style={{ padding: "16px 20px 10px", fontSize: 19, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
          <div className="uvix-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {tasks.map((t, i) => <div key={t.kind} style={i ? { marginTop: 8 } : undefined}><TaskCards t={t} /></div>)}
            {tasks.length === 0 && <div style={{ ...card(), fontSize: 13.5, color: THEME.muted, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>Hali vazifa berilmagan — chatda muhokama boshlash mumkin.{extra}</div>}
            <FilesCard files={files} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", minHeight: 62, boxSizing: "border-box", background: THEME.card, borderTop: `1px solid ${THEME.border}` }}>
            {actions}
            <span style={{ flex: 1 }} />
            {watchN > 0 && <span title="Kuzatuvchilar" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: THEME.muted }}><Eye size={15} />{watchN}</span>}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: C.bg }}>
          {chatHead}
          <TeamChat bare thread={thread} me={me} onData={onData} />
        </div>
      </div>
    </>
  );
}
