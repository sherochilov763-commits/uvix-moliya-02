// FeedbackButton.jsx — «💡 Taklif» (120-eskiz): har ekran sarlavhasida, faqat rahbarga.
// Kamchilik / taklif / savol yoziladi (matn yoki ovoz), joy o'zi qo'shiladi: bo'lim, ochiq oyna yoki chat, qurilma.
// «Ekran rasmini qo'shish» — oyna ochilgan paytdagi sahifa (oynaning o'zi rasmga tushmaydi; html-to-image).
// Kompyuterda — sarlavhadagi tugma va kichik oyna; telefonda — «+» varag'idagi «Kamchilik yoki taklif» va pastdan varaq. Esc — yopish, Ctrl+Enter — saqlash.
// Ro'yxat: Sozlamalar → «Takliflar» (FeedbackSection.jsx).
import { useEffect, useRef, useState } from "react";
import { Lightbulb, Loader2, Mic, Square, X } from "lucide-react";
import { THEME } from "../theme.js";
import { addFeedback, voiceTranscribe } from "../storage.js";

export const FB_TYPES = { kamchilik: "🐞 Kamchilik", taklif: "💡 Taklif", savol: "❓ Savol" };
export const FB_PRIOS = { oddiy: "Oddiy", muhim: "Muhim", shoshilinch: "Shoshilinch" };
const isPhone = () => typeof window !== "undefined" && window.matchMedia?.("(max-width: 860px)").matches;
function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"]) if (MediaRecorder.isTypeSupported?.(t)) return t;
  return "";
}
const clip = (s, n = 110) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

// Hozir ekranda nima ochiq: oyna sarlavhasi yoki [data-fb-record] (masalan, ochiq chat nomi)
export function currentRecord(doc = typeof document !== "undefined" ? document : null) {
  if (!doc) return "";
  const panels = [...doc.querySelectorAll(".uvix-modal-panel")].filter((p) => !p.closest("[data-fb-ignore]"));
  const panel = panels[panels.length - 1];
  if (panel) {
    const h = panel.querySelector("[data-modal-title], h1, h2, h3");
    if (h) return clip(h.textContent);
  }
  const rec = [...doc.querySelectorAll("[data-fb-record]")].filter((e) => !e.closest("[data-fb-ignore]")).pop();
  return rec ? clip(rec.getAttribute("data-fb-record") || rec.textContent) : "";
}

// Ekran rasmi: brauzerning o'zi chizadi (SVG foreignObject) — zamonaviy CSS ranglar ham to'g'ri chiqadi
async function captureScreen() {
  const { toJpeg } = await import("html-to-image");
  const w = window.innerWidth, h = window.innerHeight;
  const root = document.getElementById("root") || document.body;
  const ratio = Math.min(window.devicePixelRatio || 1, 1600 / w);
  const opts = {
    width: w, height: h, pixelRatio: ratio, backgroundColor: THEME.surface, cacheBust: false,
    style: { transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)` },
    filter: (node) => !(node.hasAttribute && node.hasAttribute("data-fb-ignore")),
  };
  let q = 0.72, url = await toJpeg(root, { ...opts, quality: q });
  while (url.length > 3.6e6 && q > 0.3) { q -= 0.15; url = await toJpeg(root, { ...opts, quality: q }); }
  return url;
}

export function FeedbackButton({ viewLabel, onOpenList }) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState("");
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(""), 2600); return () => clearTimeout(t); }, [toast]);
  // Telefonda tugma «+» varag'ida («Kamchilik yoki taklif») — sarlavha tiqilib qolmasin
  useEffect(() => { const on = () => setOpen(true); window.addEventListener("uvix:feedback-open", on); return () => window.removeEventListener("uvix:feedback-open", on); }, []);
  return (
    <>
      <button type="button" className="uvix-fbbtn" data-testid="fb-btn" aria-label="Kamchilik yoki taklif yozish" title="Kamchilik yoki taklif yozish"
        aria-expanded={open} onClick={() => setOpen((v) => !v)}
        style={{ background: open ? THEME.amberBg || "#FFF7E6" : THEME.card, color: THEME.amberText || "#9A6200", borderColor: open ? THEME.amber : THEME.border }}>
        <Lightbulb size={16} /><span className="uvix-fbbtn-t">Taklif</span>
      </button>
      {open && <FeedbackDialog viewLabel={viewLabel} onClose={() => setOpen(false)} onOpenList={onOpenList}
        onSaved={(it) => { setOpen(false); setToast(`✓ #${it.n} saqlandi — Sozlamalar → Takliflar`); }} />}
      {toast && <div role="status" data-testid="fb-toast" data-fb-ignore="" className="uvix-fbtoast" style={{ background: THEME.text, color: THEME.card }}>{toast}</div>}
    </>
  );
}

