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

async function recordedFrame(art) {
  return art.evaluate(stage => {
    const video = stage.querySelector('video[src*="/3d-fallback/"]:not([hidden])');
    if (!video || video.readyState < 2) return null;
    return new Promise(resolve => {
      const frame = video.requestVideoFrameCallback((_, { presentedFrames, mediaTime }) => {
        clearTimeout(timeout);
        resolve(`video frame ${presentedFrames} at ${mediaTime}`);
      });
      const timeout = setTimeout(() => {
        video.cancelVideoFrameCallback(frame);
        resolve(null);
      }, 300);
    });
  });
}

async function expectIntermediateFrames(player, beat = 1, { allow3DStill = false, fallbackVideo } = {}) {
  const art = player.locator('.flux-slide-art');
  const before = await slidePixels(art);
  await nextStep(player).click();
  let clip;
  if (fallbackVideo) {
    await expect(fallbackVideo).toBeVisible();
    await expect.poll(() => fallbackVideo.evaluate(video => !video.paused && video.currentTime > 0)).toBe(true);
    const picture = await fallbackVideo.evaluate(video => {
      const frame = video.getBoundingClientRect();
      const stage = video.closest('.flux-slide-art').getBoundingClientRect();
      return { source: video.currentSrc, coversStage: ['x', 'y', 'width', 'height'].every(axis => Math.abs(stage[axis] - frame[axis]) < 1) };
    });
    expect(picture.coversStage).toBe(true);
    clip = picture.source;
  }
  const intermediates = new Set();
  // Sample by authored cue progress so short and long examples share the same
  // assertion. Capture just the artwork so toolbar updates cannot count as motion.
  for (const phase of [0.15, 0.3, 0.45, 0.6, 0.75]) {
    await expect.poll(async () => {
      const state = await playback(player);
      return state?.beat === beat && state.duration > 0 ? state.time / state.duration : 0;
    }, { intervals: [20, 40, 60], timeout: 15_000 }).toBeGreaterThanOrEqual(phase);
    if ((await playback(player)).playing) {
      const presented = allow3DStill && await recordedFrame(art);
      if (presented) intermediates.add(presented);
      else if (!fallbackVideo && await art.getAttribute('data-motion3d') !== 'recorded') intermediates.add(await slidePixels(art));
    }
  }
  await expect.poll(async () => (await playback(player))?.playing).toBe(false);
  const after = await slidePixels(art);
  intermediates.delete(before);
  intermediates.delete(after);
  expect(intermediates.size).toBeGreaterThanOrEqual(2);
  expect(after).not.toBe(before);
  const { issues } = await playback(player);
  expect(issues.filter(issue => !(allow3DStill && issue.reason === '3D model rendered as a still'))).toEqual([]);
  return clip;
}

