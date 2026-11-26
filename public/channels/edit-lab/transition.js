// Edit Lab's Web Animations choreography, paired with the authored v2 loop.
const asset = path => new URL(path, import.meta.url).href;

export async function prepareChannel() {
 const response = await fetch(asset('manifest.json'));
 if (!response.ok) throw new Error('Could not load Edit Lab layers');
 const MAN = await response.json();
const DW = 2560, DH = 1440, DUR = 10;

/* ===== loop math: a 1:1 port of the video render, so the page can pick up from any frame ===== */
const G = 3800, T0 = 0.8, Y0 = -260, HEAD_X = 1195, HEAD_Y = 744, GROUND = 1127.5, R = 200, RX = 1653.5, RY = 1127.5;
const tFall = Math.sqrt(2 * (HEAD_Y - Y0) / G), vImp = G * tFall, T1 = T0 + tFall;
const VY1 = -0.42 * vImp, VX1 = 330;
const tF1 = (-VY1 + Math.sqrt(VY1 * VY1 + 4 * (G / 2) * (GROUND - HEAD_Y))) / G;
const T2 = T1 + tF1, X2 = HEAD_X + VX1 * tF1;
const VY2 = -0.28 * (VY1 + G * tF1), VX2 = 270, tF2 = -2 * VY2 / G, T3 = T2 + tF2, X3 = X2 + VX2 * tF2;
const V_ROLL = 250, A_ROLL = 15, X_EXIT = 2790;
const T4 = T3 + (V_ROLL - Math.sqrt(V_ROLL ** 2 - 2 * A_ROLL * (X_EXIT - X3))) / A_ROLL;
const W_FL = 5, TH2 = W_FL * tF1, TH3 = TH2 + VX2 / R * tF2, BACK0 = T4 + 0.40, BACK1 = T4 + 0.55;
const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const mod = (a, n) => ((a % n) + n) % n;

function logoAt(t) {
  if (t < T0 || t >= T4) return null;
  if (t < T1) { const u = t - T0; return [HEAD_X, Y0 + G / 2 * u * u, 0]; }
  if (t < T2) { const u = t - T1; return [HEAD_X + VX1 * u, HEAD_Y + VY1 * u + G / 2 * u * u, W_FL * u]; }
  if (t < T3) { const u = t - T2; return [X2 + VX2 * u, GROUND + VY2 * u + G / 2 * u * u, TH2 + VX2 / R * u]; }
  const u = t - T3, x = X3 + V_ROLL * u - A_ROLL / 2 * u * u;
  return [x, GROUND, TH3 + (x - X3) / R];
}
function bearAt(t) {
  if (t < T1) return [0, 1];
  const u = t - T1;
  return [1 - smooth(BACK0, BACK1, t), u < 0.5 ? 1 - 0.03 * Math.exp(-u / 0.06) : 1];
}
function cloudAt(c, t) {
  const tau = mod(t - c.s, DUR);
  const env = c.kind === 'in' ? smooth(0, 2, tau) * (1 - smooth(8.8, DUR, tau)) : 1 - smooth(7.8, DUR, tau);
  return [c.o0 + c.v * tau, env];
}
function bankAt(k, t) {
  const tau = mod(t + k, DUR);
  return [-40 * (tau - DUR / 2), Math.sin(Math.PI * tau / DUR) ** 2];
}

/* ===== build the scene from the manifest (stacking order matches the video) ===== */
const $ = s => document.querySelector(s);
const stage = $('#stage'), scene = $('#scene'), video = $('#loop'), finalEl = $('#final'), preview = $('#preview'), backBtn = $('#back');
const byId = Object.fromEntries(MAN.elements.map(e => [e.id, e]));
const nodes = [];  // {node, e, base:{dx,dy,r,sx,sy,op}, kind}
function img(e) {
  const n = document.createElement('img');
  n.src = asset(e.src); n.alt = ''; n.className = 'el'; n.decoding = 'async';
  Object.assign(n.style, { left: e.x + 'px', top: e.y + 'px', width: e.w + 'px', height: e.h + 'px' });
  return n;
}
function add(node, e, kind, extra) {
  scene.appendChild(node);
  const o = Object.assign({ node, e, kind, base: { dx: 0, dy: 0, r: 0, sx: 1, sy: 1, op: 1 } }, extra);
  nodes.push(o); return o;
}
add(img(byId.bg), byId.bg, 'bg');
const banks = [0, 5].map(k => add(img(byId['cloud-bank']), byId['cloud-bank'], 'cloud', { bankK: k }));
const clouds = MAN.elements.filter(e => e.role === 'cloud').map(e => add(img(e), e, 'cloud', { c: e }));
MAN.elements.filter(e => e.role === 'title').sort((a, b) => a.order - b.order).forEach(e => add(img(e), e, 'fall', { delay: 90 + e.order * 45 }));
const logo = add(img(byId.logo), byId.logo, 'fall', { delay: 260, logo: true });
const overlay = add(img(byId.overlay), byId.overlay, 'fall', { delay: 520, heavy: true });
const bgrp = document.createElement('div'); bgrp.className = 'grp';
const be = byId.bear;
Object.assign(bgrp.style, { left: be.x + 'px', top: be.y + 'px', width: be.w + 'px', height: be.h + 'px', transformOrigin: '50% 100%' });
const bDef = document.createElement('img'), bTilt = document.createElement('img');
bDef.src = asset(be.src); bTilt.src = asset(byId['bear-tilt'].src); bDef.alt = bTilt.alt = '';
bgrp.append(bDef, bTilt);
const bear = add(bgrp, be, 'fall', { delay: 330 });
MAN.elements.filter(e => e.role === 'caption').forEach(e => add(img(e), e, 'fall', { delay: e.order * 40 }));
// optional sharp iMac photo swapped in mid-zoom: set MAN.hires = {src, x, y, w, h} (design units)
let hires = null;
if (MAN.hires) { hires = img(MAN.hires); hires.className = ''; Object.assign(hires.style, { position: 'absolute', opacity: 0 }); scene.appendChild(hires); }

const tf = b => `translate(${b.dx}px,${b.dy}px) rotate(${b.r}rad) scale(${b.sx},${b.sy})`;
function applyState(t) {
  for (const n of nodes) n.base = { dx: 0, dy: 0, r: 0, sx: 1, sy: 1, op: 1 };
  banks.forEach(n => { const [dx, w] = bankAt(n.bankK, t); n.base.dx = dx; n.base.op = w; });
  clouds.forEach(n => { const [dx, env] = cloudAt(n.c, t); n.base.dx = dx; n.base.op = env; });
  const L = logoAt(t);
  if (L) { logo.base.dx = L[0] - RX; logo.base.dy = L[1] - RY; logo.base.r = L[2]; } else logo.base.op = 0;
  const [mix, sq] = bearAt(t);
  bDef.style.opacity = 1 - mix; bTilt.style.opacity = mix; bear.base.sy = sq;
  for (const n of nodes) { n.node.getAnimations().forEach(a => a.cancel()); n.node.style.transform = tf(n.base); n.node.style.opacity = n.base.op; }
}

/* ===== camera: cover-fit the 2560x1440 scene into the stage, plus zoom ===== */

const vw = () => innerWidth, vh = () => innerHeight;
const fitScale = (W, H) => W < H ? Math.min(W / DW, H / DH) : Math.max(W / DW, H / DH);
const cam = (s, tx, ty) => `translate(${tx}px,${ty}px) scale(${s})`;
function fitCam(W, H) { const s = fitScale(W, H); return [s, (W - DW * s) / 2, (H - DH * s) / 2]; }
const [sx0, sy0, sx1, sy1] = MAN.zoom.screen, P = [(sx0 + sx1) / 2, (sy0 + sy1) / 2];
// Final framing: the iMac's screen fills ~86% of the window height (or ~92% of its width on narrow screens),
// so the bezel crops off the window edges and the page on the screen is large enough to read.
const SCREEN_H = 0.86, SCREEN_W = 0.92;
function zoomEnd(W, H) {
  const s = Math.min(H * SCREEN_H / (sy1 - sy0), W * SCREEN_W / (sx1 - sx0));
  return [s, W / 2 - s * P[0], H / 2 - s * P[1]];
}
/* ===== final state: lay out the sharp iMac and its screen in real pixels (crisp, not scaled by the camera) ===== */
const finalImg = $('#final-imac'), screenEl = $('#screen');
if (MAN.hires) finalImg.src = asset(MAN.hires.src);
function layoutFinal() {
  if (!MAN.hires) return;
  const W = vw(), H = vh(), [s, tx, ty] = zoomEnd(W, H), h = MAN.hires;
  const L = tx + s * h.x, T = ty + s * h.y, S = s * h.w;      // iMac image rect in viewport px
  Object.assign(finalImg.style, { left: L + 'px', top: T + 'px', width: S + 'px', height: S + 'px' });
  const k = S / h.px[0], [a, b, c, d] = h.screen_px, inset = 3 * k;
  const r = { left: L + a * k + inset, top: T + b * k + inset, width: (c - a) * k - 2 * inset, height: (d - b) * k - 2 * inset };
  Object.assign(screenEl.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });

}

