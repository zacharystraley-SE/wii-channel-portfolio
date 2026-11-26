"""Export the Edit Lab channel layers as web assets + a JSON manifest (design units = 2560x1440 Canva canvas)."""
import json, math, shutil, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

L = '/home/claude/work/L/'
OUT = '/home/claude/proto/assets/'
os.makedirs(OUT, exist_ok=True)
man = {'design': [2560, 1440], 'elements': []}

def rgba(name):
    return np.array(Image.open(L + name).convert('RGBA'))

def save(arr, fname, q=82, lossless=False):
    im = Image.fromarray(arr, 'RGBA')
    im.save(OUT + fname, 'WEBP', quality=q, method=6, lossless=lossless, exact=False)

def bbox(a, thr=2, pad=2):
    ys, xs = np.where(a[..., 3] > thr)
    return max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad + 1, a.shape[1]), min(ys.max() + pad + 1, a.shape[0])

def add(id_, arr, role, extra=None, q=82, crop=True):
    if crop:
        x0, y0, x1, y1 = bbox(arr)
    else:
        x0, y0, x1, y1 = 0, 0, arr.shape[1], arr.shape[0]
    fname = id_ + '.webp'
    save(np.ascontiguousarray(arr[y0:y1, x0:x1]), fname, q)
    e = dict(id=id_, src='assets/' + fname, x=int(x0), y=int(y0), w=int(x1 - x0), h=int(y1 - y0), role=role)
    if extra: e.update(extra)
    man['elements'].append(e)
    return e

# background (opaque)
bg = rgba('01_bg.png'); bg[..., 3] = 255
Image.fromarray(bg[..., :3]).save(OUT + 'bg.webp', 'WEBP', quality=88, method=6)
man['elements'].append(dict(id='bg', src='assets/bg.webp', x=0, y=0, w=2560, h=1440, role='bg'))

# cloud bank (feathered edges, drawn twice with crossfade like the video)
bank = rgba('02_cloud.png').astype(np.float32)
fe = 350
ramp = np.ones(2560, np.float32); ramp[:fe] = np.linspace(0, 1, fe) ** 1.5; ramp[-fe:] = np.linspace(1, 0, fe) ** 1.5
bank[..., 3] *= ramp[None, :]
add('cloud-bank', bank.astype(np.uint8), 'bank')

# single clouds, same order + params as the render (s, o0, v, kind)
CLOUDS = [('03', 0.0, 0.0, -175, 'in'), ('08', 1.7, -2213.0, 190, 'out'), ('06', 3.3, 0.0, 120, 'in'),
          ('05', 5.0, 1752.0, -185, 'out'), ('04', 6.6, 0.0, -130, 'in'), ('07', 8.3, -1352.0, 170, 'out')]
for n, s, o0, v, kind in CLOUDS:
    add('cloud-' + n, rgba(f'{n}_cloud.png'), 'cloud', dict(s=s, o0=o0, v=v, kind=kind))

# title pieces: sticker (starburst + Zach's box), E, d, i (stem+dot), t, L, a, b
t = rgba('10_title.png')
alpha = t[..., 3]
m = ndi.binary_dilation(alpha > 40, iterations=2)
lab, n = ndi.label(m)
objs = ndi.find_objects(lab)
comps = []
for i, sl in enumerate(objs):
    area = (lab[sl] == i + 1).sum()
    if area > 800: comps.append((sl[1].start, i + 1))
comps.sort()
order = [c[1] for c in comps]  # sticker, E, d, i-stem, i-dot, t, Lab  (by x0; dot after stem by x)
# nearest-component assignment so faint shadows stay with their letter
core = np.zeros_like(lab)
for k, idx in enumerate(order): core[(lab == idx) & (alpha > 40)] = k + 1
_, (iy, ix) = ndi.distance_transform_edt(core == 0, return_indices=True)
owner = core[iy, ix]
owner[alpha == 0] = 0
names = ['sticker', 'E', 'd', 'i', 'i-dot', 't', 'Lab']
pieces = {}
for k, nm in enumerate(names):
    pieces[nm] = (owner == k + 1)
