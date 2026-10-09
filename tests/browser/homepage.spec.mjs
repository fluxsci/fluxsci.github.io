import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The entrance animation fades the hero in over ~1.6 s; an accessibility scan that
// samples mid-fade reads blended colors and reports false contrast failures on slow
// runners. Scans wait for every running animation to finish first.
const settle = page => page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));

test('homepage has complete content, working imagery, and responsive geometry', async ({ page }) => {
  const errors = [];
  const badResponses = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().startsWith('http://127.0.0.1:1430') && response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  await page.goto('/');
  await expect(page).toHaveTitle(/Flux/);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('heading', { level:1 })).toHaveCount(1);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://fluxsci.github.io/');
  for (const module of ['figure-materials', 'response-figure', 'materials-figure']) {
    const image = page.locator(`img[src$="/${module}.webp"]`).first();
    await expect(image).toHaveCount(1);
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
  }
  const imageCount = await page.locator('img[src]').count();
  expect(imageCount).toBeGreaterThanOrEqual(4);
  await expect(page.locator('.site-header .main-navigation a')).toHaveCount(4);
  await expect(page.locator('.site-footer .footer-columns a')).toHaveCount(13);
  expect(await page.locator('body').innerText()).not.toContain('Built around the work');
  await expect(page.locator('.part-explorer.is-live')).toHaveCount(1);
  await expect(page.locator('.install-command [data-copy]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => ({ viewport:document.documentElement.clientWidth, content:document.documentElement.scrollWidth }));
  expect(overflow.content).toBeLessThanOrEqual(overflow.viewport + 1);
  expect(errors).toEqual([]);
  expect(badResponses).toEqual([]);
});

test('homepage meets automated WCAG AA checks', async ({ page }) => {
  await page.goto('/');
  await settle(page);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
});

test('appearance selection persists and both color schemes remain accessible', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name:'Appearance' }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.getByRole('combobox', { name:'Appearance' })).toHaveValue('dark');
  await settle(page);
  const dark = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(dark.violations).toEqual([]);
  await page.getByRole('combobox', { name:'Appearance' }).selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('combobox', { name:'Appearance' }).selectOption('system');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await page.emulateMedia({ colorScheme:'dark' });
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(16, 15, 15)');
  await page.emulateMedia({ colorScheme:'light' });
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(255, 252, 240)');
});

test('navigation works with mobile menu and keyboard dismissal', async ({ page }) => {
  await page.goto('/');
  const menu = page.getByRole('button', { name:'Menu', exact:true });
  if (await menu.isVisible()) {
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeFocused();
    await menu.click();
  }
  await page.locator('.hero-actions .text-link').click();
  await expect(page).toHaveURL(/#how-it-works$/);
  if (await menu.isVisible()) await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await page.locator('[data-workspace-guide]').click();
  await expect(page).toHaveURL(/\/docs\/figure.html$/);
  await page.goBack();
  await page.getByRole('navigation', { name:'Main navigation', exact:true }).getByRole('link', { name:'Documentation', exact:true }).click();
  await expect(page).toHaveURL(/\/docs\/$/);
});

test('full-size imagery opens accessibly and restores focus', async ({ page }) => {
  await page.goto('/');
  await settle(page);
  const opener = page.locator('[data-enlarge]').first();
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.locator('#media-dialog-image').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(dialog.locator('.dialog-close')).toBeFocused();
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test('homepage loads its native slide only on request, opens the data morph, and pauses offscreen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#slide-demo iframe')).toHaveCount(0);
  await expect(page.locator('.scene-tabs button[aria-pressed="true"]')).toHaveAttribute('data-scene', '1');
  await page.getByRole('button', { name:'Load the interactive scientific slides', exact:true }).click();
  const iframe = page.locator('#slide-demo iframe');
  await expect(iframe).toHaveCount(1);
  const frame = page.frameLocator('#slide-demo iframe');
  await expect(frame.getByRole('combobox', { name:'Explore the deck' })).toHaveValue('1');
  await expect(frame.getByRole('button', { name:'Next animation step', exact:true })).toBeVisible();
  await expect(frame.locator('.flux-slide-bar [aria-live="polite"]')).toContainText('Step 1 / 3');
  await page.locator('.scene-tabs button[data-scene="2"]').click();
  await expect(frame.getByRole('combobox', { name:'Explore the deck' })).toHaveValue('2');
  await expect(page.locator('.scene-tabs button[aria-pressed="true"]')).toHaveAttribute('data-scene', '2');
  await page.locator('.scene-tabs button[data-scene="1"]').click();
  await expect(frame.locator('.flux-slide-bar [aria-live="polite"]')).toContainText('Step 1 / 3');
  await frame.getByRole('button', { name:'Next animation step', exact:true }).click();
  await page.evaluate(() => window.scrollTo({ top:0, behavior:'instant' }));
  await expect.poll(async () => {
    const child = await iframe.contentFrame();
    return child.locator('body').evaluate(() => window.fluxWebsiteDemo.state().playing);
  }).toBe(false);
});

