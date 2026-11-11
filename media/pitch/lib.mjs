/** Shared helpers for driving the staged Flux app over CDP. */
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';

export const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export async function attach(port=process.env.PORT||9333){
  const browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);
  const page=browser.contexts()[0].pages()[0];
  const cdp=await page.context().newCDPSession(page);
  /** Screenshot the page (or a CSS-px clip of it) to a PNG; `scale` shrinks it for review. */
  const shot=async(file,clip,scale=1)=>{const {data}=await cdp.send('Page.captureScreenshot',{format:'png',...(clip?{clip:{...clip,scale}}:{})});fs.writeFileSync(file,Buffer.from(data,'base64'));};
  const rect=sel=>page.evaluate(sel=>{const n=document.querySelector(sel);if(!n)return null;const r=n.getBoundingClientRect();return r.width||r.height?{x:r.x,y:r.y,w:r.width,h:r.height}:null;},sel);
  /** The box of the first element under `scope` matching `selector` whose text (or first word) is `text`. */
  const textRect=(scope,selector,text)=>page.evaluate(([scope,selector,text])=>{const n=[...document.querySelectorAll(scope+' '+selector)].find(n=>{const t=n.textContent.trim();return t===text||t.split(/\s+/)[0]===text;});if(!n)return null;const r=n.getBoundingClientRect();return r.width||r.height?{x:r.x,y:r.y,w:r.width,h:r.height}:null;},[scope,selector,text]);
  const need=async(what,get,ms=8000)=>{const t=performance.now();for(;;){const v=await get();if(v)return v;if(performance.now()-t>ms)throw Error('Timed out: '+what);await sleep(60);}};
  return {browser,page,cdp,shot,sleep,rect,textRect,need};
}

/** Flux opens at its own default size, and there is no window manager on the private display.
 *  Size and place the X window so the page is exactly width x height CSS px with its corner at
 *  the display's corner (the window has invisible resize borders, found by looking for a marker). */
export async function fitWindow({page,need},{width,height,scale,display}){
  const env={...process.env,DISPLAY:':'+display};
  const x=(...args)=>execFileSync('xdotool',args,{env,encoding:'utf8'}).trim();
  const id=await need('app window',async()=>{try{return x('search','--onlyvisible','--name','Flux').split('\n').filter(Boolean)[0];}catch{return null;}},15000);
  const inner=()=>page.evaluate(()=>[innerWidth,innerHeight]);
  let size=[width*scale,height*scale];
  for(let i=0;i<5;i++){
    x('windowsize',id,String(size[0]),String(size[1]));await sleep(500);
    const [w,h]=await inner();
    if(w===width&&h===height)break;
    size=[size[0]+(width-w)*scale,size[1]+(height-h)*scale];
  }
  await page.evaluate(()=>{const m=document.createElement('div');m.id='pitch-origin';m.style.cssText='position:fixed;left:0;top:0;width:6px;height:6px;z-index:2147483647;background:rgb(255,0,255);pointer-events:none';document.documentElement.appendChild(m);});
  const origin=()=>{
    const n=160,raw=execFileSync('ffmpeg',['-loglevel','error','-f','x11grab','-draw_mouse','0','-video_size',`${n}x${n}`,'-i',`:${display}.0+0,0`,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:1<<26});
    for(let y=0;y<n;y++)for(let px=0;px<n;px++){const i=(y*n+px)*3;if(raw[i]===255&&raw[i+1]===0&&raw[i+2]===255)return [px,y];}
    return null;
  };
  // A window this large repaints slowly in software; wait for the marker rather than a fixed time.
  x('windowmove',id,'0','0');
  const found=await need('page corner on the display',async()=>{await sleep(300);return origin();},20000);
  x('windowmove',id,String(-found[0]),String(-found[1]));
  await need('page corner at the display corner',async()=>{await sleep(300);const at=origin();return at&&!at[0]&&!at[1]?at:null;},20000);
  const [w,h]=await inner();
  await page.evaluate(()=>document.getElementById('pitch-origin').remove());
  if(w!==width||h!==height||await page.evaluate(()=>devicePixelRatio)!==scale)throw Error(`Window does not fill the display: page ${w}x${h}`);
}

