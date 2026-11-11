/** Record one pitch-article take: the real Flux app, driven by real input events, grabbed
 *  losslessly from a private X display.
 *
 *    node media/pitch/record.mjs --flux-source <checkout> --project <FluxProj> --take <name> --out <dir>
 *                                [--display 97 --port 9333 --scale 4] [--explore]
 *
 *  A take is a module in takes/<name>.mjs (see takes/README.md for the contract): it may prepare
 *  the scratch project, it sets the stage (`setup`), performs (`run`) and says how the camera
 *  moves (`camera`). This runner gives it a driver (glide, click, drag, key, wheel, mark…) whose
 *  every action is logged on the page's clock.
 *
 *  Writes <out>/capture.mkv (lossless RGB, 60 fps, the stage region at device pixels) and
 *  <out>/take.json (the pointer's glides, clicks, keys, wheel turns, named moments, the on-screen
 *  boxes and the camera keys). compose.py turns the pair into the clip.
 *
 *  Nothing is drawn into the app. The pointer is composited afterwards from the logged path, so
 *  it is smooth at any frame rate, and it is the app's own: the take records which of Flux's
 *  cursor images was showing at every moment (cursors.mjs renders them for the compositor).
 *  The only addition to the page is one 8 px square outside every camera frame whose colour is
 *  the page clock in milliseconds; it tells the compositor exactly which moment each grabbed
 *  frame shows.
 *
 *  --explore sets the stage (prepare + setup) and then idles, so the app can be poked from
 *  another script (lib.mjs `attach(port)`) while a take is being written. --scale 2 is plenty
 *  for that and far lighter.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as lib from './lib.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const opt=(name,fallback)=>{const at=process.argv.indexOf('--'+name);return at<0?fallback:process.argv[at+1];};
const flag=name=>process.argv.includes('--'+name);
const source=path.resolve(opt('flux-source','')),project=path.resolve(opt('project','')),takeName=opt('take');
const explore=flag('explore'),out=explore?null:path.resolve(opt('out',''));
if(!opt('flux-source')||!opt('project')||!takeName||(!explore&&!opt('out')))throw Error('Pass --flux-source, --project, --take and --out (or --explore)');
const takeFile=path.join(here,'takes',takeName+'.mjs');
const take=(await import(takeFile)).default;
const WIDTH=take.window?.width??1840,HEIGHT=take.window?.height??1100,SCALE=+opt('scale',take.window?.scale??4);
const ASPECT=take.aspect??4/3;
const DISPLAY=opt('display','97'),PORT=+opt('port',9333);
if(out)fs.mkdirSync(out,{recursive:true});

// ---- stage -----------------------------------------------------------------------------
const stage=spawn(process.execPath,[path.join(here,'stage.mjs'),'--flux-source',source,'--project',project,'--width',WIDTH,'--height',HEIGHT,'--scale',SCALE,'--display',DISPLAY,'--port',PORT,'--take',takeFile,...(take.electronArgs?.length?['--extra',take.electronArgs.join(' ')]:[])],{stdio:['ignore','pipe','inherit']});
let grab=null,locked=false;
const LOCK='/tmp/flux-pitch-record.lock';
const shutdown=()=>{try{grab?.kill('SIGKILL');}catch{}try{stage.kill('SIGTERM');}catch{}if(locked)try{fs.rmSync(LOCK,{recursive:true,force:true});}catch{}};
process.on('exit',shutdown);process.on('SIGINT',()=>process.exit(1));process.on('SIGTERM',()=>process.exit(1));
const staged=await new Promise((resolve,reject)=>{let buffer='';stage.stdout.on('data',b=>{buffer+=b;const line=buffer.split('\n').find(l=>l.includes('"ready"'));if(line)resolve(JSON.parse(line));});stage.on('exit',c=>reject(Error('stage exited '+c)));setTimeout(()=>reject(Error('stage timeout')),120000);});

const session=await lib.attach(PORT);
const {browser,page,cdp,sleep,rect,textRect,need,shot}=session;
const now=()=>performance.now();
// Page clock = driver clock + offset (best of several round trips).
let offset=0;{let best=1e9;for(let i=0;i<25;i++){const a=now(),p=await page.evaluate(()=>performance.now()),b=now();if(b-a<best){best=b-a;offset=p-(a+b)/2;}}}
const pageTime=()=>+(now()+offset).toFixed(2);

// ---- the driver: every input is real, and logged on the page clock ---------------------
const log={glides:[],clicks:[],keys:[],wheels:[],typed:[],marks:{}};
const MODIFIER={Alt:1,Control:2,Meta:4,Shift:8};
let at={x:0,y:0},buttons=0,modifiers=0,pressing=null;
const mouse=(type,extra={})=>cdp.send('Input.dispatchMouseEvent',{type,x:at.x,y:at.y,modifiers,buttons,button:buttons||type!=='mouseMoved'?'left':'none',...extra});
// A hand reaching for a target: quick off the mark, fastest about a third of the way, then a
// long soft landing. (Minimum-jerk position over a time warp that front-loads the travel.)
const ease=s=>{const g=1-Math.pow(1-s,1.6);return g*g*g*(10+g*(-15+6*g));};
/** How long a reach of `d` px takes: a little for any move, more for a longer one (Fitts). */
const reach=d=>150+135*Math.log2(1+d/30);
const driver={
  /** Glide along an arc to `to`. `bow` is the sideways bulge as a fraction of the distance; `ms`
   *  overrides the distance-based duration (a deliberate drag wants to be slower than a reach).
   *  The path is logged as a formula, so the compositor places the pointer exactly at any instant. */
  async glide(to,{bow=0.12,ms}={}){
    const from={...at},dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy)||1;
    ms??=reach(d);
    const mid={x:from.x+dx/2-dy*bow,y:from.y+dy/2+dx*bow};
    const t0=now();
    log.glides.push({t0:+(t0+offset).toFixed(2),ms:+ms.toFixed(1),from,mid,to:{x:to.x,y:to.y}});
    for(;;){
      const s=Math.min(1,(now()-t0)/ms),e=ease(s),u=1-e;
      at={x:u*u*from.x+2*u*e*mid.x+e*e*to.x,y:u*u*from.y+2*u*e*mid.y+e*e*to.y};
      await mouse('mouseMoved');
      if(s>=1)break;
      await sleep(5);
    }
    at={x:to.x,y:to.y};
  },
  /** Put the pointer somewhere without a glide (only before the take starts). */
  async place(to){at={x:to.x,y:to.y};await mouse('mouseMoved');},
  /** Press the left button and keep it down (a drag: down, glide…, up). */
  async down({count=1}={}){buttons=1;pressing={down:pageTime(),x:at.x,y:at.y,count};await mouse('mousePressed',{clickCount:count});},
  async up(){buttons=0;await mouse('mouseReleased',{clickCount:pressing?.count??1});log.clicks.push({...pressing,up:pageTime(),drag:Math.hypot(at.x-pressing.x,at.y-pressing.y)>3,endX:at.x,endY:at.y});pressing=null;},
  async click({hold=85}={}){await driver.down();await sleep(hold);await driver.up();},
  async doubleClick({hold=70,gap=90}={}){await driver.down();await sleep(hold);await driver.up();await sleep(gap);await driver.down({count:2});await sleep(hold);await driver.up();},
  /** Tap a key; the compositor shows `label` as a key badge (null: no badge). `where` places the
   *  badge as fractions of the frame, default lower right. */
  async key(k,{label=k.length===1?k.toUpperCase():k,hold=90,where}={}){
    const entry={down:pageTime(),label,where};
    await page.keyboard.down(k);await sleep(hold);await page.keyboard.up(k);
    entry.up=pageTime();if(label)log.keys.push(entry);
  },
  /** Hold a modifier (Shift, Control, Alt) across clicks; its badge stays until release(). */
  async hold(k,{label=k==='Control'?'Ctrl':k,where}={}){
    const entry={down:pageTime(),label,where,held:true,up:null};
    await page.keyboard.down(k);modifiers|=MODIFIER[k]??0;if(label)log.keys.push(entry);driver['_'+k]=entry;
  },
  async release(k){await page.keyboard.up(k);modifiers&=~(MODIFIER[k]??0);if(driver['_'+k])driver['_'+k].up=pageTime();},
  /** Type text into the focused field at a human pace. */
  async type(text,{per=75}={}){const t0=pageTime();await page.keyboard.type(text,{delay:per});log.typed.push({t0,t1:pageTime(),text});},
  /** Turn the wheel at the pointer: `steps` notches of `dy` (negative = away from you), `gap` ms
   *  apart. The compositor shows a scroll badge while the wheel turns (`where` places it). */
  async wheel(dy,{dx=0,steps=1,gap=45,where}={}){
    for(let i=0;i<steps;i++){
      log.wheels.push({t:pageTime(),dy,dx,where});
      await cdp.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:at.x,y:at.y,deltaX:dx,deltaY:dy,modifiers,buttons});
      if(i<steps-1)await sleep(gap);
    }
  },
  mark(name){log.marks[name]=pageTime();return log.marks[name];},
  get at(){return {...at};},
};