test('native slide is a real independent player with manual steps and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.goto('/demos/data-morph/');
  await expect.poll(() => page.evaluate(() => window.fluxWebsiteDemo?.state()?.beat)).toBe(0);
  await expect(page.getByRole('button', { name:'Toggle animation', exact:true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name:'Next animation step', exact:true }).click();
  await expect.poll(() => page.evaluate(() => window.fluxWebsiteDemo.state().beat)).toBe(1);
  expect(await page.evaluate(() => window.fluxWebsiteDemo.state().playing)).toBe(false);
  await page.getByRole('button', { name:'Previous animation step', exact:true }).click();
  await expect.poll(() => page.evaluate(() => window.fluxWebsiteDemo.state().beat)).toBe(0);
  await page.getByRole('button', { name:'Toggle animation', exact:true }).click();
  await expect(page.getByRole('button', { name:'Toggle animation', exact:true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name:'Next animation step', exact:true }).click();
  await expect.poll(() => page.evaluate(() => window.fluxWebsiteDemo.state().playing)).toBe(true);
  await page.evaluate(() => window.fluxWebsiteDemo.pause());
  expect(await page.evaluate(() => window.fluxWebsiteDemo.state().playing)).toBe(false);
  await page.getByRole('button', { name:'Reset to step 0', exact:true }).click();
  await expect.poll(() => page.evaluate(() => window.fluxWebsiteDemo.state().beat)).toBe(0);
  expect(await page.evaluate(() => window.fluxWebsiteDemo.state().issues)).toEqual([]);
});

test('a narrow phone keeps every native slide control inside the frame', async ({ page }) => {
  await page.setViewportSize({ width:320, height:800 });
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name:'Load the interactive scientific slides', exact:true }).click();
  const iframe = page.locator('#slide-demo iframe');
  const frame = page.frameLocator('#slide-demo iframe');
  await expect(frame.getByRole('button', { name:'Toggle animation', exact:true })).toBeVisible();
  await expect.poll(async () => {
    const bounds = await iframe.boundingBox();
    const buttons = await frame.getByRole('button').all();
    for (const button of buttons) {
      const box = await button.boundingBox();
      if (!box || box.x < bounds.x - 1 || box.y < bounds.y - 1 || box.x + box.width > bounds.x + bounds.width + 1 || box.y + box.height > bounds.y + bounds.height + 1) return false;
    }
    return true;
  }).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('all three original native scenes can be explored and retain their manual step', async ({ page }) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.goto('/demos/data-morph/');
  const select=page.getByRole('combobox', { name:'Explore the deck', exact:true });
  await expect(select.locator('option')).toHaveCount(3);
  const webgl=await page.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2',{antialias:true,alpha:true,preserveDrawingBuffer:true});if(!gl)return false;gl.getExtension('WEBGL_lose_context')?.loseContext();return true;});
  const slides=['population-atlas','response-geometry','fermi-surface'];
  for (let index=0;index<slides.length;index++) {
    await select.selectOption(String(index));
    await expect.poll(()=>page.evaluate(()=>window.fluxWebsiteDemo.selectedSlide())).toBe(slides[index]);
    await page.getByRole('button', { name:'Next animation step', exact:true }).click();
    await expect.poll(()=>page.evaluate(()=>window.fluxWebsiteDemo.state().beat)).toBe(1);
    const issues=await page.evaluate(()=>window.fluxWebsiteDemo.state().issues);
    if(index===2&&!webgl){
      expect(issues.map(i=>i.reason)).toEqual(['3D model rendered as a still']);
      await expect(page.locator('[data-model3d-poster]')).toBeVisible();
      await expect(page.locator('[data-model3d-placeholder]')).toHaveCount(0);
    }else expect(issues).toEqual([]);
    expect(await page.locator('#native-player svg').count()).toBeGreaterThan(0);
  }
  await select.selectOption('0');
  await expect.poll(()=>page.evaluate(()=>window.fluxWebsiteDemo.state().beat)).toBe(1);
  expect(errors).toEqual([]);
});

