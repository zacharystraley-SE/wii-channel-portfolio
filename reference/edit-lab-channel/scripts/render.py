import sys, math, subprocess
import numpy as np
from PIL import Image

L = '/home/claude/work/L/'
W, H = 1920, 1080
S = W / 2560.0          # design units are the 2560x1440 Canva canvas
FPS = 60
DUR = 10.0
NF = int(FPS * DUR)

def load(name):
    im = Image.open(L + name).convert('RGBA').resize((W, H), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255.0
    a[..., :3] *= a[..., 3:4]            # premultiply
    return a

def over(dst, src, x0=0, y0=0):
    """premultiplied src over dst at integer offset, clipped"""
    h, w = src.shape[:2]
    dx0, dy0 = max(x0, 0), max(y0, 0)
    dx1, dy1 = min(x0 + w, W), min(y0 + h, H)
    if dx1 <= dx0 or dy1 <= dy0:
        return
    s = src[dy0 - y0:dy1 - y0, dx0 - x0:dx1 - x0]
    d = dst[dy0:dy1, dx0:dx1]
    d *= (1.0 - s[..., 3:4])
    d += s

def crop_bbox(a, pad=4):
    ys, xs = np.where(a[..., 3] > 0.002)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, H)
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, W)
    return a[y0:y1, x0:x1].copy(), x0, y0

def smooth(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)

# ---------- layers ----------
bg = load('01_bg.png')
bg[..., 3] = 1.0
title = load('10_title.png')
upper = load('11_overlay.png')
_bd = load('12_bear.png'); _bt = load('12b_bear_tilt.png')
_u = _bd.copy(); _u[..., 3] = np.maximum(_bd[..., 3], _bt[..., 3])
_, bdx, bdy = crop_bbox(_u, pad=12)
_h, _w = _.shape[:2]
bear_def = _bd[bdy:bdy + _h, bdx:bdx + _w].copy()
bear_tilt = _bt[bdy:bdy + _h, bdx:bdx + _w].copy()
caption, capx, capy = crop_bbox(load('13_caption.png'))
# upper is premult with partial alpha; keep as-is

# clouds: (file, fade-in start s, start offset o0, velocity v (design px/s), kind)
#   kind 'in'  = fades in where it starts, drifts out of frame
#   kind 'out' = enters from off-frame, fades out near the end of its cycle
CLOUDS = [
    ('03_cloud.png', 0.0,     0.0, -175, 'in'),
    ('08_cloud.png', 1.7, -2213.0,  190, 'out'),
    ('06_cloud.png', 3.3,     0.0,  120, 'in'),
    ('05_cloud.png', 5.0,  1752.0, -185, 'out'),
    ('04_cloud.png', 6.6,     0.0, -130, 'in'),
    ('07_cloud.png', 8.3, -1352.0,  170, 'out'),
]
clouds = []
for f, s, o0, v, kind in CLOUDS:
    c, cx, cy = crop_bbox(load(f))
    clouds.append((c, cx, cy, s, o0, v, kind))

# cloud bank (cut at both frame edges): feather edges, two crossfading copies drifting slowly
bank = load('02_cloud.png')
fe = int(350 * S)
ramp = np.ones(W, np.float32)
ramp[:fe] = np.linspace(0, 1, fe) ** 1.5
ramp[-fe:] = np.linspace(1, 0, fe) ** 1.5
bank *= ramp[None, :, None]
bank, bkx, bky = crop_bbox(bank)
BANK_V = -40.0

def shifted(c, dx):
    """horizontal subpixel shift: returns array and integer offset"""
    ix = math.floor(dx)
    f = dx - ix
    if f < 1e-3:
        return c, ix
    out = np.zeros((c.shape[0], c.shape[1] + 1, 4), np.float32)
    out[:, :-1] += c * (1 - f)
    out[:, 1:] += c * f
    return out, ix

