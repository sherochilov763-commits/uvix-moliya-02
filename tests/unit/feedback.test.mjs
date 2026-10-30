// «💡 Taklif» (feedback.js, 120-eskiz): saqlash, joy, ekran rasmi, holat, o'chirish
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
const breq = createRequire(path.resolve(here, "../../backend/package.json"));
const FB = breq("./feedback.js");
const Database = breq("better-sqlite3");
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uvix-fb-"));
  const db = new Database(path.join(dir, "u.db"));
  db.exec("CREATE TABLE kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  const getStmt = db.prepare("SELECT value FROM kv_store WHERE key = ?");
  const upsertStmt = db.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  const up = path.join(dir, "uploads");
  return { dir, up, getStmt, fb: FB.createFeedback({ getStmt, upsertStmt, uploadsDir: up, now: () => new Date("2026-10-30T09:00:00Z") }) };
}
const admin = { id: "admin", name: "Administrator" };

test("add: raqam, tur/muhimlik standarti, joy tozalanadi, ekran rasmi faylga", () => {
  const { fb, up } = setup();
  const a = fb.add({ text: "  Qarz yangilanmayapti ", type: "kamchilik", prio: "muhim", ctx: { label: "Buyurtmalar", record: "UV-261013-004", device: "telefon", evil: "<script>" }, shot: PNG }, admin);
  assert.equal(a.n, 1); assert.equal(a.text, "Qarz yangilanmayapti"); assert.equal(a.status, "yangi");
  assert.deepEqual(Object.keys(a.ctx).sort(), ["app", "device", "label", "record", "screen", "view"]);
  assert.equal(a.ctx.device, "telefon");
  assert.match(a.shot, /^fb[0-9a-f]{24}\.png$/);
  assert.ok(fs.existsSync(path.join(up, a.shot)));
  const b = fb.add({ text: "Ikkinchi", type: "nomalum", prio: "zo'r", shot: "data:text/html;base64,PGgxPg==" }, admin);
  assert.equal(b.n, 2); assert.equal(b.type, "taklif"); assert.equal(b.prio, "oddiy"); assert.equal(b.shot, null, "rasm bo'lmagan narsa saqlanmaydi");
  assert.deepEqual(fb.list().map((x) => x.n), [2, 1], "yangisi birinchi");
  assert.throws(() => fb.add({ text: "   " }, admin), /bo'sh/);
});

test("patch: faqat ruxsat etilgan maydonlar; remove — rasm ham o'chadi", () => {
  const { fb, up } = setup();
  const a = fb.add({ text: "x", shot: PNG }, admin);
  const p = fb.patch(a.id, { status: "bajarildi", fixedIn: "c3b61fa", prio: "shoshilinch", by: "hacker", n: 99, status2: 1 });
  assert.equal(p.status, "bajarildi"); assert.equal(p.fixedIn, "c3b61fa"); assert.equal(p.prio, "shoshilinch");
  assert.equal(p.by, "admin"); assert.equal(p.n, 1);
  assert.equal(fb.patch(a.id, { status: "yo'q" }).status, "bajarildi", "noma'lum holat — o'zgarmaydi");
  assert.throws(() => fb.patch("yoq", { status: "rejada" }), /Topilmadi/);
  assert.equal(fb.remove(a.id), true);
  assert.equal(fb.list().length, 0);
  return new Promise((r) => setTimeout(() => { assert.ok(!fs.existsSync(path.join(up, a.shot))); r(); }, 50));
});
