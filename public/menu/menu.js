const $ = selector => document.querySelector(selector);
const home = $('#home'), grid = $('#grid'), tile = $('#edit-tile');
const stage = $('#stage'), video = $('#loop'), preview = $('#preview'), screen = $('#screen');
const start = $('#pv-start'), menu = $('#pv-menu'), back = $('#back'), final = $('#final');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const page = screen.querySelector('.page');
const enterPage = $('#enter-page');
let wheelDistance = 0, lastWheel = -Infinity, wheelTail = false;
let swipeOrigin = null;
let readerMotion = null;
let origin = tile, state = 'home', busy = false, channel, preparation;

function emptySlot(parent) {
  const slot = document.createElement('div');
  slot.className = 'tile empty';
  slot.setAttribute('aria-hidden','true');
  const noise = document.createElement('canvas');
  noise.width = 156;
  noise.height = 80;
  slot.append(noise);
  parent.append(slot);
}
while (grid.childElementCount < 12) emptySlot(grid);
for (let i = 0; i < 3; i++) emptySlot($('.edge'));

// Update scattered grains independently. A tile never pans or swaps an entire texture.
const grainFields = [...home.querySelectorAll('.empty canvas')].map(canvas => {
  const context = canvas.getContext('2d', {alpha:false});
  const pixels = context.createImageData(canvas.width, canvas.height);
  const shades = new Uint32Array(pixels.data.buffer);
  const randomGrey = () => (Math.random() * 256 | 0) * 0x010101 + 0xff000000;
  for (let i = 0; i < shades.length; i++) shades[i] = randomGrey();
  function paint() {
    for (let i = 0; i < shades.length / 5; i++) {
      shades[Math.floor(Math.random() * shades.length)] = randomGrey();
    }
    context.putImageData(pixels, 0, 0);
  }
  return paint;
});
let grainTimer;
function syncGrain() {
  clearTimeout(grainTimer);
  if (document.hidden || reduced.matches || state !== 'home') return;
  function tick() {
    for (const paint of grainFields) paint();
    grainTimer = setTimeout(tick, 50 + Math.random() * 45);
  }
  tick();
}
document.addEventListener('visibilitychange', syncGrain);
reduced.addEventListener('change', syncGrain);
syncGrain();

// The hollow seven-segment face follows the console clock, including the changing colon.
const segments = ['2,1 13,1 15,3 13,5 3,5 1,3','14,4 16,3 16,13 14,15 12,13 12,6','14,16 16,18 16,27 14,29 12,27 12,18','3,27 12,27 14,29 12,31 3,31 1,29','1,16 3,18 3,26 1,28 0,26 0,18','1,4 3,6 3,13 1,15 0,13 0,6','3,14 12,14 14,16 12,18 3,18 1,16'];
const digitSegments = ['012345','12','01643','01623','5612','05623','056432','012','0123456','012356'];
function clock() {
  const now = new Date(), time = now.getHours()+':'+String(now.getMinutes()).padStart(2,'0');
  const date = new Intl.DateTimeFormat('en-GB',{weekday:'short'}).format(now)+' '+new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit'}).format(now);
  $('#digits').innerHTML = Array.from(time,ch => ch === ':' ? '<svg viewBox="0 0 5 32"><circle cx="2.5" cy="11" r="1.9"/><circle cx="2.5" cy="21" r="1.9"/></svg>' : '<svg viewBox="0 0 17 32">'+Array.from(digitSegments[Number(ch)],n=>'<polygon points="'+segments[Number(n)]+'"/>').join('')+'</svg>').join('');
  $('#date').textContent=date; $('.clock').setAttribute('aria-label',time+' '+date);
  setTimeout(clock, 60000-now.getSeconds()*1000-now.getMilliseconds());
}
clock();

