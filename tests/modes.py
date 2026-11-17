"""Boot every BLACKLINE 2 mode through the real menu flow and play a little: python3 tests/modes.py"""
import asyncio, pathlib
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / "dist" / "index.html").as_uri()
async def run(b, mode, check, secs):
    errs = []
    pg = await b.new_page(viewport={"width": 800, "height": 450}); pg.set_default_timeout(240000)
    await pg.add_init_script("localStorage.setItem('blackline_settings', JSON.stringify({quality:'low',shadows:false,effects:'low',aa:false,sens:1,fov:78,vol:0.8,music:0.5,invertY:false}));")
    pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.goto(URL); await pg.wait_for_function("window.__BL && window.__BL.state==='menu'")
    await pg.evaluate(f"document.getElementById('mode-{mode}').click()")
    await pg.wait_for_function("window.__BL && (window.__BL.state==='begin' || window.__BL.state==='menu') && location.search.includes('m=')")
    if mode == 'mp':
        await pg.evaluate("document.getElementById('mp-practice').click()")
    else:
        await pg.evaluate("document.getElementById('begin').click()")
        await pg.wait_for_function("window.__BL.state==='intro' || window.__BL.state==='play' || window.__BL.state==='pause'")
        await pg.evaluate("__BL.sim(8)")
    await pg.evaluate("__BL.play()")
    await pg.evaluate(f"__BL.sim({secs})")
    r = await pg.evaluate(check)
    await pg.screenshot(path=f'/tmp/mode_{mode}.png')
    print(('FAIL' if errs else 'PASS'), mode, '|', r); [print('   ', e[:300]) for e in errs[:6]]
    await pg.close(); return len(errs)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        n = 0
        n += await run(b, 'zombies', "'round '+document.getElementById('zm-round').textContent+' · '+document.getElementById('obj-sub').textContent+' · hp '+__BL.player.hp.toFixed(0)", 25)
        n += await run(b, 'br', "'alive '+document.getElementById('br-alive').textContent+' · y '+__BL.player.pos.y.toFixed(0)+' · '+document.getElementById('obj-sub').textContent", 30)
        n += await run(b, 'horror', "document.getElementById('obj-text').textContent+' · '+document.getElementById('obj-sub').textContent+' · enemies '+__BL.enemies().length", 15)
        n += await run(b, 'mp', "document.getElementById('mp-score').innerText.replace(/\\n/g,' | ')+' · bots '+__BL.enemies().length", 15)
        await b.close()
    print('modes with errors:', n)
asyncio.run(main())
