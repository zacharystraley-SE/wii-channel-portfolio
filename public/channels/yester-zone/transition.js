// The Yester Zone channel: Start swings the camera from the cover's angled shot to a head-on view
// of the TV while the broadcast keeps playing on the glass, then the channel page takes over the glass.
import { loadChannels, createTube, homography, seek } from './tube.js';

const base = new URL('./', import.meta.url);
const asset = path => new URL(path, base).href;

export async function prepareChannel() {
  const [data, track] = await Promise.all([
    loadChannels(),
    fetch(asset('assets/track.json')).then(r => { if (!r.ok) throw new Error('Could not load the TV track'); return r.json(); }),
  ]);
  const $ = s => document.querySelector(s);
  const stage = $('#yz-stage'), scene = $('#yz-scene'), cover = $('#yz-loop');
  const finalEl = $('#final'), finalImg = $('#final-imac'), screenEl = $('#screen'), page = screenEl.querySelector('.page');
  const preview = $('#preview'), backBtn = $('#back');
  const DW = 1600, DH = 900, F0 = track.from, F1 = track.to, FPS = track.fps;
  // Zach's camera path runs F0..F1; the page camera only starts zooming toward the glass for the last stretch,
  // and Wii Menu plays just that last stretch backwards.
  const ZOOM_FROM = track.zoomFrom ?? F0, BACK_FROM = track.backFrom ?? F0;
  const corners = f => track.frames[String(Math.min(F1, Math.max(F0, f)))];
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const show = (el, on) => { el.style.visibility = on ? 'visible' : 'hidden'; };

  /* ----- the swing: rendered camera move, with the live tube pinned to the glass on every frame ----- */
  const cam = document.createElement('div'); cam.className = 'yz-cam';
  const swing = document.createElement('video');
  Object.assign(swing, { className: 'yz-swing', muted: true, playsInline: true, preload: 'auto' });
  swing.src = asset('assets/flyin.mp4');
  const swingBack = document.createElement('video');
  Object.assign(swingBack, { className: 'yz-swing', muted: true, playsInline: true, preload: 'auto' });
  swingBack.src = asset('assets/flyin-back.mp4'); swingBack.style.visibility = 'hidden';
  const flyTube = createTube(data);
  cam.append(swing, swingBack, flyTube.el);
  scene.replaceChildren(cam);

  /* ----- camera framing, same rules as Edit Lab: cover-fit at the start, glass at 86% of the window at the end ----- */
  const fitScale = (W, H) => W < H ? Math.min(W / DW, H / DH) : Math.max(W / DW, H / DH);
  function fitCam(W, H) { const s = fitScale(W, H); return [s, (W - DW * s) / 2, (H - DH * s) / 2]; }
  const g = corners(F1), gx0 = g[0][0] * DW, gy0 = g[0][1] * DH, gx1 = g[2][0] * DW, gy1 = g[2][1] * DH;
  const SCREEN_H = 0.86, SCREEN_W = 0.92;
  function endCam(W, H) {
    const s = Math.min(H * SCREEN_H / (gy1 - gy0), W * SCREEN_W / (gx1 - gx0));
    return [s, W / 2 - s * (gx0 + gx1) / 2, H / 2 - s * (gy0 + gy1) / 2];
  }
  const ease = u => u < .5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
  function camAt(u) {
    const W = innerWidth, H = innerHeight, [s0, x0, y0] = fitCam(W, H), [s1, x1, y1] = endCam(W, H), e = ease(u);
    // log-scale zoom so the push feels even, pan follows the scale
    const s = s0 * (s1 / s0) ** e;
    return [s, x0 + (x1 - x0) * e, y0 + (y1 - y0) * e];
  }
  const camTf = ([s, x, y]) => `translate(${x}px,${y}px) scale(${s})`;
  function pinTube(frame) {
    const c = corners(frame).map(([x, y]) => [x * DW, y * DH]);
    flyTube.el.style.transform = homography(1440, 1080, c);
  }

  /* ----- final state: the crisp head-on TV, laid out exactly where the swing's last frame lands ----- */
  const TV = { src: asset('assets/tv.webp'), w: 3200, h: 1800 };
  function layoutFinal() {
    const [s, x, y] = endCam(innerWidth, innerHeight);
    Object.assign(finalImg.style, { left: x + 'px', top: y + 'px', width: DW * s + 'px', height: DH * s + 'px' });
    const inset = 2;
    Object.assign(screenEl.style, { left: x + gx0 * s + inset + 'px', top: y + gy0 * s + inset + 'px',
      width: (gx1 - gx0) * s - 2 * inset + 'px', height: (gy1 - gy0) * s - 2 * inset + 'px' });
  }

  /* ----- the channel page that lives in the glass ----- */
  let pageTube = null;
  function buildPage() {
    const wrap = document.createElement('div'); wrap.className = 'yz-page';
    const tv = document.createElement('section'); tv.className = 'yz-tv'; tv.setAttribute('aria-label', 'Now playing');
    pageTube = createTube(data, { interactive: true });
    const remote = document.createElement('div'); remote.className = 'yz-remote';
    remote.innerHTML = `<button type="button" class="yz-up" aria-label="Channel up">CH▲</button>
      <button type="button" class="yz-down" aria-label="Channel down">CH▼</button>
      <button type="button" class="yz-sound" aria-pressed="false" aria-label="Sound">🔇</button>`;
    tv.append(pageTube.el, remote);
    const guide = document.createElement('section'); guide.className = 'yz-guide';
    guide.innerHTML = `<h1>The Yester Zone</h1>
      <p class="yz-lede">Memory archaeology on YouTube: abandoned places, lost attractions and the pieces of growing up that quietly disappeared.</p>
      <ol class="yz-list"></ol>
      <p class="yz-credit">Watch the whole channel at <a href="https://www.youtube.com/@theyesterzone" target="_blank" rel="noopener">youtube.com/@theyesterzone</a>.
      Stats as of ${new Date(data.statsAsOf + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.<br>
      TV model: <a href="https://skfb.ly/ooRTR" target="_blank" rel="noopener">“CRT TV”</a> by Timothy Ahene,
      licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>.</p>`;
    const list = guide.querySelector('.yz-list');
    data.channels.forEach((ch, i) => {
      const li = document.createElement('li');
      const meta = ch.breakout ? `Breakout · ${ch.breakout.views.toLocaleString('en-US')} views` : '';
      li.innerHTML = `<span class="yz-num">CH ${String(ch.number).padStart(2, '0')}</span>
        <span><button type="button" class="yz-tune"></button>${meta ? `<span class="yz-meta">${meta}</span>` : ''}</span>
        <a target="_blank" rel="noopener">Watch on YouTube</a>`;
      li.querySelector('.yz-tune').textContent = ch.title;
      li.querySelector('a').href = ch.url;
      li.querySelector('a').setAttribute('aria-label', 'Watch ' + ch.title + ' on YouTube');
      li.querySelector('.yz-tune').addEventListener('click', () => { page.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); pageTube.tune(i); });
      list.append(li);
    });
    pageTube.el.addEventListener('tuned', e => {
      list.querySelectorAll('li').forEach((li, i) => li.setAttribute('aria-current', String(i === e.detail.index)));
    });
    remote.querySelector('.yz-up').addEventListener('click', () => pageTube.tune(pageTube.index + 1));
    remote.querySelector('.yz-down').addEventListener('click', () => pageTube.tune(pageTube.index - 1));
    const sound = remote.querySelector('.yz-sound');
    sound.addEventListener('click', () => {
      const on = pageTube.video.muted;
      pageTube.video.muted = !on;
      sound.setAttribute('aria-pressed', String(on)); sound.textContent = on ? '🔊' : '🔇';
      if (on) pageTube.video.play().catch(() => {});
    });
    tv.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); pageTube.tune(pageTube.index + 1); }
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); pageTube.tune(pageTube.index - 1); }
    });
    wrap.append(tv, guide);
    page.replaceChildren(wrap);
  }

  /* ----- which channel and moment the cover loop is showing, so Start picks up the same broadcast ----- */
  function coverMoment() {
    const t = cover.currentTime % track.cover.length;
    for (const seg of track.cover.segments) if (t >= seg.start && t < seg.end) return { index: seg.index, time: seg.clipStart + (t - seg.start) };
    return { index: 0, time: 0 };
  }
  const playVideo = v => v.play().catch(() => {});
  const nextFrame = () => new Promise(r => requestAnimationFrame(r));

  async function runSwing(video, frameAt) {
    await seek(video, 0);
    if (video.readyState < 3) await new Promise(r => { const t = setTimeout(r, 1500); video.addEventListener('canplay', () => { clearTimeout(t); r(); }, { once: true }); });
    video.style.visibility = 'inherit';
    await playVideo(video);
    const dur = video.duration || (F1 - F0 + 1) / FPS;
    while (!video.ended && !video.paused) {
      const u = Math.min(1, video.currentTime / dur);
      const f = frameAt(u);
      cam.style.transform = camTf(camAt(Math.min(1, Math.max(0, (f - ZOOM_FROM) / (F1 - ZOOM_FROM)))));
      pinTube(f);
      await nextFrame();
    }
  }

  async function startChannel() {
    const reduce = reduced();
    show(preview, false);
    const moment = coverMoment();
    await flyTube.tune(moment.index, { burst: false, time: moment.time });
    if (TV.src !== finalImg.src) finalImg.src = TV.src;
    const tvReady = finalImg.decode().catch(() => {});
    if (!reduce) {
      cam.style.transform = camTf(camAt(0)); pinTube(F0);
      swingBack.style.visibility = 'hidden';
      await seek(swing, 0);
      show(scene, true);
      await scene.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: 'ease-out' }).finished;
      cover.style.visibility = 'hidden'; cover.pause();
      await runSwing(swing, u => Math.round(F0 + u * (F1 - F0)));
    } else {
      cover.pause();
    }
    cam.style.transform = camTf(camAt(1)); pinTube(F1);
    await tvReady;
    buildPage();
    await pageTube.tune(flyTube.index, { burst: false, time: flyTube.video.currentTime });
    flyTube.video.pause();
    layoutFinal(); show(finalEl, true); finalEl.setAttribute('aria-hidden', 'false');
    if (reduce) await finalEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 }).finished;
    show(backBtn, true);
    backBtn.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  }

  async function closeChannel() {
    const reduce = reduced();
    show(backBtn, false);
    const index = pageTube ? pageTube.index : 0, time = pageTube ? pageTube.video.currentTime : 0;
    if (pageTube) { pageTube.video.pause(); pageTube.video.removeAttribute('src'); pageTube.video.load(); }
    show(stage, true);
    if (!reduce) {
      await flyTube.tune(index, { burst: false, time });
      cam.style.transform = camTf(camAt(1)); pinTube(F1);
      show(scene, true);
    }
    show(finalEl, false); finalEl.setAttribute('aria-hidden', 'true');
    page.replaceChildren(); pageTube = null;
    if (!reduce) {
      swing.style.visibility = 'hidden';
      await runSwing(swingBack, u => Math.round(F1 - u * (F1 - BACK_FROM)));
      cover.currentTime = 0; cover.style.visibility = 'inherit';
      await scene.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-in', fill: 'forwards' }).finished;
      swing.style.visibility = 'inherit'; swingBack.style.visibility = 'hidden';
    }
    flyTube.video.pause();
    cover.currentTime = 0; cover.style.visibility = 'inherit';
    if (!reduce) await playVideo(cover);
    show(scene, false);
    scene.getAnimations().forEach(x => x.cancel());
  }

  await Promise.all([
    new Promise((resolve, reject) => { swing.addEventListener('loadeddata', resolve, { once: true }); swing.addEventListener('error', () => reject(new Error('swing video')), { once: true }); }),
    new Promise(resolve => { const i = new Image(); i.onload = i.onerror = resolve; i.src = TV.src; }),
  ]);
  return { startChannel, closeChannel, layoutFinal };
}
