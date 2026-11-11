/** Developer aid: full-page screenshots of the built article on desktop and phone. node media/pitch/pageshot.mjs <out dir> */
import {chromium,devices} from '@playwright/test';
const out=process.argv[2];
const browser=await chromium.launch({channel:'chrome'});
for(const [name,options] of [['desktop',{viewport:{width:1440,height:900},deviceScaleFactor:1}],['phone',{...devices['iPhone 14']}]]){
  const context=await browser.newContext(options);const page=await context.newPage();
  await page.goto('http://127.0.0.1:1430/in-60-seconds/');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(600);
  await page.screenshot({path:`${out}/page-${name}.png`,fullPage:true});
  console.log(name,await page.evaluate(()=>({h:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth})));
  await context.close();
}
await browser.close();
