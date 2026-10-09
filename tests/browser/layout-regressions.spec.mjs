import { test, expect } from '@playwright/test';

// Geometry checks for defects that were once visible on the site: text spilling out of
// diagram boxes, a highlight that missed its part, a header that wrapped on small phones,
// a play prompt that covered the slide, and controls drawn on top of the install command.

const WIDE_FONT = ':root{--sans:"DejaVu Sans","Verdana",sans-serif}';
const intersects = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const { width, layout } of [{ width:1440, layout:'flow-wide' }, { width:900, layout:'flow-tall' }, { width:320, layout:'flow-tall' }]) {
  test(`the flow diagram keeps every label inside its box at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height:900 });
    await page.goto('/');
    for (const css of ['', WIDE_FONT]) {
      if (css) await page.addStyleTag({ content:css });
      await page.evaluate(() => document.fonts.ready);
      const report = await page.evaluate(() => {
        const svg = [...document.querySelectorAll('.flow svg')].find(item => getComputedStyle(item).display !== 'none');
        const boxes = [...svg.querySelectorAll('.flow-box')];
        const spill = boxes.filter(box => box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1).map(box => box.textContent.slice(0, 30));
        const labels = [...svg.querySelectorAll('.flow-labels text')].map(text => text.getBoundingClientRect());
        const rects = boxes.map(box => box.getBoundingClientRect());
        const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const covered = labels.filter(label => rects.some(rect => hit(label, rect))).length;
        return { layout:svg.getAttribute('class'), spill, covered, overflow:document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      expect(report.layout).toBe(layout);
      expect(report.spill).toEqual([]);
      expect(report.covered).toBe(0);
      expect(report.overflow).toBeLessThanOrEqual(0);
    }
  });
}

test('the part explorer highlight covers every drawn part and the list never moves', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  const box = page.locator('[data-part-explorer]');
  await box.scrollIntoViewIfNeeded();
  await expect(box).toHaveClass(/is-live/);
  await page.evaluate(() => { for (let pass = 0; pass < 8; pass++) document.querySelectorAll('.explorer-toggle[aria-expanded="false"]').forEach(toggle => toggle.click()); });
  const ids = await box.locator('.explorer-part:not(.is-undrawn)').evaluateAll(parts => parts.map(part => part.dataset.part));
  expect(ids.length).toBeGreaterThan(60);
  expect(new Set(ids).size).toBe(ids.length);
  const treeTops = new Set();
  for (const id of ids) {
    const row = box.locator(`.explorer-part[data-part="${id}"]`);
    await row.scrollIntoViewIfNeeded();
    await row.hover();
    const result = await page.evaluate(id => {
      const svg = document.querySelector('.explorer-svg');
      const row = document.querySelector(`.explorer-part[data-part="${CSS.escape(id)}"]`);
      // The part's ink: the row's own element and every element listed beneath it.
      const ids = [id, ...[...row.closest('li').querySelectorAll('.explorer-part')].map(part => part.dataset.part)];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const partId of ids) {
        const rect = svg.getElementById(partId)?.getBoundingClientRect();
        if (!rect || (!rect.width && !rect.height)) continue;
        x0 = Math.min(x0, rect.left); y0 = Math.min(y0, rect.top); x1 = Math.max(x1, rect.right); y1 = Math.max(y1, rect.bottom);
      }
      const mark = svg.querySelector('.explorer-box')?.getBoundingClientRect();
      const tree = document.querySelector('.explorer-tree').getBoundingClientRect().top + scrollY;
      if (!mark) return { id, missing:true, tree };
      const slack = Math.max(x0 - mark.left, y0 - mark.top, mark.right - x1, mark.bottom - y1);
      const contains = mark.left <= x0 + 0.5 && mark.top <= y0 + 0.5 && mark.right >= x1 - 0.5 && mark.bottom >= y1 - 0.5;
      return { id, contains, slack, tree, current:row.getAttribute('aria-current') };
    }, id);
    treeTops.add(Math.round(result.tree));
    expect(result, id).toMatchObject({ contains:true, current:'true' });
    expect(result.slack, id).toBeLessThanOrEqual(8);
  }
  expect([...treeTops]).toHaveLength(1);
});

test('a part pinned with the pointer is released with Escape; keyboard release keeps focus', async ({ page }) => {
  await page.goto('/');
  const box = page.locator('[data-part-explorer]');
  await box.scrollIntoViewIfNeeded();
  await expect(box).toHaveClass(/is-live/);
  // Click the median line where a visitor would: at its drawn position in the plot.
  const median = await box.locator('.explorer-svg [id="high-dose.median"]').evaluate(element => { const r = element.getBoundingClientRect(); return { x:r.x + r.width / 2, y:r.y + r.height / 2 }; });
  await page.mouse.click(median.x, median.y);
  await page.mouse.move(2, 2);
  await expect(box).toHaveClass(/is-pinned/);
  await expect(box.locator('.explorer-id')).toHaveText('high-dose.median');
  await page.keyboard.press('Escape');
  await expect(box).not.toHaveClass(/is-pinned/);
  const row = box.locator('.explorer-part[data-part="plot-area"]');
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(box).toHaveClass(/is-pinned/);
  await page.keyboard.press('Escape');
  await expect(box).not.toHaveClass(/is-pinned/);
  await expect(row).toBeFocused();
  await page.keyboard.press('Enter');
  await box.getByRole('button', { name:'Release selection' }).click();
  await expect(row).toBeFocused();
  // A series has no element of its own; its highlight still surrounds everything it draws.
  await box.locator('.explorer-part[data-part="control"]').hover();
  await expect(box.locator('.explorer-svg .explorer-box')).toHaveCount(1);
});

test('the header keeps the menu button on its row on a 320px phone', async ({ page }) => {
  await page.setViewportSize({ width:320, height:700 });
  await page.goto('/');
  for (const css of ['', WIDE_FONT]) {
    if (css) await page.addStyleTag({ content:css });
    const header = await page.locator('.site-header').boundingBox();
    const menu = page.getByRole('button', { name:'Menu', exact:true });
    const button = await menu.boundingBox();
    expect(button.y + button.height).toBeLessThanOrEqual(header.y + header.height + 1);
    expect(button.width).toBeGreaterThanOrEqual(40);
  }
  const menu = page.getByRole('button', { name:'Menu', exact:true });
  await menu.click();
  await expect(page.locator('#main-navigation')).toBeVisible();
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
});

test('the install command and its copy button never overlap', async ({ page }) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height:900 });
    await page.goto('/');
    const command = page.locator('.install-command pre');
    await command.scrollIntoViewIfNeeded();
    await expect(page.locator('.install-command [data-copy]')).toBeVisible();
    const text = await command.locator('code').evaluate(code => { const range = document.createRange(); range.selectNodeContents(code); return [...range.getClientRects()].map(r => ({ x:r.x, y:r.y, width:r.width, height:r.height })); });
    const button = await page.locator('.install-command [data-copy]').boundingBox();
    for (const line of text) expect(intersects(line, button), `${width}px`).toBe(false);
    expect(await command.evaluate(pre => pre.scrollWidth - pre.clientWidth), `${width}px`).toBeLessThanOrEqual(0);
  }
});

test('the slide preview shows the whole slide with the play prompt beneath it', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height:900 });
    await page.goto('/');
    const poster = page.locator('#slide-demo .demo-launch > img');
    await poster.scrollIntoViewIfNeeded();
    await expect.poll(() => poster.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    const image = await poster.boundingBox();
    const prompt = await page.locator('#slide-demo .demo-launch-prompt').boundingBox();
    expect(prompt.y, `${width}px`).toBeGreaterThanOrEqual(image.y + image.height - 1);
    expect(Math.abs(image.width / image.height - 1200 / 760), `${width}px`).toBeLessThan(0.02);
  }
});

test('a landscape enlargement fits the window with its caption; tall plates keep their detail', async ({ page }) => {
  await page.goto('/');
  await page.locator('.hero-image').click();
  const dialog = page.locator('#media-dialog');
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.locator('#media-dialog-image').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(await dialog.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  await expect(page.locator('#media-dialog-caption')).toBeInViewport();
  await page.keyboard.press('Escape');
  await page.locator('.showcase-plates [data-enlarge]').first().click();
  await expect(dialog).toHaveClass(/is-tall/);
});

test('the workspace guide link points across the site, not down the page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-workspace-guide] [aria-hidden]')).toHaveText('→');
  await page.locator('.workspace-choices [data-workspace="paper"]').click();
  await expect(page.locator('[data-workspace-guide]')).toHaveAttribute('href', '/docs/paper.html');
  await expect(page.locator('[data-workspace-guide] [aria-hidden]')).toHaveText('→');
});

test('search opens the best match with Enter and stays put while results change', async ({ page }) => {
  await page.goto('/docs/');
  await page.getByRole('button', { name:/Search/ }).click();
  const dialog = page.getByRole('dialog', { name:'Search the docs' });
  const input = page.getByRole('searchbox', { name:'Search documentation' });
  await expect(dialog.locator('.search-results a').first()).toBeVisible();
  const before = await input.boundingBox();
  await input.fill('zzzz-no-such-topic');
  await expect(dialog.locator('[role="status"]')).toContainText('No matching topics');
  const after = await input.boundingBox();
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
  await input.fill('3D plots');
  const first = dialog.locator('.search-results a').first();
  await expect(first).toBeVisible();
  const target = new URL(await first.getAttribute('href'), page.url()).pathname;
  await input.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${target.replace(/[.]/g, '\\.')}$`));
});
