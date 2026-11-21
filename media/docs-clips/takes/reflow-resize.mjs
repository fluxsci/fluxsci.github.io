import {aspect, camera, drag, elements, point, prepare, setup, window} from './_figure.mjs';

export default {
  aspect, window, camera,
  prepare: prepare({plots: ['plots/growth.svg']}),
  setup: setup({left: 207, top: 106, width: 755}),
  async run(ctx) {
    const {boxes, page, need, rect, glide, click, sleep, mark, lib} = ctx;
    const plot = await need('the original growth plot', () => rect(elements));
    boxes.focus = plot;
    mark('start');
    await sleep(1000);
    await glide(point(plot, .47, .52));
    await sleep(180);
    await click();
    const handle = await need('right edge resize handle', () => rect('.canvas-host rect.zone.edge[data-h="e"]'));
    mark('focus');
    await sleep(1000);
    const from = lib.centre(handle);
    const to = {x: from.x - plot.w*.38, y: from.y};
    await drag(ctx, from, to, 2200);
    await need('plot narrowed by the drag', async () => {
      const changed = await rect(elements);
      return changed && changed.w < plot.w*.68 && changed.w > plot.w*.55 && Math.abs(changed.h-plot.h) < 4;
    });
    await sleep(1600);
    mark('result');
    const status = page.locator('aside.inspector').getByText('Exact', {exact:true});
    const exact = await need('Inspector says the reflow is Exact', () => status.boundingBox({timeout:500}).catch(() => null));
    await glide({x:exact.x+exact.width/2, y:exact.y+exact.height/2}, {ms:950});
    mark('wide');
    await sleep(1600);
    await glide(boxes.rest);
    await sleep(1100);
    mark('end');
  },
};
