from PIL import Image
import numpy as np
from scipy import ndimage as ndi
src = np.asarray(Image.open('/home/claude/work/L/imac_src.png').convert('RGB')).astype(np.float32)
mn, mx = src.min(2), src.max(2)
cand = (mn >= 244) & ((mx - mn) <= 8)
lab, n = ndi.label(cand)
border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
bg = np.isin(lab, border[border > 0])
bg = ndi.binary_opening(bg, iterations=1)
# soft edge: alpha from distance + how close to white the edge pixel is
dist = ndi.distance_transform_edt(~bg)
whiteness = np.clip((mn - 200) / 55, 0, 1)
alpha = np.where(bg, 0.0, 1.0)
band = (~bg) & (dist <= 2.5)
alpha[band] = np.clip(1 - whiteness[band] * (1 - dist[band] / 3), 0.15, 1)
alpha = ndi.gaussian_filter(alpha, 0.7)
alpha[bg & (ndi.distance_transform_edt(bg) > 2)] = 0
a3 = alpha[..., None]
col = np.clip((src - (1 - a3) * 255) / np.maximum(a3, 0.05), 0, 255)
out = np.dstack([col, alpha * 255]).astype(np.uint8)
Image.fromarray(out, 'RGBA').save('/home/claude/work/L/imac_cut.png')
ys, xs = np.where(alpha > 0.5); print('bbox', xs.min(), xs.max(), ys.min(), ys.max())
im = Image.fromarray(out, 'RGBA')
for nm, c in [('dark', (30, 40, 60, 255)), ('mag', (255, 0, 255, 255))]:
    p = Image.new('RGBA', im.size, c); p.alpha_composite(im); p.convert('RGB').resize((627, 627)).save(f'/home/claude/work/chk/imac_{nm}.jpg', quality=88)
