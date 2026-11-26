from PIL import Image
import numpy as np
from scipy.signal import fftconvolve
o = np.asarray(Image.open('/home/claude/work/L/12_bear.png'))[..., 3].astype(np.float32) / 255
ox0, oy0, ox1, oy1 = 940, 900, 1300, 1400
O = o[oy0:oy1, ox0:ox1]
# lower body region of original (legs, paws, tail): below y=1140 in canvas
Ow = O.copy(); Ow[:1140 - oy0] = 0
t = Image.open('/home/claude/work/L/12b_bear_tilt_cut.png')
best = None
for s in np.arange(0.300, 0.380, 0.002):
    ti = t.resize((round(t.width * s), round(t.height * s)), Image.LANCZOS)
    T = np.asarray(ti)[..., 3].astype(np.float32) / 255
    # correlate (zero-mean-ish via 2T-1 on valid)
    Tc = 2 * T - 1; Oc = 2 * Ow - 1; Oc[:1140 - oy0] = 0
    # restrict tilt to its lower part too (below its own 52% height)
    Tm = Tc.copy(); Tm[:int(T.shape[0] * 0.50)] = 0
    corr = fftconvolve(Oc, Tm[::-1, ::-1], mode='full')
    i = np.unravel_index(np.argmax(corr), corr.shape)
    dy, dx = i[0] - (T.shape[0] - 1), i[1] - (T.shape[1] - 1)
    # IoU on lower region
    canvas = np.zeros_like(O)
    y0, x0 = dy, dx
    ys0, xs0 = max(y0, 0), max(x0, 0)
    ys1, xs1 = min(y0 + T.shape[0], O.shape[0]), min(x0 + T.shape[1], O.shape[1])
    canvas[ys0:ys1, xs0:xs1] = T[ys0 - y0:ys1 - y0, xs0 - x0:xs1 - x0]
    lo = slice(1140 - oy0, None)
    inter = np.minimum(canvas[lo], O[lo]).sum(); uni = np.maximum(canvas[lo], O[lo]).sum()
    iou = inter / uni
    if best is None or iou > best[0]:
        best = (iou, s, dx + ox0, dy + oy0)
print('best IoU %.4f scale %.3f pos %d,%d' % best)
iou, s, X, Y = best
ti = t.resize((round(t.width * s), round(t.height * s)), Image.LANCZOS)
full = Image.new('RGBA', (2560, 1440)); full.alpha_composite(ti, (int(X), int(Y)))
full.save('/home/claude/work/L/12b_bear_tilt.png')
# overlay preview: original red-tinted vs tilt
base = Image.open('/home/claude/work/composite.png').convert('RGBA').crop((900, 860, 1340, 1400))
a = Image.open('/home/claude/work/L/12_bear.png').crop((900, 860, 1340, 1400))
b = full.crop((900, 860, 1340, 1400))
A = np.asarray(a)[..., 3] > 128; Bm = np.asarray(b)[..., 3] > 128
dbg = np.zeros(A.shape + (3,), np.uint8) + 255
dbg[A & ~Bm] = (230, 60, 60); dbg[Bm & ~A] = (60, 90, 230); dbg[A & Bm] = (90, 90, 90)
sheet = Image.new('RGB', (440 * 3, 540), 'white')
sheet.paste(Image.fromarray(dbg), (0, 0))
p1 = Image.new('RGBA', (440, 540), (235, 240, 245, 255)); p1.alpha_composite(a); sheet.paste(p1.convert('RGB'), (440, 0))
p2 = Image.new('RGBA', (440, 540), (235, 240, 245, 255)); p2.alpha_composite(b); sheet.paste(p2.convert('RGB'), (880, 0))
sheet.save('/home/claude/work/chk/align.jpg', quality=88)
