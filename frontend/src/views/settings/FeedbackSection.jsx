// FeedbackSection.jsx — Sozlamalar → «Takliflar» (120-eskiz): «💡 Taklif» orqali yozilganlar ro'yxati (faqat rahbar).
// Holat Yangi → Rejada → Bajarildi (bajarilganda — qaysi versiyada), tur va muhimlik bo'yicha filtr,
// ekran rasmini ko'rish, «📋 Claude uchun nusxa» — ochiq takliflar tayyor matn (Claude taxtasiga qo'yiladi).
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Image as ImageIcon, Lightbulb, Trash2 } from "lucide-react";
import { Card } from "../../components/ui.jsx";
import { FB_PRIOS, FB_TYPES } from "../../components/FeedbackButton.jsx";
import { deleteFeedback, fetchFeedback, patchFeedback } from "../../storage.js";
import { THEME } from "../../theme.js";

const STATUS = { yangi: "Yangi", rejada: "Rejada", bajarildi: "Bajarildi" };
const ST_COLOR = { yangi: "#1F5FD6", rejada: "#B45309", bajarildi: "#15803D" };
const TYPE_COLOR = { kamchilik: "#DC2626", taklif: "#7C3AED", savol: "#0E7490" };
const PR = { shoshilinch: 0, muhim: 1, oddiy: 2 };
const d2 = (n) => String(n).padStart(2, "0");
const when = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : `${d2(d.getDate())}.${d2(d.getMonth() + 1)} ${d2(d.getHours())}:${d2(d.getMinutes())}`; };
const place = (it) => [it.ctx?.label, it.ctx?.record].filter(Boolean).join(" → ");
const word = (k) => (FB_TYPES[k] || "").replace(/^\S+\s/, "");

/** «Claude uchun nusxa» matni — Claude taxtasidagi «Nusxani qo'yish» shu formatni o'qiydi */
export function claudeText(items, now = new Date()) {
  const open = items.filter((x) => x.status !== "bajarildi").sort((a, b) => (PR[a.prio] ?? 2) - (PR[b.prio] ?? 2) || b.n - a.n);
  const head = `UVIX takliflar · ${d2(now.getDate())}.${d2(now.getMonth() + 1)}.${now.getFullYear()} · ${open.length} ta ochiq`;
  const lines = open.map((it) => {
    const meta = [word(it.type), it.prio !== "oddiy" ? FB_PRIOS[it.prio] : null, it.status === "rejada" ? "Rejada" : null].filter(Boolean).join(" · ");
    const tail = [it.ctx?.device, when(it.at), it.via === "ovoz" ? "ovoz" : null, it.shot ? "ekran rasmi bor" : null].filter(Boolean).join(", ");
    return `#${it.n} [${meta}] ${place(it) || "—"}: ${String(it.text).replace(/\s+/g, " ")} (${tail})`;
  });
  return [head, ...lines].join("\n");
}

