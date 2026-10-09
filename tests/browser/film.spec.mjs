import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const settle = page => page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
// Open-source browser builds may lack H.264/AAC; playback is asserted only where the engine can decode the ladder.
const canDecode = page => page.evaluate(async () => {
  const response = await fetch('/assets/film/master.m3u8');
  const codecs = [...(await response.text()).matchAll(/CODECS="([^"]+)"/g)].map(match => match[1]);
  const MS = window.ManagedMediaSource || window.MediaSource;
  const apple = /Apple/.test(navigator.vendor);
  return !apple && !!MS && codecs.some(codec => MS.isTypeSupported(`video/mp4; codecs="${codec}"`));
});

test('the film waits for a visitor, then plays the whole ladder as one continuous stream', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [], film = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/assets/film/')) film.push(new URL(request.url()).pathname); });
  await page.goto('/');
  const frame = page.locator('[data-film]');
  const launch = frame.getByRole('button', { name: /^Play the Flux film/ });
  await expect(launch).toBeVisible();
  const poster = launch.locator('img');
  await expect.poll(() => poster.evaluate(image => image.complete && image.naturalWidth >= 1920)).toBe(true);
  expect(film.filter(path => !path.endsWith('/poster.webp'))).toEqual([]);           // nothing streams before a request
  const box = await frame.boundingBox();
  expect(Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(0.02);
  await settle(page);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);

  const decodes = await canDecode(page);
  await launch.click();
  const video = frame.locator('video.film-video');
  await expect(video).toHaveCount(1);
  await expect(launch).toHaveCount(0);
  await expect(video).toHaveAttribute('controls', '');
  expect(await video.evaluate(element => element.querySelector('track[kind="captions"]')?.getAttribute('srclang'))).toBe('en');
  if (decodes) {
    await expect.poll(() => video.evaluate(element => element.currentTime), { timeout: 20000 }).toBeGreaterThan(1);
    expect(await video.evaluate(element => element.duration)).toBeGreaterThan(200);
    // A seek far ahead is served from the right segment and keeps playing.
    await video.evaluate(element => { element.currentTime = 120; });
    await expect.poll(() => video.evaluate(element => element.currentTime), { timeout: 20000 }).toBeGreaterThan(121);
    // The stream ends cleanly: the element reports `ended` instead of waiting for more data.
    await video.evaluate(element => { element.currentTime = element.duration - 2; });
    await expect.poll(() => video.evaluate(element => element.ended), { timeout: 20000 }).toBe(true);
    expect(film.some(path => /\/(?:2160p|1440p|1080p|720p)\/seg_\d+\.m4s$/.test(path))).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('"Watch the video" in the hero starts the film full screen', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const link = page.locator('.hero-actions [data-film-watch]');
  await expect(link).toHaveText(/^Watch the video/);
  await expect(link).toHaveAttribute('href', '#film');
  const decodes = await canDecode(page);
  await link.click();
  const video = page.locator('[data-film] video.film-video');
  await expect(video).toHaveCount(1);
  await expect(page).not.toHaveURL(/#film$/);
  const elementFullscreen = await video.evaluate(element => !!(element.requestFullscreen || element.webkitRequestFullscreen));
  if (elementFullscreen) {
    await expect.poll(() => page.evaluate(() => (document.fullscreenElement || document.webkitFullscreenElement)?.tagName ?? null)).toBe('VIDEO');
    await page.evaluate(() => (document.exitFullscreen || document.webkitExitFullscreen).call(document));
    await expect.poll(() => page.evaluate(() => document.fullscreenElement || document.webkitFullscreenElement || null)).toBe(null);
  } else {
    expect(await video.evaluate(element => element.playsInline)).toBe(false);   // iPhone: plays in the system's full-screen player
  }
  if (decodes) await expect.poll(() => video.evaluate(element => element.currentTime), { timeout: 20000 }).toBeGreaterThan(0.5);
  // Leaving full screen returns to the film, still the only video, still playing.
  await expect(video).toBeInViewport();
  await link.click();
  await expect(page.locator('[data-film] video')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('the explorer follows the film and keeps all five workspaces', async ({ page }) => {
  await page.goto('/');
  const film = await page.locator('#film').boundingBox();
  const explorer = await page.locator('#explore').boundingBox();
  expect(explorer.y).toBeGreaterThan(film.y + film.height);
  await expect(page.locator('#explore .workspace-choices button')).toHaveCount(5);
  await page.locator('#film figcaption a[href="#explore"]').click();
  await expect(page).toHaveURL(/#explore$/);
});

test('a phone shows the whole film frame without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/');
  const box = await page.locator('[data-film]').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  const prompt = await page.locator('.film-launch-prompt').boundingBox();
  expect(prompt.x).toBeGreaterThanOrEqual(box.x);
  expect(prompt.x + prompt.width).toBeLessThanOrEqual(box.x + box.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the film is a native video with the same poster and captions', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.film-launch')).toBeHidden();
    const video = page.locator('[data-film] video');
    await expect(video).toHaveAttribute('poster', 'assets/film/poster.webp');
    await expect(video).toHaveAttribute('src', 'assets/film/master.m3u8');
    await expect(video.locator('track[kind="captions"]')).toHaveCount(1);
  });
});
