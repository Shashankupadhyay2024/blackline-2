"""Convert Mixamo FBX files to GLB (characters) / clip JSON (animations) with three.js in headless Chromium.
Usage: python3 convert.py jobs.json outdir    (jobs: [{"kind":"char"|"anim","key":..,"file":path}])"""
import asyncio, json, sys, base64, pathlib, shutil, os, subprocess, time
from playwright.async_api import async_playwright
HERE = pathlib.Path(__file__).resolve().parent
async def main(jobs, out):
    out.mkdir(parents=True, exist_ok=True); inbox = HERE / "inbox"; inbox.mkdir(exist_ok=True)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8833", "--directory", str(HERE)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--allow-file-access-from-files"])
        pg = await b.new_page(); pg.set_default_timeout(300000)
        pg.on("console", lambda m: print("  console:", m.text[:200]) if m.type == "error" else None)
        await pg.goto("http://localhost:8833/convert.html"); await pg.wait_for_function("window.ready")
        for j in jobs:
            src = pathlib.Path(j["file"]); dst = inbox / (j["key"] + ".fbx"); shutil.copy(src, dst)
            try:
                r = json.loads(await pg.evaluate("j => convert(j)", {"kind": j["kind"], "key": j["key"], "url": "http://localhost:8833/inbox/" + dst.name}))
            except Exception as e:
                print("FAIL", j["key"], str(e)[:200]); continue
            if j["kind"] == "anim":
                (out / (j["key"] + ".json")).write_text(json.dumps(r)); print("anim", j["key"], round(r["dur"], 2), "s", len(r["tracks"]), "tracks")
            else:
                (out / (j["key"] + ".glb")).write_bytes(base64.b64decode(r["glb"])); print("char", j["key"], r["info"])
            dst.unlink()
        await b.close()
    srv.terminate()
asyncio.run(main(json.loads(pathlib.Path(sys.argv[1]).read_text()), pathlib.Path(sys.argv[2])))
