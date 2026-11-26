import assert from 'node:assert/strict';
import {size,cmd,ev,until,sleep,socket,shot,errors} from './browser.mjs';
const reading='document.querySelector("#final").classList.contains("reader-open") && !document.querySelector("#final").classList.contains("turning")';
const top=()=>ev('document.querySelector(".page").scrollTop');
const wheel=(dy,dx=0)=>cmd('Input.dispatchMouseEvent',{type:'mouseWheel',x:480,y:310,deltaY:dy,deltaX:dx});
const active=id=>'document.activeElement.id==="'+id+'"',start=async()=>{await until('document.querySelector("#pv-start").textContent==="Start" && !document.querySelector("#preview").inert && !document.querySelector("#pv-start").disabled');await ev('document.querySelector("#pv-start").click()')};
async function clickAt(selector){
 const [x,y]=await ev('(()=>{const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()');
 for(const type of ['mouseMoved','mousePressed','mouseReleased'])await cmd('Input.dispatchMouseEvent',{type,x,y,button:type==='mouseMoved'?'none':'left',clickCount:type==='mouseMoved'?0:1});
}
async function key(k){await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:k,code:k,windowsVirtualKeyCode:k==='Enter'?13:27,text:k==='Enter'?'\r':''});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:k,code:k});}
async function visit(){await clickAt('#edit-tile');await until('!document.querySelector("#preview").inert');}
async function home(){await until('!document.querySelector("#home").inert');assert(await ev(active('edit-tile')));}
await cmd('Emulation.setEmulatedMedia',{features:[]});await cmd('Emulation.setTouchEmulationEnabled',{enabled:false});await size(1440,900);await cmd('Page.navigate',{url:'http://127.0.0.1:8787/'});await until('document.querySelector("#loop")?.currentTime>0.1');assert.equal(await ev('document.querySelectorAll("#grid .tile").length'),12);await shot('home');
await visit();await shot('preview');await ev('document.querySelector("#loop").currentTime=9.9');await until('!document.querySelector("#loop").seeking && document.querySelector("#loop").currentTime<2');await clickAt('#pv-menu');await home();
for (const time of [1.52,8.7]){
 await visit();await ev('document.querySelector("#loop").currentTime='+time);await until('!document.querySelector("#loop").seeking');await start();
 await until('document.querySelector("#final").inert===false');
 assert.equal(await ev('document.querySelector("#screen").offsetWidth'),1032);
 assert(await ev('document.querySelector("#loop").paused'));
 assert.equal(await top(),0);
 await wheel(-80);await wheel(2,40);
 assert(!await ev(reading));
 await ev('window.originalHeading=document.querySelector(".page h1");void 0');
 await wheel(48);
 for(let k=0;k<14;k++){await sleep(45);await wheel(7)}
 await until(reading);
 assert.equal(await top(),0);
 assert(await ev('window.originalHeading===document.querySelector(".page h1") && originalHeading.getBoundingClientRect().top>=0 && originalHeading.getBoundingClientRect().bottom<innerHeight'));
 assert.equal(await ev('document.querySelector("#screen").offsetWidth'),1440);
 await sleep(220);await wheel(152);await until('document.querySelector(".page").scrollTop>0');
 await wheel(-600);await until('document.querySelector(".page").scrollTop===0');assert(await ev(reading));
 await sleep(550);await shot('imac');await key('Escape');await home();
}
await size(390,844,true);await cmd('Emulation.setTouchEmulationEnabled',{enabled:true});await sleep(200);
const pt=await ev('(()=>{const r=document.querySelector("#edit-tile").getBoundingClientRect();return {x:r.x+25,y:r.y+25}})()');await cmd('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pt]});await cmd('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
await start();await until('!document.querySelector("#final").inert');assert.equal(await ev('document.querySelector("#screen").offsetWidth'),356);await shot('phone-glass');
await cmd('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:190,y:450}]});
for(let y=435;y>=330;y-=15){await cmd('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:190,y}]});await sleep(30)}
await cmd('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await until(reading);
assert.equal(await top(),0);assert.equal(await ev('document.querySelector("#screen").offsetWidth'),390);await shot('phone');
await size(844,390,true);await until('document.querySelector("#screen").offsetWidth===844');await size(390,844,true);await until('document.querySelector("#screen").classList.contains("reading")');await clickAt('#back');await home();
await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await size(1440,900);await key('Enter');await until('!document.querySelector("#preview").inert');await start();await until('!document.querySelector("#final").inert');
assert(await ev('document.querySelector("#loop").paused'));assert(await ev(active('enter-page')));await key('Enter');await until(reading);await key('Escape');await home();
assert(await ev('document.querySelector("#loop").paused'));assert.deepEqual(errors,[]);console.log('PASS · preview cancel · loop wrap · 2 handoffs · dimensions · scroll · touch · rotation · focus · reduced motion');socket.close();
