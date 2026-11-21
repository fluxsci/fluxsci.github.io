import {aspect, camera, drag, point, prepare} from './_figure.mjs';
import {clickTarget, electronArgs, consoleBoard, live, openImage, setup, window} from './_fluximg.mjs';

const depth = '[data-fxb-rail="z"]';
const time = '[data-fxb-rail="t"]';
const contrast = '[data-fxb-channel="1"] [data-fxb-well]';
const signal = '[data-fxb-channel="1"] button.lamp';
const whitePoint = '[data-fxb-channel="1"] button.num.w';

export default {
  aspect, window, camera, electronArgs, prepare: prepare({width:520,height:480}), setup,
  async run(ctx) {
    const {boxes, page, need, rect, glide, sleep, mark, lib} = ctx;
    mark('start');
    await sleep(650);
    await openImage(ctx);
    const z = await need('depth scrub track', () => rect(`${depth} [data-fxb-track]`));
    const t = await need('time scrub track', () => rect(`${time} [data-fxb-track]`));
    boxes.focus = lib.union(boxes.image, await rect(consoleBoard), await rect(depth), await rect(time));
    mark('focus');
    await sleep(700);
    const flag = selector => page.locator(`${selector} [data-fxb-flag] b`).textContent();
    const initial = await flag(depth);
    mark('depth');
    await drag(ctx, point(z,.45,.48), point(z,.45,.32), 700);
    await need('a different depth plane', async () => await flag(depth) !== initial);
    await sleep(700);
    const before = await flag(time);
    mark('time');
    await drag(ctx, point(t,.36,.55), point(t,.72,.55), 1000);
    await need('a different time frame', async () => await flag(time) !== before);
    await sleep(650);
    const well = await need('the Signal histogram', () => rect(contrast));
    const white = Number(await page.locator(contrast).getAttribute('data-w', {timeout:1500}));
    const range = () => page.locator(whitePoint).textContent({timeout:1500});
    const initialWhite = await range();
    mark('contrast');
    await drag(ctx, point(well,white,.58), point(well,white*.73,.58), 800);
    await need('the Signal white point moved', async () => await range() !== initialWhite);
    await sleep(650);
    mark('channel');
    await clickTarget(ctx, signal);
    await need('Signal hidden', () => rect(`${signal}[aria-pressed="false"]`));
    await sleep(700);
    await clickTarget(ctx, signal);
    await need('Signal visible again', () => rect(`${signal}[aria-pressed="true"]`));
    await sleep(650);
    mark('result');
    await ctx.key('r', {where:[.76,.88]});
    await need('live view closed', async () => !await rect(live));
    await glide(boxes.rest);
    await sleep(900);
    mark('end');
  },
};
