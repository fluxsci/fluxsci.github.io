/** Overlay sprites the compositor draws over the grabbed frames: the key badges. (The pointer is
 *  Flux's own cursor, rendered per take by cursors.mjs.) Rendered once with Chromium on a
 *  transparent background, at 4x the size they are drawn at, so they stay sharp at any size.
 *
 *    node media/pitch/overlays.mjs            → media/pitch/overlays/{key-f,key-esc}.png
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
const dir=path.join(path.dirname(fileURLToPath(import.meta.url)),'overlays');
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch();
const page=await browser.newPage({deviceScaleFactor:4});
async function sprite(name,html,width,height){
  await page.setViewportSize({width,height});
  await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}body{width:${width}px;height:${height}px;display:grid;place-items:center}</style>${html}`);
  await page.screenshot({path:path.join(dir,name+'.png'),omitBackground:true});
}
const key=label=>`<div style="font:600 ${label.length>1?19:23}px/1 'Inter','Helvetica Neue',Arial,sans-serif;letter-spacing:.02em;color:#f4f1e8;min-width:30px;height:46px;padding:0 15px;display:grid;place-items:center;border-radius:11px;background:linear-gradient(#3a3935,#262521);border:1px solid #57554e;box-shadow:0 3px 0 #131210,0 8px 22px #0007,inset 0 1px 0 #ffffff1f">${label}</div>`;
await sprite('key-f',key('F'),150,140);
await sprite('key-esc',key('esc'),150,140);
await browser.close();
console.log('overlays written to',dir);
