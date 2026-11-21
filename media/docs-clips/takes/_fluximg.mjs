import {elements, figure, rail, setup as setupFigure, window as defaultWindow} from './_figure.mjs';

// The private Xvfb stage uses software graphics. The live board still needs WebGL2.
export const electronArgs = [
  '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
];
const tile = `${rail} [data-tile$="/cells-in-motion.fluximg"]`;
export const window = {...defaultWindow,width:1040,height:620};
export const live = '[data-fluximg-live]';
export const consoleBoard = '[data-fxb-console]';

export async function setup(ctx, {keepOpen = false} = {}) {
  const staged = await setupFigure({left:330, top:95, width:680, showRail:true})(ctx);
  const {page, rect, need, lib, boxes} = ctx;
  const source = await need('the Cells in motion stack tile', () => rect(tile), 12000);
  const at = lib.centre(source);
  await page.mouse.dblclick(at.x, at.y);
  await need('one image bundle placed', async () => await page.locator(elements).count() === 1 && rect(elements), 15000);
  await page.keyboard.press('Control+b');
  await need('the rail is closed', async () => !await rect(rail));
  await page.keyboard.press('Control+Shift+b');
  await need('the Inspector is closed', async () => !await rect('aside.inspector'));
  await lib.zoomCanvas(ctx, elements, 320);
  boxes.image = await lib.panCanvas(ctx, elements, {x:443,y:128});
  boxes.figure = await need('the figure stays active', () => rect(figure));
  const image = lib.centre(boxes.image);
  await page.mouse.click(image.x,image.y);
  await page.keyboard.press('r');
  const ready = () => rect(`${live}[data-sharp="1"]`);
  await need('the warm-up image is sharp', ready, 15000);
  for (const key of ['ArrowDown','ArrowUp','ArrowRight','ArrowLeft']) {
    await page.keyboard.press(key);
    await ctx.sleep(220);
    await need('the warm-up frame is sharp', ready);
  }
  if (keepOpen) {
    const lamp = page.locator('[data-fxb-layers] button.lamp');
    await lamp.click();
    await need('the warm-up layer is on', () => rect('[data-fxb-layers] [aria-label="Hide Cell outlines"]'));
    await ctx.sleep(850);
    await lamp.click();
    await need('the warm-up layer is off', () => rect('[data-fxb-layers] [aria-label="Show Cell outlines"]'));
  } else {
    await page.keyboard.press('r');
    await need('the board closes after warm-up', async () => !await rect(live));
  }
  boxes.rest = {x:575,y:108};
  await ctx.place(boxes.rest);
  await ctx.sleep(3100);
  return staged;
}

export async function openImage(ctx) {
  const {rect, boxes, glide, click, key, sleep, need, lib} = ctx;
  await glide(lib.centre(boxes.image), {bow:.12});
  await sleep(200);
  await click();
  await sleep(250);
  await key('r', {where:[.77,.84]});
  await need('the image is sharp in the live view', () => rect(`${live}[data-sharp="1"]`), 14000);
  await need('the live view console', () => rect(consoleBoard));
}

export async function clickTarget(ctx, selector) {
  const target = await ctx.need(selector, () => ctx.rect(selector));
  await ctx.glide(ctx.lib.centre(target));
  await ctx.sleep(180);
  await ctx.click();
}