const boxes={};
const ctx={...session,...driver,lib,boxes,marks:log.marks,log,WIDTH,HEIGHT,SCALE,ASPECT,now,pageTime,
  frame:(x0,x1,o={})=>lib.frame(x0,x1,{aspect:ASPECT,...o}),
  around:(box,o={})=>lib.around(box,{aspect:ASPECT,minWidth:Math.ceil(1920/SCALE),...o}),
  get at(){return {...at};}};

async function stamp(region,clock){
  await page.evaluate(({x,y})=>{
    const s=document.createElement('div');s.id='pitch-clock';
    s.style.cssText=`position:fixed;left:${x}px;top:${y}px;width:8px;height:8px;z-index:2147483647;pointer-events:none;background:#000`;
    document.documentElement.appendChild(s);
    // The pointer the app itself shows. Flux draws its own cursor (a pink arrow by default) as CSS
    // cursor images and animates a press by swapping them on the canvas. Each frame, note the
    // image Chromium would show: the cursor of the element holding the pointer capture, else of
    // the element under the pointer.
    const at={x:-1,y:-1},seen=window.__pitchCursor={images:[],timeline:[]};let last=-1,holder=null;
    addEventListener('pointermove',e=>{at.x=e.clientX;at.y=e.clientY;},true);
    addEventListener('pointerdown',e=>{at.x=e.clientX;at.y=e.clientY;},true);
    addEventListener('gotpointercapture',e=>{holder=e.target;},true);
    addEventListener('lostpointercapture',()=>{holder=null;},true);
    const tick=()=>{
      const now=performance.now(),t=Math.round(now)&0xffffff;s.style.background=`rgb(${t>>16},${(t>>8)&255},${t&255})`;
      if(at.x>=0){
        const under=holder?.isConnected?holder:document.elementFromPoint(at.x,at.y);
        const cursor=under?getComputedStyle(under).cursor:'none';
        let index=seen.images.indexOf(cursor);if(index<0)index=seen.images.push(cursor)-1;
        if(index!==last){seen.timeline.push([+now.toFixed(1),index]);last=index;}
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },{x:region.x+clock.x,y:region.y+clock.y});
  // Tell the sampler where the pointer rests, without leaving the resting place.
  const rest={...at};
  at={x:rest.x+1,y:rest.y};await mouse('mouseMoved');at=rest;await mouse('mouseMoved');
  await sleep(300);
}

/** One recording at a time on this machine: a second grab would starve the first of frames. */
async function lock(){
  for(;;){
    try{fs.mkdirSync(LOCK);fs.writeFileSync(path.join(LOCK,'pid'),String(process.pid));locked=true;return;}
    catch{
      let holder=0;try{holder=+fs.readFileSync(path.join(LOCK,'pid'),'utf8');}catch{}
      let alive=false;try{if(holder){process.kill(holder,0);alive=true;}}catch{}
      if(!alive){fs.rmSync(LOCK,{recursive:true,force:true});continue;}
      await sleep(1500);
    }
  }
}
async function startGrab(region){
  await lock();
  const size=`${region.w*SCALE}x${region.h*SCALE}`,input=`:${DISPLAY}.0+${region.x*SCALE},${region.y*SCALE}`;
  grab=spawn('ffmpeg',['-y','-loglevel','warning','-stats','-f','x11grab','-draw_mouse','0','-framerate','60','-video_size',size,'-i',input,'-c:v','libx264rgb','-preset','ultrafast','-qp','0','-threads','32',path.join(out,'capture.mkv')],{stdio:['pipe','ignore','pipe']});
  let err='';grab.stderr.on('data',b=>{err+=b;});
  grab.report=()=>err.split(/[\r\n]+/).filter(Boolean).slice(-1).join(' | ');
  await sleep(900);
  if(grab.exitCode!==null)throw Error('ffmpeg did not start: '+err);
}
async function stopGrab(){
  grab.stdin.write('q');
  await new Promise(r=>grab.once('exit',r));
  console.log('grab:',grab.report());grab=null;
  fs.rmSync(LOCK,{recursive:true,force:true});locked=false;
}

try{
  await lib.fitWindow(session,{width:WIDTH,height:HEIGHT,scale:SCALE,display:DISPLAY});
  // setup(): navigate, arrange the stage, rest the pointer (ctx.place). Returns the box every
  // camera frame will stay inside.
  const {cover}=await take.setup(ctx);
  if(explore){
    console.log(JSON.stringify({exploring:true,port:PORT,display:DISPLAY,scale:SCALE,cover,at,project:staged.project,boxes}));
    await new Promise(()=>{});
  }
  // The grabbed region: the cover plus a margin on the left or top for the clock square.
  const x0=Math.max(0,Math.floor(cover.x)-10),y0=Math.max(0,Math.floor(cover.y)-10);
  const region={x:x0,y:y0,w:Math.min(WIDTH,Math.ceil(cover.x+cover.w)+2)-x0,h:Math.min(HEIGHT,Math.ceil(cover.y+cover.h)+2)-y0};
  if(cover.x-x0<10&&cover.y-y0<10)throw Error('No room beside the cover for the clock square; keep the cover 10 px clear of the window\'s left or top edge.');
  const clock={x:1,y:1,size:8};
  const rest={...at};
  await stamp(region,clock);
  await startGrab(region);
  await take.run(ctx);
  await sleep(400);
  await stopGrab();
  await shot(path.join(out,'after.png'));
  const pointer=await page.evaluate(()=>window.__pitchCursor);
  const camera=take.camera(ctx).map(([t,f])=>({t:+t.toFixed(1),...f}));
  const revision=execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const dirty=execFileSync('git',['-C',source,'status','--porcelain','--','src','electron','dist'],{encoding:'utf8'}).trim()!=='';
  fs.writeFileSync(path.join(out,'take.json'),JSON.stringify({take:takeName,recorded:new Date().toISOString(),flux:{revision,dirty},window:{width:WIDTH,height:HEIGHT,scale:SCALE},aspect:ASPECT,region,clock,cover,boxes,pointer,rest,camera,...log},null,1));
  console.log('take written to',out,'| span',((log.marks.end-log.marks.start)/1000).toFixed(2),'s | glides',log.glides.length,'| clicks',log.clicks.length,'| region',JSON.stringify(region));
}finally{
  await browser.close().catch(()=>{});
  shutdown();
}
process.exit(0);
