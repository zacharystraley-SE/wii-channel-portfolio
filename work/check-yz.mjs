// Yester Zone smoke test: node work/check-yz.mjs (Chrome on 9236, public/ served on 8787 with Range support)
import assert from 'node:assert/strict';
import { size, cmd, ev, until, sleep, shot, errors } from './browser.mjs';
// The Start transition plays Zach's full 15 s camera path, longer than until()'s 14 s budget.
async function untilLong(test, ms = 40000) { const end = Date.now() + ms; while (Date.now() < end) { if (await ev(test)) return; await sleep(200); } throw Error(test); }
async function clickAt(selector) {
  const [x, y] = await ev('(()=>{const r=document.querySelector(' + JSON.stringify(selector) + ').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()');
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await cmd('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
}
await cmd('Network.enable'); await cmd('Network.setCacheDisabled', { cacheDisabled: true });
await cmd('Emulation.setEmulatedMedia', { features: [] });
await size(1440, 900);
await cmd('Page.navigate', { url: 'http://127.0.0.1:8787/' });
await until('document.querySelector("#yz-loop")?.currentTime>0.3 && document.querySelector("#loop")?.currentTime>0.3');
assert.equal(await ev('document.querySelectorAll("#grid .tile").length'), 12);
await shot('yz-home');
await clickAt('#yz-tile');
await until('!document.querySelector("#preview").inert');
await until('document.querySelector("#pv-start").textContent==="Start" && !document.querySelector("#pv-start").disabled');
await sleep(400); await shot('yz-preview');
assert.equal(await ev('document.querySelector("#preview").getAttribute("aria-label")'), 'The Yester Zone preview');
await ev('document.querySelector("#pv-start").click()');
await sleep(6000); await shot('yz-swing-mid');
await untilLong('document.querySelector("#final").inert===false');
await sleep(500); await shot('yz-final');
assert.equal(await ev('document.querySelector("#final").dataset.channel'), 'yester-zone');
assert(await ev('document.querySelector(".yz-tv .yz-pic").currentTime>0'));
// channel up
await ev('document.querySelector(".yz-up").click()'); await sleep(600);
const idx = await ev('[...document.querySelectorAll(".yz-list li")].findIndex(li=>li.getAttribute("aria-current")==="true")');
await shot('yz-final-ch');
// reading mode
await ev('document.querySelector("#enter-page").click()');
await until('document.querySelector("#final").classList.contains("reader-open")');
await ev('document.querySelector(".page").scrollTop=10000'); await sleep(300); await shot('yz-reading');
// back home
await ev('document.querySelector("#back").click()');
await untilLong('!document.querySelector("#home").inert'); await sleep(300); await shot('yz-back-home');
assert(await ev('document.activeElement.id==="yz-tile"'));
// Edit Lab still opens with its own page after visiting Yester Zone
await clickAt('#edit-tile'); await until('!document.querySelector("#preview").inert');
await until('document.querySelector("#pv-start").textContent==="Start" && !document.querySelector("#pv-start").disabled');
await ev('document.querySelector("#pv-start").click()'); await untilLong('document.querySelector("#final").inert===false'); await sleep(500);
assert.equal(await ev('document.querySelector(".page h1").textContent'), 'Zach’s Edit Lab');
assert(await ev('document.querySelector("#final-imac").src.includes("edit-lab")'));
await shot('yz-then-editlab');
await ev('document.querySelector("#back").click()'); await untilLong('!document.querySelector("#home").inert');
// phone
await size(390, 844, true); await sleep(300);
await clickAt('#yz-tile'); await until('!document.querySelector("#preview").inert');
await until('document.querySelector("#pv-start").textContent==="Start" && !document.querySelector("#pv-start").disabled');
await ev('document.querySelector("#pv-start").click()'); await untilLong('document.querySelector("#final").inert===false'); await sleep(500);
await shot('yz-phone');
console.log('channel after CH up:', idx, 'errors:', errors);
assert.deepEqual(errors, []);
console.log('yester zone check passed');
process.exit(0);