/** A camera frame of the take's aspect spanning x0..x1, placed vertically by its centre, top or
 *  bottom, then slid to stay inside `within`. */
export function frame(x0,x1,{cy,top,bottom,within,aspect=4/3}={}){
  const w=x1-x0,h=w/aspect;
  let y=cy!==undefined?cy-h/2:top!==undefined?top:bottom-h;
  if(within){x0=Math.min(Math.max(x0,within.x),within.x+within.w-w);y=Math.min(Math.max(y,within.y),within.y+within.h-h);}
  return {cx:x0+w/2,cy:y+h/2,w};
}
/** The smallest frame of the take's aspect that contains a box with `pad` px of air around it. */
export function around(box,{pad=24,within,aspect=4/3,minWidth=480}={}){
  let w=Math.max(minWidth,box.w+2*pad,(box.h+2*pad)*aspect);
  const cx=box.x+box.w/2;
  return frame(cx-w/2,cx+w/2,{cy:box.y+box.h/2,within,aspect});
}
export const union=(...boxes)=>{boxes=boxes.filter(Boolean);const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));return {x,y,w:Math.max(...boxes.map(b=>b.x+b.w))-x,h:Math.max(...boxes.map(b=>b.y+b.h))-y};};
export const centre=r=>({x:r.x+r.w/2,y:r.y+r.h/2});

// ---- the Figure canvas -------------------------------------------------------------------
/** Switch to Figure and open a canvas by its name in the sidebar. */
export async function openCanvas({page,rect,need},name){
  await need('shell',()=>page.evaluate(()=>!!document.querySelector('button[aria-label=Figure]')),30000);
  await page.evaluate(()=>document.querySelector('button[aria-label=Figure]').click());
  await need('figure mode',()=>rect('.canvas-host'),20000);
  await sleep(1500);
  await page.getByText(name,{exact:true}).click();
  await sleep(3000);
}
export const elementSelector=id=>`.canvas-host [data-editor-element-id="${id}"]`;
/** Zoom the canvas (ctrl+wheel about the element) until `selector` is about `width` px wide.
 *  Zoom moves in steps of e^0.15, so the result is within 8% of the request; read the box back. */
export async function zoomCanvas({page,rect},selector,width){
  for(let i=0;i<16;i++){
    const r=await rect(selector),notches=Math.round(Math.log(width/r.w)/0.15);
    if(!notches)break;
    const host=await rect('.canvas-host');
    await page.mouse.move(Math.min(host.x+host.w-40,Math.max(host.x+40,r.x+r.w/2)),Math.min(host.y+host.h-40,Math.max(host.y+40,r.y+r.h/2)));
    await page.keyboard.down('Control');
    await page.mouse.wheel(0,notches>0?-100:100);
    await page.keyboard.up('Control');
    await sleep(350);
  }
  await sleep(1500);
  return rect(selector);
}
/** Pan the canvas (wheel) until `selector`'s top-left corner is at `to`. */
export async function panCanvas({page,rect},selector,to){
  const host=await rect('.canvas-host');
  for(let i=0;i<10;i++){
    const r=await rect(selector),dx=r.x-to.x,dy=r.y-to.y;
    if(Math.abs(dx)<0.6&&Math.abs(dy)<0.6)break;
    await page.mouse.move(host.x+host.w/2,host.y+host.h/2);await page.mouse.wheel(dx,dy);await sleep(650);
  }
  return rect(selector);
}
/** Boxes of the figure pages on the canvas, in document order (the active one flagged). */
export const figurePages=({page})=>page.evaluate(()=>[...document.querySelectorAll('.canvas-host rect.figure-bg')].map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,active:n.classList.contains('active')};}));