function Chip({ on, onClick, children, color, testid }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} data-testid={testid}
      style={{ height: 30, padding: "0 11px", borderRadius: 15, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
        border: `1px solid ${on ? color || THEME.text : THEME.border}`, background: on ? color || THEME.text : "transparent", color: on ? "#fff" : THEME.muted }}>
      {children}
    </button>
  );
}

export function FeedbackDialog({ viewLabel, onClose, onSaved, onOpenList }) {
  const phone = isPhone();
  const [type, setType] = useState("kamchilik");
  const [prio, setPrio] = useState("oddiy");
  const [text, setText] = useState("");
  const [record] = useState(() => currentRecord());
  const [withShot, setWithShot] = useState(true);
  const [shot, setShot] = useState({ state: "busy", url: null }); // busy | ok | fail
  const [rec, setRec] = useState(null); // { mr, chunks } yozilmoqda
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [via, setVia] = useState("matn");
  const taRef = useRef(null);

  // Ekran rasmi — oyna ochilgan zahoti fonda (oynaning o'zi rasmga tushmaydi)
  useEffect(() => {
    let alive = true;
    captureScreen().then((url) => alive && setShot({ state: "ok", url })).catch(() => alive && setShot({ state: "fail", url: null }));
    return () => { alive = false; };
  }, []);
  useEffect(() => { setTimeout(() => taRef.current?.focus(), 30); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);
  useEffect(() => () => rec?.mr?.stream?.getTracks?.().forEach((t) => t.stop()), [rec]);

  async function startRec() {
    setErr("");
    const mime = pickMime();
    if (mime === null || !navigator.mediaDevices?.getUserMedia) { setErr("Bu qurilmada ovoz yozib bo'lmaydi — matn bilan yozing"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRec(null);
        const blob = new Blob(chunks, { type: mr.mimeType || mime || "audio/webm" });
        if (!blob.size) return;
        setBusy("voice");
        try { const t = await voiceTranscribe(blob); setText((p) => (p ? `${p} ${t}` : t)); setVia("ovoz"); } catch (e) { setErr(e.message); }
        setBusy("");
      };
      mr.start();
      setRec({ mr });
    } catch { setErr("Mikrofonga ruxsat berilmadi"); }
  }
  async function save() {
    if (!text.trim() || busy) { taRef.current?.focus(); return; }
    setBusy("save"); setErr("");
    try {
      const it = await addFeedback({
        type, prio, text: text.trim(), via,
        ctx: { view: viewLabel || "", label: viewLabel || "", record, device: phone ? "telefon" : "kompyuter", screen: `${window.innerWidth}×${window.innerHeight}` },
        shot: withShot && shot.state === "ok" ? shot.url : null,
      });
      onSaved?.(it);
    } catch (e) { setErr(e.message || "Saqlab bo'lmadi"); setBusy(""); }
  }

  const body = (
    <div data-fb-ignore="" role="dialog" aria-modal="true" aria-label="Kamchilik yoki taklif" data-testid="fb-dialog"
      className={phone ? "uvix-fbsheet" : "uvix-fbpop"} style={{ background: THEME.card, color: THEME.text, borderColor: THEME.border, boxShadow: THEME.shadowLg }}
      onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } }}>
      {phone && <div style={{ width: 40, height: 5, borderRadius: 3, background: THEME.border2, margin: "0 auto 10px" }} />}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <b style={{ fontSize: 15, flex: 1 }}>💡 Kamchilik yoki taklif</b>
        <button type="button" aria-label="Yopish" onClick={onClose} disabled={!!busy} style={{ border: 0, background: "none", color: THEME.muted, cursor: "pointer", padding: 4, display: "flex" }}><X size={18} /></button>
      </div>
      <div role="group" aria-label="Turi" style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {Object.entries(FB_TYPES).map(([k, l]) => <Chip key={k} on={type === k} onClick={() => setType(k)} testid={`fb-type-${k}`} color={k === "kamchilik" ? "#DC2626" : k === "taklif" ? "#7C3AED" : "#0E7490"}>{l}</Chip>)}
      </div>
      <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} data-testid="fb-text" maxLength={4000}
        placeholder={type === "kamchilik" ? "Nima ishlamayapti yoki noqulay? Masalan: to'lov qo'shganda qarz darhol yangilanmayapti" : type === "savol" ? "Savolingiz…" : "Nimani qo'shish yoki o'zgartirish kerak?"}
        style={{ width: "100%", boxSizing: "border-box", marginTop: 10, minHeight: phone ? 76 : 88, resize: "vertical", border: `1.5px solid ${THEME.violet}`, borderRadius: 12, padding: "9px 11px", background: THEME.card, color: THEME.text, fontFamily: "inherit", fontSize: phone ? 16 : 13.5, lineHeight: 1.45, outline: "none" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <button type="button" onClick={() => (rec ? rec.mr.stop() : startRec())} disabled={busy === "voice" || busy === "save"} data-testid="fb-mic"
          aria-label={rec ? "Yozishni tugatish" : "Gapirib aytish"}
          style={{ width: 36, height: 36, borderRadius: "50%", border: 0, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0,
            background: rec ? THEME.rose : THEME.violetSoft, color: rec ? "#fff" : THEME.violet, boxShadow: rec ? `0 0 0 6px color-mix(in srgb, ${THEME.rose} 20%, transparent)` : "none" }}>
          {busy === "voice" ? <Loader2 size={16} className="uvix-spin" /> : rec ? <Square size={14} /> : <Mic size={16} />}
        </button>
        <span style={{ fontSize: 12, color: THEME.muted }}>{rec ? "Gapiring… tugatish uchun ■" : busy === "voice" ? "Matnga aylantirilmoqda…" : "yoki gapirib ayting"}</span>
      </div>
      <div data-testid="fb-ctx" style={{ marginTop: 10, padding: "8px 10px", borderRadius: 10, background: THEME.hover, fontSize: 12, lineHeight: 1.5 }}>
        📍 <b>{viewLabel || "—"}</b>{record ? <> → {record}</> : null}
        <div style={{ color: THEME.muted }}>o'zi yoziladi: bo'lim, ochiq oyna yoki chat, qurilma</div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontSize: 13, cursor: shot.state === "fail" ? "default" : "pointer", opacity: shot.state === "fail" ? 0.55 : 1 }}>
        <span style={{ flex: 1 }}>📷 Ekran rasmini qo'shish{shot.state === "busy" ? " · olinmoqda…" : shot.state === "fail" ? " · olib bo'lmadi" : ""}</span>
        <input type="checkbox" role="switch" checked={withShot && shot.state !== "fail"} disabled={shot.state === "fail"} onChange={(e) => setWithShot(e.target.checked)} data-testid="fb-shot"
          style={{ width: 18, height: 18, accentColor: THEME.green }} />
      </label>
      <div role="group" aria-label="Muhimlik" style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: THEME.muted, marginRight: 2 }}>Muhimlik:</span>
        {Object.entries(FB_PRIOS).map(([k, l]) => <Chip key={k} on={prio === k} onClick={() => setPrio(k)} testid={`fb-prio-${k}`} color={k === "shoshilinch" ? "#DC2626" : k === "muhim" ? "#B45309" : undefined}>{l}</Chip>)}
      </div>
      {err && <div role="alert" style={{ fontSize: 12.5, color: THEME.rose, marginTop: 8 }}>{err}</div>}
      <button type="button" onClick={save} disabled={!!busy || !text.trim()} data-testid="fb-save"
        style={{ marginTop: 12, width: "100%", height: 42, borderRadius: 12, border: 0, background: THEME.violet, color: THEME.onPrimary || "#fff", fontWeight: 700, fontSize: 14, cursor: busy || !text.trim() ? "default" : "pointer", opacity: busy || !text.trim() ? 0.55 : 1, fontFamily: "inherit" }}>
        {busy === "save" ? "Saqlanmoqda…" : "Saqlash"}
      </button>
      <div style={{ fontSize: 11, color: THEME.muted, textAlign: "center", marginTop: 6 }}>
        {phone ? "Faqat rahbar ko'radi" : "Ctrl + Enter · faqat rahbar ko'radi"}
        {onOpenList && <> · <button type="button" onClick={() => { onClose(); onOpenList(); }} style={{ border: 0, background: "none", padding: 0, color: THEME.violet, cursor: "pointer", font: "inherit" }}>Ro'yxat →</button></>}
      </div>
    </div>
  );
  return (
    <div data-fb-ignore="" className="uvix-fbdim" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{ background: phone ? "rgba(0,0,0,.4)" : "transparent" }}>
      {body}
    </div>
  );
}

