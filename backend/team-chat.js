// team-chat.js — jamoa «Muhokama» chati (128-eskiz): har lid/buyurtma uchun bitta ichki chat.
// Mijoz ko'rmaydi. Ishtirokchilar: rahbar/menejerlar (hammasi), dizayn/pechat ijrochisi va kuzatuvchilari.
// Mavzu (thread) kaliti: "l:<leadId>" — liddan; "o:<orderId>" — lidsiz buyurtma (smetadan).
// Liddan yaratilgan buyurtmaning vazifalari ham o'sha lid mavzusiga tushadi — dizayndan pechatgacha bitta chat.
const path = require("path");
const crypto = require("crypto");

const KINDS = ["design", "print"];
const MAX_TEXT = 4000;
const THREAD_RE = /^(l|o):[A-Za-z0-9_.-]{1,80}$/;

function createTeamStore({ db }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS team_messages (
      id TEXT PRIMARY KEY,
      thread TEXT NOT NULL,
      at TEXT NOT NULL,
      author_id TEXT,
      author TEXT,
      kind TEXT NOT NULL DEFAULT 'msg',
      text TEXT,
      file TEXT
    );
    CREATE INDEX IF NOT EXISTS team_messages_thread ON team_messages (thread, at);
  `);
  const st = {
    list: db.prepare("SELECT * FROM team_messages WHERE thread = ? ORDER BY at ASC, id ASC LIMIT 1000"),
    put: db.prepare("INSERT INTO team_messages (id, thread, at, author_id, author, kind, text, file) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
    stats: db.prepare("SELECT thread, COUNT(*) AS n, MAX(at) AS last FROM team_messages WHERE kind = 'msg' GROUP BY thread"),
    since: db.prepare("SELECT thread, COUNT(*) AS n FROM team_messages WHERE kind = 'msg' AND thread = ? AND at > ? AND (author_id IS NULL OR author_id <> ?)"),
  };
  const row = (r) => ({ id: r.id, at: r.at, authorId: r.author_id || null, author: r.author || "", kind: r.kind, text: r.text || "", file: r.file ? JSON.parse(r.file) : null });
  return {
    list: (thread) => st.list.all(thread).map(row),
    add(thread, { authorId = null, author = "", kind = "msg", text = "", file = null, at = new Date().toISOString() }) {
      const id = crypto.randomBytes(8).toString("hex");
      st.put.run(id, thread, at, authorId, author, kind, String(text || "").slice(0, MAX_TEXT), file ? JSON.stringify(file) : null);
      return { id, at, authorId, author, kind, text, file };
    },
    stats: () => Object.fromEntries(st.stats.all().map((r) => [r.thread, { n: r.n, last: r.last }])),
    unread: (thread, after, userId) => (after ? st.since.get(thread, after, userId || "")?.n || 0 : null),
  };
}

// Vazifaning mavzusi: lid vazifasi → l:<leadId>; buyurtma vazifasi → lidi bo'lsa l:<leadId>, aks holda o:<orderId>
const threadOfLead = (leadId) => `l:${leadId}`;
const threadOfOrder = (order) => (order?.leadId ? `l:${order.leadId}` : `o:${order?.id}`);

function registerTeamChat(app, { db, getStmt, upsertStmt, readEmployees, requireAuth, isWorker, uploadsDir, multer, notifyEmployee = async () => false, now = () => new Date() }) {
  const store = createTeamStore({ db });
  const readJson = (key, fallback) => { const r = getStmt.get(key); if (!r) return fallback; try { return JSON.parse(r.value); } catch { return fallback; } };
  const KEY_READS = "uvix:teamReads";

  // Mavzu ishtirokchilari (xodim id'lari) va sarlavha
  function threadInfo(thread) {
    const [type, id] = [thread.slice(0, 1), thread.slice(2)];
    const leads = readJson("uvix:leads", []);
    const orders = readJson("uvix:orders", []);
    const ids = new Set();
    const addTask = (t) => {
      if (!t) return;
      if (t.assigneeId) ids.add(t.assigneeId);
      (Array.isArray(t.watchers) ? t.watchers : []).forEach((w) => w && ids.add(w));
    };
    let title = "", customer = "", exists = false;
    if (type === "l") {
      const lead = (Array.isArray(leads) ? leads : []).find((l) => l && l.id === id);
      if (lead) { exists = true; customer = lead.customer || ""; title = lead.jobTitle || ""; KINDS.forEach((k) => addTask(lead[k])); }
      (Array.isArray(orders) ? orders : []).filter((o) => o && !o.deletedAt && o.leadId === id).forEach((o) => { exists = true; customer = customer || o.customer || ""; KINDS.forEach((k) => addTask(o[k])); });
    } else {
      const o = (Array.isArray(orders) ? orders : []).find((x) => x && x.id === id && !x.deletedAt);
      if (o) { exists = true; customer = o.customer || ""; title = o.title || ""; KINDS.forEach((k) => addTask(o[k])); }
    }
    return { exists, ids, title, customer };
  }
  const canSee = (user, info) => !isWorker(user) || info.ids.has(user.id);
  const reads = () => readJson(KEY_READS, {});
  function markRead(userId, thread, at) {
    const all = reads();
    all[userId] = { ...(all[userId] || {}), [thread]: at };
    upsertStmt.run(KEY_READS, JSON.stringify(all));
  }

  // Yangi xabar — ishtirokchi xodimlarga Telegram (bir mavzu bo'yicha 10 daqiqada bir marta)
  const lastPing = new Map();
  function ping(thread, info, msg) {
    const emps = readEmployees();
    const t = now().getTime();
    for (const e of emps) {
      if (!info.ids.has(e.id) || e.id === msg.authorId) continue;
      const k = `${e.id}|${thread}`;
      if (t - (lastPing.get(k) || 0) < 10 * 60000) continue;
      lastPing.set(k, t);
      const body = msg.file ? `${msg.text ? msg.text + " · " : ""}📎 ${msg.file.name}` : msg.text;
      notifyEmployee(e.id, `💬 <b>${esc(info.customer || "Muhokama")}</b> — ${esc(msg.author)}:\n${esc(String(body || "").slice(0, 300))}`).catch(() => {});
    }
  }
  const esc = (s) => String(s || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

  function guard(req, res) {
    const thread = String(req.params.thread || "");
    if (!THREAD_RE.test(thread)) { res.status(400).json({ error: "bad_thread" }); return null; }
    const info = threadInfo(thread);
    if (!info.exists) { res.status(404).json({ error: "not_found", message: "Lid yoki buyurtma topilmadi" }); return null; }
    if (!canSee(req.user, info)) { res.status(403).json({ error: "forbidden", message: "Bu muhokamada ishtirok etmaysiz" }); return null; }
    return { thread, info };
  }
  // Ishtirokchilar: vazifa odamlari + yozganlar (rahbar/menejerlar ham ko'rinsin)
  function participants(info, messages = []) {
    const ids = new Set(info.ids);
    messages.forEach((m) => m.kind === "msg" && m.authorId && ids.add(m.authorId));
    return readEmployees().filter((e) => ids.has(e.id)).map((e) => ({ id: e.id, name: e.name, role: e.role }));
  }

  // Bir nechta mavzu bo'yicha qisqa holat: { "l:abc": { n, unread } }
  app.get("/api/team-chat", requireAuth, (req, res) => {
    const want = String(req.query.threads || "").split(",").map((s) => s.trim()).filter((s) => THREAD_RE.test(s)).slice(0, 300);
    const stats = store.stats();
    const my = reads()[req.user.id] || {};
    const out = {};
    for (const th of want) {
      const s = stats[th];
      if (!s) { out[th] = { n: 0, unread: 0 }; continue; }
      if (isWorker(req.user) && !canSee(req.user, threadInfo(th))) continue;
      const un = my[th] ? store.unread(th, my[th], req.user.id) : store.list(th).filter((m) => m.kind === "msg" && m.authorId !== req.user.id).length;
      out[th] = { n: s.n, unread: un, last: s.last };
    }
    res.json({ threads: out });
  });

  app.get("/api/team-chat/:thread", requireAuth, (req, res) => {
    const g = guard(req, res); if (!g) return;
    const messages = store.list(g.thread);
    markRead(req.user.id, g.thread, now().toISOString());
    res.json({ thread: g.thread, customer: g.info.customer, title: g.info.title, participants: participants(g.info, messages), messages });
  });

  app.post("/api/team-chat/:thread", requireAuth, (req, res) => {
    const g = guard(req, res); if (!g) return;
    const text = String(req.body?.text || "").trim();
    const sys = req.body?.sys === true && !isWorker(req.user);
    if (!text) return res.status(400).json({ error: "empty", message: "Xabar bo'sh" });
    const msg = store.add(g.thread, { authorId: req.user.id, author: req.user.name, kind: sys ? "sys" : "msg", text });
    markRead(req.user.id, g.thread, msg.at);
    if (!sys) ping(g.thread, g.info, msg);
    res.json({ ok: true, message: msg });
  });

  // Fayl: rasm, PDF, CDR, AI, PSD, ZIP… (25 MB gacha). Ko'rish — /api/photos/<nom> orqali (xavfsiz turlar brauzerda, qolgani yuklanadi)
  const ALLOWED = /\.(jpe?g|png|webp|gif|pdf|cdr|ai|eps|psd|tiff?|svg|zip|rar|7z|dxf|plt|docx?|xlsx?|txt|mp4|mov|m4a|ogg|mp3)$/i;
  const upload = multer({
    storage: multer.diskStorage({
      destination: (r, f, cb) => cb(null, uploadsDir),
      filename: (r, f, cb) => cb(null, `${crypto.randomBytes(12).toString("hex")}${(path.extname(f.originalname) || "").toLowerCase().replace(/[^a-z0-9.]/g, "")}`),
    }),
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
    fileFilter: (r, f, cb) => (ALLOWED.test(f.originalname || "") ? cb(null, true) : cb(new Error("Bu turdagi fayl qabul qilinmaydi"))),
  });
  app.post("/api/team-chat/:thread/file", requireAuth, (req, res) => {
    const g = guard(req, res); if (!g) return;
    upload.single("file")(req, res, (err) => {
      if (err) return res.status(400).json({ error: "upload_failed", message: err.code === "LIMIT_FILE_SIZE" ? "Fayl 25 MB dan katta" : err.message });
      const f = req.file;
      if (!f) return res.status(400).json({ error: "no_file" });
      const name = Buffer.from(f.originalname || "fayl", "latin1").toString("utf8").replace(/[\r\n"\\/]/g, "").slice(0, 120);
      const file = { url: `/api/photos/${f.filename}`, name, size: f.size, image: /^image\/(jpeg|png|webp|gif)$/.test(f.mimetype) };
      const msg = store.add(g.thread, { authorId: req.user.id, author: req.user.name, text: String(req.body?.text || "").trim(), file });
      markRead(req.user.id, g.thread, msg.at);
      ping(g.thread, g.info, msg);
      res.json({ ok: true, message: msg });
    });
  });

  return {
    store,
    // Server hodisalari (vazifa holati) — kulrang tizim qatori
    system(thread, text) { try { if (THREAD_RE.test(thread)) store.add(thread, { kind: "sys", author: "Tizim", text }); } catch (e) { console.error("Muhokama:", e.message); } },
  };
}

module.exports = { registerTeamChat, createTeamStore, threadOfLead, threadOfOrder, THREAD_RE };
