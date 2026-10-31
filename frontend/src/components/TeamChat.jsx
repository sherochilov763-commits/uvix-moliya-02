// TeamChat.jsx — jamoa «Muhokama» chati (128-eskiz). Mijoz ko'rmaydi.
// Kompyuterda lid panelida, telefonda xodim ilovasida (to'liq ekran) ishlatiladi.
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, FileText, Paperclip, Send } from "lucide-react";
import { fetchTeamChat, sendTeamChat, sendTeamFile } from "../storage.js";
import { avatarOf } from "../lib/leadPriority.js";
import { C } from "../views/crm/chatPalette.js";
import { THEME } from "../theme.js";

const hm = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const dayOf = (iso) => { const d = new Date(iso); return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`; };
const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const ROLE = { admin: "Rahbar", manager: "Katta menejer", operator: "Operator", designer: "Dizayner", printer: "Pechatchi", installer: "Montajchi" };

function Av({ name, size = 26 }) {
  const a = avatarOf(name || "?");
  return <span title={name} style={{ width: size, height: size, borderRadius: "50%", background: a.color, color: "#fff", fontSize: Math.round(size * 0.36), fontWeight: 800, display: "inline-grid", placeItems: "center", flexShrink: 0 }}>{a.text}</span>;
}

// thread — "l:<leadId>" | "o:<orderId>"; me — joriy xodim; full — telefonda to'liq ekran (onBack bilan)
export function TeamChat({ thread, me, full = false, title = "", onBack, onCount, onData, height, top = null, bare = false }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  const fileRef = useRef(null);
  const lastN = useRef(-1);

  async function load() {
    try {
      const d = await fetchTeamChat(thread);
      setData(d); setErr("");
      onCount?.(d.messages.filter((m) => m.kind === "msg").length);
      onData?.(d);
    } catch (e) { setErr(e.message || "Muhokamani ochib bo'lmadi"); }
  }
  useEffect(() => {
    setData(null); lastN.current = -1;
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 5000);
    return () => clearInterval(t);
  }, [thread]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const n = data?.messages?.length ?? -1;
    if (n !== lastN.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    lastN.current = n;
  }, [data]);

  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try { await sendTeamChat(thread, t); setText(""); await load(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function pickFile(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) return setErr("Fayl 25 MB dan katta");
    setBusy(true);
    try { await sendTeamFile(thread, f, text.trim()); setText(""); await load(); } catch (er) { setErr(er.message); } finally { setBusy(false); }
  }

  const msgs = data?.messages || [];
  const people = data?.participants || [];
  let lastDay = "";
  const body = (
    <div ref={listRef} data-testid="team-chat-list" className="uvix-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: 12 }}>
      {!data && !err && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 20 }}>Yuklanmoqda…</div>}
      {data && msgs.length === 0 && (
        <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "24px 12px", lineHeight: 1.5 }}>Hali xabar yo'q. Format, fayl, rang — shu yerda kelishib oling.<br />Mijoz bu chatni ko'rmaydi.</div>
      )}
      {msgs.map((m) => {
        const day = dayOf(m.at);
        const dayRow = day !== lastDay ? (lastDay = day, <div key={`d${m.id}`} style={{ alignSelf: "center", fontSize: 11.5, color: C.muted, padding: "2px 8px" }}>{day}</div>) : null;
        if (m.kind === "sys") return [dayRow, <div key={m.id} data-team-sys="" style={{ alignSelf: "center", maxWidth: "92%", fontSize: 12, color: C.muted, background: C.dayBg, borderRadius: 10, padding: "4px 10px", textAlign: "center" }}>{m.text} · {hm(m.at)}</div>];
        const out = m.authorId && m.authorId === me?.id;
        const f = m.file;
        return [dayRow,
          <div key={m.id} data-team-msg={out ? "out" : "in"} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexDirection: out ? "row-reverse" : "row" }}>
            {!out && <Av name={m.author} />}
            <div style={{ maxWidth: "80%", background: out ? C.outBubble : C.inBubble, color: C.text, borderRadius: 14, [out ? "borderBottomRightRadius" : "borderBottomLeftRadius"]: 4, padding: "7px 10px", fontSize: 13.5, lineHeight: 1.4, boxShadow: "0 1px 1px rgba(0,0,0,.04)", overflowWrap: "anywhere" }}>
              {!out && <div style={{ fontSize: 12, fontWeight: 700, color: avatarOf(m.author).color }}>{String(m.author || "").split(" ")[0]}</div>}
              {m.text && <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>}
              {f && (f.image
                ? <a href={f.url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: m.text ? 6 : 0 }}><img src={f.url} alt={f.name} style={{ display: "block", maxWidth: 220, maxHeight: 220, borderRadius: 8, objectFit: "cover" }} /></a>
                : <a href={`${f.url}?dl=1&name=${encodeURIComponent(f.name)}`} data-team-file="" style={{ marginTop: m.text ? 6 : 0, display: "flex", alignItems: "center", gap: 8, background: C.overlay, borderRadius: 8, padding: "7px 9px", color: C.text, textDecoration: "none" }}>
                    <span style={{ width: 30, height: 30, borderRadius: 7, background: C.blue, color: "#fff", fontSize: 9.5, fontWeight: 800, display: "grid", placeItems: "center", flexShrink: 0 }}>{(String(f.name).split(".").pop() || "").slice(0, 4).toUpperCase() || <FileText size={14} />}</span>
                    <span style={{ fontSize: 12.5, minWidth: 0 }}><b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</b><span style={{ color: C.muted }}>{kb(f.size || 0)}</span></span>
                  </a>)}
              <div style={{ fontSize: 10.5, color: C.outMuted, textAlign: "right", marginTop: 2 }}>{hm(m.at)}</div>
            </div>
          </div>];
      })}
    </div>
  );
  const input = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: C.panel, borderTop: `1px solid ${C.border}`, paddingBottom: full || bare ? "calc(8px + env(safe-area-inset-bottom, 0px))" : 8 }}>
      <input ref={fileRef} type="file" onChange={pickFile} style={{ display: "none" }} data-testid="team-chat-file" />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} aria-label="Fayl biriktirish" title="Rasm yoki fayl (CDR, PDF…)" style={{ width: 36, height: 36, border: 0, borderRadius: "50%", background: "none", color: C.muted, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}><Paperclip size={19} /></button>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Jamoaga yozing…" data-testid="team-chat-input"
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        style={{ flex: 1, minWidth: 0, resize: "none", border: 0, outline: "none", borderRadius: 18, background: C.bg, color: C.text, padding: "9px 14px", fontSize: 14, fontFamily: "inherit", lineHeight: 1.35, maxHeight: 120 }} />
      <button type="button" onClick={send} disabled={busy || !text.trim()} aria-label="Yuborish" data-testid="team-chat-send"
        style={{ width: 38, height: 38, border: 0, borderRadius: "50%", background: text.trim() ? C.blue : C.overlay2, color: text.trim() ? "#fff" : C.muted, cursor: text.trim() ? "pointer" : "default", display: "grid", placeItems: "center", flexShrink: 0 }}><Send size={17} /></button>
    </div>
  );
  const peopleRow = people.length > 0 && (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", fontSize: 12.5, color: THEME.muted }} data-testid="team-chat-people">
      {people.map((p) => <span key={p.id} title={`${p.name} · ${ROLE[p.role] || ""}`}><Av name={p.name} size={22} /></span>)}
      <span style={{ marginLeft: 4 }}>mijoz ko'rmaydi</span>
    </div>
  );

  // bare — panel ichida ramkasiz (129-A panel: sarlavha va ishtirokchilar tashqarida)
  if (bare) {
    return (
      <div data-testid="team-chat" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, background: C.bg }}>
        {top}
        {err && <div role="alert" style={{ padding: "6px 12px", fontSize: 12.5, color: C.red }}>{err}</div>}
        {body}
        {input}
      </div>
    );
  }
  if (full) {
    return (
      <div data-testid="team-chat" style={{ position: "fixed", inset: 0, zIndex: 300, background: C.bg, display: "flex", flexDirection: "column", fontFamily: THEME.font, color: C.text }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", paddingTop: "calc(10px + env(safe-area-inset-top, 0px))", background: C.panel, borderBottom: `1px solid ${C.border}` }}>
          <button type="button" onClick={onBack} aria-label="Orqaga" style={{ border: 0, background: "none", color: C.blue, padding: 4, cursor: "pointer", display: "flex" }}><ChevronLeft size={24} /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.text }}>{title || data?.title || "Muhokama"} — muhokama</div>
            <div style={{ fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data?.customer || ""}{people.length ? ` · ${people.length} ishtirokchi` : ""} · mijoz ko'rmaydi</div>
          </div>
        </div>
        {top}
        {err && <div role="alert" style={{ padding: "6px 12px", fontSize: 12.5, color: C.red }}>{err}</div>}
        {body}
        {input}
      </div>
    );
  }
  return (
    <div data-testid="team-chat" style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0, ...(height === "fill" ? { flex: 1 } : {}) }}>
      {peopleRow}
      <div style={{ display: "flex", flexDirection: "column", ...(height === "fill" ? { flex: 1, minHeight: 0 } : { height: height || 520 }), background: C.bg, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}` }}>
        {err && <div role="alert" style={{ padding: "6px 12px", fontSize: 12.5, color: C.red }}>{err}</div>}
        {body}
        {input}
      </div>
    </div>
  );
}
