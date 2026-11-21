import {expect, test} from '@playwright/test';

test('scientific image guide plays the matching encode on request with reduced motion', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/docs/fluximg.html');
  const clips = page.locator('figure.doc-clip video');
  await expect(clips).toHaveCount(2);
  const clip = clips.first();
  await clip.scrollIntoViewIfNeeded();
  await expect(clip).toHaveJSProperty('controls', true);
  await expect(clip).toHaveJSProperty('paused', true);
  await expect(clip).toHaveAttribute('aria-label', /channel/i);
  await expect(clip).toHaveAttribute('poster', /fluximg-view\.webp$/);
  await clip.evaluate(video => video.play());
  await expect.poll(() => clip.evaluate(video => video.currentTime)).toBeGreaterThan(0);
  const narrow = await page.evaluate(() => matchMedia('(max-width: 700px)').matches);
  await expect(clip).toHaveJSProperty('videoWidth', narrow ? 1280 : 1920);
  await expect(clip).toHaveJSProperty('videoHeight', narrow ? 720 : 1080);
  expect(await clip.evaluate(video => new URL(video.currentSrc).pathname)).toBe(
    '/assets/media/docs/clips/fluximg-view' + (narrow ? '-1280.mp4' : '.mp4')
  );
  await clip.evaluate(video => video.pause());
  await expect(clips.nth(1)).toHaveJSProperty('paused', true);
});
