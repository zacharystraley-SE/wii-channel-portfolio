import {cmd,ev,size,sleep,until,shot,socket,errors} from './browser.mjs';
import assert from 'node:assert/strict';
await cmd('Emulation.setEmulatedMedia',{features:[]});await size(1280,720);
await cmd('Page.navigate',{url:'http://127.0.0.1:8787/'});await until('document.querySelector("#loop")?.currentTime>.1');
await ev('document.querySelector("#edit-tile").click()');await until('!document.querySelector("#preview").inert && !document.querySelector("#pv-start").disabled');
await ev('(()=>{const v=document.querySelector("#loop");v.pause();v.currentTime=1.58;})()');await until('!document.querySelector("#loop").seeking');await sleep(100);
await ev('document.querySelector("#preview").style.opacity=0');await shot('source-frame');
await cmd('Animation.enable');await cmd('Animation.setPlaybackRate',{playbackRate:0});await ev('document.querySelector("#pv-start").click()');await until('document.querySelector("#scene").style.visibility==="visible"');await shot('layers-frame');
await cmd('Animation.setPlaybackRate',{playbackRate:1});await until('!document.querySelector("#final").inert');
await ev('document.querySelector(".page").innerHTML="<article><h1>Replacement content</h1></article>"');await size(1050,760);await sleep(200);
assert(await ev('document.querySelector(".page h1").textContent==="Replacement content"'));
await ev('document.querySelector("#back").click()');await until('!document.querySelector("#home").inert');assert.deepEqual(errors,[]);console.log('Replacement page and return verified');socket.close()
