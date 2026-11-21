import {aspect, elements, panel, prepare, setup, window} from './_figure.mjs';

const offsets = [
  {x:32, y:122}, {x:194, y:75}, {x:434, y:148},
].map(position => ({...position, width:154}));

export default {
  aspect, window,
  prepare: prepare({plots: ['plots/rose.svg', 'plots/section-a.svg', 'plots/section-gamma.svg'], offsets}),
  setup: setup({left: 52, top: 112, width: 570}),
  async run(ctx) {
    const {boxes, page, need, rect, glide, click, hold, release, key, sleep, mark, lib} = ctx;
    const plots = page.locator(elements);
    if (await plots.count() !== 3) throw Error('Expected three plots');
    const positions = () => plots.evaluateAll(nodes => nodes.map(node => {
      const viewport = node.querySelector('svg[x][y][width][height]');
      if (!viewport) throw Error('Plot viewport did not render');
      const matrix = viewport.parentElement.getScreenCTM();
      const origin = new DOMPoint(+viewport.getAttribute('x'), +viewport.getAttribute('y')).matrixTransform(matrix);
      return {x:origin.x, y:origin.y, w:+viewport.getAttribute('width')*matrix.a, h:+viewport.getAttribute('height')*matrix.d};
    }).sort((a,b) => a.x-b.x));
    const initial = await positions();
    const button = async (label, beat) => {
      const target = page.locator(panel).getByRole('button', {name:label, exact:true});
      const box = await need(label, () => target.boundingBox({timeout:500}).catch(() => null));
      boxes[beat] = {x:box.x+box.width/2,y:box.y+box.height/2};
      await glide(boxes[beat], {bow:.1});
      await sleep(200);
      await click();
      mark(beat);
    };
    mark('start');
    await sleep(850);
    for (const [index, plot] of initial.entries()) {
      if (index === 1) await hold('Shift', {where:[.26,.87]});
      await glide(lib.centre(plot));
      await sleep(175);
      await click();
      await sleep(210);
    }
    await release('Shift');
    await key('a', {where:[.28,.87]});
    const controls = await need('Align & Arrange panel', () => rect(panel));
    boxes.focus = lib.union(...initial, controls);
    mark('focus');
    await sleep(1400);
    await button('Align top', 'alignTop');
    await need('three plots align at the top', async () => {
      const result = await positions();
      return result.every(p => Math.abs(p.y-result[0].y) < 2);
    });
    await sleep(1350);
    await button('Distribute horizontal spacing', 'distribute');
    await need('the two gutters match', async () => {
      const [a,b,c] = await positions();
      return Math.abs((b.x-a.x-a.w)-(c.x-b.x-b.w)) < 2 && Math.abs(b.x-initial[1].x) > 8;
    });
    await sleep(1650);
    mark('result');
    await key('Escape');
    await glide(boxes.rest);
    await sleep(1500);
    mark('end');
  },
  camera({boxes, marks, frame, around}) {
    const {cover, focus, alignTop, distribute} = boxes;
    const wide = frame(cover.x, cover.x + cover.w, {top:0,within:cover});
    const overview = around(focus, {pad:32,within:cover});
    const detail = around({
      x: Math.min(alignTop.x,distribute.x)-148,
      y: alignTop.y-116,
      w: Math.abs(alignTop.x-distribute.x)+240,
      h: distribute.y-alignTop.y+166,
    }, {pad:18,within:cover});
    return [
      [marks.start,wide], [marks.start+650,wide],
      [marks.focus,overview], [marks.focus+550,overview],
      [marks.alignTop-220,detail], [marks.distribute+200,detail],
      [marks.result-350,overview], [marks.result,overview],
      [marks.end-400,wide], [marks.end,wide],
    ];
  },
};
