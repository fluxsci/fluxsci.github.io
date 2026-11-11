/** Render the key badges a take needs, for the compositor.
 *
 *    node media/pitch/badges.mjs <take dir>      → <take dir>/badges/*.png and badges.json
 *
 *  Every key the take pressed with a label ("F", "esc", "Shift", "Ctrl+A") becomes a keycap
 *  sprite (a chord becomes caps side by side); a take that turned the wheel also gets a scroll
 *  badge. Drawn by Chromium on a transparent background at 4x, so they stay sharp at any size.
 */
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from '@playwright/test';
const dir=path.resolve(process.argv[2]),take=JSON.parse(fs.readFileSync(path.join(dir,'take.json'),'utf8'));
const out=path.join(dir,'badges');fs.mkdirSync(out,{recursive:true});
const labels=[...new Set(take.keys.map(k=>k.label))];
if(take.wheels?.length)labels.push('scroll');
const cap=text=>`<div style="font:600 ${text.length>1?19:23}px/1 'Inter','Helvetica Neue',Arial,sans-serif;letter-spacing:.02em;color:#f4f1e8;min-width:30px;height:46px;padding:0 15px;display:grid;place-items:center;border-radius:11px;background:linear-gradient(#3a3935,#262521);border:1px solid #57554e;box-shadow:0 3px 0 #131210,0 8px 22px #0007,inset 0 1px 0 #ffffff1f;white-space:nowrap">${text}</div>`;
// A mouse with its wheel lit, and arrows either side of it.
const scroll=`<div style="height:46px;padding:0 15px;display:flex;gap:9px;align-items:center;border-radius:11px;background:linear-gradient(#3a3935,#262521);border:1px solid #57554e;box-shadow:0 3px 0 #131210,0 8px 22px #0007,inset 0 1px 0 #ffffff1f"><svg width="20" height="30" viewBox="0 0 20 30"><rect x="1.2" y="1.2" width="17.6" height="27.6" rx="8.8" fill="none" stroke="#f4f1e8" stroke-width="1.8"/><rect x="8.4" y="6" width="3.2" height="8" rx="1.6" fill="#ff60fc"/></svg><svg width="12" height="30" viewBox="0 0 12 30"><path d="M6 2 L11 9 H1 Z M6 28 L11 21 H1 Z" fill="#f4f1e8"/></svg></div>`;
const browser=await chromium.launch();
const page=await browser.newPage({deviceScaleFactor:4});
const badges={};
for(const [index,label] of labels.entries()){
  const body=label==='scroll'?scroll:label.split('+').map(cap).join('<span style="width:8px"></span>');
  await page.setViewportSize({width:600,height:200});
  await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}#b{position:absolute;left:0;top:0;padding:26px 44px 50px;display:flex;align-items:center}</style><div id="b">${body}</div>`);
  const box=await page.locator('#b').boundingBox();
  await page.setViewportSize({width:Math.ceil(box.width),height:Math.ceil(box.height)});
  await page.screenshot({path:path.join(out,index+'.png'),omitBackground:true});
  badges[label]={file:`badges/${index}.png`,width:Math.ceil(box.width),height:Math.ceil(box.height),scale:4};
}
await browser.close();
fs.writeFileSync(path.join(dir,'badges.json'),JSON.stringify(badges,null,1));
console.log('badges:',labels.join(', ')||'none');
