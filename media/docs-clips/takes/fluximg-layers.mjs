import {aspect, camera, prepare} from './_figure.mjs';
import {clickTarget, electronArgs, setup, window} from './_fluximg.mjs';

const card = '[data-fxb-layers]';
const lamp = `${card} button.lamp`;
const layer = `${card} [role="treeitem"].lay .name`;
const object = `${card} [role="treeitem"].obj`;

export default {
  aspect, window, camera, electronArgs, prepare: prepare({width:520,height:480}),
  setup: ctx => setup(ctx,{keepOpen:true}),
  async run(ctx) {
    const {boxes, page, need, rect, glide, sleep, mark, lib} = ctx;
    const layers = await need('Cell outlines layer card', () => rect(card));
    boxes.focus = lib.union(boxes.image, layers);
    await need('Cell outlines starts hidden', () => rect(`${lamp}[aria-label="Show Cell outlines"]`));
    mark('start');
    await sleep(1500);
    mark('focus');
    const toggle = await need('the layer visibility lamp', () => rect(lamp));
    await glide(lib.centre(toggle));
    await sleep(1250);
    mark('enableLayer');
    await ctx.click();
    await need('the outlines layer is visible', () => rect(`${lamp}[aria-pressed="true"]`));
    await sleep(1800);
    if (!await rect(object)) await clickTarget(ctx, layer);
    await need('the layer exposes its objects', () => rect(object));
    await sleep(850);
    const hoverObject = async index => {
      const target = page.locator(object).nth(index);
      const row = await need(`object row ${index+1}`, () => target.boundingBox({timeout:900}).catch(() => null));
      const box = {x:row.x,y:row.y,w:row.width,h:row.height};
      boxes.focus = lib.union(boxes.focus, box);
      await glide({x:row.x+32,y:row.y+row.height/2});
      await need(`object ${index+1} highlighted`, async () => (await target.getAttribute('class', {timeout:1000})).split(' ').includes('hot'));
    };
    mark('objects');
    await hoverObject(0);
    await sleep(1550);
    await hoverObject(1);
    await sleep(1850);
    mark('result');
    await glide(boxes.rest);
    await sleep(1700);
    mark('end');
  },
};
