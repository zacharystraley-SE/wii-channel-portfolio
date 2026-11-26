import {size,cmd,ev,until,sleep,socket} from './browser.mjs';
await size(1440,900);await cmd('Page.navigate',{url:'http://127.0.0.1:8786'});await until("document.querySelector('#hint')?.textContent.includes('Click')");
for(const go of [false,true]){
 await ev("document.querySelector('.tile.live').click()");await until("document.activeElement.id==='pv-start'");
 if(go){await ev("document.querySelector('#pv-start').click()");await until("document.activeElement.id==='back'");console.log(await ev("document.querySelector('#dims').textContent"));await ev("document.querySelector('#back').click()")}
 else await ev("document.querySelector('#pv-menu').click()");
 await until("document.querySelector('#stage').getBoundingClientRect().width < 450");await sleep(900)
}console.log('Both original return paths passed');socket.close()