def draw_clouds(F, t):
    for k in (0.0, 5.0):
        tau = (t + k) % DUR
        wgt = math.sin(math.pi * tau / DUR) ** 2
        dx = BANK_V * (tau - DUR / 2) * S
        arr, ix = shifted(bank, dx)
        over(F, arr * wgt, bkx + ix, bky)
    for c, cx, cy, s, o0, v, kind in clouds:
        tau = (t - s) % DUR
        if kind == 'in':
            env = smooth(0.0, 2.0, tau) * (1 - smooth(8.8, DUR, tau))
        else:
            env = 1 - smooth(7.8, DUR, tau)
        if env <= 0.001:
            continue
        dx = (o0 + v * tau) * S
        if cx + dx > W or cx + dx + c.shape[1] < 0:
            continue
        arr, ix = shifted(c, dx)
        over(F, arr * env, cx + ix, cy)

# ---------- logo motion (design units, 2560 canvas) ----------
logo_full = Image.open(L + '09_logo.png').convert('RGBA').resize((W, H), Image.LANCZOS)
RX, RY = 1653.5, 1127.5           # design resting centre (used as reference point for the crop)
R = 200.0                          # disc radius
GROUND = 1127.5                    # centre height when touching the ground
HEAD_X, HEAD_Y = 1195.0, 744.0    # logo centre at the moment it touches Bear's head
G = 3800.0
T0 = 0.8
Y0 = -260.0
t_fall = math.sqrt(2 * (HEAD_Y - Y0) / G)
v_imp = G * t_fall
T1 = T0 + t_fall                   # bonk
VY1, VX1 = -0.42 * v_imp, 330.0
a, b, c_ = 0.5 * G, VY1, -(GROUND - HEAD_Y)
t_f1 = (-b + math.sqrt(b * b - 4 * a * c_)) / (2 * a)
T2 = T1 + t_f1
X2 = HEAD_X + VX1 * t_f1
VY2 = -0.28 * (VY1 + G * t_f1)
VX2 = 270.0
t_f2 = -2 * VY2 / G
T3 = T2 + t_f2
X3 = X2 + VX2 * t_f2
V_ROLL, A_ROLL = 250.0, 15.0       # slow roll with a gentle slowdown
X_EXIT = 2560 + 230
t_exit = (V_ROLL - math.sqrt(V_ROLL ** 2 - 2 * A_ROLL * (X_EXIT - X3))) / A_ROLL
T4 = T3 + t_exit                   # fully off screen
W_FLIGHT = 5.0                     # spin (rad/s, clockwise) after the bonk
TH2 = W_FLIGHT * t_f1
TH3 = TH2 + VX2 / R * t_f2
# Bear: tilt pose from the bonk until he turns back
BEAR_BACK0, BEAR_BACK1 = T4 + 0.40, T4 + 0.55

def logo_state(t):
    if t < T0 or t >= T4:
        return None
    if t < T1:
        u = t - T0
        return HEAD_X, Y0 + 0.5 * G * u * u, 0.0, 1.0
    if t < T2:
        u = t - T1
        return HEAD_X + VX1 * u, HEAD_Y + VY1 * u + 0.5 * G * u * u, W_FLIGHT * u, 1.0
    if t < T3:
        u = t - T2
        return X2 + VX2 * u, GROUND + VY2 * u + 0.5 * G * u * u, TH2 + VX2 / R * u, 1.0
    u = t - T3
    x = X3 + V_ROLL * u - 0.5 * A_ROLL * u * u
    return x, GROUND, TH3 + (x - X3) / R, 1.0

def bear_pose(t):
    """(tilt mix 0..1, vertical squash factor)"""
    if t < T1:
        return 0.0, 1.0
    mix = 1.0 - smooth(BEAR_BACK0, BEAR_BACK1, t)
    u = t - T1
    squash = 1.0 - 0.03 * math.exp(-u / 0.06) * (1.0 if u < 0.5 else 0.0)
    return mix, squash

# logo crop centred on its rest position
lb = np.asarray(logo_full)[..., 3]
ys, xs = np.where(lb > 0)
pad = 40
lx0, ly0 = xs.min() - pad, ys.min() - pad
lx1, ly1 = xs.max() + pad, ys.max() + pad
logo_crop = logo_full.crop((lx0, ly0, lx1, ly1)).convert('RGBa')   # premultiplied
LCX, LCY = RX * S - lx0, RY * S - ly0        # rest centre inside crop
logo_rest = np.asarray(logo_crop).astype(np.float32) / 255.0

