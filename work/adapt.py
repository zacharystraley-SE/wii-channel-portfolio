from pathlib import Path
p=Path('reference/edit-lab-channel/index.template.html').read_text()
c=Path('public/channels/edit-lab')
css=p.split('/* ---------- stage:')[1].split('@media(max-width')[0];css='/* Stage '+css
css=css[:css.index('.blank{')]+css[css.index('.back{'):]
(c/'channel.css').write_text(css)
s=p[p.index('const DW'):p.index('/* ===== home grid + wiring')]
s=s.replace("const $ = s => document.querySelector(s);","const $ = s => document.querySelector(s);")
s=s.replace('n.src = e.src','n.src = asset(e.src)').replace('bDef.src = be.src; bTilt.src = byId[\'bear-tilt\'].src','bDef.src = asset(be.src); bTilt.src = asset(byId[\'bear-tilt\'].src)').replace('finalImg.src = MAN.hires.src','finalImg.src = asset(MAN.hires.src)')
s=s.replace("let mode = 'home', busy = false;","")
s=s.replace('const fitScale = (W, H) => Math.max(W / DW, H / DH);','const fitScale = (W, H) => W < H ? Math.min(W / DW, H / DH) : Math.max(W / DW, H / DH);')
s=s[:s.index('function placeOnTile()')]+s[s.index('/* ===== final state:'):]
s=s.replace(", dims = $('#dims')","")
start=s.index("  document.documentElement.style.setProperty(");end=s.index('\n}',start);s=s[:start]+s[end:]
s=s.replace("const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;","const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;")
s=s[:s.index('function stageTo(')]+s[s.index('async function startChannel()'):]
s=s.replace("""  if (busy || mode !== 'preview') return; busy = true;""","  const reduce = reduced();")
s=s.replace("  mode = 'channel'; busy = false; backBtn.focus({ preventScroll: true });","")
s=s.replace("  if (busy || mode !== 'channel') return; busy = true; mode = 'closing';","  const reduce = reduced();")
s=s[:s.index('  await stageTo(fullRect(), tileRect(), 480)')]+'}\n'
s=s.replace("  preview.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }).finished.then(() => show(preview, false));","  show(preview, false);")
s=s.replace("  if (reduce) await finalEl.animate","  if (reduce) await finalEl.animate")
s=s.replace("  video.currentTime = 0; video.style.visibility = 'visible'; await video.play().catch(() => {});","  video.currentTime = 0; video.style.visibility = 'visible';\n  if (!reduce) await video.play().catch(() => {});")
s=s.replace("  const W = vw(), H = vh();\n  applyState(video.currentTime % DUR);","  const W = vw(), H = vh();\n  applyState(video.currentTime % DUR);")
s=s.replace("  const finalImg", "  const finalImg")
s=s.replace(", home = $('#home')","")
s=s.replace("  // swap to the crisp", "  scene.getAnimations().forEach(a => a.cancel());\n  const [endScale,endX,endY] = zoomEnd(vw(),vh());\n  scene.style.transform = cam(endScale,endX,endY);\n  // swap to the crisp")
s=s.replace("  const W = vw(), H = vh();\n  show(stage, true);","  const W = vw(), H = vh();\n  show(stage, true);")
(c/'transition.js').write_text("""// Edit Lab's Web Animations choreography, paired with the authored v2 loop.
const asset = path => new URL(path, import.meta.url).href;

export async function prepareChannel() {
 const response = await fetch(asset('manifest.json'));
 if (!response.ok) throw new Error('Could not load Edit Lab layers');
 const MAN = await response.json();
"""+s+"""
 try {
   await Promise.all([...scene.querySelectorAll('img'), finalImg].map(node => node.decode()));
 } catch (error) {
   scene.replaceChildren();
   throw error;
 }
 return { startChannel, closeChannel, layoutFinal };
}
""")
