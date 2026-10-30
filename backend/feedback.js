// feedback.js — «💡 Taklif» (120-eskiz): rahbar ishlatish paytida kamchilik, taklif va savollarni yozib boradi.
//
// Har yozuvda joy o'zi saqlanadi (qaysi bo'lim, qaysi buyurtma/chat, qurilma) va xohlasa ekran rasmi.
// Ro'yxat faqat rahbarga: holat Yangi → Rejada → Bajarildi, «qaysi versiyada tuzatildi».
// «📋 Claude uchun nusxa» matni brauzerda yig'iladi (backend faqat ma'lumot beradi).
// Saqlash: uvix:feedback = { seq, items: [...] } (ichki kalit — KV orqali ochiq emas);
// ekran rasmi — uploads/fb<24 hex>.jpg (nomi yozuvda turadi, shuning uchun chat-files uni hech qachon o'chirmaydi).

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const KEY = "uvix:feedback";
const TYPES = ["kamchilik", "taklif", "savol"];
const PRIOS = ["oddiy", "muhim", "shoshilinch"];
const STATUSES = ["yangi", "rejada", "bajarildi"];
const MAX_ITEMS = 1000;
const MAX_TEXT = 4000;
const MAX_SHOT = 3 * 1024 * 1024; // JPEG, baytda

const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const pick = (v, list, def) => (list.includes(v) ? v : def);

/** Brauzerdan kelgan joy ma'lumoti — faqat ma'lum maydonlar, qisqartirilgan */
function cleanCtx(c) {
  const o = c && typeof c === "object" ? c : {};
  return {
    view: str(o.view, 40), label: str(o.label, 120), record: str(o.record, 120),
    device: pick(o.device, ["kompyuter", "telefon", "planshet"], "kompyuter"), screen: str(o.screen, 20), app: str(o.app, 40),
  };
}

function createFeedback({ getStmt, upsertStmt, uploadsDir, now = () => new Date() }) {
  const read = () => {
    try { const r = getStmt.get(KEY); const v = r ? JSON.parse(r.value) : null; return { seq: Number(v?.seq) || 0, items: Array.isArray(v?.items) ? v.items : [] }; } catch { return { seq: 0, items: [] }; }
  };
  const write = (s) => upsertStmt.run(KEY, JSON.stringify(s));

  function saveShot(dataUrl) {
    const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
    if (!m) return null;
    const buf = Buffer.from(m[2], "base64");
    if (!buf.length || buf.length > MAX_SHOT) return null;
    const name = `fb${crypto.randomBytes(12).toString("hex")}.${m[1] === "png" ? "png" : "jpg"}`;
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, name), buf);
    return name;
  }

  function add(body, user) {
    const text = str(body?.text, MAX_TEXT);
    if (!text) { const e = new Error("Matn bo'sh"); e.status = 400; throw e; }
    const s = read();
    const at = now().toISOString();
    const item = {
      id: crypto.randomBytes(6).toString("hex"), n: s.seq + 1,
      type: pick(body?.type, TYPES, "taklif"), prio: pick(body?.prio, PRIOS, "oddiy"), status: "yangi",
      text, via: body?.via === "ovoz" ? "ovoz" : "matn", ctx: cleanCtx(body?.ctx),
      shot: body?.shot ? saveShot(body.shot) : null,
      by: user?.id || null, byName: user?.name || "", at, updatedAt: at, fixedIn: "",
    };
    s.seq = item.n;
    s.items = [item, ...s.items].slice(0, MAX_ITEMS);
    write(s);
    return item;
  }
  function list() { return read().items; }
  function patch(id, body) {
    const s = read();
    const it = s.items.find((x) => x.id === id);
    if (!it) { const e = new Error("Topilmadi"); e.status = 404; throw e; }
    if (body?.status !== undefined) it.status = pick(body.status, STATUSES, it.status);
    if (body?.prio !== undefined) it.prio = pick(body.prio, PRIOS, it.prio);
    if (body?.type !== undefined) it.type = pick(body.type, TYPES, it.type);
    if (body?.fixedIn !== undefined) it.fixedIn = str(body.fixedIn, 60);
    if (body?.text !== undefined && str(body.text, MAX_TEXT)) it.text = str(body.text, MAX_TEXT);
    it.updatedAt = now().toISOString();
    write(s);
    return it;
  }
  function remove(id) {
    const s = read();
    const it = s.items.find((x) => x.id === id);
    if (!it) return false;
    s.items = s.items.filter((x) => x.id !== id);
    write(s);
    if (it.shot && /^fb[0-9a-f]{24}\.(jpg|png)$/.test(it.shot)) fs.unlink(path.join(uploadsDir, it.shot), () => {});
    return true;
  }
  return { add, list, patch, remove };
}

function registerFeedback(app, { requireAuth, requireAdmin, feedback }) {
  const send = (res, fn) => { try { res.json(fn()); } catch (e) { res.status(e.status || 500).json({ error: "feedback", message: e.message }); } };
  app.get("/api/feedback", requireAuth, requireAdmin, (req, res) => send(res, () => ({ items: feedback.list() })));
  app.post("/api/feedback", requireAuth, requireAdmin, (req, res) => send(res, () => ({ ok: true, item: feedback.add(req.body, req.user) })));
  app.patch("/api/feedback/:id", requireAuth, requireAdmin, (req, res) => send(res, () => ({ ok: true, item: feedback.patch(String(req.params.id).slice(0, 20), req.body) })));
  app.delete("/api/feedback/:id", requireAuth, requireAdmin, (req, res) => send(res, () => ({ ok: feedback.remove(String(req.params.id).slice(0, 20)) })));
}

module.exports = { createFeedback, registerFeedback, cleanCtx, KEY, TYPES, PRIOS, STATUSES };
