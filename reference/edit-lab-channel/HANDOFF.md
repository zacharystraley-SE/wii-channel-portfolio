# Edit Lab channel: transition prototype handoff

This folder is a working, standalone prototype of the click transition for the Zach's Edit Lab channel on the Wii-style portfolio site. Open `index.html` through any local web server (the video needs http, not file://).

## What happens
1. **Home screen.** The channel tile plays `assets/loop.mp4` (10 s seamless loop).
2. **Select.** The tile grows to full screen and becomes the channel preview: the loop keeps playing and Wii Menu / Start buttons appear (`openPreview()`). Wii Menu shrinks it back to the tile (`closePreview()`).
3. **Start → handoff** (`startChannel()`). The script reads `video.currentTime` and places the live image layers in exactly the state the video shows at that time. The functions `logoAt`, `bearAt`, `cloudAt` and `bankAt` are a 1:1 port of the math that rendered the video. Then the video hides.
4. **Fall-out.** Title letters, sticker, caption, Bear, logo and the CD case/haze layer fall with real gravity (sampled parabola, small upward pop, random tilt, staggered delays). Clouds get pulled out sideways toward the nearest edge.
5. **Hyper zoom.** The camera (`#scene` transform) zooms on a log scale into the lab's cyan iMac with a blur peak mid-zoom. During the blur the sharp iMac photo (`manifest.hires`, placed over the lab iMac) crossfades in.
6. **Channel page.** The zoom ends with the iMac's screen at 86% of the window height (or 92% of its width on narrow screens; `SCREEN_H` / `SCREEN_W`). `layoutFinal()` then swaps to `#final`: the same iMac image laid out in real pixels (crisp), with `#screen` placed exactly over its glass. The channel website goes inside `#screen > .page`, which scrolls on its own. `--screen-w` / `--screen-h` CSS variables hold the live screen size.
7. **Back.** "Wii Menu" (or Esc) zooms out, drops everything back into place at loop time 0, resumes the video from 0, and shrinks the stage back onto the tile.

## Files
- `index.template.html` is the source. `__MANIFEST__` is replaced by `manifest.json` to make `index.html`.
- `manifest.json` lists every layer: `src`, position `x,y,w,h` on the 2560x1440 design canvas, and `role` (`bg`, `bank`, `cloud`, `title`, `logo`, `overlay`, `bear`, `bear-tilt`, `caption`). Cloud entries also carry their loop motion (`s`, `o0`, `v`, `kind`).
- `assets/` holds WebP layers and the loop video.
- `scripts/` holds the Python used to build everything (`render.py` renders the loop video, `build_assets.py` exports the layers and manifest, `cutout.py` and `align.py` prepared the head-tilt Bear).

## The iMac
`assets/imac.webp` is Zach's photo with the white background removed. `manifest.hires` places it over the lab iMac (design units) and records its screen rectangle in photo pixels (`screen_px`: 177,182 → 1071,848).

## Integrating into the site
- Keep the MP4 on the home grid; mount this scene only when the tile is clicked.
- The channel page content goes inside `#screen .page` (placeholder now shows the live screen size).
- Open question: on phones the 4:3 screen ends up small (about 356 × 265 px on a 390 px wide phone).
- Respects `prefers-reduced-motion` (skips the fall and zoom).

## Reusing for other channels
Each channel needs: its Canva layers (one page per layer, exported as transparent PNGs), a loop render, a manifest, and a zoom target. The transition code stays the same.
