import {aspect, camera, drag, elements, point, prepare, rail, setup, window} from './_figure.mjs';

const tile = `${rail} [data-tile$="/growth.svg"]`;
export default {
  aspect, window, camera, prepare: prepare(),
  async setup(ctx) {
    const result = await setup({left: 340, top: 100, width: 570, showRail: true})(ctx);
    await ctx.page.keyboard.press('Alt+g');
    await ctx.need('Layers shown at the start', async () => !await ctx.rect(rail));
    await ctx.place(ctx.boxes.rest);
    return result;
  },
  async run(ctx) {
    const {boxes, page, need, rect, glide, sleep, mark, lib, click, key, type} = ctx;
    mark('start');
    await sleep(900);
    await key('Alt+g', {where:[.25,.85]});
    await need('Plots rail opened', () => rect(rail));
    const search = await need('Plots search', () => rect('[data-plots-search]'));
    await glide(lib.centre(search));
    await sleep(260);
    await click();
    await type('growth', {per:130});
    await need('one matching growth plot', async () => await page.locator(`${rail} [data-tile]`).count() === 1);
    await sleep(750);
    const source = await need('growth.svg in the Plots rail', () => rect(tile));
    if (await page.locator(elements).count()) throw Error('The figure must start empty');
    const start = lib.centre(source);
    const end = point(boxes.figure, .46, .48);
    boxes.focus = lib.union(source, boxes.figure);
    await glide(start, {bow: .12});
    mark('focus');
    await sleep(1300);
    await drag(ctx, start, end, 1660);
    await need('growth plot placed at native size', async () => {
      const items = await page.locator(elements).count();
      const placed = await rect(elements);
      return items === 1 && placed && Math.abs(placed.w / boxes.figure.w - 460.8 / 680) < .015;
    });
    await sleep(2150);
    mark('result');
    await glide(boxes.rest, {bow: .08});
    await sleep(1500);
    mark('end');
  },
};
