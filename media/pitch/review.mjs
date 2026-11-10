/** Developer aid: screenshot the article at desktop and phone sizes, with the clip at a chosen time.
 *    node media/pitch/review.mjs <out dir> [seconds] */
import {chromium,devices} from '@playwright/test';
const [out,seconds='6.4']=process.argv.slice(2);
const url='http://127.0.0.1:'+(process.env.PORT||1430)+'/in-60-seconds/';
// Installed Chrome, not Playwright's Chromium: the clip is H.264.
const browser=await chromium.launch({channel:'chrome'});
for(const [name,options] of [['desktop',{viewport:{width:1440,height:900},deviceScaleFactor:2}],['phone',{...devices['iPhone 14']}],['phone-dark',{...devices['iPhone 14'],colorScheme:'dark'}]]){
  const context=await browser.newContext(options);const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.evaluate(()=>document.fonts.ready);
  // Scroll the clip into view and let it play by itself to the requested moment: this is the
  // visitor's path (no seeking), so it also proves the in-view autoplay.
  await page.locator('.article-clip video').scrollIntoViewIfNeeded();
  await page.evaluate(()=>{const v=document.querySelector('.article-clip video');const b=v.getBoundingClientRect();scrollBy(0,b.top-(innerHeight-b.height)/2);});
  await page.waitForFunction(seconds=>document.querySelector('.article-clip video').currentTime>=seconds,+seconds,{timeout:40000});
  const state=await page.evaluate(()=>{const v=document.querySelector('.article-clip video');const playing=!v.paused;v.pause();const b=v.getBoundingClientRect();return {playing,time:+v.currentTime.toFixed(2),controls:v.controls,w:b.width,h:b.height,video:[v.videoWidth,v.videoHeight],overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};});
  await page.screenshot({path:`${out}/${name}.png`});
  console.log(name,JSON.stringify(state),errors.join('; '));
  await context.close();
}
await browser.close();
