import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('timeline diagrams explain all four shortcuts and remain keyboard operable',async({page})=>{
 await page.goto('/docs/animation.html#align-starts-and-ends');
 const lab=page.locator('.timing-lab');
 for(const name of ['Align starts','Align ends','Resize starts','Resize ends']){
  const button=lab.getByRole('button',{name,exact:true});await button.focus();await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-pressed','true');
  await expect(lab.locator('.timing-panel:visible')).toHaveCount(1);
  const panel=lab.locator('.timing-panel:visible');await expect(panel).toContainText(name.startsWith('Resize')?'Shift':'Move the bars');
  expect(await panel.locator('img').evaluate(async img=>{await img.decode();return img.naturalWidth>0;})).toBe(true);
 }
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});

test('separate native examples load on demand and respect reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/docs/transforms.html');
 await expect(page.locator('.doc-study iframe')).toHaveCount(0);
 for(const id of ['change','ghost','become']){
  const box=page.locator(`[data-doc-study$="#${id}"]`);await box.getByRole('button',{name:'Try this example'}).click();
  const frame=box.frameLocator('iframe');await frame.getByRole('button',{name:'Next animation step',exact:true}).click();
  await expect(frame.locator('.flux-slide-bar [aria-live]')).toHaveText('Step 1 / 1');
  await expect(frame.getByRole('button',{name:'Toggle animation',exact:true})).toHaveAttribute('aria-pressed','false');
  await expect(frame.locator('.flux-slide-status')).toBeEmpty();
  await frame.getByRole('button',{name:'Reset to step 0',exact:true}).click();
  await expect(frame.locator('.flux-slide-bar [aria-live]')).toHaveText('Step 0 / 1');
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('all six native teaching slides actually animate and settle without issues',async({page})=>{
 test.setTimeout(65000);await page.emulateMedia({reducedMotion:'no-preference'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const id of ['appear','change','ghost','become','easing','emphasis']){
  await page.goto('/demos/techniques/index.html#'+id);
  await expect.poll(()=>page.evaluate(()=>window.fluxDocsDemo?.id)).toBe(id);
  await page.getByRole('button',{name:'Next animation step',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.fluxDocsDemo.state().playing)).toBe(true);
  const before=await page.locator('.flux-slide-fit').innerHTML();
  await expect.poll(()=>page.locator('.flux-slide-fit').innerHTML()).not.toBe(before);
  await expect.poll(()=>page.evaluate(()=>window.fluxDocsDemo.state().playing)).toBe(false);
  expect(await page.evaluate(()=>window.fluxDocsDemo.state().issues),id).toEqual([]);
  await expect(page.locator('.flux-slide-bar [aria-live]')).toHaveText('Step 1 / 1');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),id).toBeLessThanOrEqual(1);
 }
 expect(errors).toEqual([]);
});

test('documentation navigation exposes breadcrumbs, section links and adjacent guides',async({page})=>{
 await page.goto('/docs/figure.html');await expect(page.getByRole('navigation',{name:'Breadcrumb'})).toContainText('Figures');
 const pagination=page.getByRole('navigation',{name:'More in Figures'});await pagination.getByRole('link',{name:/Next guide/}).click();await expect(page).toHaveURL(/plot-gallery.html$/);
 const anchor=page.locator('.heading-link').first();await anchor.focus();await expect(anchor).toBeVisible();await anchor.click();expect(new URL(page.url()).hash).not.toBe('');
});

test.describe('visual guides without scripts',()=>{
 test.use({javaScriptEnabled:false});
 test('posters and all shortcut comparisons remain visible',async({page})=>{
  await page.goto('/docs/animation.html');await expect(page.locator('.timing-panel:visible')).toHaveCount(4);
  await expect(page.locator('.doc-study-stage>img:visible')).toHaveCount(2);await expect(page.locator('.doc-study-launch:visible')).toHaveCount(0);
 });
});

test('the semantic plots guide inspects a real fluxplot plot by part', async({page})=>{
 await page.goto('/docs/semantic-plots.html');
 const box=page.locator('[data-part-explorer]');await box.scrollIntoViewIfNeeded();
 await expect(box).toHaveClass(/is-live/);
 const point=box.locator('.explorer-svg #control\\.point\\.3');const b=await point.boundingBox();
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
 await expect(box.locator('.explorer-id')).toHaveText('control.point.3');
 await expect(box.locator('.explorer-crumbs')).toContainText('Control');
 await box.locator('.explorer-part[data-part="axis.x"]').click();
 await expect(box.locator('.explorer-id')).toHaveText('axis.x');
 await expect(box).toHaveClass(/is-pinned/);
 await page.keyboard.press('Escape');await expect(box).not.toHaveClass(/is-pinned/);
 await expect(box.locator('.explorer-part[data-part="axis.x.tick-labels"]')).toBeVisible();
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});

test('reference tables keep every column readable',async({page})=>{
 await page.goto('/docs/connect.html');
 const wrap=page.locator('.table-wrap[data-columns="4"]').first();await wrap.scrollIntoViewIfNeeded();
 const widths=await wrap.locator('thead th').evaluateAll(cells=>cells.map(c=>c.getBoundingClientRect().width));
 expect(Math.min(...widths)).toBeGreaterThan(110);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
