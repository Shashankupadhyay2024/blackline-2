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

| Mode | What it is |
|---|---|
| **Campaign** | The story. All 10 chapters of *Last Hour* (Part Two is in production) |
| **Battle Royale** | *Kestrel Valley.* Skydive in with 23 others, loot seven towns, stay inside the shrinking zone, be the last one standing |
| **Multiplayer** | *The Yard.* Online free-for-all, first to 20. Quick match, private room codes, or offline practice against bots |
| **Zombies** | *Dead End.* Endless rounds in a walled town square. Earn points, buy guns off the walls, open the diner, gamble on the mystery box |
| **Horror** | *Ward 9.* A dead hospital, one flashlight, four fuses. Something tall hunts by light and sound, and the mannequins move when you look away |
| **Firing range** | Every weapon, lanes from 10 to 200 m, and a kill house |

## What's new in 2

- **Real human characters:** motion-captured soldiers, civilians, zombies and creatures (Mixamo), with blended walk, run, crouch, reload and hit animations and real death animations
- **13 weapons**, including a revolver, a burst rifle, a DMR, an LMG, an auto-shotgun and an arc gun that chains lightning between enemies, all with worn metal finishes, working bolts and pumps, and real optics
- **New sound engine:** layered gunshots, room reverb, distance and echo, footsteps, and a music score that reacts to the fight
- **New menus** built around the five modes

## Online play (Render)

The multiplayer lobby and a copy of the browser game run from one small Node server (`server/server.js`). The game connects to `wss://blackline-2.onrender.com/ws` by default; if your Render service has a different address, open **Multiplayer → Server** in the game and paste it there (ending in `/ws`). Players on the Render site itself connect automatically.

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
python3 tests/modes.py        # boots Zombies, Battle Royale, Horror and Multiplayer through the menu
python3 tests/mp2.py          # two clients play an online match against a local server
```

Characters are converted from Mixamo FBX with `tools/fbx/convert.py` and packed with `python3 tools/pack_chars.py mixamo <converted dir> assets_out`.

## Controls

WASD move · Mouse aim · Left click fire · Right click aim down sights · R reload · Shift sprint · C crouch · G grenade · F melee · E interact · 1–9 weapons · Esc pause · L flashlight (Horror) · Space opens the parachute (Battle Royale). Xbox and PlayStation controllers work too.

---

Built with Three.js and Electron. Characters and animations from Adobe Mixamo.
