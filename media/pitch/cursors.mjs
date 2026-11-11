/** Render the cursor images a take recorded, for the compositor.
 *
 *    node media/pitch/cursors.mjs <take dir> --flux-source <checkout>   → <take dir>/cursors/*.png and cursors.json
 *
 *  take.json lists every CSS `cursor` value the app showed, in Flux's case SVG images with a
 *  hotspot (`url("data:image/svg+xml,…") 3 3, default`). Each image is drawn by Chromium at 8x
 *  its CSS size on a transparent background, so the composited pointer is the app's own
 *  drawing, sharp at any zoom. A value with no image (a system cursor) is recorded as such.
 *
 *  The press: Flux's arrow dips at its tip when pressed (cursor/cursorFamily.ts, drawArrowPress;
 *  17 frames from rest to fully pressed). The frames are generated here by that same module at
 *  the app's default depth, and must start from the very image the take recorded, so the
 *  compositor can play the app's own press on every click.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
const dir=path.resolve(process.argv[2]),take=JSON.parse(fs.readFileSync(path.join(dir,'take.json'),'utf8'));
const out=path.join(dir,'cursors');fs.mkdirSync(out,{recursive:true});
const SCALE=8;
const browser=await chromium.launch();
const page=await browser.newPage({deviceScaleFactor:SCALE});
async function sprite(name,value){

  const match=/^(url\("data:image\/svg\+xml,[\s\S]*?"\))\s+(-?[\d.]+)\s+(-?[\d.]+)\s*,\s*([\w-]+)$/.exec(value);
  if(!match)return {system:value};
  const [,url,hx,hy,fallback]=match;
  const size=/<svg[^>]*\swidth='([\d.]+)'[^>]*\sheight='([\d.]+)'/.exec(url);
  if(!size)throw Error('Cursor image has no size: '+value.slice(0,120));
  const [width,height]=[+size[1],+size[2]];
  await page.setViewportSize({width:Math.ceil(width),height:Math.ceil(height)});
  await page.setContent('<!doctype html><style>html,body{margin:0;background:transparent}div{position:absolute;left:0;top:0;background-repeat:no-repeat;background-size:100% 100%}</style><div></div>');
  await page.evaluate(({url,width,height})=>{const d=document.querySelector('div');d.style.width=width+'px';d.style.height=height+'px';d.style.backgroundImage=url;},{url,width,height});
  await page.waitForTimeout(60);
  await page.screenshot({path:path.join(out,name+'.png'),omitBackground:true});
  return {file:`cursors/${name}.png`,width,height,hotspot:[+hx,+hy],scale:SCALE,fallback};
}
const images=[];
for(const [index,value] of take.pointer.images.entries())images.push(await sprite(String(index),value));
// Flux's own press frames, from its own drawing code.
const at=process.argv.indexOf('--flux-source');
if(at<0)throw Error('Pass --flux-source <checkout>');
const STEPS=16;
const frames=JSON.parse(execFileSync(process.execPath,['--import','tsx','-e',`import('./src/lib/cursor/cursorFamily.ts').then(m=>console.log(JSON.stringify({press:m.CURSOR_PRESS_DEFAULTS,frames:Array.from({length:${STEPS+1}},(_,i)=>m.drawArrowPress({},i/${STEPS},m.CURSOR_PRESS_DEFAULTS.depth,false).css)})))`],{cwd:path.resolve(process.argv[at+1]),encoding:'utf8'}));
// Paper, Reader and Library keep the system cursor, and a take filmed only there never shows
// Flux's arrow. The clips use Flux's arrow throughout (the compositor falls back to it for every
// system cursor), so make sure it is among the rendered images.
let arrow=take.pointer.images.indexOf(frames.frames[0]);
if(arrow<0){arrow=images.length;images.push(await sprite(String(arrow),frames.frames[0]));}
const press=[];
for(const [index,value] of frames.frames.entries())press.push(await sprite('press-'+index,value));
await browser.close();
fs.writeFileSync(path.join(dir,'cursors.json'),JSON.stringify({images,arrow,press:{...frames.press,frames:press}},null,1));
console.log('cursor images:',images.map(s=>s.system?`system(${s.system})`:`${s.width}x${s.height}@${s.hotspot}`).join(', '),'| press frames:',press.length);
