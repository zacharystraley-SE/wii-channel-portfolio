# Wii Channel Portfolio handoff

Zach Straley's portfolio as a Nintendo Wii-style menu. Each project is a channel. Two channels are live: Zach's Edit Lab and The Yester Zone.

## Stack and commands

Plain static HTML, CSS and JavaScript (ES modules and the Web Animations API). No framework, no package.json, no install and no build step.

Run it from the repo root:

    python3 -m http.server 8787 --bind 127.0.0.1 --directory public

Then open http://127.0.0.1:8787/. Only `public/` is the site. On Windows, use `py -3` in place of `python3`.

Python's server can't answer byte-range requests, so videos can't seek under it. The Yester Zone channel seeks its clips, so for that channel (and for the browser checks) serve with `node work/serve.mjs public 8787` instead. It has no dependencies. Cloudflare and other real hosts support ranges already.

Browser checks live in `work/` (`check.mjs`, `check-grain.mjs`, `verify-handoff.mjs`, `check-yz.mjs`). They drive Chrome over the DevTools protocol, so start Chrome with `--remote-debugging-port=9236`, keep the server on 8787 running, then run `node work/check.mjs` from the repo root. They need Node 22 or newer for the built-in WebSocket. `work/baseline.mjs` still points at an old 8786 server and is out of date.

## Folder map

- `public/index.html` holds every view. `#home` is the menu wall. Each live tile has its own stage: `#stage` (Edit Lab: cover video and layered scene) and `#yz-stage` (Yester Zone: cover video and the camera swing). `#preview` has the Wii Menu and Start buttons, and `#final` is the shared bezel image plus the channel page. Edit Lab's page lives in `<template id="page-edit-lab">` and is copied into `.page` on Start.
- `public/menu/menu.js` runs the menu. It reads the live tiles' `data-channel` / `data-stage` / `data-title`, loads `channels/<data-channel>/transition.js` for the clicked tile, fills the 12-slot grid with grain tiles, runs the clock, handles tile select, preview, Start, Back, Escape, and the wheel, swipe and "Enter page" gestures on the final screen. It also sets `--screen-w` and `--screen-h` on `#screen`.
- `public/menu/menu.css` styles the wall, tiles, dock and the name tag. Portrait switches the grid to 3 columns by 4 rows.
- `public/menu/` also has `grain.png`, `name-tag.png`, `player-one.png` (cursor and favicon), `static.webp` and `static-still.webp`.
- `public/channels/edit-lab/` is everything Edit Lab specific.
  - `transition.js` exports `prepareChannel()`, which returns `{ startChannel, closeChannel, layoutFinal }`. It holds the fall-apart physics, the cloud motion, the camera zoom into the cyan iMac and the swap to the sharp iMac image.
  - `manifest.json` lists every layer on the 2560x1440 design canvas, the zoom target (`zoom.screen`), the loop length (10 s at 60 fps) and the sharp iMac (`hires`).
  - `channel.css` styles the stage, preview, final iMac and the `.screen` / `.page` container.
  - `assets/` has the layer WebPs, `loop.mp4`, `overlay.webp` and `imac.webp`. `poster.webp` is the video poster. `batch-fades-cover.webp` is used on the channel page.
