import {test,expect} from '@playwright/test';
import {groups, routes} from '../../scripts/routes.mjs';
import AxeBuilder from '@axe-core/playwright';
const pages=['/install/','/docs/','/docs/first-project.html','/docs/projects-and-files.html',...['paper','figure','slides','library','reader','fluxplot','3d-plots','fluxplot-api','commands','animation'].map(name=>`/docs/${name}.html`)];
for(const url of pages)test(`document ${url} is readable, linked and accessible`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);
 await expect(page.getByRole('main')).toHaveCount(1);
 await expect(page.getByRole('heading',{level:1})).toHaveCount(1);
 await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://fluxsci.github.io'+url);
 for(const scheme of ['light','dark']){
  await page.getByRole('combobox',{name:'Appearance'}).selectOption(scheme);
  await page.evaluate(()=>document.fonts.ready);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(()=>document.documentElement.clientWidth));
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations).toEqual([]);
 }
 expect(errors).toEqual([]);
});
test('installer availability is honest and code copies exactly',async({page,request})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.copied=text}})});
 await page.goto('/install/');await expect(page.locator('.availability-note')).toContainText('Flux v0.2.0 is available');
 await page.locator('[data-copy]').first().click();
 expect(await page.evaluate(()=>window.copied)).toBe('curl -fsSL https://fluxsci.github.io/install.sh | bash');
 await expect(page.locator('[data-copy]').first()).toHaveText('Copied');
 const response=await request.get('/install.sh');expect(response.status()).toBe(200);expect(response.headers()['content-type']).toContain('text/plain');expect(await response.text()).toContain('#!/usr/bin/env bash');
});
test('search works by title and content with keyboard navigation and focus restoration',async({page})=>{
 await page.goto('/docs/');const opener=page.getByRole('button',{name:/Search/});await opener.click();
 const dialog=page.getByRole('dialog',{name:'Search the docs'});await expect(dialog).toBeVisible();
 const input=page.getByRole('searchbox',{name:'Search documentation'});await input.fill('3D');
 await expect(dialog.getByRole('link',{name:/3D plots/})).toBeVisible();
 await input.fill('autosave');await expect(dialog.getByRole('link',{name:/Projects and files/})).toBeVisible();
 await page.keyboard.press('ArrowDown');await expect(dialog.locator('.search-results a').first()).toBeFocused();
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(opener).toBeFocused();
 await page.keyboard.press('/');await expect(dialog).toBeVisible();await input.fill('zzzz-no-such-topic');await expect(dialog.locator('[role="status"]')).toContainText('No matching topics');
});
test('docs guide embeds the native slides on demand',async({page})=>{
 await page.goto('/docs/first-project.html');await expect(page.locator('#slide-demo iframe')).toHaveCount(0);
 await page.getByRole('button',{name:'Load the interactive population slides'}).click();
 const frame=page.frameLocator('#slide-demo iframe');await frame.getByRole('button',{name:'Next animation step',exact:true}).click();await expect(frame.locator('.flux-slide-bar [aria-live="polite"]')).toContainText('Step 1 / 1');
});
test.describe('progressive documents',()=>{
 test.use({javaScriptEnabled:false});
 test('guides and code remain available without scripts',async({page})=>{await page.goto('/docs/first-project.html');await expect(page.getByRole('heading',{name:'Your first project',exact:true})).toBeVisible();await expect(page.locator('pre').first()).toContainText('growth-study');await expect(page.locator('[data-copy]').first()).toBeHidden();await page.goto('/docs/');await expect(page.locator('.directory-items a')).toHaveCount(groups.flatMap(g=>g.items).length);});
});

// Scan every guide for complete content and responsive geometry, including long reference tables.
test('every published guide loads without script errors or horizontal page overflow', async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of routes.filter(r=>r.kind==='guide')){
  const response=await page.goto(route.url);expect(response.status(),route.url).toBe(200);
  await expect(page.locator('main h1')).toHaveCount(1);
  await page.evaluate(()=>document.fonts.ready);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),route.url).toBeLessThanOrEqual(1);
  expect(await page.locator('main').innerText(),route.url).not.toMatch(/This guide is moving|Coming soon|TODO/);
 }
 expect(errors).toEqual([]);
});

test('Python reference signatures copy cleanly and parameter details are readable',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.copied=text}})});
 await page.goto('/docs/fluxplot-api.html');
 expect(await page.locator('pre code.python').count()).toBeGreaterThanOrEqual(70);
 await page.locator('[data-copy]').first().click();
 expect(await page.evaluate(()=>window.copied)).toMatch(/^fp\.use_paper\(/);
 const details=page.locator('#regression').locator('xpath=following-sibling::details[1]');
 await details.locator('summary').click();await expect(details.locator('dt').first()).toContainText('kind');
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations).toEqual([]);
});