function tileBounds(){
  const r=origin.getBoundingClientRect();
  return {left:r.left+2, top:r.top+2, width:r.width-4,height:r.height-4,borderRadius:'5% / 12%'};
}
const fullBounds = () => ({left:0,top:0,width:innerWidth,height:innerHeight,borderRadius:'0px'});
function pixels(rect) {
  return Object.fromEntries(Object.entries(rect).map(([k,v])=>[k,typeof v==='number'?v+'px':v]));
}
function pin(rect){Object.assign(stage.style,pixels(rect));}
async function expand(open){
  const from=stage.getBoundingClientRect(), to=open?fullBounds():tileBounds();
  const animation=stage.animate([pixels({left:from.left,top:from.top,width:from.width,height:from.height,borderRadius:getComputedStyle(stage).borderRadius}),pixels(to)],{duration:reduced.matches?1:(open?520:480),easing:'cubic-bezier(.3,.7,.2,1)',fill:'both'});
  await animation.finished;pin(open?fullBounds():tileBounds());animation.cancel();
}
function resize(){
  if(state==='home')pin(tileBounds());
  else if(!busy){pin(fullBounds()); if(state==='channel'){channel.layoutFinal();if(screen.classList.contains('reading'))Object.assign(screen.style,rectStyles(final.getBoundingClientRect()))}}
}
new ResizeObserver(()=>resize()).observe(grid);addEventListener('resize',resize);
function idlePlayback(){
  if(reduced.matches){video.pause();}else if(state==='home'||state==='preview')video.play().catch(()=>{});
}
reduced.addEventListener('change',idlePlayback);
stage.classList.add('idle');resize();stage.style.visibility='visible';idlePlayback();
async function prepare(){
  if(channel || preparation)return;
  start.disabled=true;start.textContent='Loading…';$('#status').textContent='';
  preparation=import('../channels/edit-lab/transition.js').then(module=>module.prepareChannel());
  try{channel=await preparation;start.textContent='Start';}
  catch{start.textContent='Retry';$('#status').textContent='Channel artwork could not load.';}
  finally{preparation=null;start.disabled=false;}
}
async function select(event){
  if(busy||state!=='home')return;
  origin=event.currentTarget;busy=true;state='preview';syncGrain();
  home.inert=true;home.classList.add('departing');stage.classList.remove('idle');
  prepare();await expand(true);
  preview.inert=false;preview.style.visibility='visible';preview.style.opacity=1;
  busy=false;(start.disabled?menu:start).focus({preventScroll:true});
}
async function goHome(){
  if(readerMotion)await readerMotion;
  if(busy||state==='home')return;
  busy=true;back.disabled=true;
  if(state==='channel'){
    final.inert=true;
    if(screen.classList.contains('reading'))await moveThroughGlass(false);
    page.scrollTop=0;wheelTail=false;swipeOrigin=null;
    await channel.closeChannel();
  }
  preview.inert=true;preview.style.visibility='hidden';preview.style.opacity=0;
  home.classList.remove('departing');await expand(false);
  stage.classList.add('idle');home.inert=false;state='home';busy=false;syncGrain();
  back.disabled=false;origin.focus({preventScroll:true});resize();idlePlayback();
}
function rectStyles(rect) {
  return pixels({left:rect.left,top:rect.top,width:rect.width,height:rect.height});
}

