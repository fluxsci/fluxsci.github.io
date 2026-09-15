import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The entrance animation fades the hero in over ~1.6 s; an accessibility scan that
// samples mid-fade reads blended colors and reports false contrast failures on slow
// runners. Wait for finite entrances; the decorative ambient float never ends.
const settle = page => page.evaluate(() => Promise.all(document.getAnimations()
  .filter(animation => animation.effect.getComputedTiming().iterations !== Infinity)
  .map(animation => animation.finished.catch(() => {}))));

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
  for (const module of ['paper', 'figure', 'slides', 'library', 'reader']) {
    const image = page.locator(`img[src$="/${module}.webp"]`).first();
    await expect(image).toHaveCount(1);
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
  }
  const imageCount = await page.locator('img[src]').count();
  expect(imageCount).toBeGreaterThanOrEqual(5);
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
  await page.getByRole('navigation', { name:'Main navigation', exact:true }).getByRole('link', { name:'Explore', exact:true }).click();
  await expect(page).toHaveURL(/#explore$/);
  if (await menu.isVisible()) await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('navigation', { name:'Explore the five modules' }).getByRole('link', { name:/Figure/ }).click();
  await expect(page).toHaveURL(/#figure$/);
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

test('homepage loads its native slide only on request and pauses offscreen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#slide-demo iframe')).toHaveCount(0);
  await page.getByRole('button', { name:'Load the interactive neuroscience slides', exact:true }).click();
  const iframe = page.locator('#slide-demo iframe');
  await expect(iframe).toHaveCount(1);
  const frame = page.frameLocator('#slide-demo iframe');
  await expect(frame.getByRole('button', { name:'Next animation step', exact:true })).toBeVisible();
  await frame.getByRole('button', { name:'Next animation step', exact:true }).click();
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
  await page.goto('/demos/neural-populations/');
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
  await page.goto('/');
  await page.getByRole('button', { name:'Load the interactive neuroscience slides', exact:true }).click();
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

test('all four native scenes can be explored and retain their manual step', async ({ page }) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.goto('/demos/neural-populations/');
  const select=page.getByRole('combobox', { name:'Explore the deck', exact:true });
  await expect(select.locator('option')).toHaveCount(4);
  const slides=['results','anatomy','tuning','population'];
  for (let index=0;index<slides.length;index++) {
    await select.selectOption(String(index));
    await expect.poll(()=>page.evaluate(()=>window.fluxWebsiteDemo.selectedSlide())).toBe(slides[index]);
    await page.getByRole('button', { name:'Next animation step', exact:true }).click();
    await expect.poll(()=>page.evaluate(()=>window.fluxWebsiteDemo.state().beat)).toBe(1);
    expect(await page.evaluate(()=>window.fluxWebsiteDemo.state().issues)).toEqual([]);
    expect(await page.locator('#native-player svg').count()).toBeGreaterThan(0);
  }
  await select.selectOption('0');
  await expect.poll(()=>page.evaluate(()=>window.fluxWebsiteDemo.state().beat)).toBe(1);
  expect(errors).toEqual([]);
});

test('the editable project has a usable download and the large scientific plate loads', async ({ page, request }) => {
  await page.goto('/');
  const download=page.getByRole('link', { name:'Download the Flux project', exact:true });
  await expect(download).toHaveAttribute('download', '');
  const response=await request.get(await download.getAttribute('href'));
  expect(response.status()).toBe(200);
  const bytes=await response.body();
  expect(bytes.subarray(0,4).toString('hex')).toBe('504b0304');
  expect(bytes.length).toBeGreaterThan(1_000_000);
  const plate=page.locator('.science-plate img');
  await plate.scrollIntoViewIfNeeded();
  await expect.poll(()=>plate.evaluate(image=>image.complete&&image.naturalWidth>=1800)).toBe(true);
  await page.getByRole('link', { name:'Enlarge the complete neuroscience figure', exact:true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#media-dialog-image')).toHaveAttribute('src', /neural-figure.webp$/);
});

test('the entrance plays once per session and the mark blooms from 88 dots', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/\bintro\b/);
  expect(await page.locator('.hero-mark circle').count()).toBe(88);
  await expect(page.getByRole('heading', { level:1 })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).not.toHaveClass(/\bintro\b/);
});

