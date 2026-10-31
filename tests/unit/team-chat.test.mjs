// Jamoa «Muhokama» chati (team-chat.js) — 128-eskiz
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const breq = createRequire(path.resolve(here, "../../backend/package.json"));
const { createTeamStore, threadOfOrder, THREAD_RE } = breq("./team-chat.js");
const Database = breq("better-sqlite3");

test("mavzu kaliti: liddan — l:, lidsiz buyurtma — o:", () => {
  assert.equal(threadOfOrder({ id: "o1", leadId: "L9" }), "l:L9");
  assert.equal(threadOfOrder({ id: "o1" }), "o:o1");
  assert.ok(THREAD_RE.test("l:abc_12"));
  assert.ok(!THREAD_RE.test("x:abc"));
  assert.ok(!THREAD_RE.test("l:../etc"));
});

test("xabar qo'shish, ro'yxat tartibi, fayl va tizim qatori", () => {
  const db = new Database(":memory:");
  const s = createTeamStore({ db });
  s.add("l:a", { authorId: "u1", author: "Aziza", text: "salom", at: "2026-10-30T10:00:00Z" });
  s.add("l:a", { kind: "sys", author: "Tizim", text: "vazifa berildi", at: "2026-10-30T09:00:00Z" });
  s.add("l:a", { authorId: "u2", author: "Kamola", file: { url: "/api/photos/x.cdr", name: "m.cdr", size: 10 }, at: "2026-10-30T11:00:00Z" });
  s.add("l:b", { authorId: "u1", author: "Aziza", text: "boshqa" });
  const l = s.list("l:a");
  assert.deepEqual(l.map((m) => m.kind), ["sys", "msg", "msg"]);
  assert.equal(l[2].file.name, "m.cdr");
  const st = s.stats();
  assert.equal(st["l:a"].n, 2, "tizim qatori sanalmaydi");
  assert.equal(st["l:b"].n, 1);
});

test("o'qilmaganlar: o'zining xabari sanalmaydi", () => {
  const db = new Database(":memory:");
  const s = createTeamStore({ db });
  s.add("l:a", { authorId: "u1", text: "1", at: "2026-10-30T10:00:00Z" });
  s.add("l:a", { authorId: "u2", text: "2", at: "2026-10-30T10:05:00Z" });
  s.add("l:a", { authorId: "u2", text: "3", at: "2026-10-30T10:06:00Z" });
  assert.equal(s.unread("l:a", "2026-10-30T10:01:00Z", "u1"), 2);
  assert.equal(s.unread("l:a", "2026-10-30T10:01:00Z", "u2"), 0);
});
