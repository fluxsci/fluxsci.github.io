import {aspect, elements, prepare, setup, window} from './_figure.mjs';

const properties = '.fluxFigMenu.placed[aria-label="Properties"]';
const strokePicker = `${properties} [data-key="g"] .colorbtn`;
const green = `${properties} [role="option"][title="green-600 · #228833"]`;
const close = `${properties} button[aria-label="Close properties"]`;
const plotPath = id => `${elements} [id$="${id}"] path`;
const control = plotPath('control.line');
const treatment = plotPath('treatment.line');
const legend = plotPath('legend.entry.0.swatch');
const greenInk = 'rgb(34, 136, 51)';

export default {
  aspect, window: {...window,width:1280,height:750},
  prepare: prepare({plots:['plots/growth.svg']}),
  setup: setup({left:68, top:107, width:687}),
  async run(ctx) {
    const {page, boxes, need, rect, mark, glide, click, key, hold, release, sleep, lib} = ctx;
    const plot = await need('growth plot', () => rect(elements));
    boxes.plot = plot;
    const getStroke = selector => page.$eval(selector, node => getComputedStyle(node).stroke);
    const original = await getStroke(control);
    const other = await getStroke(treatment);
    if (original !== 'rgb(32, 94, 166)' || original === other) throw Error('Expected a blue Control series');
    const onLine = await page.$eval(control, path => {
      const point = path.getPointAtLength(path.getTotalLength()*.60).matrixTransform(path.getScreenCTM());
      return {x:point.x, y:point.y};
    });
    const pointAt = async (description, selector) => lib.centre(await need(description, () => rect(selector)));
    const press = async (description, selector) => {
      await glide(await pointAt(description, selector), {bow:.08});
      await sleep(200);
      await click();
    };

    mark('start');
    await sleep(950);
    await hold('Control', {where:[.2,.86]});
    await glide(onLine, {bow:.15});
    await sleep(550);
    await click();
    await release('Control');
    await need('a plot part is selected', () => rect('.canvas-host .part-box'));
    await sleep(400);
    await key('f', {where:[.18,.86]});
    const menu = await need('on-canvas Properties menu', () => rect(properties));
    await need('Stroke colour field', () => rect(strokePicker));
    boxes.menu = lib.union(plot, menu);
    mark('focus');
    await sleep(1600);

    await press('Stroke colour swatch', strokePicker);
    await need('stroke palette', () => rect(`${properties} [aria-label="stroke colour"]`));
    const palette = await need('Properties menu with palette', () => rect(properties));
    if (palette.x + palette.w > ctx.WIDTH-10 || palette.y + palette.h > ctx.HEIGHT-3) {
      throw Error('The palette is outside the available stage: ' + JSON.stringify(palette));
    }
    boxes.palette = lib.union(plot, palette);
    mark('palette');
    await sleep(1050);
    await glide(await pointAt('green-600 palette swatch', green), {bow:.09});
    await need('green stroke preview', async () => await getStroke(control) === greenInk);
    await sleep(850);
    await click();
    await need('returned to Properties after applying the swatch', () => rect(strokePicker));
    await need('Control legend swatch changed with the line', async () => await getStroke(legend) === greenInk);
    mark('applied');
    await sleep(1300);
    await press('Close Properties', close);
    await need('Properties closed', async () => !await rect(properties));
    if (await getStroke(control) !== greenInk || await getStroke(treatment) !== other) {
      throw Error('The chosen stroke must persist on Control only');
    }
    mark('closed');
    await glide(boxes.rest);
    await sleep(2050);
    mark('end');
  },
  camera({boxes, marks, frame, around}) {
    const {cover} = boxes;
    const wide = frame(cover.x,cover.x+cover.w,{top:0,within:cover});
    const menu = around(boxes.menu,{pad:24,within:cover});
    const palette = around(boxes.palette,{pad:18,within:cover});
    const result = around(boxes.plot,{pad:40,within:cover});
    return [
      [marks.start,wide], [marks.start+650,wide],
      [marks.focus,menu], [marks.palette-100,menu],
      [marks.palette+650,palette], [marks.applied,palette],
      [marks.applied+700,menu], [marks.closed,menu],
      [marks.closed+600,result], [marks.end-900,result],
      [marks.end-400,wide], [marks.end,wide],
    ];
  },
};
