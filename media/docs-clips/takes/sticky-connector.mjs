import {aspect, camera, drag, elements, point, prepare, setup, window} from './_figure.mjs';

export default {
  aspect, window, camera, prepare: prepare(),
  setup: setup({left: 220, top: 100, width: 720}),
  async run(ctx) {
    const {boxes, page, need, glide, key, sleep, mark, lib} = ctx;
    const p = (x,y) => point(boxes.figure,x,y);
    boxes.focus = {x:p(.06,.15).x, y:p(.06,.15).y, w:boxes.figure.w*.88, h:boxes.figure.h*.72};
    const count = expected => need(`${expected} objects on the figure`, async () => await page.locator(elements).count() === expected);
    const draw = async (shortcut, a, b, expected) => {
      await key(shortcut, {where:[.72,.88]});
      await drag(ctx, p(...a), p(...b), 740);
      await count(expected);
      await sleep(440);
    };
    mark('start');
    await sleep(800);
    mark('focus');
    await draw('Alt+r', [.12,.34], [.37,.58], 1);
    await draw('Alt+r', [.63,.24], [.88,.48], 2);
    await key('Escape', {where:[.72,.88]});
    await sleep(650);
    await draw('Shift+l', [.245,.46], [.755,.36], 3);
    await key('v');
    const line = page.locator(elements).nth(2);
    const path = line.locator('path, line').first();
    const geometry = async () => {
      const b = await path.boundingBox();
      return b && {x:b.x, y:b.y, w:b.width, h:b.height};
    };
    const original = await need('connector rendered', geometry);
    await sleep(500);
    await drag(ctx, p(.755,.36), p(.73,.69), 1400);
    const lab = await need('connector followed the second rectangle', async () => {
      const changed = await geometry();
      return changed && Math.abs(changed.y-original.y) > 20 && Math.abs(changed.h-original.h) > 20 && changed;
    });
    if (Math.abs(lab.x-original.x) > 12) throw Error('Connector detached from the first rectangle');
    await sleep(900);
    mark('result');
    await glide(boxes.rest);
    await sleep(1000);
    mark('end');
  },
};
