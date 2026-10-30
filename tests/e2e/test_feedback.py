# «💡 Taklif» (120-eskiz): sarlavhadagi tugma → oyna (joy o'zi, ekran rasmi, ovoz), Sozlamalar → «Takliflar»,
# holat/versiya, «Claude uchun nusxa», faqat rahbar; telefonda pastdan varaq.
import asyncio, datetime, json, os
from common import *  # noqa: F401,F403

UP = os.path.join(os.path.dirname(DB), "uploads")
PHONE = dict(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, timezone_id="Asia/Tashkent")


def seed():
    now = datetime.datetime.now(datetime.timezone.utc)
    iso = lambda **kw: (now - datetime.timedelta(**kw)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    dbset("uvix:telegramMessages", {"777001": [{"id": "m1", "tgId": 1, "text": "Salom", "out": False, "date": iso(hours=1)}]})
    dbset("uvix:telegramContacts", {"777001": {"name": "Malika Interior", "username": "malika_int"}})


async def main():
    seed()
    tok = admin_token()
    errs = []
    az = api("/api/auth/login", {"employeeId": "aziza", "pin": "1234"})["token"]
    ok("operator: ro'yxat ham, yozish ham yo'q (403)", api("/api/feedback", token=az).get("_code") == 403 and api("/api/feedback", {"text": "x"}, az).get("_code") == 403)
    ok("ichki kalit — KV orqali ochiq emas", api("/api/kv/uvix:feedback", token=tok).get("_code") in (403, 404))
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
        ctx = await b.new_context(viewport={"width": 1440, "height": 900}, timezone_id="Asia/Tashkent", permissions=["clipboard-read", "clipboard-write", "microphone"])
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await dlogin(pg, "Administrator", "0000")
        # ---------- Buyurtmalar: kamchilik, muhim, ekran rasmi bilan ----------
        await nav(pg, "Buyurtmalar"); await pg.wait_for_timeout(800)
        btn = pg.locator("[data-testid=fb-btn]")
        ok("sarlavhada «💡 Taklif» tugmasi", await btn.is_visible() and "Taklif" in await btn.inner_text())
        await btn.click(); await pg.wait_for_timeout(400)
        dlg = pg.locator("[data-testid=fb-dialog]")
        ok("oyna: joy o'zi — «Buyurtmalar», turi standart «Kamchilik»", await dlg.is_visible() and "Buyurtmalar" in await pg.locator("[data-testid=fb-ctx]").inner_text() and await pg.locator("[data-testid=fb-type-kamchilik][aria-pressed=true]").count() == 1)
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)
        ok("Esc — yopiladi, hech narsa saqlanmaydi", await dlg.count() == 0 and api("/api/feedback", token=tok)["items"] == [])
        await btn.click(); await pg.wait_for_timeout(300)
        await pg.locator("[data-testid=fb-text]").fill("To'lov qo'shganda qarz darhol yangilanmayapti")
        await pg.locator("[data-testid=fb-prio-muhim]").click()
        for _ in range(40):
            if "olinmoqda" not in await dlg.inner_text(): break
            await pg.wait_for_timeout(250)
        ok("ekran rasmi olindi", "olib bo'lmadi" not in await dlg.inner_text() and await pg.locator("[data-testid=fb-shot]").is_checked())
        await pg.wait_for_timeout(600); await pg.screenshot(path=S + "fb_dialog.png")
        ok("muhimlik tugmasi «Muhim» tanlangan", await pg.locator("[data-testid=fb-prio-muhim][aria-pressed=true]").count() == 1 and await pg.locator("[data-testid=fb-prio-oddiy][aria-pressed=false]").count() == 1)
        # ovoz: AI kaliti yo'q — tushunarli xato
        await pg.locator("[data-testid=fb-mic]").click(); await pg.wait_for_timeout(1200)
        await pg.locator("[data-testid=fb-mic]").click(); await pg.wait_for_timeout(1500)
        ok("ovoz: AI kaliti yo'q — tushunarli xato, matn saqlanib turadi", "AI kaliti" in await dlg.inner_text() and "qarz darhol" in await pg.locator("[data-testid=fb-text]").input_value(), (await dlg.inner_text())[-200:])
        await pg.locator("[data-testid=fb-text]").press("Control+Enter"); await pg.wait_for_timeout(1200)
        ok("Ctrl+Enter — saqlandi: «#1 saqlandi»", "#1 saqlandi" in await pg.locator("[data-testid=fb-toast]").inner_text() and await dlg.count() == 0)
        it = api("/api/feedback", token=tok)["items"][0]
        ok("serverda: kamchilik, muhim, joy, kompyuter", (it["type"], it["prio"], it["ctx"]["label"], it["ctx"]["device"]) == ("kamchilik", "muhim", "Buyurtmalar", "kompyuter"), it)
        ok("ekran rasmi faylda (JPEG), oyna rasmga tushmagan", it["shot"] and os.path.exists(os.path.join(UP, it["shot"])) and os.path.getsize(os.path.join(UP, it["shot"])) > 5000)
        # ---------- Chatlar: ochiq chat nomi joyga yoziladi ----------
        await nav(pg, "Chatlar"); await pg.wait_for_timeout(1200)
        await pg.locator("[data-chat='777001']").click(); await pg.wait_for_timeout(1200)
        await btn.click(); await pg.wait_for_timeout(300)
        ok("chatda: joy — «Chatlar → Chat: Malika Interior»", "Chat: Malika Interior" in await pg.locator("[data-testid=fb-ctx]").inner_text())
        await pg.locator("[data-testid=fb-type-taklif]").click()
        await pg.locator("[data-testid=fb-shot]").uncheck()
        await pg.locator("[data-testid=fb-text]").fill("Chat ro'yxatida mijoz qarzi ham ko'rinsin")
        await pg.locator("[data-testid=fb-save]").click(); await pg.wait_for_timeout(1000)
        it2 = api("/api/feedback", token=tok)["items"][0]
        ok("ikkinchisi: taklif, rasmsiz, joyida chat", it2["n"] == 2 and it2["type"] == "taklif" and it2["shot"] is None and "Malika" in it2["ctx"]["record"], it2)
        # ---------- Sozlamalar → Takliflar ----------
        await nav(pg, "Sozlamalar"); await pg.locator("[data-section=takliflar]").click(); await pg.wait_for_timeout(1000)
        card = pg.locator("[data-testid=feedback-list]")
        ok("ro'yxat: 2 ta, muhimi tepada", await card.locator("[data-fb-item]").count() == 2 and await card.locator("[data-fb-item]").first.get_attribute("data-fb-item") == "1")
        ok("ekran rasmi havolasi bor (faqat #1 da)", await card.locator("[data-fb-item='1'] [data-testid=fb-shot-link]").count() == 1 and await card.locator("[data-fb-item='2'] [data-testid=fb-shot-link]").count() == 0)
        await card.locator("[data-testid=fb-copy]").click(); await pg.wait_for_timeout(500)
        clip = await pg.evaluate("navigator.clipboard.readText()")
        ok("«Claude uchun nusxa»: sarlavha + #1 [Kamchilik · Muhim] Buyurtmalar: … + #2 [Taklif]", clip.startswith("UVIX takliflar ·") and "2 ta ochiq" in clip and "#1 [Kamchilik · Muhim] Buyurtmalar: To'lov qo'shganda" in clip and "#2 [Taklif] Chatlar → Chat: Malika Interior:" in clip, clip)
        await card.locator("[data-fb-item='1'] [data-testid=fb-status]").select_option("bajarildi"); await pg.wait_for_timeout(700)
        await card.locator("[data-fb-item='1'] [data-testid=fb-fixed]").fill("a1b2c3d"); await card.locator("[data-fb-item='1'] [data-testid=fb-fixed]").blur(); await pg.wait_for_timeout(700)
        i1 = [x for x in api("/api/feedback", token=tok)["items"] if x["n"] == 1][0]
        ok("holat «Bajarildi» va versiya — serverda", i1["status"] == "bajarildi" and i1["fixedIn"] == "a1b2c3d", i1)
        await card.locator("[data-fb-st=ochiq]").click(); await pg.wait_for_timeout(300)
        ok("«Ochiq» filtri: faqat #2", await card.locator("[data-fb-item]").count() == 1)
        await pg.screenshot(path=S + "fb_list.png")
        await card.locator("[data-fb-item='2'] [data-testid=fb-del]").click()
        await card.locator("[data-fb-item='2'] [data-testid=fb-del-yes]").click(); await pg.wait_for_timeout(600)
        ok("o'chirish — ikki bosishda", len(api("/api/feedback", token=tok)["items"]) == 1)
        # ---------- operator: tugma yo'q ----------
        o = await (await b.new_context(viewport={"width": 1280, "height": 860}, timezone_id="Asia/Tashkent")).new_page(); o.on("pageerror", lambda e: errs.append("O:" + str(e)))
        await dlogin(o, "Aziza", "1234")
        ok("operatorda «💡 Taklif» yo'q", await o.locator("[data-testid=fb-btn]").count() == 0)
        # ---------- telefon: pastdan varaq ----------
        m = await (await b.new_context(**PHONE)).new_page(); m.on("pageerror", lambda e: errs.append("M:" + str(e)))
        await mob_login(m, "Administrator", "0000"); await m.wait_for_selector(".uvix-bottomnav", timeout=15000); await m.wait_for_timeout(1200)
        ok("telefon: sarlavhada 💡 yo'q (sarlavha tiqilmaydi)", not await m.locator("[data-testid=fb-btn]").is_visible())
        await m.locator("[data-testid=header-plus]").click(); await m.wait_for_timeout(400)
        await m.locator("[data-add=feedback]").click(); await m.wait_for_timeout(600)
        ok("telefon: «+» → «Kamchilik yoki taklif» → pastdan varaq", await m.locator(".uvix-fbsheet[data-testid=fb-dialog]").is_visible())
        await m.screenshot(path=S + "fb_mobile.png")
        ok("JS xatolari yo'q", not errs, errs)
        await b.close()
    finish()

asyncio.run(main())