/* ===== transition helpers ===== */
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const show = (el, on) => { el.style.visibility = on ? 'visible' : 'hidden'; };
function fallKF(n) {
  const b = n.base, g = 5200, vy0 = n.heavy ? -120 : -rnd(220, 420), vx = rnd(-70, 70), w = (n.heavy ? rnd(-0.12, 0.12) : rnd(-1.4, 1.4));
  const D = DH + 60 - (n.e.y + b.dy);
  const T = (-vy0 + Math.sqrt(vy0 * vy0 + 2 * g * D)) / g, kf = [];
  for (let i = 0; i <= 16; i++) {
    const u = T * i / 16;
    kf.push({ transform: tf({ ...b, dx: b.dx + vx * u, dy: b.dy + vy0 * u + g / 2 * u * u, r: b.r + w * u }), opacity: b.op });
  }
  return [kf, T * 1000];
}
function suckKF(n) {
  const b = n.base, cx = n.e.x + n.e.w / 2 + b.dx, dir = cx < DW / 2 ? -1 : 1;
  return [[{ transform: tf(b), opacity: b.op },
           { transform: tf({ ...b, dx: b.dx + dir * 600, sx: 1.08 }), opacity: b.op, offset: .45 },
           { transform: tf({ ...b, dx: b.dx + dir * (DW + n.e.w), sx: 1.45 }), opacity: 0 }],
          { duration: 700, easing: 'cubic-bezier(.6,0,.9,.4)' }];
}
function zoomKF(W, H, reverse) {
  const [s0, x0, y0] = fitCam(W, H), [s1] = zoomEnd(W, H), c = [W / 2, H / 2];
  const p0 = [x0 + s0 * P[0], y0 + s0 * P[1]], kf = [], N = 40;
  const ease = u => u < .5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;   // log-scale zoom, slow-fast-slow
  const panE = u => 1 - (1 - Math.min(1, u * 1.7)) ** 3;                 // pan finishes early: we dive straight in
  for (let i = 0; i <= N; i++) {
    const u = i / N, s = s0 * (s1 / s0) ** ease(u);
    const p = [p0[0] + (c[0] - p0[0]) * panE(u), p0[1] + (c[1] - p0[1]) * panE(u)];
    kf.push({ transform: cam(s, p[0] - s * P[0], p[1] - s * P[1]) });
  }
  return reverse ? kf.reverse() : kf;
}
const blurKF = [{ filter: 'blur(0px)' }, { filter: 'blur(1px)', offset: .3 }, { filter: 'blur(9px)', offset: .55 }, { filter: 'blur(0px)', offset: .85 }, { filter: 'blur(0px)' }];
const hiresIn = [{ opacity: 0 }, { opacity: 0, offset: .4 }, { opacity: 1, offset: .6 }, { opacity: 1 }];
async function startChannel() {
  const reduce = reduced();
  show(preview, false);
  const W = vw(), H = vh();
  applyState(video.currentTime % DUR);
  const [s, x, y] = fitCam(W, H); scene.style.transform = cam(s, x, y);
  show(scene, true); video.style.visibility = 'hidden'; video.pause();
  if (!reduce) {
    let i = 0;
    for (const n of nodes) {
      if (n.kind === 'cloud') { const [kf, o] = suckKF(n); n.node.animate(kf, { ...o, delay: 120 + 55 * i++, fill: 'forwards' }); }
      if (n.kind === 'fall' && n.base.op > 0) { const [kf, d] = fallKF(n); n.node.animate(kf, { duration: d, delay: n.delay, easing: 'linear', fill: 'forwards' }); }
    }
    await wait(1050);
    const zoom = scene.animate(zoomKF(W, H), { duration: 1500, easing: 'linear', fill: 'forwards' });
    stage.animate(blurKF, { duration: 1500, easing: 'linear' });
    if (hires) hires.animate(hiresIn, { duration: 1500, fill: 'forwards' });
    await zoom.finished;
  }
  scene.getAnimations().forEach(a => a.cancel());
  const [endScale,endX,endY] = zoomEnd(vw(),vh());
  scene.style.transform = cam(endScale,endX,endY);
  // swap to the crisp, real-pixel iMac (same framing as the camera's last frame)
  layoutFinal(); show(finalEl, true); finalEl.setAttribute('aria-hidden', 'false');
  screenEl.animate([{ opacity: 0, filter: 'brightness(1.8)' }, { opacity: 1, filter: 'brightness(1)' }], { duration: reduce ? 1 : 450, easing: 'ease-out' });
  if (reduce) await finalEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 }).finished;
  show(backBtn, true);   // the zoomed lab stays behind the iMac, exactly as the zoom's last frame left it
  backBtn.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });

}

