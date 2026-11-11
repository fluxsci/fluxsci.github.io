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
 const clips=await page.locator('.article-clip video').all();
 expect(clips.length).toBeGreaterThan(0);
 for(const video of clips){
  await expect(video).toHaveJSProperty('muted',true);
  await expect(video).toHaveJSProperty('loop',true);
  await expect(video).toHaveJSProperty('controls',false);
  await expect(video).toHaveAttribute('playsinline','');
  // Clips load and start when scrolled to, never all at once on load.
  await expect(video).not.toHaveAttribute('autoplay');
  await expect(video).toHaveAttribute('preload','none');
  expect((await video.getAttribute('aria-label')).length).toBeGreaterThan(40);
  await video.scrollIntoViewIfNeeded();
  const box=await video.boundingBox();
  expect(Math.abs(box.width/box.height-4/3)).toBeLessThan(0.02);
  expect(box.width).toBeLessThanOrEqual(page.viewportSize().width);
  expect((await page.request.get(await video.getAttribute('poster'))).status()).toBe(200);
  for(const source of await video.locator('source').all())expect((await page.request.get(await source.getAttribute('src'))).status()).toBe(200);
 }
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
