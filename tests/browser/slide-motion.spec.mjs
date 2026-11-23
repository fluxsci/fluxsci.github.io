import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';

const homepageSlides = [
  'Japan’s earthquakes, from the side',
  'The Moon’s month',
  'A neuron, untangled',
  'A sunflower’s golden angle',
  'Shapes that change shape',
  'The figure becomes a slide'
];
const guideSlides = {
  entrances: 'animation',
  easing: 'animation',
  emphasis: 'slides',
  change: 'transforms',
  ghost: 'transforms',
  become: 'transforms'
};

function playback(player) {
  return player.locator('body').evaluate(() => window.fluxWebsiteDemo?.state());
}

function nextStep(player) {
  return player.getByRole('button', { name: 'Next animation step', exact: true });
}

async function slidePixels(art) {
  const pixels = await art.screenshot({ scale: 'css' });
  return createHash('sha256').update(pixels).digest('hex');
}

// Keep real browser rendering and native player callbacks, but give each chosen
// frame its own timestamp. A screenshot can then take arbitrarily long without
// ever moving the playhead. Recorded video is tested on its real decoder clock.
async function installFrameClock(art) {
  await art.evaluate(() => {
    if (window.slideTestClock) return;
    let now = performance.now();
    let nextId = 0;
    const callbacks = new Map();
    Object.defineProperty(performance, 'now', { value: () => now });
    window.requestAnimationFrame = callback => {
      const id = ++nextId;
      callbacks.set(id, callback);
      return id;
    };
    window.cancelAnimationFrame = id => callbacks.delete(id);
    window.slideTestClock = {
      advance(ms) {
        now += ms;
        const batch = [...callbacks.keys()];
        for (const id of batch) {
          const callback = callbacks.get(id);
          callbacks.delete(id);
          callback?.(now);
        }
      }
    };
  });
}

function frameIntervals(milliseconds, interval = 96) {
  return Array.from({ length: Math.ceil(milliseconds / interval) }, (_, index) => Math.min(interval, milliseconds - index * interval));
}

async function advanceFrames(art, milliseconds) {
  return art.evaluate((_, milliseconds) => {
    for (const ms of milliseconds) window.slideTestClock.advance(ms);
    return window.fluxWebsiteDemo.state();
  }, milliseconds);
}

async function expectNativeArtworkFrames(player, beat) {
  const art = player.locator('.flux-slide-art');
  await art.evaluate(() => document.fonts.ready.then(() => {}));
  const before = await slidePixels(art);
  await installFrameClock(art);
  await nextStep(player).evaluate(button => button.click());
  // Hardware WebGL may upload and ready the asset before queuing the first frame.
  await expect.poll(async () => (await advanceFrames(art, [16, 16, 16])).beat).toBe(beat);
  let state = await playback(player);
  expect(state).toMatchObject({ playing: true, issues: [] });
  expect(state.duration).toBeGreaterThan(0);
  const frames = new Set();
  for (const phase of [0.12, 0.28, 0.44, 0.6, 0.78]) {
    const target = state.duration * phase;
    state = await advanceFrames(art, frameIntervals(target - state.time));
    expect(state.playing).toBe(true);
    expect(state.time).toBeCloseTo(target, 4);
    frames.add(await slidePixels(art));
  }
  state = await advanceFrames(art, frameIntervals(state.duration - state.time + 16));
  expect(state).toMatchObject({ beat, playing: false, time: state.duration, issues: [] });
  const after = await slidePixels(art);
  frames.delete(before);
  frames.delete(after);
  expect(after).not.toBe(before);
  expect(frames.size).toBeGreaterThanOrEqual(2);
}