- `public/channels/yester-zone/` is everything Yester Zone specific.
  - `transition.js` exports `prepareChannel()` with the same `{ startChannel, closeChannel, layoutFinal }` contract. Start plays `assets/swing.mp4` (a Blender camera move from the cover's angled shot to a head-on view of the TV) while the live broadcast is pinned to the glass on every frame using `assets/track.json`; Wii Menu plays `assets/swing-back.mp4`.
  - `tube.js` is the TV picture used everywhere: a 4:3 letterboxed clip, the on-screen display in the bars (Breakout Video logo plus views, likes and comments for breakout videos, channel number for all), static between channels, scanlines and glass glare.
  - `channels.json` is the channel list: number, YouTube title and ID, clip, poster and the `breakout` stats snapshot (`statsAsOf`). Update stats here; nothing needs re-rendering.
  - `clips/` holds the five 40-second 720p clips and posters. `assets/` holds `cover.mp4` (15 s loop, baked), `cover-poster.webp`, `swing.mp4`, `swing-back.mp4`, `tv.webp` (3200x1800 head-on TV, the bezel for the page), `breakout-logo.webp` and `track.json`.
  - `channel.css` styles the stage, the tube and the page. Page rules are scoped to `#final[data-channel="yester-zone"]`.
- `work/yz-bake/` rebuilds `cover.mp4`: `index.html` draws the held TV render (`held_390.png`, not in Git) with the tube on the glass, `bake.mjs` captures 450 frames through Chrome, then ffmpeg encodes them (command in the PR description).
- `reference/edit-lab-channel/` is the original Claude prototype, kept for reference: `index.html`, `index.template.html`, its own `HANDOFF.md`, `manifest.json`, `assets/` and the Python scripts that rendered the loop and cut the layers (`render.py`, `build_assets.py`, `cutout.py`, `align.py`, `imac_cut.py`).
- `work/` keeps the browser test scripts and `adapt.py`, which ported the prototype into `public/`.
- `Channel build sheet.md` is the build notes from the ChatGPT session.
- `Bear looking right.png` is the source photo of Bear.

## Where each part of the flow lives

- Home menu grid: `#grid` in `index.html`, filled to 12 slots by `emptySlot()` in `menu.js`, styled in `menu.css`.
- Edit Lab tile: `button.tile.live#edit-tile` in `index.html`. Its cover is the `#stage` video, pinned to the tile's bounds while idle.
- Cover loop: `video#loop` in `#stage`, source `channels/edit-lab/assets/loop.mp4`.
- Preview: `select()` and `expand(true)` in `menu.js` grow the stage from the clicked tile. The loop keeps playing. `#pv-menu` goes home and `#pv-start` enters.
- Fall-apart and zoom: `enter()` in `menu.js` calls `startChannel()` in `transition.js`. That reads `video.currentTime`, rebuilds the same frame from the layers, drops the letters, clears the clouds and zooms into the iMac.
- Final iMac screen: `section#final`, with `img#final-imac` and `.screen#screen > .page`. `layoutFinal()` sizes them.

## Adding a channel

Add a `button.tile.live` with `data-channel="<folder>"`, `data-stage="<stage id>"` and `data-title`, a matching stage element (fixed, holds the channel's cover `<video>`), and `public/channels/<folder>/transition.js` exporting `prepareChannel()`. The menu pins every stage over its tile while idle, hides the other stages with `display:none` while one is open, and caches each prepared channel.

Shared and reusable: the wall, the grid and grain, the dock and clock, `expand()` from tile to full screen, the preview buttons, focus handling, Back and Escape, and the `#final` / `.screen` / `.page` reading behavior.

Edit Lab only: `channels/edit-lab/` (transition choreography, manifest, layers, loop and iMac), the `#loop` source and poster, and the page content inside `.page`.

A channel's `startChannel()` must claim the shared shell itself: set `#final-imac` to its own bezel image and fill `#screen > .page` with its own page, because another channel may have used them last. Its transition can differ completely as long as that contract holds.

## Screen container contract

- Put the channel page inside `#screen > .page` in `public/index.html`. Replace the children of `.page` and keep `.page` itself, because it is the scroll container.
- Keep `#screen`, `#final-imac`, `#enter-page` and `#back`. The shell owns glass alignment, the return control and the transition.
- Size content from the container, not the window. `menu.js` sets `--screen-w` and `--screen-h` on `#screen` from a ResizeObserver, and they always match the usable glass or the expanded view. Scope styles to `.page` or use a separate stylesheet.
- The page first rests inside the glass at 86% of the window height or 92% of its width, whichever is smaller (`SCREEN_H` and `SCREEN_W` in `transition.js`). A downward wheel, an upward swipe of 22 px or more, or the "Enter page" button expands `.screen` to the full window (`.screen.reading`), and then the page scrolls normally.
- On phones it works the same way. In portrait the cover video is letterboxed (`object-fit: contain`) and the page still starts in the glass, then expands on swipe.

## Cover video specs (Edit Lab)

- `loop.mp4`: 1920x1080, 60 fps, H.264 yuv420p, faststart, about 4.6 MB, a seamless 10 s loop with one keyframe per loop.
- The tag is `muted loop playsinline preload="auto"` with `poster="channels/edit-lab/poster.webp"`, and it autoplays from `menu.js`.
- The loop timing and the layer positions share the 2560x1440 canvas. Changing Bear's timing in only one of them breaks the video-to-layer handoff on Start.
- With reduced motion the video stays paused on its frame, the menu grain is hidden, the signature shows finished, and Start skips the fall and zoom.

## Where it goes live

Not decided. Nothing here is deployed. Zach's live site is a separate repo (zacharystraley-SE.github.io, Cloudflare Workers) and sandbox.zachstraley.com exists for tests, but neither has this site yet.

## Not in Git

These stay on Zach's Mac in `/Users/zstraley/Documents/ChatGPT/Zach/`:

- `Bondi Blue iMac G3 - Front - 4096.png` (10 MB master; the page uses `assets/imac.webp`)
- `reference/edit-lab-channel/source-layers/` (22 MB of layered PNG exports from Canva)
- `public/resumes/` and `work/resume-export/` (resumes with personal contact details; nothing links to them yet)
- `work/` logs, pid files, screenshots and `grain-review/` frames

## Known gaps

- The channel page is a placeholder (intro plus the Batch Fades episode).
- `work/baseline.mjs` targets the old port.
- The Yester Zone intro line on its page is placeholder copy for Zach to rewrite.

## Yester Zone sources (Zach's PC, not in Git)

- `C:\CRT Projects\CRT_TV_MASTER.blend` is Zach's original. Never open or save it.
- `C:\CRT Projects\CRT_TV_YesterZone.blend` is an untouched duplicate. `CRT_TV_YesterZone_web.blend` is the working copy: render-hidden viewport-hidden lights, a dim glowing screen material (`CRT Off Glass`), and the camera move extended from frame 390 to a head-on view at 450.
- `C:\CRT Projects\Yester Zone Web\` holds the scripts (`scripts/`), renders, clip cuts (`clips/`, `cut.sh`) and encodes. `scripts/track_glass.py` re-exports the glass corners if the camera changes.
- Never commit `.blend` files; `.gitignore` blocks them.

## Working rules

- The ChatGPT session on the Mac and the Claude chat on the PC each work on their own branch and merge through a pull request on GitHub. Neither works on `main` directly.
- Pull `main` before starting a branch.
- This repo is public. Never commit `.env` files, tokens, passwords or personal documents.