def render_logo(x, y, th, alpha):
    """premult float array + integer offset"""
    dx, dy = (x - RX) * S, (y - RY) * S
    if abs(th) < 1e-6 and abs(dx) < 1e-6 and abs(dy) < 1e-6:
        return logo_rest * alpha, lx0, ly0
    ix, iy = math.floor(dx), math.floor(dy)
    fx, fy = dx - ix, dy - iy
    # inverse affine: output pixel -> source pixel. rotate clockwise by th about centre, then shift by frac
    cs, sn = math.cos(th), math.sin(th)
    cx, cy = LCX + fx, LCY + fy
    a_, b_ = cs, sn
    d_, e_ = -sn, cs
    c_ = LCX - (a_ * cx + b_ * cy)
    f_ = LCY - (d_ * cx + e_ * cy)
    im = logo_crop.transform(logo_crop.size, Image.AFFINE, (a_, b_, c_, d_, e_, f_), Image.BICUBIC)
    arr = np.asarray(im).astype(np.float32) / 255.0
    return arr * alpha, lx0 + ix, ly0 + iy

def draw_logo(F, t):
    # motion blur: average sub-samples over a 180-degree shutter when moving fast
    if logo_state(t) is None and logo_state(t - 0.25 / FPS) is None and logo_state(t + 0.25 / FPS) is None:
        return
    n = 7 if (T0 - 0.02 < t < T3 + 0.05) else 3
    acc = None
    for k in range(n):
        tt = t + (k / max(n - 1, 1) - 0.5) * (0.5 / FPS) if n > 1 else t
        s_ = logo_state(tt)
        if s_ is None:
            continue
        arr, ox, oy = render_logo(*s_)
        if acc is None:
            acc = np.zeros((H + 2000, W + 2000, 4), np.float32) if False else {}
        acc[(ox, oy)] = acc.get((ox, oy), 0) + arr
    if not acc:
        return
    # combine sub-samples on a shared canvas region
    ox_min = min(k[0] for k in acc); oy_min = min(k[1] for k in acc)
    h, w = logo_rest.shape[:2]
    ox_max = max(k[0] for k in acc); oy_max = max(k[1] for k in acc)
    buf = np.zeros((h + oy_max - oy_min, w + ox_max - ox_min, 4), np.float32)
    for (ox, oy), arr in acc.items():
        buf[oy - oy_min:oy - oy_min + h, ox - ox_min:ox - ox_min + w] += arr
    buf /= n
    over(F, buf, ox_min, oy_min)

def frame(t):
    F = bg.copy()
    draw_clouds(F, t)
    over(F, title)
    draw_logo(F, t)
    over(F, upper)
    mix, sq = bear_pose(t)
    bear = bear_def * (1 - mix) + bear_tilt * mix if 0 < mix < 1 else (bear_tilt if mix >= 1 else bear_def)
    if sq < 0.999:
        h, w = bear.shape[:2]
        nh = max(int(round(h * sq)), 1)
        im = Image.fromarray((bear * 255).astype(np.uint8), 'RGBa').resize((w, nh), Image.BICUBIC)
        b2 = np.asarray(im).astype(np.float32) / 255
        over(F, b2, bdx, bdy + (h - nh))
    else:
        over(F, bear, bdx, bdy)
    over(F, caption, capx, capy)
    return (np.clip(F[..., :3], 0, 1) * 255 + 0.5).astype(np.uint8)

if __name__ == '__main__':
    print(f'fall {T0:.2f}-{T1:.3f}  flight->{T2:.3f} (x {X2:.0f})  hop->{T3:.3f} (x {X3:.0f})  exit {T4:.3f}  bear back {BEAR_BACK0:.2f}-{BEAR_BACK1:.2f}', file=sys.stderr)
    mode = sys.argv[1]
    if mode == 'stills':
        for t in [float(x) for x in sys.argv[2].split(',')]:
            Image.fromarray(frame(t)).save(f'/home/claude/work/still_{t:05.2f}.png')
    else:
        out = sys.argv[2]
        p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
                              '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast',
                              '-crf', '16', '-g', '600', '-x264-params', 'ipratio=1.0:pbratio=1.0:aq-mode=0', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
        for i in range(NF):
            p.stdin.write(frame(i / FPS).tobytes())
            if i % 60 == 0:
                print('frame', i, file=sys.stderr)
        p.stdin.close(); p.wait()