// Observe decoded frames and the overlay's whole life in one browser call so
// expensive automation commands cannot miss a short clip or its ending.
async function expectRecordedArtworkFrames(player, beat, direction = 'forward') {
  const control = direction === 'reverse'
    ? player.getByRole('button', { name: 'Previous animation step', exact: true })
    : nextStep(player);
  const result = await control.evaluate((button, { beat, direction }) => new Promise(resolve => {
    const stage = document.querySelector('.flux-slide-art');
    const path = `/3d-fallback/step-${beat}-${direction}.mp4`;
    const landing = direction === 'reverse' ? beat - 1 : beat;
    let clip;
    let coveredStage = false;
    const presented = new Set();
    const finish = () => {
      observer.disconnect();
      clearTimeout(timeout);
      resolve({
        clip: clip?.currentSrc,
        error: clip?.error?.message,
        coveredStage,
        presented: presented.size,
        ended: clip?.ended,
        hidden: clip?.hidden,
        landed: window.fluxWebsiteDemo.state()
      });
    };
    const sample = (_, { presentedFrames, mediaTime }) => {
      if (!clip.hidden) presented.add(`${presentedFrames}:${mediaTime}`);
      if (!clip.ended) clip.requestVideoFrameCallback(sample);
    };
    const observer = new MutationObserver(() => {
      const video = stage.querySelector(`video[src$="${path}"]:not([hidden])`);
      if (!clip && video) {
        clip = video;
        const frame = clip.getBoundingClientRect();
        const art = stage.getBoundingClientRect();
        coveredStage = ['x', 'y', 'width', 'height'].every(axis => Math.abs(art[axis] - frame[axis]) < 1);
        clip.requestVideoFrameCallback(sample);
      }
      const state = window.fluxWebsiteDemo.state();
      if (!state.playing && state.beat === landing) finish();
    });
    observer.observe(stage, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'data-recorded-motion-error'] });
    const timeout = setTimeout(finish, 20_000);
    button.click();
  }), { beat, direction });
  expect(result.error).toBeUndefined();
  expect(result.clip).toMatch(new RegExp(`/step-${beat}-${direction}\\.mp4$`));
  expect(result).toMatchObject({ coveredStage: true, ended: true, hidden: true, landed: { beat: direction === 'reverse' ? beat - 1 : beat, playing: false } });
  expect(result.presented).toBeGreaterThanOrEqual(2);
  expect(result.landed.issues.filter(issue => issue.reason !== '3D model rendered as a still')).toEqual([]);
}

test.use({ reducedMotion: 'no-preference' });

for (const [index, name] of homepageSlides.entries()) {
  test(`homepage slide renders intermediate frames · ${name}`, async ({ page }) => {
    if (index === 4) test.setTimeout(180_000);   // the shape morphs step frame by frame; CI runners need the time
    await page.goto(`/demos/slides/#scene=${index}`);
    await expect(page.getByRole('combobox', { name: 'Choose a slide' })).toHaveValue(String(index));
    await expect(nextStep(page)).toBeVisible();
    const art = page.locator('.flux-slide-art');
    if (await art.getAttribute('data-motion3d') === 'recorded') {
      await expectRecordedArtworkFrames(page, 1);
      await expectRecordedArtworkFrames(page, 2);
    } else {
      await expectNativeArtworkFrames(page, 1);
      if (index === 4) await expectNativeArtworkFrames(page, 2);
    }
  });
}

test('both 3D transitions play without WebGL and return to their saved views', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(kind, ...options) {
      return kind === 'webgl2' ? null : original.call(this, kind, ...options);
    };
  });
  await page.goto('/demos/slides/#scene=4');
  const art = page.locator('.flux-slide-art');
  const fallbackVideo = art.locator('video[src*="/3d-fallback/"]:visible');
  const posters = art.locator('[data-model3d-poster]:visible');
  const views = [];
  const savedView = () => posters.evaluateAll(images => images.map(image => image.getAttribute('href').length));
  await expect(posters.first()).toBeVisible();
  views.push(await savedView());
  for (const beat of [1, 2]) {
    await expectRecordedArtworkFrames(page, beat);
    await expect(fallbackVideo).toHaveCount(0);
    await expect(posters.first()).toBeVisible();
    views.push(await savedView());
  }
  expect(new Set(views.map(view => view.join(','))).size).toBeGreaterThan(1);

  await expectRecordedArtworkFrames(page, 2, 'reverse');
  await expect(fallbackVideo).toHaveCount(0);
  expect(await savedView()).toEqual(views[1]);
});

for (const [study, guide] of Object.entries(guideSlides)) {
  test(`guide slide renders intermediate frames · ${study}`, async ({ page }) => {
    await page.goto(`/docs/${guide}.html`);
    const studyBox = page.locator(`[data-doc-study="/demos/studies/${study}.html"]`);
    await studyBox.getByRole('button', { name: 'Try this example' }).click();
    const player = studyBox.frameLocator('iframe');
    await expectNativeArtworkFrames(player, 1);
  });
}

test('a missed browser frame does not skip the rest of a slide animation', async ({ page }) => {
  await page.goto('/demos/studies/easing.html');
  const art = page.locator('.flux-slide-art');
  await installFrameClock(art);
  await nextStep(page).evaluate(button => button.click());
  const before = await advanceFrames(art, [16, 16, 16, 16]);
  expect(before).toMatchObject({ beat: 1, playing: true });
  expect(before.time).toBeGreaterThan(0);

  const afterHitch = await advanceFrames(art, [2000]);
  expect(afterHitch).toMatchObject({ beat: 1, playing: true });
  expect(afterHitch.time).toBeGreaterThan(before.time);
  expect(afterHitch.time - before.time).toBeLessThanOrEqual(121);
  const landed = await advanceFrames(art, frameIntervals(afterHitch.duration - afterHitch.time + 32, 32));
  expect(landed).toMatchObject({ beat: 1, playing: false, time: afterHitch.duration, issues: [] });
});