export const FEEDBACK_CSS = () => `
  .uvix-fbbtn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border-radius: 17px; border: 1.5px solid; cursor: pointer; font: 700 12.5px/1 inherit; flex-shrink: 0; }
  .uvix-fbdim { position: fixed; inset: 0; z-index: 260; }
  .uvix-fbpop { position: fixed; top: 64px; right: 24px; width: 400px; max-width: calc(100vw - 24px); max-height: calc(100vh - 80px); overflow: auto; border: 1px solid; border-radius: 16px; padding: 14px 16px; box-sizing: border-box; }
  .uvix-fbsheet { position: fixed; left: 0; right: 0; bottom: 0; max-height: 92vh; overflow: auto; border-radius: 20px 20px 0 0; padding: 10px 14px calc(16px + env(safe-area-inset-bottom, 0px)); box-sizing: border-box; }
  .uvix-fbtoast { position: fixed; left: 50%; bottom: calc(90px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 270; padding: 9px 16px; border-radius: 12px; font-size: 13px; font-weight: 600; white-space: nowrap; max-width: calc(100vw - 32px); overflow: hidden; text-overflow: ellipsis; }
  @media (max-width: 860px) {
    .uvix-fbbtn { display: none; }
  }
  @media print { .uvix-fbbtn, .uvix-fbdim, .uvix-fbtoast { display: none !important; } }
`;
