import {aspect, elements, point, prepare, setup, window} from './_figure.mjs';

const xray = '.xray.placed[aria-label="X-ray"]';
const row = part => `${xray} .row[data-rid$="__${part}"]`;
const control = 'control.line';
const treatment = 'treatment.line';
const controlPath = `${elements} [id$="control.line"] path`;

export default {
  aspect, window,
  prepare: prepare({plots:['plots/growth.svg']}),
  setup: setup({left:70,top:108,width:617}),
  async run(ctx) {
    const {page, boxes, need, rect, mark, glide, click, key, hold, release, type, sleep, lib} = ctx;
    const plot = await need('growth plot', () => rect(elements));
    const onLine = await page.$eval(controlPath, path => {
      const position = path.getPointAtLength(path.getTotalLength()*.6).matrixTransform(path.getScreenCTM());
      return {x:position.x,y:position.y};
    });
    const pointAt = async (what, selector) => lib.centre(await need(what, () => rect(selector)));
    const press = async (what, selector) => {
      await glide(await pointAt(what,selector), {bow:.08});
      await sleep(200);
      await click();
    };
    const hover = async part => {
      await glide(await pointAt(part+' row',row(part)+' .rlabel'), {bow:.08});
      await need(part+' readout and linked canvas outline', async () => {
        const id = await page.locator(`${xray} .xdetail .did`).getAttribute('title',{timeout:1000}).catch(() => null);
        return id?.includes(part) && await rect('.canvas-host [data-xray-hover]');
      });
    };

    mark('start');
    await sleep(850);
    await hold('Control', {where:[.19,.87]});
    await glide(onLine, {bow:.1});
    await sleep(480);
    await click();
    await release('Control');
    await need('the Control line is drilled', () => rect('.canvas-host .part-box'));
    await sleep(360);
    await key('r', {where:[.17,.87]});
    const box = await need('the redesigned X-ray panel', () => rect(xray));
    await need('Control line is the picked row', () => rect(row(control)+'.primary'));
    const source = await page.locator(`${xray} .srcline`).textContent({timeout:3000});
    if (source.trim() !== 'plots/growth.svg') throw Error('Expected a project-relative source label');
    boxes.overview = lib.union(plot,box);
    mark('focus');
    await sleep(1350);
    await hover(control);
    await sleep(800);

    await press('Search parts', xray+' .search-in');
    await type('line', {per:140});
    await need('the filtered Control and Treatment line rows', async () => await rect(row(control)) && await rect(row(treatment)));
    const filtered = await rect(xray);
    const rightPlot = {...plot, ...point(plot,.37,0), w:plot.w*.63};
    boxes.detail = lib.union(rightPlot, filtered);
    mark('filtered');
    await sleep(1000);
    await hover(treatment);
    await sleep(1100);

    const eye = row(treatment)+' button.eye';
    await press('Treatment line visibility', eye);
    await need('Treatment stroke is hidden', () => rect(eye+'.off'));
    await sleep(1200);
    await click();
    await need('Treatment stroke is visible again', async () => await rect(eye) && !await rect(eye+'.off'));
    await sleep(1150);
    mark('result');
    await press('Close X-ray', xray+' button[aria-label="Close X-ray"]');
    await need('X-ray closed', async () => !await rect(xray));
    await glide(boxes.rest);
    await sleep(1400);
    mark('end');
  },
  camera({boxes,marks,frame,around}) {
    const {cover} = boxes;
    const wide = frame(cover.x,cover.x+cover.w,{top:0,within:cover});
    const panel = around(boxes.overview,{pad:25,within:cover});
    const detail = around(boxes.detail,{pad:26,within:cover});
    return [
      [marks.start,wide], [marks.start+650,wide],
      [marks.focus,panel], [marks.filtered,panel],
      [marks.filtered+650,detail], [marks.result,detail],
      [marks.result+550,panel], [marks.end-450,wide], [marks.end,wide],
    ];
  },
};