test('the authored scientific plate loads and opens the unchanged source image', async ({ page }) => {
  await page.goto('/');
  const plate=page.locator('.showcase-plates img').first();
  await plate.scrollIntoViewIfNeeded();
  await expect.poll(()=>plate.evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
  await page.locator('.showcase-plates [data-enlarge]').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#media-dialog-image')).toHaveAttribute('src', /response-figure.webp$/);
  await expect(page.locator('a[download]')).toHaveCount(0);
});

test('the entrance plays once per session and the mark blooms from 88 dots', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/\bintro\b/);
  expect(await page.locator('.hero-mark circle').count()).toBe(88);
  await expect(page.getByRole('heading', { level:1 })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).not.toHaveClass(/\bintro\b/);
});

test('missing nested paths return a styled and accessible 404', async ({ page }) => {
  const response = await page.goto('/unknown/nested/page');
  expect(response.status()).toBe(404);
  await expect(page.getByRole('heading', { level:1 })).toHaveCount(1);
  await expect(page.getByRole('link', { name:'Return to Flux →', exact:true })).toHaveAttribute('href', '/');
  await expect(page.getByRole('navigation', { name:'Main navigation', exact:true })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  expect(await page.evaluate(() => [...document.styleSheets].some(sheet => sheet.href?.endsWith('/assets/styles/site.css')))).toBe(true);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled:false });
  test('content, navigation, source images and the slide poster remain available', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level:1 })).toBeVisible();
    const navigation = page.getByRole('navigation', { name:'Main navigation', exact:true });
    await expect(navigation.getByRole('link', { name:/Documentation/ })).toBeVisible();
    await expect(page.locator('.scene-tabs')).toBeHidden();
    await page.locator('.hero-actions .text-link').click();
    await expect(page).toHaveURL(/#how-it-works$/);
    await expect(page.locator('[data-enlarge]').first()).toHaveAttribute('href', /assets\/media\/figure-materials\.webp$/);
    const fallback = page.locator('.showcase-plates img').first();
    await fallback.scrollIntoViewIfNeeded();
    await expect(fallback).toBeVisible();
    await expect.poll(() => fallback.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await page.goto('/demos/data-morph/');
    await expect(page.locator('img.fallback')).toBeVisible();
    expect(await page.locator('img.fallback').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(page.locator('#native-player')).toBeEmpty();
  });
});

test('3D slides keep accurate saved views at every step when WebGL is unavailable',async({page})=>{
 await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(kind,...options){return kind==='webgl2'?null:original.call(this,kind,...options);};
 });
 await page.goto('/demos/data-morph/');
 await page.getByRole('combobox',{name:'Explore the deck'}).selectOption('2');
 await expect(page.getByRole('button',{name:'Toggle animation',exact:true})).toBeDisabled();
 const views=[];
 for(let beat=0;beat<=2;beat++){
  if(beat)await page.getByRole('button',{name:'Next animation step',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.fluxWebsiteDemo.state().beat)).toBe(beat);
  await expect(page.locator('[data-model3d-placeholder]')).toHaveCount(0);
  const poster=page.locator('[data-model3d-poster]');await expect(poster).toBeVisible();
  const src=await poster.getAttribute('href');expect(src).toMatch(/^data:image\/png;base64,/);
  expect(await page.evaluate(async src=>{const img=new Image();img.src=src;await img.decode();return img.naturalWidth>500&&img.naturalHeight>500;},src)).toBe(true);
  views.push(src);
 }
 expect(views[0]).not.toBe(views[1]);
 expect(await page.evaluate(()=>window.fluxWebsiteDemo.state().playing)).toBe(false);
});
