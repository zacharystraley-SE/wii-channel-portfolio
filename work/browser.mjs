import {writeFileSync} from 'node:fs';
const target=(await (await fetch('http://127.0.0.1:9236/json/list')).json()).find(x=>x.type==='page');
export const socket=new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r=>socket.onopen=r);
let id=0;const calls=new Map(); export const errors=[];
socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description);if(m.id){const [resolve,reject]=calls.get(m.id);calls.delete(m.id);m.error?reject(Error(m.error.message)):resolve(m.result)}};
export function cmd(method,params={}){return new Promise((res,rej)=>{calls.set(++id,[res,rej]);socket.send(JSON.stringify({id,method,params}))})}
export async function ev(expression){const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value}
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function until(test){for(let i=0;i<180;i++){if(await ev(test))return;await sleep(80)}throw Error(test)}
export async function size(width,height,mobile=false){await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});}
export async function shot(name){writeFileSync('work/'+name+'.png',Buffer.from((await cmd('Page.captureScreenshot')).data,'base64'))}
await cmd('Runtime.enable');await cmd('Page.enable');