/* ===== 3. Wii Menu from inside the channel: zoom out, everything drops back in, back onto the tile ===== */
async function closeChannel() {
  const reduce = reduced();
  const W = vw(), H = vh();
  show(backBtn, false);
  show(stage, true); show(finalEl, false); finalEl.setAttribute('aria-hidden', 'true');
  if (!reduce) {
    const z = scene.animate(zoomKF(W, H, true), { duration: 1100, easing: 'linear', fill: 'forwards' });
    if (hires) hires.animate([{ opacity: 1 }, { opacity: 1, offset: .4 }, { opacity: 0, offset: .6 }, { opacity: 0 }], { duration: 1100, fill: 'forwards' });
    stage.animate(blurKF, { duration: 1100, easing: 'linear' });
    await z.finished;
  }
  if (hires) { hires.getAnimations().forEach(a => a.cancel()); hires.style.opacity = 0; }
  applyState(0);
  const [s, x, y] = fitCam(W, H); scene.getAnimations().forEach(a => a.cancel()); scene.style.transform = cam(s, x, y);
  if (!reduce) {
    const anims = [];
    nodes.filter(n => n.kind === 'fall' && n.base.op > 0).reverse().forEach((n, k) => {
      const b = n.base, h = n.e.y + n.e.h + 80, r0 = n.heavy ? 0 : rnd(-.5, .5);
      anims.push(n.node.animate([
        { transform: tf({ ...b, dy: b.dy - h, r: r0 }), easing: 'cubic-bezier(.45,0,.9,.55)' },
        { transform: tf(b), offset: .8, easing: 'cubic-bezier(.2,.6,.4,1)' },
        { transform: tf({ ...b, dy: b.dy - (n.heavy ? 6 : 22) }), offset: .9, easing: 'cubic-bezier(.6,0,.9,.5)' },
        { transform: tf(b) }], { duration: n.heavy ? 650 : 560, delay: k * 45, fill: 'backwards' }).finished);
    });
    [...banks, ...clouds].forEach((n, k) => {
      const b = n.base, dir = n.e.x + n.e.w / 2 + b.dx < DW / 2 ? -1 : 1;
      anims.push(n.node.animate([{ transform: tf({ ...b, dx: b.dx + dir * 1400 }), opacity: 0 }, { transform: tf(b), opacity: b.op }],
        { duration: 900, delay: 200 + k * 50, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' }).finished);
    });
    await Promise.all(anims);
  }
  video.currentTime = 0; video.style.visibility = 'visible';
  if (!reduce) await video.play().catch(() => {});
  show(scene, false);
}

 try {
   await Promise.all([...scene.querySelectorAll('img'), finalImg].map(node => node.decode()));
 } catch (error) {
   scene.replaceChildren();
   throw error;
 }
 return { startChannel, closeChannel, layoutFinal };
}
