// The Yester Zone "broadcast": one channel at a time on a 4:3 tube, letterboxed,
// with the on-screen display in the bars. Breakout videos get the Breakout Video logo
// and their stats; the others only show the channel number.
// Used for the baked cover loop, the Start transition and the channel page, so all three match.

const base = new URL('./', import.meta.url);
const asset = path => new URL(path, base).href;
const fmt = n => n.toLocaleString('en-US');

export async function loadChannels() {
  const response = await fetch(asset('channels.json'));
  if (!response.ok) throw new Error('Could not load the Yester Zone channel list');
  const data = await response.json();
  for (const ch of data.channels) {
    ch.clipUrl = asset(ch.clip);
    ch.posterUrl = asset(ch.poster);
    ch.url = 'https://www.youtube.com/watch?v=' + ch.youtubeId;
  }
  return data;
}

const once = (target, type, ms) => new Promise(resolve => {
  const timer = setTimeout(resolve, ms);
  target.addEventListener(type, () => { clearTimeout(timer); resolve(); }, { once: true });
});
// Seek a video and wait for the frame, without ever hanging the transition on a missing event.
export async function seek(video, time) {
  if (video.readyState < 1) await once(video, 'loadedmetadata', 4000);
  if (Math.abs(video.currentTime - time) <= 0.05) return;
  const done = once(video, 'seeked', 1500);
  video.currentTime = time;
  await done;
}

export function createTube(data, { interactive = false } = {}) {
  const el = document.createElement('div');
  el.className = 'yz-tube';
  el.innerHTML = `
    <video class="yz-pic" muted playsinline loop preload="auto"></video>
    <div class="yz-bar yz-top"><span class="yz-logo" hidden><img class="yz-bloom" alt=""><img class="yz-mark" alt="Breakout video"></span><span class="yz-ch"></span></div>
    <div class="yz-bar yz-bottom"><span class="yz-stats"></span></div>
    <canvas class="yz-static" width="160" height="120" aria-hidden="true"></canvas>
    <div class="yz-glass" aria-hidden="true"></div>`;
  const video = el.querySelector('.yz-pic');
  const logo = el.querySelector('.yz-logo');
  logo.querySelectorAll('img').forEach(img => { img.src = asset('assets/breakout-logo.webp'); img.decoding = 'async'; });
  const chLabel = el.querySelector('.yz-ch'), stats = el.querySelector('.yz-stats');
  const noise = el.querySelector('.yz-static'), ctx = noise.getContext('2d');
  const pixels = ctx.createImageData(noise.width, noise.height), words = new Uint32Array(pixels.data.buffer);
  let index = -1, staticTimer = 0;

  function paintStatic() {
    for (let i = 0; i < words.length; i++) { const v = Math.random() * 255 | 0; words[i] = 0xff000000 | v << 16 | v << 8 | v; }
    ctx.putImageData(pixels, 0, 0);
  }
  function showStatic(on) {
    clearInterval(staticTimer);
    el.classList.toggle('tuning', on);
    if (on) { paintStatic(); staticTimer = setInterval(paintStatic, 45); }
  }
  function label(i) {
    const ch = data.channels[i];
    chLabel.textContent = 'CH ' + String(ch.number).padStart(2, '0');
    logo.hidden = !ch.breakout;
    stats.innerHTML = ch.breakout
      ? `<b>${fmt(ch.breakout.views)}<small>views</small></b><b>${fmt(ch.breakout.likes)}<small>likes</small></b><b>${fmt(ch.breakout.comments)}<small>comments</small></b>`
      : '';
    el.dataset.breakout = ch.breakout ? 'yes' : 'no';
  }
  // Tune to a channel. With burst, a short run of static covers the switch, like a real set.
  async function tune(i, { burst = true, time = 0, play = true } = {}) {
    const n = data.channels.length;
    i = ((i % n) + n) % n;
    if (burst) showStatic(true);
    label(i);
    if (i !== index) {
      index = i;
      video.src = data.channels[i].clipUrl;
      video.poster = data.channels[i].posterUrl;
    }
    await seek(video, time);
    if (play) video.play().catch(() => {});
    if (burst) await new Promise(r => setTimeout(r, 320));
    showStatic(false);
    el.dispatchEvent(new CustomEvent('tuned', { detail: { index: i } }));
    return i;
  }
  return {
    el, video, tune, showStatic, label,
    get index() { return index; },
    get channel() { return data.channels[index]; },
  };
}

// Projective transform that maps a w x h box onto four destination corners (TL, TR, BR, BL).
export function homography(w, h, dst) {
  const src = [[0, 0], [w, 0], [w, h], [0, h]], A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const n = 8;
  for (let i = 0; i < n; i++) {
    let m = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
    [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]];
    for (let r = i + 1; r < n; r++) {
      const f = A[r][i] / A[i][i];
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; }
  const [a, b2, c, d, e, f, g, hh] = x;
  return `matrix3d(${a},${d},0,${g},${b2},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
}
