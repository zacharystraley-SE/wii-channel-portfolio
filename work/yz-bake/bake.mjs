// node work/yz-bake/bake.mjs  (Chrome on --remote-debugging-port=9236, repo root served on 8788)
import { mkdirSync, writeFileSync } from 'node:fs';
import { cmd, ev, until, size } from '../browser.mjs';
const FPS = 30, LENGTH = 15, out = 'work/yz-bake/frames';
mkdirSync(out, { recursive: true });
await size(1920, 1080);
await cmd('Page.navigate', { url: 'http://127.0.0.1:8788/work/yz-bake/index.html' });
await until('window.bake && window.bake.ready');
for (let k = 0; k < FPS * LENGTH; k++) {
  await ev(`bake.at(${(k / FPS).toFixed(4)})`);
  const shot = await cmd('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } });
  writeFileSync(`${out}/${String(k).padStart(4, '0')}.png`, Buffer.from(shot.data, 'base64'));
}
console.log('baked', FPS * LENGTH, 'frames');
process.exit(0);