test('homepage completes the current move and coalesces repeated Next presses', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Load the interactive Flux slides', exact: true }).click();
  const player = page.frameLocator('#slide-demo iframe');
  const status = player.locator('.flux-slide-bar [aria-live="polite"]');
  await expect.poll(async () => (await playback(player))?.playing).toBe(true);
  const playingStatus = await status.innerText();

  const frames = await nextStep(player).evaluate(button => new Promise(resolve => {
    const samples = [];
    let raf;
    const timeout = setTimeout(() => {
      cancelAnimationFrame(raf);
      resolve(samples);
    }, 35_000);
    button.click();
    button.click();
    const sample = () => {
      const { beat, duration, playing, time } = window.fluxWebsiteDemo.state();
      samples.push({ beat, progress: time / duration, playing });
      if (beat === 3 || (beat === 2 && !playing)) {
        clearTimeout(timeout);
        resolve(samples);
      } else raf = requestAnimationFrame(sample);
    };
    raf = requestAnimationFrame(sample);
  }));

  for (const beat of [1, 2]) {
    expect(frames.some(frame => frame.beat === beat && frame.playing && frame.progress > 0 && frame.progress < 1),
      `step ${beat} has an interior animation frame`).toBe(true);
  }
  expect(frames).toContainEqual({ beat: 1, progress: 1, playing: false });
  expect(playingStatus).toContain('Step 1 / 3');
  expect(frames.at(-1)).toMatchObject({ beat: 2, progress: 1, playing: false });
  await expect(status).toHaveText('Step 2 / 3');
  await nextStep(player).click();
  await expect.poll(async () => (await playback(player))?.playing).toBe(true);
  await expect(nextStep(player)).toBeDisabled();
  await expect(status).toContainText('Step 3 / 3');
});

test('a guide’s previous button animates backward through the current move', async ({ page }) => {
  await page.goto('/docs/animation.html');
  const study = page.locator('[data-doc-study="/demos/studies/easing.html"]');
  await study.getByRole('button', { name: 'Try this example' }).click();
  const player = study.frameLocator('iframe');
  const art = player.locator('.flux-slide-art');
  await art.evaluate(() => document.fonts.ready.then(() => {}));
  const before = await slidePixels(art);
  const previous = player.getByRole('button', { name: 'Previous animation step', exact: true });
  const reverseTimes = await previous.evaluate(button => new Promise(resolve => {
    const frames = [];
    const state = () => window.fluxWebsiteDemo.state();
    document.querySelector('[aria-label="Next animation step"]').click();
    function sampleReverse() {
      const { playing, reversing, time } = state();
      if (reversing) frames.push(time);
      if (playing) requestAnimationFrame(sampleReverse);
      else resolve(frames);
    }
    function startReverse() {
      const { playing, time, duration } = state();
      if (!playing) { resolve(frames); return; }
      if (time / duration >= 0.45) {
        button.click();
        sampleReverse();
      } else requestAnimationFrame(startReverse);
    }
    requestAnimationFrame(startReverse);
  }));
  expect(reverseTimes.length).toBeGreaterThanOrEqual(2);
  expect(reverseTimes.at(-1)).toBeLessThan(reverseTimes[0]);
  await expect(player.locator('.flux-slide-bar [aria-live="polite"]')).toContainText('Step 0 / 3');
  expect(await slidePixels(art)).toBe(before);
});

test('reduced motion keeps steps instant and allows an explicitly requested replay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Load the interactive Flux slides', exact: true }).click();
  const player = page.frameLocator('#slide-demo iframe');
  const status = player.locator('.flux-slide-bar [aria-live="polite"]');
  await expect(status).toHaveText('Step 0 / 3');
  await nextStep(player).click();
  await expect(status).toHaveText('Step 1 / 3');
  expect(await playback(player)).toMatchObject({ beat: 1, playing: false });

  await player.getByRole('button', { name: 'Play animation', exact: true }).click();
  await expect.poll(async () => (await playback(player))?.time).toBeGreaterThan(0);
  await player.getByRole('button', { name: 'Pause animation', exact: true }).click();
  const paused = await playback(player);
  expect(paused).toMatchObject({ beat: 1, playing: false });
  expect(paused.time).toBeLessThan(paused.duration);
  await player.getByRole('button', { name: 'Resume animation', exact: true }).click();
  await expect.poll(async () => (await playback(player))?.time).toBeGreaterThan(paused.time);
  await expect(player.getByRole('button', { name: 'Toggle animation', exact: true })).toHaveAttribute('aria-pressed', 'false');
});
