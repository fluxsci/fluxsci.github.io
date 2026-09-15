import { test, expect } from '@playwright/test';

const workspaces = [
  { name:'paper', title:'Paper', caption:'Write with your figures, citations, and working notes in reach.', alt:/Paper workspace.*neural-populations manuscript/ },
  { name:'figure', title:'Figure', caption:'Compose the whole figure. Refine every individual part.', alt:/Figure workspace.*editable multi-panel neuroscience composition/ },
  { name:'slides', title:'Slides', caption:'Give the same figures a timeline. Build the explanation step by step.', alt:/Slides workspace.*editable animation steps/ },
  { name:'library', title:'Library', caption:'A lasting collection of references, ready for every project.', alt:/Library workspace.*public neuroscience collection/ },
  { name:'reader', title:'Reader', caption:'Read closely. Keep your notes connected to the evidence.', alt:/Reader workspace.*original neuroscience manuscript/ },
];

const preview = page => page.locator('[data-workspace-preview]');
const choice = (page, name) => preview(page).locator(`[data-workspace="${name}"]`);
const settle = page => page.evaluate(() => Promise.all(document.getAnimations()
  .filter(animation => animation.effect.getComputedTiming().iterations !== Infinity)
  .map(animation => animation.finished.catch(() => {}))));

async function expectWorkspace(page, name) {
  const workspace = workspaces.find(item => item.name === name);
  const surface = preview(page);
  await expect(choice(page, name)).toHaveAttribute('aria-pressed', 'true');
  await expect(surface.locator('button[aria-pressed="true"]')).toHaveCount(1);
  await expect(surface.locator('.hero-image img')).toHaveAttribute('src', new RegExp(`/assets/media/${name}\\.webp$|^assets/media/${name}\\.webp$`));
  await expect(surface.locator('.hero-image img')).toHaveAttribute('alt', workspace.alt);
  await expect.poll(() => surface.locator('.hero-image img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(surface.locator('[data-workspace-caption]')).toHaveText(workspace.caption);
  await expect(surface.locator('[data-workspace-guide]')).toHaveAttribute('href', `#${name}`);
  await expect(surface.locator('[data-workspace-guide]')).toHaveAccessibleName(`Explore ${workspace.title}`);
  await expect(surface.locator('.hero-image')).toHaveAttribute('href', new RegExp(`assets/media/${name}\\.webp$`));
  await expect(surface.locator('.hero-image')).toHaveAccessibleName(`Enlarge the Flux ${workspace.title} workspace`);
  await expect(surface).not.toHaveAttribute('aria-busy', 'true');
}

test('five workspace choices keep the image, description, guide, and enlargement together', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await settle(page);
  await expect(preview(page).getByRole('group', { name:'Choose a Flux workspace' }).getByRole('button')).toHaveCount(5);
  for (const workspace of workspaces) {
    await choice(page, workspace.name).click();
    await expectWorkspace(page, workspace.name);
    const opener = preview(page).locator('.hero-image');
    await opener.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('#media-dialog-image')).toHaveAttribute('src', new RegExp(`assets/media/${workspace.name}\\.webp$`));
    await expect(page.locator('#media-dialog-caption')).toHaveText(`${workspace.title} in Flux. ${workspace.caption}`);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(opener).toBeFocused();
  }
  await preview(page).locator('[data-workspace-guide]').click();
  await expect(page).toHaveURL(/#reader$/);
  expect(errors).toEqual([]);
});

test('workspace choices support arrow wraparound, Home, and End with matching focus', async ({ page }) => {
  await page.goto('/');
  await settle(page);
  await choice(page, 'paper').focus();
  for (const [key, name] of [
    ['ArrowLeft', 'reader'],
    ['ArrowRight', 'paper'],
    ['ArrowRight', 'figure'],
    ['End', 'reader'],
    ['Home', 'paper'],
  ]) {
    await page.keyboard.press(key);
    await expect(choice(page, name)).toBeFocused();
    await expectWorkspace(page, name);
  }
});

test('the final workspace choice survives earlier images finishing out of order', async ({ page }) => {
  await page.goto('/');
  await settle(page);
  const pending = new Map();
  const releases = new Map();
  await page.route(/\/assets\/media\/(figure|slides|library)\.webp$/, async route => {
    const name = route.request().url().match(/\/(figure|slides|library)\.webp$/)[1];
    pending.set(name, route.request());
    await new Promise(resolve => releases.set(name, resolve));
    await route.continue();
  });
  try {
    for (const name of ['figure', 'slides', 'library']) {
      await choice(page, name).click();
      await expect.poll(() => pending.has(name)).toBe(true);
    }
    await choice(page, 'reader').click();
    await expectWorkspace(page, 'reader');
    for (const name of ['library', 'slides', 'figure']) {
      const responsePromise = page.waitForResponse(response => response.request() === pending.get(name));
      releases.get(name)();
      const response = await responsePromise;
      await response.finished();
      // Give completed image decodes their browser tasks before checking for a stale swap.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await expectWorkspace(page, 'reader');
    }
  } finally {
    for (const release of releases.values()) release();
    await page.unrouteAll({ behavior:'wait' });
  }
});

test('reduced motion preserves manual workspace selection without an image fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level:1 })).toBeVisible();
  expect(await page.locator('.hero').evaluate(hero => hero.getAnimations({ subtree:true }).length)).toBe(0);
  await choice(page, 'figure').click();
  await expectWorkspace(page, 'figure');
  expect(await preview(page).locator('.hero-image img').evaluate(image => image.getAnimations().length)).toBe(0);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled:false });

  test('the Paper image and module guide remain usable while unavailable choices stay hidden', async ({ page }) => {
    await page.goto('/');
    const surface = preview(page);
    await expect(surface.locator('.workspace-choices')).toBeHidden();
    await expect(surface.getByRole('button')).toHaveCount(0);
    await expectWorkspace(page, 'paper');
    await surface.locator('[data-workspace-guide]').click();
    await expect(page).toHaveURL(/#paper$/);
    await surface.locator('.hero-image').click();
    await expect(page).toHaveURL(/\/assets\/media\/paper\.webp$/);
    await expect.poll(() => page.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  });
});