test('the living emblem floats, can be paused, and rests offscreen or with reduced motion', async ({ page }) => {
  await page.goto('/');
  await settle(page);
  const field = page.locator('.emblem-field');
  const position = () => field.evaluate(element => {
    const box = element.getBoundingClientRect();
    return { x:box.x, y:box.y };
  });
  const start = await position();
  await expect.poll(async () => Math.abs((await position()).y - start.y)).toBeGreaterThan(.5);

  // Pausing freezes the current pose rather than snapping the mark home.
  await page.getByRole('button', { name:'Pause logo motion', exact:true }).click();
  await expect.poll(() => field.evaluate(element => element.getAnimations()[0]?.playState)).toBe('paused');
  // Let WebKit's compositor present the paused frame before sampling geometry.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const paused = await position();
  await page.waitForTimeout(250);
  expect(await position()).toEqual(paused);
  await page.reload();
  await expect(page.getByRole('button', { name:'Resume logo motion', exact:true })).toBeAttached();
  await page.getByRole('button', { name:'Resume logo motion', exact:true }).click();

  await page.locator('#figure').scrollIntoViewIfNeeded();
  await expect.poll(() => field.evaluate(element => element.getAnimations()[0]?.playState)).toBe('paused');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => field.evaluate(element => element.getAnimations()[0]?.playState)).toBe('running');

  await page.emulateMedia({ reducedMotion:'reduce' });
  await expect(page.getByRole('button', { name:'Pause logo motion', exact:true })).not.toBeVisible();
  await expect.poll(() => field.evaluate(element => element.getAnimations().length)).toBe(0);
  const still = await position();
  await page.waitForTimeout(250);
  expect(await position()).toEqual(still);
});

test('the semantic-plot explorer names parts, restyles a series, and keeps the restyle across a regenerated state', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.goto('/');
  const explorer = page.locator('#semantic-plot');
  await explorer.scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => document.querySelector('#semantic-plot')?.xray?.ready() ?? false)).toBe(true);
  const hit = explorer.locator('svg [data-series="cell-587375741-guide"][data-role="line"] path.xray-hit');
  await hit.dispatchEvent('pointerover');
  await expect(explorer.locator('[data-xray-readout]')).toContainText('cell-587375741-guide.line');
  await hit.dispatchEvent('click');
  await expect(explorer.locator('[data-xray-command]')).toContainText('flux restyle fig-neural-structure cell-587375741-guide.line --stroke');
  const line = explorer.locator('svg [data-series="cell-587375741-guide"][data-role="line"] > path').first();
  const stroke = await line.evaluate(element => element.style.stroke);
  expect(stroke).not.toBe('');
  const point = explorer.locator('svg [id$="cell-587375741-means.point.2"]');
  const before = await point.getAttribute('y');
  await page.getByRole('button', { name:'4 Hz', exact:true }).click();
  await expect(page.getByRole('button', { name:'4 Hz', exact:true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => point.getAttribute('y')).not.toBe(before);
  expect(await line.evaluate(element => element.style.stroke)).toBe(stroke);
  await expect(explorer.locator('[data-xray-file]')).toHaveText('plots/advanced/16-tuning-landscape-4hz.svg');
  expect(await page.locator('#figure').count()).toBe(1);
  expect(await page.locator('[id="figure"], [id="plot-area"]').count()).toBe(1);
});

test('missing nested paths return a styled and accessible 404', async ({ page }) => {
  const response = await page.goto('/unknown/nested/page');
  expect(response.status()).toBe(404);
  await expect(page.getByRole('heading', { level:1 })).toHaveCount(1);
  await expect(page.getByRole('link', { name:'Return to Flux →', exact:true })).toHaveAttribute('href', '/');
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
    await expect(navigation.getByRole('link', { name:/User guide/ })).toBeVisible();
    await navigation.getByRole('link', { name:'Explore', exact:true }).click();
    await expect(page).toHaveURL(/#explore$/);
    await expect(page.locator('[data-enlarge]').first()).toHaveAttribute('href', /assets\/media\/paper\.webp$/);
    const fallback = page.locator('#semantic-plot img');
    await fallback.scrollIntoViewIfNeeded();
    await expect(fallback).toBeVisible();
    await expect.poll(() => fallback.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await page.goto('/demos/neural-populations/');
    await expect(page.locator('img.fallback')).toBeVisible();
    expect(await page.locator('img.fallback').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(page.locator('#native-player')).toBeEmpty();
  });
});
