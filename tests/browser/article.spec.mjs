import {test,expect} from '@playwright/test';
import {routes} from '../../scripts/routes.mjs';

// The pitch article: one reading column and 4:3 clips of the app that behave like moving
// pictures. Playback itself depends on the browser's codecs, so these checks cover the
// contract around it: layout, the still frame, and who gets controls.
const articles=routes.filter(route=>route.kind==='article');

test('articles read as one column without sideways scroll, on any screen',async({page})=>{
 expect(articles.length).toBeGreaterThan(0);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of articles){
  const response=await page.goto(route.url);expect(response.status(),route.url).toBe(200);
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('.docs-sidebar,.doc-toc')).toHaveCount(0);
  await page.evaluate(()=>document.fonts.ready);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),route.url).toBeLessThanOrEqual(1);
 }
 expect(errors).toEqual([]);
});

test('every article clip is a muted, looping, inline 4:3 picture with a still frame and no control bar',async({page})=>{
 await page.goto('/in-60-seconds/');
 // Read every clip where it stands: scrolling to each would start all of them playing.
 const clips=await page.locator('.article-clip video').evaluateAll(videos=>videos.map(v=>{const b=v.getBoundingClientRect();return {muted:v.muted,loop:v.loop,controls:v.controls,inline:v.hasAttribute('playsinline'),autoplay:v.hasAttribute('autoplay'),preload:v.getAttribute('preload'),label:v.getAttribute('aria-label')||'',poster:v.getAttribute('poster'),sources:[...v.querySelectorAll('source')].map(s=>s.getAttribute('src')),width:b.width,height:b.height};}));
 expect(clips.length).toBeGreaterThan(0);
 const urls=new Set();
 for(const clip of clips){
  expect(clip.muted&&clip.loop&&clip.inline,clip.poster).toBe(true);
  expect(clip.controls,clip.poster).toBe(false);
  // Clips load and start when scrolled to, never all at once on load.
  expect(clip.autoplay,clip.poster).toBe(false);
  expect(clip.preload,clip.poster).toBe('none');
  expect(clip.label.length,clip.poster).toBeGreaterThan(40);
  expect(Math.abs(clip.width/clip.height-4/3),clip.poster).toBeLessThan(0.02);
  expect(clip.width).toBeLessThanOrEqual(page.viewportSize().width);
  expect(clip.sources.length).toBe(2);
  for(const url of [clip.poster,...clip.sources])urls.add(url);
 }
 // Existence only (HEAD): the build's publication checks already verify every clip's bytes and hash.
 for(const url of urls)expect((await page.request.head(url,{timeout:10000})).status(),url).toBe(200);
});

test('reduced motion keeps an article clip still and gives the visitor the controls',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/in-60-seconds/');
 const video=page.locator('.article-clip video').first();
 await video.scrollIntoViewIfNeeded();
 await expect(video).toHaveJSProperty('controls',true);
 await page.waitForTimeout(600);
 expect(await video.evaluate(v=>v.paused)).toBe(true);
});

test('unlisted routes stay out of the sitemap and the search index',async({request})=>{
 const sitemap=await (await request.get('/sitemap.xml')).text(),search=await (await request.get('/search-index.json')).text();
 for(const route of routes.filter(route=>route.unlisted)){
  expect(sitemap).not.toContain(route.url);
  expect(search).not.toContain(route.url);
  expect(await (await request.get(route.url)).text()).toContain('name="robots" content="noindex"');
 }
});

test('the tour\'s live slide is a still until asked for, then the exported slide itself',async({page})=>{
 await page.goto('/in-60-seconds/');
 const box=page.locator('.tour-live');
 await box.scrollIntoViewIfNeeded();
 await expect(box.locator('iframe')).toHaveCount(0);
 await expect(box.locator('img')).toBeVisible();
 await box.locator('[data-study-start]').click();
 const frame=box.locator('iframe');
 await expect(frame).toHaveCount(1);
 await expect(frame).toHaveAttribute('title',/becomes its half-time/);
 const size=await frame.boundingBox();
 expect(Math.abs(size.height/size.width-0.75)).toBeLessThan(0.02);
 expect((await page.request.get(await frame.getAttribute('src'))).status()).toBe(200);
});

test('the tour links each of its sections from the top',async({page})=>{
 await page.goto('/in-60-seconds/');
 for(const id of ['flux-figure','flux-slides','flux-paper','agents']){
  await expect(page.locator(`.tour-jump a[href="#${id}"]`)).toHaveCount(1);
  await expect(page.locator(`h2#${id}`)).toHaveCount(1);
 }
});
