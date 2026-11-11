/** Developer aid: open the built article on desktop and phone sizes in installed Chrome (the clips
 *  are H.264), scroll to each clip as a visitor would, and report whether it loads and plays by
 *  itself. Screenshots the moment each clip has played for `seconds`.
 *    node media/pitch/review.mjs <out dir> [seconds] */
import {chromium,devices} from '@playwright/test';
const [out,seconds='2.0']=process.argv.slice(2);
const url='http://127.0.0.1:'+(process.env.PORT||1430)+'/in-60-seconds/';
const browser=await chromium.launch({channel:'chrome'});
let failures=0;
for(const [name,options] of [['desktop',{viewport:{width:1440,height:900},deviceScaleFactor:2}],['phone',{...devices['iPhone 14']}]]){
  const context=await browser.newContext(options);const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.evaluate(()=>document.fonts.ready);
  const clips=await page.locator('.article-clip video').all();
  for(const [i,video] of clips.entries()){
    await video.evaluate(v=>{const b=v.getBoundingClientRect();scrollBy(0,b.top-(innerHeight-b.height)/2);});
    let state;
    try{
      await video.evaluate((v,s)=>new Promise((res,rej)=>{const t=setTimeout(()=>rej(Error('not playing')),20000);const check=()=>{if(v.currentTime>=s){clearTimeout(t);res();}else requestAnimationFrame(check);};check();}),+seconds);
      state=await video.evaluate(v=>({ok:true,time:+v.currentTime.toFixed(2),size:[v.videoWidth,v.videoHeight],src:v.currentSrc.split('/').pop()}));
    }catch(e){failures++;state=await video.evaluate(v=>({ok:false,paused:v.paused,readyState:v.readyState,src:v.currentSrc.split('/').pop()}));}
    if(i===0)await page.screenshot({path:`${out}/${name}.png`});
    console.log(name,i+1,JSON.stringify(state));
    await video.evaluate(v=>v.pause());
  }
  console.log(name,'overflow',await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),errors.join('; '));
  await context.close();
}
await browser.close();
process.exit(failures?1:0);
