#!/usr/bin/env python3
"""Bundle BLACKLINE into one offline HTML file: dist/index.html (+ docs/index.html for GitHub Pages)
Usage:  python3 build.py
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
ORDER = ["voicepack.js", "core.js", "post.js", "input.js", "fx.js", "audio2.js", "voice.js", "models.js", "charpack.js", "chars.js", "world.js", "builders.js", "entities.js", "entities2.js", "player.js", "guns2.js", "hud.js", "mission.js", "story.js",
         "m1.js", "f1.js", "m2.js", "m3.js", "f2.js", "m3b.js", "m4.js", "f3.js", "m5.js", "range.js", "monsters.js", "zombies.js", "br.js", "horror.js", "net.js", "main.js"]

three = (ROOT / "vendor" / "three.min.js").read_text(encoding="utf-8")
game = "\n".join(f"/* ---- {n} ---- */\n" + (SRC / n).read_text(encoding="utf-8") for n in ORDER)
html = (SRC / "index.template.html").read_text(encoding="utf-8")
html = html.replace("<!--THREE-->", "<script>\n" + three + "\n</script>")
html = html.replace("<!--GAME-->", "<script>\n(function(){\n" + game + "\n})();\n</script>")
out = ROOT / "dist" / "index.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf-8")
# GitHub Pages serves the playable build from docs/
(ROOT / "docs").mkdir(exist_ok=True); (ROOT / "docs" / "index.html").write_text(html, encoding="utf-8")
(ROOT / "dist" / "game.bundle.js").write_text("(function(){\n" + game + "\n})();\n", encoding="utf-8")
import shutil
if (ROOT / "assets_out").exists():
    shutil.rmtree(ROOT / "dist" / "assets", ignore_errors=True); (ROOT / "dist" / "assets").mkdir()
    for f in (ROOT / "assets_out").glob("*.js"): shutil.copy(f, ROOT / "dist" / "assets" / f.name)
# GitHub Pages and the Render server both serve docs/
for d in ("docs",):
    (ROOT / d).mkdir(exist_ok=True); (ROOT / d / "index.html").write_text(html, encoding="utf-8")
    if (ROOT / "assets_out").exists():   # packed characters (tools/pack_chars.py); a fresh clone keeps the committed docs/assets
        shutil.rmtree(ROOT / d / "assets", ignore_errors=True); shutil.copytree(ROOT / "dist" / "assets", ROOT / d / "assets")
print(f"Built {out}  ({out.stat().st_size/1024:.0f} KB)")