pieces['i'] = pieces['i'] | pieces.pop('i-dot')
# split "Lab" into letters with nearest-core of eroded strong alpha
labmask = pieces.pop('Lab')
strong = ndi.binary_erosion((alpha > 230) & labmask, iterations=3)
sl2, n2 = ndi.label(strong)
sizes = ndi.sum(strong, sl2, range(1, n2 + 1))
keep = [i + 1 for i in np.argsort(sizes)[::-1][:3]]
cent = sorted([(ndi.center_of_mass(sl2 == k)[1], k) for k in keep])
core2 = np.zeros_like(sl2)
for j, (_, k) in enumerate(cent): core2[sl2 == k] = j + 1
_, (iy2, ix2) = ndi.distance_transform_edt(core2 == 0, return_indices=True)
own2 = core2[iy2, ix2]
for j, nm in enumerate(['L', 'a', 'b']):
    pieces[nm] = labmask & (own2 == j + 1)
fall_order = ['sticker', 'E', 'd', 'i', 't', 'L', 'a', 'b']
for k, nm in enumerate(fall_order):
    arr = t.copy(); arr[~pieces[nm]] = 0
    add('title-' + nm, arr, 'title', dict(order=k), q=90)

# logo: square crop centred on its resting centre (rotation pivot)
logo = rgba('09_logo.png')
RX, RY, HALF = 1653.5, 1127.5, 240
x0, y0 = int(round(RX - HALF)), int(round(RY - HALF))
crop = np.ascontiguousarray(logo[y0:y0 + 2 * HALF, x0:x0 + 2 * HALF])
save(crop, 'logo.webp', 90)
man['elements'].append(dict(id='logo', src='assets/logo.webp', x=x0, y=y0, w=2 * HALF, h=2 * HALF, role='logo',
                            cx=RX, cy=RY))

# overlay (CD case + haze), full frame
add('overlay', rgba('11_overlay.png'), 'overlay', q=80, crop=False)

# bear default + tilt on a shared box
bd, bt = rgba('12_bear.png'), rgba('12b_bear_tilt.png')
u = bd.copy(); u[..., 3] = np.maximum(bd[..., 3], bt[..., 3])
x0, y0, x1, y1 = bbox(u, pad=4)
for nm, arr in (('bear', bd), ('bear-tilt', bt)):
    save(np.ascontiguousarray(arr[y0:y1, x0:x1]), nm + '.webp', 90)
    man['elements'].append(dict(id=nm, src=f'assets/{nm}.webp', x=int(x0), y=int(y0), w=int(x1 - x0), h=int(y1 - y0),
                                role='bear' if nm == 'bear' else 'bear-tilt'))

# caption: text + arrow
c = rgba('13_caption.png')
m = ndi.binary_dilation(c[..., 3] > 8, iterations=6)
lab, n = ndi.label(m)
objs = sorted([(sl[0].start, i + 1) for i, sl in enumerate(ndi.find_objects(lab))])
for k, (nm, (_, idx)) in enumerate(zip(['caption-text', 'caption-arrow'], objs)):
    arr = c.copy(); arr[lab != idx] = 0
    add(nm, arr, 'caption', dict(order=k), q=90)

# zoom target: the cyan iMac's screen (design units)
man['zoom'] = dict(screen=[943, 397, 1070, 500])
# loop timing constants shared with the video render
man['loop'] = dict(duration=10.0, fps=60)
shutil.copy('/home/claude/work/zachs-edit-lab-channel-loop-v2.mp4', OUT + 'loop.mp4')
json.dump(man, open('/home/claude/proto/manifest.json', 'w'), indent=1)
tot = sum(os.path.getsize(OUT + f) for f in os.listdir(OUT))
print(len(man['elements']), 'elements', round(tot / 1e6, 2), 'MB')
for e in man['elements']: print(e['id'], e['x'], e['y'], e['w'], e['h'], os.path.getsize(OUT + e['src'].split('/')[-1]) // 1024, 'KB')
