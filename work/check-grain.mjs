import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {cmd,ev,until,size,sleep,socket,errors} from './browser.mjs';
await size(668,605);
await cmd('Emulation.setEmulatedMedia',{features:[]});
await cmd('Page.navigate',{url:'http://127.0.0.1:8787/'});
// 9 empty grid slots + 3 edge slots (Edit Lab, Yester Zone and the name tag take the other three)
await until("document.querySelectorAll('.empty canvas').length===12");
await sleep(500);
const clip=await ev("(()=>{const r=document.querySelectorAll('#grid .empty')[3].getBoundingClientRect();return {x:Math.ceil(r.x)+4,y:Math.ceil(r.y)+4,width:Math.floor(r.width)-8,height:Math.floor(r.height)-8,scale:1}})()");
async function capture(){return (await cmd('Page.captureScreenshot',{format:'png',clip})).data}
mkdirSync('work/grain-review',{recursive:true});
const frames=new Set();
for(let i=0;i<90;i++){
 const frame=await capture();frames.add(frame);writeFileSync('work/grain-review/'+i+'.png',Buffer.from(frame,'base64'));await sleep(100);
}
assert.equal(frames.size,90);
await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
await sleep(400);const still=await capture();await sleep(400);assert.equal(await capture(),still);
assert.deepEqual(errors,[]);socket.close();
