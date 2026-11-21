import fs from 'node:fs';
import path from 'node:path';
import {aspect, camera, window} from './_figure.mjs';

const paragraphs = [
  'Growth was measured at seven time points over 24 hours.',
  'The profiles show two illustrative conditions.',
];
const messages = [
  'Add a source for the sampling schedule.',
  'Clarify which values are synthetic.',
];
const pane = '.cv.mk-pane';
const card = `${pane} [data-thread-card]`;
const tag = 'needs-reference';
const filter = `${pane} [data-filter-tag="${tag}"]`;

export default {
  window, aspect, camera,
  prepare(project) {
    fs.writeFileSync(path.join(project, 'paper/notes.qmd'),
      `---\ntitle: "Growth profiles"\n---\n\n# Methods\n\n${paragraphs.join('\n\n')}\n`);
  },
  async setup(ctx) {
    const {page, need, rect, textRect, boxes, sleep} = ctx;
    await page.getByRole('button', {name:'Paper', exact:true}).click({timeout:45000});
    const editor = page.locator('.cm-content').first();
    await editor.waitFor({timeout:30000});
    for (const [index, line] of paragraphs.entries()) {
      const text = await need('manuscript paragraph: '+line, () => textRect('.cm-content','.cm-line',line));
      await page.mouse.click(text.x+8,text.y+text.h/2);
      await page.keyboard.press('Home');
      await page.keyboard.press('Shift+End');
      await page.keyboard.press('Control+Alt+m');
      const composer = page.locator('[data-comment-card] textarea[aria-label="New comment"]');
      await composer.waitFor({timeout:10000});
      await composer.fill(messages[index]);
      await composer.press('Control+Enter');
      await sleep(320);
      await page.keyboard.press('Escape');
    }
    await page.keyboard.press('Alt+a');
    await need('two personal threads in the Comments pane', async () => await page.locator(card).count() === 2);
    if (await rect(filter)) throw Error('Expected a fresh project without this tag');
    const comments = await need('Comments pane', () => rect(pane));
    boxes.focus = {x:comments.x-500, y:comments.y-24, w:comments.w+500, h:Math.min(comments.h+32,340)};
    boxes.cover = {x:10,y:0,w:ctx.WIDTH-20,h:ctx.HEIGHT-2};
    boxes.rest = {x:comments.x-40, y:comments.y+280};
    await ctx.place(boxes.rest);
    await sleep(750);
    return {cover: boxes.cover};
  },
  async run(ctx) {
    const {page, rect, need, boxes, key, type, glide, click, sleep, mark} = ctx;
    const item = page.locator(card).filter({hasText:messages[0]});
    const add = item.getByRole('button', {name:'+ tag', exact:true});
    const press = async target => {
      const b = await target.boundingBox({timeout:5000});
      if (!b) throw Error('Comment control is off screen');
      await glide({x:b.x+b.width/2,y:b.y+b.height/2}, {bow:.09});
      await sleep(185);
      await click();
    };
    mark('start');
    await sleep(1500);
    mark('focus');
    await press(add);
    await need('Tag name field', () => rect(pane+' input[aria-label="Tag name"]'));
    await sleep(650);
    await type(tag, {per:115});
    await sleep(450);
    await key('Enter', {where:[.66,.875]});
    await need('Tag attached to the sampling comment', () => item.locator(`[data-tag="${tag}"]`).count());
    await sleep(1100);
    await press(page.locator(filter));
    await need('Only the tagged thread remains', async () => await page.locator(card).count() === 1 && await rect(`${filter}[aria-pressed="true"]`));
    await sleep(1600);
    await press(page.locator(filter));
    await need('Both threads are visible after clearing the filter', async () => await page.locator(card).count() === 2);
    await sleep(1300);
    mark('result');
    await glide(boxes.rest);
    await sleep(1250);
    mark('end');
  },
};
