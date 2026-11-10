/** Shared helpers for driving the staged Flux app over CDP. */
import fs from 'node:fs';
import {chromium} from '@playwright/test';
export async function attach(port=process.env.PORT||9333){
  const browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);
  const page=browser.contexts()[0].pages()[0];
  const cdp=await page.context().newCDPSession(page);
  const shot=async file=>{const {data}=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(file,Buffer.from(data,'base64'));};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const rect=sel=>page.evaluate(sel=>{const n=document.querySelector(sel);if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},sel);
  return {browser,page,cdp,shot,sleep,rect};
}
