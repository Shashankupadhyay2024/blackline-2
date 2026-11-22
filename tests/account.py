"""Cloud save across two fresh browsers against a local server: python3 tests/account.py [base_url]"""
import asyncio, sys, random
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:10888/'
NAME = 'Tester%d' % random.randint(1000, 9999)
async def page(b, errs):
    ctx = await b.new_context(viewport={"width": 960, "height": 600}); pg = await ctx.new_page(); pg.set_default_timeout(240000)
    await pg.add_init_script("localStorage.setItem('blackline_settings', JSON.stringify({quality:'low',shadows:false,effects:'low',aa:false,sens:1,fov:78,vol:0.8,music:0.5,invertY:false}));")
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.goto(BASE); await pg.wait_for_function("window.__BL && window.__BL.state==='menu'"); return pg
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        A = await page(b, errs)
        await A.evaluate("localStorage.setItem('blackline_zm_best','9'); localStorage.setItem('blackline_mp_stats', JSON.stringify({kills:31,deaths:4,wins:2}))")
        await A.click('#btn-profile')
        await A.fill('#pf-name', NAME); await A.fill('#pf-pass', 'secret123'); await A.click('#pf-new')
        await A.wait_for_function("document.getElementById('acct-status') && /created/.test(document.getElementById('acct-status').textContent)")
        await A.wait_for_timeout(1500); await A.screenshot(path='/tmp/profile.png')
        print('A:', await A.evaluate("document.querySelector('.pf-s').innerText"))
        await A.evaluate("localStorage.setItem('blackline_br_wins','3'); Account.markDirty()"); await A.wait_for_timeout(4000)
        B = await page(b, errs)
        print('B before:', await B.evaluate("localStorage.getItem('blackline_zm_best')"))
        await B.click('#btn-profile'); await B.fill('#pf-name', NAME.lower()); await B.fill('#pf-pass', 'secret123')
        await B.click('#pf-in'); await B.wait_for_load_state('load'); await B.wait_for_function("window.__BL && window.__BL.state==='menu'")
        print('B after:', await B.evaluate("[localStorage.getItem('blackline_zm_best'), localStorage.getItem('blackline_br_wins'), localStorage.getItem('blackline_mp_stats'), JSON.parse(localStorage.getItem('blackline_acct')).name].join(' | ')"))
        await b.close()
    print('ERRORS', len(errs)); [print('  ', e[:200]) for e in errs[:8]]
asyncio.run(main())
