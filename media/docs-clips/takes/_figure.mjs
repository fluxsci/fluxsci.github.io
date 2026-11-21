import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

export const window = {width: 1180, height: 680, scale: 4};
export const aspect = 16 / 9;
export const figure = '.canvas-host rect.figure-bg.active';
export const elements = '.canvas-host [data-editor-element-id]';
export const rail = '[data-plots-rail]';
export const panel = '.align-arrange-panel';

export function prepare({width = 680, height = 430, plots = [], offsets = []} = {}) {
  return (project, {source}) => {
    const file = path.join(project, 'fig/canvases/canvas-1.json');
    const canvas = JSON.parse(fs.readFileSync(file, 'utf8'));
    const demo = canvas.figures[0];
    if (demo.id !== 'fig-1' || demo.elements.length) throw Error('Use a newly scaffolded tutorial project');
    Object.assign(demo, {width, height});
    fs.writeFileSync(file, JSON.stringify(canvas));
    if (!plots.length) return;
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'flux-guide-cli-'));
    try {
      execFileSync(process.execPath, [path.join(source, 'dist/flux-cli.mjs'), 'import-plots', demo.id, ...plots, '--root', project], {
        cwd: project, env: {...process.env, HOME: home, XDG_CONFIG_HOME: home}, stdio: 'inherit',
      });
    } finally {
      fs.rmSync(home, {recursive: true, force: true});
    }
    const filled = JSON.parse(fs.readFileSync(file, 'utf8'));
    const placed = filled.figures[0].elements;
    if (placed.length !== plots.length) throw Error('Expected one placed plot per source');
    offsets.forEach((offset, index) => {
      const plot = placed[index];
      const height = offset.width * plot.height / plot.width;
      Object.assign(plot, {height}, offset);
    });
    fs.writeFileSync(file, JSON.stringify(filled));
  };
}

export function setup({left = 250, top = 130, width = 660, showRail = false} = {}) {
  return async ctx => {
    const {page, rect, need, lib, boxes} = ctx;
    const button = page.getByRole('button', {name: 'Figure', exact: true});
    await button.waitFor({timeout: 45000});
    if (!await rect('.canvas-host')) await button.click();
    await need('active Figure 1', () => rect(figure), 45000);
    if (showRail) {
      if (!await rect(rail)) await page.keyboard.press('Alt+g');
      await need('Plots rail', () => rect(rail));
    } else {
      const leftRail = await rect('.canvas-host');
      if (leftRail.x > 40) await page.keyboard.press('Control+b');
      await need('left rail closed', async () => (await rect('.canvas-host')).x < 40);
    }
    await lib.zoomCanvas(ctx, figure, width);
    boxes.figure = await lib.panCanvas(ctx, figure, {x: left, y: top});
    if (Math.abs(boxes.figure.x-left) > 10 || Math.abs(boxes.figure.y-top) > 10) throw Error('Could not frame Figure 1');
    boxes.rest = {x: boxes.figure.x + boxes.figure.w - 24, y: boxes.figure.y + boxes.figure.h - 18};
    await ctx.place(boxes.rest);
    boxes.cover = {x: 10, y: 0, w: ctx.WIDTH - 20, h: ctx.HEIGHT - 2};
    return {cover: boxes.cover};
  };
}

export async function drag(ctx, from, to, ms = 1200) {
  await ctx.glide(from, {bow: .08});
  await ctx.sleep(190);
  await ctx.down();
  await ctx.sleep(170);
  await ctx.glide(to, {bow: 0, ms});
  await ctx.sleep(225);
  await ctx.up();
}

export function point(box, x, y) {
  return {x: box.x + box.w*x, y: box.y + box.h*y};
}

export function camera({frame, around, boxes, marks}) {
  const {cover} = boxes;
  const wide = frame(cover.x, cover.x + cover.w, {top: 0, within: cover});
  const close = around(boxes.focus, {pad: 32, within: cover});
  const closeTime = Math.max(marks.focus, marks.start + 1150);
  return [[marks.start, wide], [marks.start + 650, wide], [closeTime, close],
    [marks.result, close], [marks.wide ?? marks.end - 400, wide], [marks.end, wide]];
}