export function FeedbackSection() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState("");
  const [st, setSt] = useState("ochiq"); // ochiq | yangi | rejada | bajarildi | all
  const [tp, setTp] = useState("all");
  const [copied, setCopied] = useState(false);
  const [del, setDel] = useState(null);
  const [stick, setStick] = useState(() => new Set()); // holati hozir o'zgargan — filtrdan chiqib ketmasin (versiyani yozish uchun)
  const load = () => fetchFeedback().then((x) => { setItems(x); setErr(""); }).catch((e) => setErr(e.message || "Yuklab bo'lmadi"));
  useEffect(() => { load(); }, []);
  const counts = useMemo(() => {
    const c = { ochiq: 0, yangi: 0, rejada: 0, bajarildi: 0, all: 0 };
    for (const it of items || []) { c.all++; c[it.status]++; if (it.status !== "bajarildi") c.ochiq++; }
    return c;
  }, [items]);
  const shown = useMemo(() => (items || [])
    .filter((it) => stick.has(it.id) || (st === "all" ? true : st === "ochiq" ? it.status !== "bajarildi" : it.status === st) && (tp === "all" || it.type === tp))
    .sort((a, b) => (stick.has(a.id) || stick.has(b.id) ? 0 : (a.status === "bajarildi") - (b.status === "bajarildi")) || (PR[a.prio] ?? 2) - (PR[b.prio] ?? 2) || b.n - a.n), [items, st, tp, stick]);

  async function upd(it, patch) {
    if (patch.status) setStick((s0) => new Set(s0).add(it.id));
    setItems((list) => list.map((x) => (x.id === it.id ? { ...x, ...patch } : x)));
    try { const n = await patchFeedback(it.id, patch); setItems((list) => list.map((x) => (x.id === it.id ? n : x))); } catch (e) { setErr(e.message); load(); }
  }
  async function remove(it) {
    setDel(null);
    try { await deleteFeedback(it.id); setItems((list) => list.filter((x) => x.id !== it.id)); } catch (e) { setErr(e.message); }
  }
  async function copy() {
    const text = claudeText(items || []);
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea"); ta.value = text; document.body.append(ta); ta.select();
      try { document.execCommand("copy"); } catch { /* yo'q */ } ta.remove();
    }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  }
  if (err && !items) return <Card><div style={{ fontSize: 12.5, color: THEME.rose }}>{err}</div></Card>;
  if (!items) return null;
  const tab = (k, l) => (
    <button key={k} type="button" aria-pressed={st === k} data-fb-st={k} onClick={() => { setSt(k); setStick(new Set()); }}
      style={{ height: 28, padding: "0 10px", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
        border: `1px solid ${st === k ? THEME.text : THEME.border}`, background: st === k ? THEME.text : "transparent", color: st === k ? THEME.card : THEME.muted }}>
      {l}{counts[k] ? <b style={{ marginLeft: 5 }}>{counts[k]}</b> : null}
    </button>
  );
  return (
    <Card data-testid="feedback-list">
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Lightbulb size={16} color={THEME.amber} />
        <div style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 120 }}>Takliflar</div>
        <button type="button" onClick={copy} disabled={!counts.ochiq} data-testid="fb-copy"
          style={{ height: 34, padding: "0 12px", borderRadius: 10, border: 0, background: THEME.text, color: THEME.card, fontWeight: 700, fontSize: 12.5, cursor: counts.ochiq ? "pointer" : "default", opacity: counts.ochiq ? 1 : 0.5, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Nusxalandi — Claude'ga qo'ying" : "Claude uchun nusxa"}
        </button>
      </div>
      <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4 }}>Har ekran sarlavhasidagi «💡 Taklif» orqali yozilganlar. Nusxani Claude chatiga yoki «UVIX rivojlanish taxtasi»ga qo'ying.</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
        {tab("ochiq", "Ochiq")}{tab("yangi", "Yangi")}{tab("rejada", "Rejada")}{tab("bajarildi", "Bajarildi")}{tab("all", "Hammasi")}
        <span style={{ flex: 1 }} />
        <select value={tp} onChange={(e) => { setTp(e.target.value); setStick(new Set()); }} aria-label="Turi" data-testid="fb-filter-type"
          style={{ height: 28, borderRadius: 9, border: `1px solid ${THEME.border}`, background: THEME.card, color: THEME.text, fontFamily: "inherit", fontSize: 12, padding: "0 6px" }}>
          <option value="all">Barcha turlar</option>{Object.entries(FB_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <div style={{ marginTop: 10, border: `1px solid ${THEME.border}`, borderRadius: 12, overflow: "hidden" }}>
        {!shown.length && <div style={{ padding: "18px 14px", fontSize: 13, color: THEME.muted, textAlign: "center" }}>{items.length ? "Bu filtrda yozuv yo'q" : "Hali yozuv yo'q. Istalgan ekranda sarlavhadagi «💡 Taklif»ni bosing."}</div>}
        {shown.map((it, i) => (
          <div key={it.id} data-fb-item={it.n} style={{ display: "flex", gap: 10, padding: "11px 12px", borderTop: i ? `1px solid ${THEME.border}` : 0, alignItems: "flex-start", opacity: it.status === "bajarildi" ? 0.7 : 1, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLOR[it.type], background: `${TYPE_COLOR[it.type]}1A`, borderRadius: 7, padding: "2px 7px", whiteSpace: "nowrap", marginTop: 1 }}>{FB_TYPES[it.type]}</span>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <div style={{ fontSize: 13.5, lineHeight: 1.45, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}><b style={{ color: THEME.muted }}>#{it.n}</b> {it.text}</div>
              <div style={{ fontSize: 11.5, color: THEME.muted, marginTop: 3 }}>
                📍 {place(it) || "—"} · {it.ctx?.device}{it.via === "ovoz" ? " · 🎤 ovoz" : ""} · {when(it.at)}
                {it.prio !== "oddiy" && <b style={{ color: it.prio === "shoshilinch" ? THEME.rose : THEME.amber }}> · {FB_PRIOS[it.prio]}</b>}
                {it.status === "bajarildi" && it.fixedIn ? <b style={{ color: THEME.green }}> · ✓ {it.fixedIn}</b> : null}
              </div>
              {it.status === "bajarildi" && (
                <input defaultValue={it.fixedIn} placeholder="qaysi versiyada (masalan c3b61fa)" aria-label="Qaysi versiyada tuzatildi" data-testid="fb-fixed"
                  onBlur={(e) => e.target.value.trim() !== (it.fixedIn || "") && upd(it, { fixedIn: e.target.value.trim() })}
                  style={{ marginTop: 6, height: 28, width: "min(240px,100%)", borderRadius: 8, border: `1px solid ${THEME.border}`, background: THEME.card, color: THEME.text, fontFamily: "inherit", fontSize: 12, padding: "0 8px" }} />
              )}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
              {it.shot && <a href={`/api/photos/${it.shot}`} target="_blank" rel="noreferrer" title="Ekran rasmi" aria-label="Ekran rasmini ochish" data-testid="fb-shot-link"
                style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${THEME.border}`, display: "grid", placeItems: "center", color: THEME.muted }}><ImageIcon size={14} /></a>}
              <select value={it.prio} onChange={(e) => upd(it, { prio: e.target.value })} aria-label="Muhimlik"
                style={{ height: 30, borderRadius: 8, border: `1px solid ${THEME.border}`, background: THEME.card, color: THEME.text, fontFamily: "inherit", fontSize: 12, padding: "0 4px" }}>
                {Object.entries(FB_PRIOS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <select value={it.status} onChange={(e) => upd(it, { status: e.target.value })} aria-label="Holat" data-testid="fb-status"
                style={{ height: 30, borderRadius: 8, border: `1px solid ${ST_COLOR[it.status]}66`, background: THEME.card, color: ST_COLOR[it.status], fontWeight: 600, fontFamily: "inherit", fontSize: 12, padding: "0 4px" }}>
                {Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              {del === it.id
                ? <button type="button" onClick={() => remove(it)} data-testid="fb-del-yes" style={{ height: 30, borderRadius: 8, border: 0, background: THEME.rose, color: "#fff", fontWeight: 700, fontSize: 12, padding: "0 9px", cursor: "pointer", fontFamily: "inherit" }}>O'chirilsinmi?</button>
                : <button type="button" onClick={() => setDel(it.id)} aria-label="O'chirish" data-testid="fb-del" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${THEME.border}`, background: "none", color: THEME.muted, cursor: "pointer", display: "grid", placeItems: "center" }}><Trash2 size={14} /></button>}
            </div>
          </div>
        ))}
      </div>
      {err && <div role="alert" style={{ fontSize: 12.5, color: THEME.rose, marginTop: 8 }}>{err}</div>}
    </Card>
  );
}
