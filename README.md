# BLACKLINE 2

**One world. Five ways to survive it.** BLACKLINE 2 is a first-person shooter with five modes in one app: a story campaign, battle royale, online multiplayer, zombies, and a horror mode. It runs as a Mac app or straight in the browser.

## Install

**Mac app, one command** (Apple Silicon or Intel). Paste this into Terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/Shashankupadhyay2024/blackline-2/main/install.sh | bash
```

It downloads the latest release, builds **BLACKLINE 2.app** in your Applications folder, and opens it. Run the same command again to update.

**Browser:** https://Shashankupadhyay2024.github.io/blackline-2/ (desktop Chrome or Edge, keyboard and mouse or a controller)

## Modes

| Mode | Status |
|---|---|
| **Campaign:** the story continues after *Last Hour* (all 10 Part One chapters are included) | Part One playable · Part Two in production |
| **Battle Royale:** drop in, loot, shrinking zone, last one standing | In production |
| **Multiplayer:** online matches with anyone who has the game, via room codes or the public lobby | Lobby server live · matches in production |
| **Zombies:** wave survival | In production |
| **Horror:** you will not want to play it with the lights off | In production |
| **Firing range:** every weapon, lanes from 10 to 200 m, and a kill house | Playable |

## What's new in 2

- **Real human characters:** motion-captured soldiers, civilians, zombies and creatures (Mixamo), with blended walk, run, crouch, reload and hit animations and real death animations
- **13 weapons**, including a revolver, a burst rifle, a DMR, an LMG, an auto-shotgun and an arc gun that chains lightning between enemies, all with worn metal finishes, working bolts and pumps, and real optics
- **New sound engine:** layered gunshots, room reverb, distance and echo, footsteps, and a music score that reacts to the fight
- **New menus** built around the five modes

## Online play (Render)

The multiplayer lobby and a copy of the browser game run from one small Node server (`server/server.js`).

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Shashankupadhyay2024/blackline-2)

Click the button, sign in to Render, and press **Apply**. The free plan works. `render.yaml` sets everything up: `npm install`, `node server/server.js`, health check at `/health`.

Run it locally:

```bash
npm install && npm start    # http://localhost:10000
```

## Build from source

```bash
python3 build.py              # bundles src/ into docs/index.html (+ docs/assets)
bash mac/build-mac-app.sh     # on a Mac: builds mac/out/BLACKLINE 2.app
python3 tests/smoke.py        # headless playthrough of every campaign chapter
```

Characters are converted from Mixamo FBX with `tools/fbx/convert.py` and packed with `python3 tools/pack_chars.py mixamo <converted dir> assets_out`.

## Controls

WASD move · Mouse aim · Left click fire · Right click aim down sights · R reload · Shift sprint · C crouch · G grenade · F melee · E interact · 1–9 weapons · Esc pause. Xbox and PlayStation controllers work too.

---

Built with Three.js and Electron. Characters and animations from Adobe Mixamo.