// Reading the moving artwork in the browser frame avoids expensive screenshots
// that can outlast short cues or force a dense plot to repaint.
async function expectMovingGeometry(player, selector) {
  const { before, after, frames, issues } = await nextStep(player).evaluate((button, selector) => new Promise(resolve => {
    const stage = document.querySelector('.flux-slide-art');
    const geometry = () => {
      const element = stage.querySelector(selector);
      const { x, y } = stage.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      return [getComputedStyle(element).visibility, ...[box.x - x, box.y - y, box.width, box.height].map(Math.round)].join(',');
    };
    const before = geometry();
    const frames = [];
    button.click();
    let phase = 0.12;
    function sample() {
      const { beat, duration, playing, time, issues } = window.fluxWebsiteDemo.state();
      if (beat === 1 && !playing) {
        resolve({ before, after: geometry(), frames, issues });
        return;
      }
      if (playing && duration > 0 && time / duration >= phase) {
        frames.push(geometry());
        phase = time / duration + 0.12;
      }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }), selector);
  expect(after).not.toBe(before);
  expect(new Set(frames.filter(frame => frame !== before && frame !== after)).size).toBeGreaterThanOrEqual(2);
  expect(issues).toEqual([]);
}

test.use({ reducedMotion: 'no-preference' });

for (const [index, name] of homepageSlides.entries()) {
  test(`homepage slide renders intermediate frames · ${name}`, async ({ page }) => {
    await page.goto(`/demos/slides/#scene=${index}`);
    await expect(page.getByRole('combobox', { name: 'Choose a slide' })).toHaveValue(String(index));
    await expect(nextStep(page)).toBeVisible();
    const options = { allow3DStill: index === 4 };
    await expectIntermediateFrames(page, 1, options);
    if (index === 4) await expectIntermediateFrames(page, 2, options);
  });
}

test('both 3D transitions play without WebGL and return to their saved views', async ({ page }) => {
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
  const clips = [];
  const views = [];
  const savedView = () => posters.evaluateAll(images => images.map(image => image.getAttribute('href').length));
  await expect(posters.first()).toBeVisible();
  views.push(await savedView());
  for (const beat of [1, 2]) {
    clips.push(await expectIntermediateFrames(page, beat, { allow3DStill: true, fallbackVideo }));
    await expect(fallbackVideo).toHaveCount(0);
    await expect(posters.first()).toBeVisible();
    views.push(await savedView());
  }
  expect(new Set(clips).size).toBe(2);
  expect(new Set(views.map(view => view.join(','))).size).toBeGreaterThan(1);

  await page.getByRole('button', { name: 'Previous animation step', exact: true }).click();
  await expect(fallbackVideo).toHaveAttribute('src', /step-2-reverse\.mp4$/);
  expect(await playback(page)).toMatchObject({ beat: 2, reversing: true });
  await expect.poll(async () => (await playback(page))?.beat).toBe(1);
  await expect(fallbackVideo).toHaveCount(0);
  expect(await savedView()).toEqual(views[1]);
});

for (const [study, guide] of Object.entries(guideSlides)) {
  test(`guide slide renders intermediate frames · ${study}`, async ({ page }) => {
    await page.goto(`/docs/${guide}.html`);
    const studyBox = page.locator(`[data-doc-study="/demos/studies/${study}.html"]`);
    await studyBox.getByRole('button', { name: 'Try this example' }).click();
    const player = studyBox.frameLocator('iframe');
    const movingElement = {
      emphasis: '[data-el-id$="-plot_muz6oozvb9t1_5"]',
      ghost: '[data-el-id$="-path_muzbnpzvqpfz_4093"] path'
    }[study];
    if (movingElement) await expectMovingGeometry(player, movingElement);
    else await expectIntermediateFrames(player);
  });
}

test('homepage completes the current move and coalesces repeated Next presses', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Load the interactive Flux slides', exact: true }).click();
  const player = page.frameLocator('#slide-demo iframe');
  const status = player.locator('.flux-slide-bar [aria-live="polite"]');
  await expect.poll(async () => (await playback(player))?.playing).toBe(true);
  const playingStatus = await status.innerText();

  const samples = await nextStep(player).evaluate(button => new Promise(resolve => {
    const frames = [];
    button.click();
    button.click();
    const sample = () => {
      const { beat, duration, playing, time } = window.fluxWebsiteDemo.state();
      frames.push({ beat, progress: time / duration, playing });
      if (beat === 3 || !playing) resolve(frames);
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));

  for (const beat of [1, 2]) {
    const step = samples.filter(frame => frame.beat === beat);
    expect(step.some(frame => frame.progress < 0.6 && frame.playing), `step ${beat} starts in motion`).toBe(true);
    expect(step.some(frame => frame.progress > 0.9 && frame.playing), `step ${beat} reaches its final motion frames`).toBe(true);
  }
  expect(playingStatus).toContain('Step 1 / 3');
  expect(samples.at(-1)).toMatchObject({ beat: 2, playing: false });
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
  await nextStep(player).click();
  await expect.poll(async () => {
    const state = await playback(player);
    return state?.playing ? state.time / state.duration : 0;
  }, { intervals: [30, 50] }).toBeGreaterThan(0.55);
  const previous = player.getByRole('button', { name: 'Previous animation step', exact: true });
  const reverseTimes = await previous.evaluate(button => new Promise(resolve => {
    const frames = [];
    button.click();
    const sample = () => {
      const { playing, reversing, time } = window.fluxWebsiteDemo.state();
      if (reversing) frames.push(time);
      if (playing) requestAnimationFrame(sample);
      else resolve(frames);
    };
    requestAnimationFrame(sample);
  }));
  expect(reverseTimes.length).toBeGreaterThanOrEqual(3);
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
