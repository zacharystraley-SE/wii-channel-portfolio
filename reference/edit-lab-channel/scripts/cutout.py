from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage as ndi
src = np.asarray(Image.open('/home/claude/work/L/12b_bear_tilt_src.png').convert('RGB')).astype(np.float32)
mx, mn = src.max(2), src.min(2)
L = src.mean(2)
cand = (mn >= 222) & ((mx - mn) <= 14)
lab, n = ndi.label(cand)
border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
bg = np.isin(lab, border[border > 0])
# local background luminance (checker): estimate by grey-dilating bg luminance into the edge band
Lbg = np.where(bg, L, 0)
cnt = ndi.uniform_filter(bg.astype(np.float32), 15)
Lbg_s = ndi.uniform_filter(Lbg, 15) / np.maximum(cnt, 1e-3)
Lbg_s = np.where(cnt > 0.01, Lbg_s, 250)
dist = ndi.distance_transform_edt(~bg)
band = (dist > 0) & (dist <= 5)
LF = 55.0
alpha = np.ones_like(L)
alpha[bg] = 0
al_band = np.clip((Lbg_s - L) / np.maximum(Lbg_s - LF, 1), 0, 1)
alpha[band] = al_band[band]
alpha = ndi.gaussian_filter(alpha, 0.6) * (~bg | (dist > 0))
alpha = np.clip(alpha, 0, 1)
# decontaminate colour
a3 = alpha[..., None]
B = np.repeat(Lbg_s[..., None], 3, 2)
col = np.where(a3 > 0.02, (src - (1 - a3) * B) / np.maximum(a3, 0.02), 0)
col = np.clip(col, 0, 255)
out = np.dstack([col, alpha * 255]).astype(np.uint8)
im = Image.fromarray(out, 'RGBA')
im.save('/home/claude/work/L/12b_bear_tilt_cut.png')
ys, xs = np.where(alpha > 0.5); print('bbox', xs.min(), xs.max(), ys.min(), ys.max())
# previews on magenta and on dark
for name, c in [('mag', (255, 0, 255)), ('blue', (40, 60, 140))]:
    p = Image.new('RGBA', im.size, c + (255,)); p.alpha_composite(im); p.convert('RGB').save(f'/home/claude/work/chk/tilt_{name}.jpg', quality=90)