async function moveThroughGlass(open) {
  const bezel = $('#final-imac');
  final.classList.add('turning');
  final.classList.remove('reader-open');
  const quiet=reduced.matches;
  const fade=quiet?final.animate([{opacity:1},{opacity:0}],{duration:90,fill:'forwards'}):null;
  if(fade)await fade.finished;
  channel.layoutFinal();
  const glass = screen.getBoundingClientRect();
  const viewport = final.getBoundingClientRect();
  const photo = bezel.getBoundingClientRect();
  const scale = Math.max(viewport.width / glass.width, viewport.height / glass.height);
  const cx = glass.left + glass.width / 2, cy = glass.top + glass.height / 2;
  bezel.style.transformOrigin = (cx-photo.left)+'px '+(cy-photo.top)+'px';

  const frames = [rectStyles(glass),rectStyles(viewport)];
  const lens = [{transform:'none'},{transform:'translate('+(viewport.width/2-cx)+'px,'+(viewport.height/2-cy)+'px) scale('+scale+')'}];
  const options = {duration:reduced.matches?150:650,easing:'cubic-bezier(.4,0,.18,1)',direction:open?'normal':'reverse'};
  screen.classList.toggle('reading',open);
  if(!quiet){
    // Animate the actual bounds so type reflows at its live container width.
    await Promise.all([screen.animate(frames,options).finished,bezel.animate(lens,options).finished]);
  }
  channel.layoutFinal();
  if(open)Object.assign(screen.style,rectStyles(final.getBoundingClientRect()));
  final.classList.toggle('reader-open',open);
  if(fade){
    fade.cancel();
    await final.animate([{opacity:0},{opacity:1}],{duration:110}).finished;
  }
  final.classList.remove('turning');
}

async function revealPage(){
  if(state!=='channel'||busy||screen.classList.contains('reading'))return;
  busy=true;page.scrollTop=0;
  readerMotion=moveThroughGlass(true);
  try{await readerMotion;page.focus({preventScroll:true});}
  finally{readerMotion=null;busy=false;resize();}
}

final.addEventListener('wheel',event=>{
  if(state!=='channel'||event.ctrlKey||event.metaKey)return;
  const now=performance.now();
  // Browsers expose wheel deltas, but no standard trackpad gesture-end event.
  if(now-lastWheel>160){wheelTail=false;wheelDistance=0;}
  lastWheel=now;
  if(wheelTail||readerMotion){event.preventDefault();return;}
  if(busy||screen.classList.contains('reading'))return;
  if(event.deltaY<=0||Math.abs(event.deltaX)>event.deltaY){wheelDistance=0;return;}
  event.preventDefault();
  const unit=event.deltaMode===1?16:event.deltaMode===2?innerHeight:1;
  wheelDistance+=event.deltaY*unit;
  if(wheelDistance>=8){wheelTail=true;revealPage();}
},{passive:false});

final.addEventListener('touchstart',event=>{
  const touch=event.touches[0];
  swipeOrigin=event.touches.length===1?[touch.clientX,touch.clientY]:null;
},{passive:true});
final.addEventListener('touchmove',event=>{
  if(event.touches.length!==1){swipeOrigin=null;return;}
  if(!swipeOrigin||busy||state!=='channel'||screen.classList.contains('reading'))return;
  const touch=event.touches[0],dy=swipeOrigin[1]-touch.clientY;
  if(dy>=22&&dy>Math.abs(touch.clientX-swipeOrigin[0])){
    swipeOrigin=null;revealPage();
  }
},{passive:true});
final.addEventListener('touchend',()=>{swipeOrigin=null;},{passive:true});
final.addEventListener('touchcancel',()=>{swipeOrigin=null;},{passive:true});
enterPage.addEventListener('click',revealPage);
async function enter(){
  if(busy||state!=='preview')return;
  if(!channel){await prepare();return;}
  busy=true;preview.inert=true;
  await channel.startChannel();channel.layoutFinal();pin(fullBounds());
  page.scrollTop=0;wheelDistance=0;wheelTail=false;lastWheel=-Infinity;
  state='channel';busy=false;final.inert=false;resize();enterPage.focus({preventScroll:true});
}
new ResizeObserver(([entry])=>{
  const {width,height}=entry.contentRect;
  screen.style.setProperty('--screen-w',Math.round(width)+'px');
  screen.style.setProperty('--screen-h',Math.round(height)+'px');
}).observe(screen);
tile.addEventListener('click',select);menu.addEventListener('click',goHome);back.addEventListener('click',goHome);start.addEventListener('click',enter);
addEventListener('keydown',event=>{if(event.key==='Escape' && state!=='home'){event.preventDefault();goHome();}});
