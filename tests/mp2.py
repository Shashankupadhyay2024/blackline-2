"""Two-client multiplayer test against a local server: python3 tests/mp2.py"""
import asyncio, subprocess, time, os
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
async def main():
    srv = subprocess.Popen(['node', 'server/server.js'], cwd=ROOT, env=dict(os.environ, PORT='10777'))
    time.sleep(1.2); errs = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
            pages = []
            for i in range(2):
                pg = await b.new_page(viewport={"width": 640, "height": 360}); pg.set_default_timeout(240000)
                await pg.add_init_script("localStorage.setItem('blackline_settings', JSON.stringify({quality:'low',shadows:false,effects:'low',aa:false,sens:1,fov:78,vol:0.8,music:0.5,invertY:false}));")
                pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == 'error' else None)
                await pg.goto('http://localhost:10777/?m=mp&start=1'); await pg.wait_for_function("window.__BL && window.__BL.state==='menu'"); pages.append(pg)
            A, B = pages
            await A.evaluate("document.getElementById('mp-name').value='Alpha'; document.getElementById('mp-name').onchange(); document.getElementById('mp-host').click()")
            await A.wait_for_function("window.__BL.state==='play' || window.__BL.state==='pause'")
            code = await A.evaluate("document.getElementById('mp-room').textContent.split(' ').pop()")
            print('room', code)
            await B.evaluate(f"document.getElementById('mp-code').value='{code}'; document.getElementById('mp-join').click()")
            await B.wait_for_function("window.__BL.state==='play' || window.__BL.state==='pause'")
            for pg in pages: await pg.evaluate("__BL.play()")
            # put them face to face 8 m apart
            await A.evaluate("__BL.tp(0,-4); __BL.look(Math.PI,0)")   # facing +z
            await B.evaluate("__BL.tp(0,4); __BL.look(0,0)")
            for _ in range(10):
                for pg in pages: await pg.evaluate("__BL.sim(0.1)")
                await asyncio.sleep(0.05)
            print('A sees', await A.evaluate("__BL.enemies().filter(e=>e.isRemote).map(e=>e.pos.toArray().map(v=>v.toFixed(1)).join(',')).join(' ')"))
            print('B sees', await B.evaluate("__BL.enemies().filter(e=>e.isRemote).map(e=>e.pos.toArray().map(v=>v.toFixed(1)).join(',')).join(' ')"))
            # A shoots B
            for _ in range(25):
                await A.evaluate("__BL.look(Math.PI,-0.02); __BL.fire(); __BL.sim(0.15)")
                await B.evaluate("__BL.sim(0.15)")
                await asyncio.sleep(0.03)
            print('B hp', await B.evaluate("__BL.player.hp.toFixed(0)+' alive='+__BL.player.alive"))
            for _ in range(5):
                for pg in pages: await pg.evaluate("__BL.sim(0.5)")
                await asyncio.sleep(0.05)
            print('A score', await A.evaluate("document.getElementById('mp-score').innerText.replace(/\\n/g,' | ')"))
            print('B score', await B.evaluate("document.getElementById('mp-score').innerText.replace(/\\n/g,' | ')"))
            await A.screenshot(path='/tmp/mpA.png')
            await b.close()
    finally:
        srv.terminate()
    print('ERRORS', len(errs)); [print('  ', e[:300]) for e in errs[:10]]
asyncio.run(main())
