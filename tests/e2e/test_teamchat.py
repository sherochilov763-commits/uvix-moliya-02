# Jamoa «Muhokama» chati va sodda dizayn vazifasi (127/128-eskiz):
# Bitrix24 kabi vazifa oynasi (nima · beruvchi · ijrochi ro'yxati · muddat · kuzatuvchilar), lid panelida «Muhokama» tabi,
# fayl, tizim qatori, xodim ilovasida «Muhokama» qatori va to'liq ekran chat, kuzatuvchi, huquqlar.
import asyncio, datetime, json, os, tempfile
from common import *  # noqa: F401,F403

NOW = datetime.datetime.now(datetime.timezone.utc)
iso = lambda dt: dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
TH = "l:tc_l1"

def tok_of(name, pin):
    eid = [e for e in api("/api/auth/employees")["employees"] if e["name"] == name][0]["id"]
    return api("/api/auth/login", {"employeeId": eid, "pin": pin})["token"]

async def main():
    adm = admin_token()
    leads = json.loads(api("/api/kv/uvix:leads", token=adm)["value"])
    leads.append({"id": "tc_l1", "customer": "Muhokama Mijoz", "jobTitle": "Shisha fartuk", "line": "UVIXPRINT", "stage": "negotiation", "deadline": (NOW + datetime.timedelta(days=5)).strftime("%Y-%m-%d"),
                  "createdAt": iso(NOW - datetime.timedelta(hours=3)), "createdBy": "Administrator", "manager": "Administrator"})
    dbset("uvix:leads", leads)
    kam, jas, azi = tok_of("Kamola Sharipova", "1111"), tok_of("Jasur Aliyev", "2222"), tok_of("Aziza Karimova", "1234")
    ok("dizayner — vazifasi yo'q muhokamaga kira olmaydi (403)", api(f"/api/team-chat/{TH}", token=kam).get("_code") == 403)
    ok("noto'g'ri mavzu — 400", api("/api/team-chat/x:1", token=adm).get("_code") == 400)
    ok("yo'q lid — 404", api("/api/team-chat/l:yoq", token=adm).get("_code") == 404)
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        d = await (await b.new_context(viewport={"width": 1440, "height": 900}, timezone_id="Asia/Tashkent")).new_page(); d.on("pageerror", lambda e: errs.append(str(e)))
        await dlogin(d, "Administrator", "0000")
        await nav(d, "CRM"); await d.wait_for_timeout(1200)
        await d.locator("[data-lead=tc_l1]").first.click(); await d.wait_for_timeout(800)
        ok("lid panelida «Ma'lumot · Muhokama» tablari", await d.locator("[data-testid=lead-panel-tabs] [data-tab=team]").count() == 1)
        await d.locator("[data-testid=lead-panel-stage]").select_option("design"); await d.wait_for_timeout(900)
        f = d.locator("[data-testid=design-task-form]")
        ok("sodda oyna: format/fayl turi maydonlari yo'q", await f.count() == 1 and await f.locator("input[list=uvix-filetypes]").count() == 0 and "Format / o'lcham" not in await f.inner_text())
        ok("topshiriq beruvchi — o'zi", "Administrator" in await d.locator("[data-testid=task-by]").inner_text())
        ok("ijrochi — yagona dizayner o'zi tanlangan", "Kamola" in await d.locator("[data-testid=task-who]").inner_text())
        ok("mijozga va'da muddati ko'rinadi", "mijozga va'da" in await f.inner_text())
        await d.locator("[data-testid=task-who]").click(); await d.wait_for_timeout(200)
        ok("ijrochi ro'yxati: hamma xodimlar, qidiruv", await d.locator("[data-testid=pick-who] [data-person]").count() >= 4)
        await d.locator("[data-testid=pick-who] input").fill("kam"); await d.wait_for_timeout(150)
        ok("qidiruv ishlaydi", await d.locator("[data-testid=pick-who] [data-person]").count() == 1)
        await d.locator("[data-testid=pick-who] [data-person=kamola]").click(); await d.wait_for_timeout(150)
        await d.locator("[data-testid=task-notes]").fill("Oq, matoviy. Logotip burchakda")
        await d.locator("[data-testid=add-watchers]").click(); await d.wait_for_timeout(150)
        await d.locator("[data-testid=pick-watch] [data-person=jasur]").click(); await d.wait_for_timeout(150)
        await d.locator("[data-testid=add-watchers]").click(); await d.wait_for_timeout(150)
        ok("kuzatuvchi tanlandi", "Jasur" in await d.locator("[data-testid=task-watchers]").inner_text())
        await d.screenshot(path=OUT + "teamchat_form.png")
        await d.locator("[data-testid=task-submit]").click(); await d.wait_for_timeout(1500)
        L = [l for l in json.loads(api("/api/kv/uvix:leads", token=adm)["value"]) if l["id"] == "tc_l1"][0]
        ok("lidda: ijrochi, kuzatuvchi, beruvchi, izoh", L["design"]["assigneeId"] == "kamola" and L["design"]["watchers"] == ["jasur"] and L["design"]["assignedBy"] == "Administrator" and "matoviy" in L["design"]["notes"], L.get("design"))
        await d.locator("[data-testid=lead-panel-tabs] [data-tab=team]").click(); await d.wait_for_timeout(1200)
        room = d.locator("[data-testid=lead-panel]")
        ok("131-B: o'rtada jamoa chati, o'ngda vazifa", await room.locator("[data-testid=team-chat]").count() == 1 and await room.locator("[data-testid=lead-panel-side] [data-room-task=design]").count() == 1)
        lt = await room.locator("[data-room-task=design]").inner_text()
        ok("vazifa: ijrochi, beruvchi, izoh, mijozga va'da", "Kamola" in lt and "Administrator" in lt and "matoviy" in lt and "mijozga va'da" in lt, lt[:200])
        ok("admin uchun «Tahrirlash»", await room.locator("[data-testid=room-edit-design]").count() == 1)
        ok("muhokamada tizim qatori: kim, kimga", await d.locator("[data-team-sys]").count() >= 1 and "Kamola" in await d.locator("[data-team-sys]").first.inner_text())
        await d.locator("[data-testid=team-chat-input]").fill("O'lcham 3000×600 mm"); await d.locator("[data-testid=team-chat-send]").click(); await d.wait_for_timeout(900)
        fp = os.path.join(tempfile.mkdtemp(), "maket.cdr"); open(fp, "wb").write(b"CDR" * 100)
        await d.locator("[data-testid=team-chat-file]").set_input_files(fp); await d.wait_for_timeout(1300)
        ok("xabar va fayl yuborildi", await d.locator("[data-team-msg=out]").count() == 2 and await d.locator("[data-team-file]").count() == 1)
        href = await d.locator("[data-team-file]").get_attribute("href")
        ok("fayl yuklab olinadi (asl nomi bilan)", "dl=1" in href and "maket.cdr" in href)
        ok("FAYLLAR ro'yxatida CDR", "maket.cdr" in await room.locator("[data-testid=room-files]").inner_text())
        await d.screenshot(path=OUT + "teamchat_panel.png")
        await d.locator("[data-testid=lead-panel-tabs] [data-tab=tg]").click(); await d.wait_for_timeout(300)
        ok("Telegram tabi (lid ulanmagan — xabar)", "ulanmagan" in await room.inner_text())
        await d.locator("[data-testid=lead-panel-tabs] [data-tab=hist]").click(); await d.wait_for_timeout(300)
        ok("Tarix tabi: bosqich o'zgarishi", "bosqich" in await room.locator("[data-testid=lead-panel-history]").inner_text())
        await d.keyboard.press("Escape"); await d.wait_for_timeout(500)
        ok("Esc — panel pastga tushib yopiladi", await room.count() == 0)
        # Huquqlar va o'qilmaganlar (API)
        r = api(f"/api/team-chat/{TH}", token=kam)
        ok("dizayner endi ko'radi (ijrochi)", r.get("_code") is None and len(r["messages"]) >= 3)
        ok("kuzatuvchi ko'radi", api(f"/api/team-chat/{TH}", token=jas).get("_code") is None)
        ok("operator (menejer) ko'radi", api(f"/api/team-chat/{TH}", token=azi).get("_code") is None)
        s = api(f"/api/team-chat/{TH}", {"text": "tizim emas", "sys": True}, token=kam)
        ok("xodim tizim qatorini soxtalay olmaydi", s["message"]["kind"] == "msg")
        st = api(f"/api/team-chat?threads={TH}", token=azi)["threads"][TH]
        ok("o'qilmaganlar soni (operator o'qigan, keyin dizayner yozdi)", st["unread"] == 1 and st["n"] == 3, st)
        ok("kalit ichki: KV orqali o'qilmaydi", api("/api/kv/uvix:teamReads", token=adm).get("_code") == 403)
        # Telefon: dizayner ilovasi
        m = await (await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, timezone_id="Asia/Tashkent")).new_page(); m.on("pageerror", lambda e: errs.append("M:" + str(e)))
        await mob_login(m, "Kamola", "1111"); await m.wait_for_timeout(2500)
        card = m.locator("[data-testid=task-team]").first
        ok("vazifa kartasida «Muhokama» qatori", await card.count() >= 1)
        await m.locator("text=Yangi").first.click(); await m.wait_for_timeout(500)
        row = m.locator("[data-testid=task-team]").first
        await row.click(); await m.wait_for_timeout(1500)
        ok("to'liq ekran muhokama ochildi", await m.locator("[data-testid=team-chat]").count() == 1 and await m.locator("[data-team-msg]").count() >= 3)
        await m.locator("[data-testid=room-summary] button").first.click(); await m.wait_for_timeout(400)
        ok("telefon: tepada vazifa (bosilsa ochiladi) + «Boshlash»", await m.locator("[data-room-task=design]").count() == 1 and await m.locator("[data-testid=room-start]").count() == 1)
        await m.screenshot(path=OUT + "teamchat_phone_task.png")
        await m.locator("[data-testid=room-summary] button").first.click(); await m.wait_for_timeout(300)
        await m.locator("[data-testid=team-chat-input]").fill("Ertaga tayyor"); await m.locator("[data-testid=team-chat-send]").click(); await m.wait_for_timeout(900)
        ok("dizayner yozdi", await m.locator("[data-team-msg=out]").count() >= 2)
        await m.screenshot(path=OUT + "teamchat_phone.png")
        # Kuzatuvchi (pechatchi): vazifani ko'radi, holatini o'zgartira olmaydi
        j = await (await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, timezone_id="Asia/Tashkent")).new_page(); j.on("pageerror", lambda e: errs.append("J:" + str(e)))
        await mob_login(j, "Jasur", "2222"); await j.wait_for_timeout(2500)
        await j.locator("text=Yangi").first.click(); await j.wait_for_timeout(500)
        ok("kuzatuvchi: «Kuzatuvchi» belgisi", await j.locator("[data-testid=task-watching]").count() >= 1)
        tasks = api("/api/tasks", token=jas)["tasks"]
        wt = [t for t in tasks if t.get("leadId") == "tc_l1"]
        ok("kuzatuvchi vazifani oladi (watching)", len(wt) == 1 and wt[0].get("watching") is True and wt[0]["thread"] == TH)
        ok("kuzatuvchi holatni o'zgartira olmaydi", api("/api/tasks/tc_l1/design/status", {"status": "in_progress"}, token=jas).get("_code") == 403)
        # Holat o'zgarsa — muhokamaga tizim qatori
        api("/api/tasks/tc_l1/design/status", {"status": "in_progress"}, token=kam)
        msgs = api(f"/api/team-chat/{TH}", token=adm)["messages"]
        ok("holat o'zgarishi muhokamada", any(x["kind"] == "sys" and "jarayonda" in x["text"] for x in msgs))
        await b.close()
    ok("JS xatolar yo'q", not errs, errs[:3])
    finish()

asyncio.run(main())
