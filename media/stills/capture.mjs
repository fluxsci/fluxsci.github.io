/** Drive the production Flux desktop app over CDP and record reviewed stills. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {attach, elementSelector, fitWindow, panCanvas, sleep, union, zoomCanvas} from '../pitch/lib.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const opt = name => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const group = opt('--group');
const groups = {
  workspaces: homeWorkspaces,
  properties,
  xray,
  images: imageBoard,
  slides,
  reading,
  comments,
  features,
  techniques,
  library,
  metadata,
  spelling,
};
if (!Object.hasOwn(groups, group) || !opt('--app') || !opt('--port')) {
  throw Error(`Pass --app, --port and --group ${Object.keys(groups).join('|')}. Start the app with media/pitch/stage.mjs.`);
}
const app = path.resolve(opt('--app'));
const pin = JSON.parse(await fs.readFile(path.join(root, 'flux-source.json'), 'utf8'));
const home = await fs.mkdtemp(path.join(os.tmpdir(), 'flux-still-build-'));
let build;
try {
  const env = {...process.env, HOME: home, XDG_CONFIG_HOME: home};
  build = JSON.parse(execFileSync(process.execPath, [path.join(app, 'dist/flux-cli.mjs'), 'config'], {encoding: 'utf8', env})).build;
} finally {
  await fs.rm(home, {recursive: true, force: true});
}
assert.match(build?.commit, /^[0-9a-f]{8,40}$/);
const revisions = new Set([pin.revision, ...(pin.captureRevisions ?? [])]);
const matches = [...revisions].filter(revision => revision.startsWith(build.commit));
assert.equal(matches.length, 1, 'Capture app must match a unique reviewed website pin');
const source = {repository: pin.repository, revision: matches[0], version: pin.version};
const folder = path.resolve(opt('--out') || path.join(root, '.cache/review/stills', group));
await fs.mkdir(folder, {recursive: true});

const ctx = await attach(Number(opt('--port')));
const {browser, page, cdp, rect, need, shot} = ctx;
assert.equal(await fs.realpath(fileURLToPath(page.url())), await fs.realpath(path.join(app, 'dist/index.html')), 'The stage must run the same app build as --app');
const errors = [];
page.on('pageerror', error => errors.push(error.message));

if (opt('--display')) {
  await fitWindow(ctx, {width: 1500, height: 950, scale: 2, display: Number(opt('--display'))});
}
const {width, height, scale} = await page.evaluate(() => ({width: innerWidth, height: innerHeight, scale: devicePixelRatio}));
assert.equal(scale, 2, 'Stage must use 2× device scale');
page.setDefaultTimeout(15000);

const visible = name => page.getByRole('button', {name, exact: true}).filter({visible: true});
const mode = async name => {
  const button = page.locator(`button[aria-label="${name}"][title^="${name} —"]`);
  if (await button.getAttribute('aria-current') !== 'true') await button.click();
  await sleep(700);
};
const settle = async () => {
  await page.evaluate(() => document.fonts.ready);
  await sleep(950);
};
const outputs = {};
const manifestFor = {};
const park = () => page.mouse.move(width - 5, height - 5);

function clipBox(box) {
  const x = Math.max(0, Math.floor(box.x)), y = Math.max(0, Math.floor(box.y));
  return {
    x, y,
    width: Math.min(width - x, Math.ceil(box.x + box.w) - x),
    height: Math.min(height - y, Math.ceil(box.y + box.h) - y),
  };
}

async function capture(name, {box, category = 'screenshots', keepPointer = false} = {}) {
  if (!keepPointer) await park();
  await settle();
  assert.equal((await page.locator('vite-error-overlay').count()), 0);
  const master = path.join(folder, name + '.png');
  const clip = box ? clipBox(box) : {x: 0, y: 0, width, height};
  await shot(master, clip);
  const png = await fs.readFile(master);
  assert.equal(png.readUInt32BE(16), clip.width * scale);
  assert.equal(png.readUInt32BE(20), clip.height * scale);
  const webp = category === 'screenshots';
  const file = webp ? path.join(folder, name + '.webp') : master;
  if (webp) {
    // Encode the reviewed lossless master once so both formats show the same frame.
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', master, '-c:v', 'libwebp', '-quality', '94', file]);
  }
  const rel = webp ? `site/assets/media/${name}.webp` : `site/assets/media/docs/${name}.png`;
  const bytes = await fs.readFile(file);
  outputs[rel] = {
    width: webp ? clip.width : png.readUInt32BE(16),
    height: webp ? clip.height : png.readUInt32BE(20),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  manifestFor[rel] = category;
  console.log('Captured', rel);
}

async function composeActiveFigure(name, fill = .91) {
  await mode('Figure');
  const layers = page.getByRole('button', {name: 'Layers', exact: true}).filter({visible: true});
  if (await layers.count()) await layers.click();
  await visible(name).click();
  const selector = '.canvas-host rect.figure-bg.active';
  const canvas = await need('Figure canvas', () => rect('.canvas-host'));
  const figure = await need('active figure', () => rect(selector));
  const target = Math.min(canvas.w * fill, canvas.h * fill * figure.w / figure.h);
  const zoomed = await zoomCanvas(ctx, selector, target);
  return panCanvas(ctx, selector, {
    x: canvas.x + (canvas.w - zoomed.w) / 2,
    y: canvas.y + (canvas.h - zoomed.h) / 2,
  });
}

async function openManuscript() {
  await mode('Paper');
  await page.locator('button[title="paper/manuscript.qmd"]').filter({visible: true}).click();
}

async function homeWorkspaces() {
  await openManuscript();
  const scroller = page.locator('.cm-editor .cm-scroller').filter({visible: true}).first();
  await scroller.waitFor();
  if (await page.locator('.dm-wrap').filter({visible: true}).count()) await page.keyboard.press('Control+Shift+b');
  await page.locator('.cm-editor img[data-figure-state="ready"]').filter({visible: true}).first().waitFor();
  await scroller.evaluate(element => { element.scrollTop = 180; });
  await capture('paper');
  const editor = await need('Paper editor', () => rect('.cm-editor'));
  await capture('paper-detail', {box: {...editor, h: Math.min(760, editor.h)}});
  await composeActiveFigure('Figure 2');
  await page.keyboard.press('Escape');
  await capture('figure');
  await composeActiveFigure('Figure 1', .85);
  await page.keyboard.press('Escape');
  await capture('figure-materials');
}

async function renameLayer(before, after) {
  const row = visible(before);
  if (!await row.count()) {
    await visible(after).waitFor();
    return;
  }
  await row.dblclick();
  const rename = page.locator('input.rename').filter({visible: true});
  await rename.fill(after);
  await rename.press('Enter');
  await visible(after).waitFor();
}

async function properties() {
  await composeActiveFigure('Figure 1', .86);
  const plot = elementSelector('plot_muslftf6wsx2_36');
  await renameLayer('plot 1', 'Bracket stress');
  await page.locator(plot + ' .plot-hit-area').click({position: {x: 30, y: 30}});
  await page.keyboard.press('f');
  const menu = page.getByRole('dialog', {name: 'Properties', exact: true});
  await menu.waitFor();
  await capture('figure-properties');
  await capture('figure-property-menu', {
    box: await need('property menu bounds', () => rect('.fluxFigMenu.placed')),
    category: 'docs-screenshots',
  });
  await page.keyboard.press('Escape');
}

async function xray() {
  await composeActiveFigure('Figure 1', .86);
  const plot = elementSelector('plot_muslftfswsx2_40');
  await renameLayer('plot 2', 'Stiffness and density');
  const bounds = await rect(plot + ' .plot-hit-area');
  assert(bounds, 'The stiffness and density plot must be visible');
  await page.mouse.click(bounds.x + bounds.w * .48, bounds.y + bounds.h * .44);
  await page.keyboard.press('r');
  const dialog = page.getByRole('dialog', {name: 'X-ray', exact: true});
  await dialog.getByRole('button', {name: 'Stiffness and density', exact: true}).waitFor();
  const axisRow = dialog.locator('.row').filter({hasText: 'X axis'}).first();
  const expand = axisRow.getByRole('button', {name: 'Open or close', exact: true});
  if (await expand.count() && await expand.getAttribute('aria-expanded') === 'false') await expand.click();
  await axisRow.locator('.rmain').click();
  await dialog.locator('.showprops.axis').waitFor();
  assert.equal(await dialog.getByRole('button', {name: 'Show Properties', exact: true}).isEnabled(), true);
  await dialog.locator('.xdetail .dval').filter({hasText: /Density|Mg/}).waitFor();
  await dialog.getByPlaceholder('Search parts…').waitFor();
  const box = await need('X-ray bounds', () => rect('.xray.placed'));
  await capture('figure-xray', {box, category: 'docs-screenshots'});
  await page.keyboard.press('Escape');
}

async function metadata() {
  const dialog = page.getByRole('dialog', {name: 'Figure-Meta', exact: true});
  if (!(await dialog.count())) {
    await mode('Figure');
    const alreadyNamed = await visible('Materials across scales').count();
    await composeActiveFigure(alreadyNamed ? 'Materials across scales' : 'Figure 1');
    await visible('Figure-Meta').click();
  }
  await dialog.waitFor();
  await dialog.getByRole('navigation', {name: 'Figures', exact: true}).getByText('Figure 2', {exact: true}).waitFor();
  const names = dialog.locator('.name-bar');
  if (await names.getAttribute('aria-expanded') !== 'true') await names.click();
  const title = dialog.getByRole('textbox', {name: 'Figure title', exact: true});
  if (await title.inputValue() !== 'Materials across scales') {
    await title.fill('Materials across scales');
    await dialog.getByRole('button', {name: 'Save name', exact: true}).click();
  }
  await dialog.getByRole('navigation', {name: 'Figures', exact: true}).getByText('Materials across scales', {exact: true}).waitFor();
  const captions = {
    Figure: 'Reference data, computed fields and crystal structures across scales.',
    a: 'Young’s modulus and density across material classes.',
    b: 'MgB₂ Fermi surface and computed bracket stress.',
    c: 'Analytic stress near a circular hole and an illustrative density of states.',
    d: 'Two sections through the MgB₂ electronic structure.',
    e: 'Perovskite.',
    f: 'Sodium chloride.',
    g: 'Diamond-cubic silicon.',
    h: 'Yttrium barium copper oxide.',
  };
  for (const [panel, text] of Object.entries(captions)) {
    await dialog.getByRole('textbox', {name: panel + ' caption', exact: true}).fill(text);
  }
  await dialog.getByRole('separator', {name: 'Resize figure preview'}).press('ArrowRight');
  await dialog.locator('.fields').evaluate(el => { el.scrollTop = 0; });
  await page.waitForFunction(() => document.querySelector('.figure-meta [role="status"]')?.getAttribute('data-state') === 'saved');
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll('.figure-meta .preview-pane img')];
    return images.some(image => image.complete && image.naturalWidth > 0);
  }, undefined, {timeout: 45000});
  await dialog.locator('header .title').click();
  const frame = await rect('.figure-meta');
  await capture('figure-meta-overview', {category: 'feature-captures', box: frame});
}

async function imageBoard() {
  await composeActiveFigure('Figure 2', .69);
  const image = page.locator('.canvas-host [data-editor-element-id^="fluximg_"]').first();
  await image.dblclick();
  const live = page.locator('[data-fluximg-live]');
  await live.waitFor();
  await page.locator('[data-fxb-console]').getByText('Cells in motion', {exact: true}).waitFor();
  await page.locator('[data-fxb-rail="z"]').waitFor();
  await page.locator('[data-fxb-rail="t"]').waitFor();
  const renderer = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
  assert.ok(renderer, 'Launch with Electron WebGL2 enabled');
  await page.waitForFunction(() => !document.querySelector('[data-fxb-console]')?.innerText.includes('not available'));
  const boxes = await Promise.all(['[data-fluximg-live]', '[data-fxb-console]', '[data-fxb-rail="z"]', '[data-fxb-rail="t"]', '[data-fxb-layers]'].map(rect));
  const frame = union(...boxes);
  await capture('fluximg-control-board', {
    box: {x: frame.x - 24, y: frame.y - 24, w: frame.w + 48, h: frame.h + 48},
    category: 'feature-captures',
  });

}

async function slides() {
  await mode('Slide');
  const slide = page.getByText('Japan’s earthquakes, from the side', {exact: true}).filter({visible: true});
  await slide.click();
  await page.getByRole('button', {name: /^Animate/}).filter({visible: true}).click();
  const timeline = page.locator('[aria-label="Animation timeline"]').filter({visible: true});
  await timeline.waitFor();
  await timeline.locator('button[data-step-index="2"][title^="One slice"]').click();
  const edit = page.getByRole('button', {name: /^Edit after step/}).filter({visible: true});
  await edit.click();
  await capture('slides');
}

async function textSelection(selector, words) {
  const locator = page.locator(selector).filter({hasText: words}).filter({visible: true}).first();
  await locator.waitFor();
  const boxes = await locator.evaluate((container, words) => {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let text = '';
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      nodes.push([node, text.length]);
      text += node.textContent;
    }
    const start = text.indexOf(words), end = start + words.length;
    if (start < 0) throw Error('Passage not found: ' + words);
    const range = document.createRange();
    for (const [node, offset] of nodes) {
      if (start >= offset && start < offset + node.length) range.setStart(node, start - offset);
      if (end > offset && end <= offset + node.length) range.setEnd(node, end - offset);
    }
    return Array.from(range.getClientRects(), ({x,y,width,height}) => ({x,y,w:width,h:height})).filter(box => box.w);
  }, words);
  assert(boxes.length, 'Selection has no visible text');
  const first = boxes[0], last = boxes.at(-1);
  await page.mouse.move(first.x + .2, first.y + first.h / 2);
  await page.mouse.down();
  await page.mouse.move(last.x + last.w - .2, last.y + last.h / 2, {steps: 18});
  await page.mouse.up();
  return boxes;
}

async function library() {
  await mode('Library');
  const row = page.locator('.lib .grow').filter({hasText: 'Highly accurate protein structure prediction with AlphaFold'}).filter({visible: true}).first();
  const details = row.getByRole('button', {name: 'Toggle details', exact: true});
  if ((await details.textContent()).trim() !== '▾') await details.click();
  await page.locator('.lib .detail').filter({visible: true}).first().waitFor();
  await capture('library');
  return row;
}

async function reading() {
  const row = await library();
  await row.getByRole('button', {name: 'Read PDF', exact: true}).click();
  const active = page.locator('[data-doc-active="true"]');
  const words = 'Proteins are essential to life, and understanding their structure';
  const selection = active.locator('.textLayer span').filter({hasText: words}).first();
  await selection.waitFor({timeout: 30000});
  const left = active.getByRole('button', {name: 'Toggle the left sidebar', exact: true});
  if (await left.count() && await active.getByText('No reference list', {exact: false}).count()) await left.click();
  await selection.scrollIntoViewIfNeeded();
  await textSelection('[data-doc-active="true"] .textLayer span', words);
  await active.getByRole('button', {name: 'Highlight yellow', exact: true}).click();
  const highlight = active.getByRole('button', {name: 'Edit highlight', exact: true}).first();
  await highlight.click();
  await page.getByRole('textbox', {name: 'Highlight comment', exact: true}).fill('Keep the distinction between a structure prediction and an experimental measurement.');
  await page.getByRole('button', {name: 'Save', exact: true}).filter({visible: true}).click();
  await page.keyboard.press('Escape');
  await capture('reader');

  const phrase = 'large-scale structural bioinformatics.';
  const context = active.locator('.textLayer span').filter({hasText: phrase}).first();
  await context.evaluate(element => element.scrollIntoView({block: 'center', inline: 'nearest'}));
  await settle();
  const quote = await textSelection('[data-doc-active="true"] .textLayer span', phrase);
  const actions = active.getByRole('button', {name: 'Annotate this passage', exact: true}).filter({visible: true}).first();
  await actions.waitFor();
  const origin = await selection.boundingBox();
  const lines = await active.locator('.textLayer span').evaluateAll((spans, paragraph) => {
    return spans.map(span => span.getBoundingClientRect())
      .filter(r => Math.abs(r.x - paragraph.x) < 4 && r.y >= paragraph.y - 3 && r.y < paragraph.y + 330 && r.width > 150)
      .map(({x,y,width,height}) => ({x,y,w:width,h:height}));
  }, origin);
  const annotation = await actions.boundingBox();
  const below = lines.filter(line => line.y > quote[0].y).slice(0, 4);
  assert(below.length, 'The selected paragraph column needs readable context below the quote');
  const frame = union(...lines.slice(0, lines.indexOf(below.at(-1)) + 1), ...quote, {
    x: annotation.x, y: annotation.y, w: annotation.width, h: annotation.height,
  });
  await capture('reader-selection-card', {
    category: 'feature-captures',
    box: {x: frame.x - 20, y: frame.y - 8, w: frame.w + 40, h: frame.h + 10},
  });
}

async function comments() {
  await openManuscript();
  if (await page.locator('.dm-wrap').filter({visible: true}).count()) await page.keyboard.press('Control+Shift+b');
  const words = 'Each panel keeps its own axes, units and source.';
  const line = page.locator('.cm-line').filter({hasText: words}).filter({visible: true}).first();
  await line.scrollIntoViewIfNeeded();
  const boxes = await textSelection('.cm-line', words);
  await page.keyboard.press('Control+Alt+m');
  const card = page.getByRole('dialog', {name: 'Comment', exact: true});
  await card.getByRole('textbox', {name: 'New comment'}).fill('Check the units against the original before submission.');
  await card.getByTitle('Attach a tag').click();
  const tag = card.getByRole('textbox', {name: 'Tag name'});
  await tag.fill('check-units');
  await tag.press('Enter');
  await card.locator('[data-tag="check-units"]').waitFor();
  await card.getByRole('textbox', {name: 'New comment'}).click();
  const c = await card.boundingBox();
  const box = union(...boxes, {x: c.x, y: c.y, w: c.width, h: c.height});
  const heading = page.locator('.cm-line').filter({hasText: 'Structure becomes visible'}).filter({visible: true}).first();
  const h = await heading.boundingBox();
  const top = Math.max(0, h.y + h.height + 9);
  await capture('paper-comment-tags', {
    category: 'feature-captures',
    box: {x: box.x - 44, y: top, w: box.w + 88, h: box.y + box.h - top + 36},
  });
}

const docStill = (name, box) => capture(name, {category: 'feature-captures', box});

async function figureFeatures() {
  await composeActiveFigure('Figure 2', .82);
  await page.keyboard.press('Alt+g');
  const rail = page.locator('[data-plots-rail]').filter({visible: true});
  await rail.waitFor();
  await rail.locator('[data-tile$="/atlas.svg"]').click();
  await page.locator('[data-plots-dissections]').getByText(/direction_counts/).first().waitFor();
  await docStill('figure-plots-rail');
  await rail.locator('[data-plot-notes-toggle]').click();
  const note = rail.locator('[data-plots-dissections]').getByText('observations', {exact: false}).first();
  await note.click();
  await docStill('figure-dissections-notes', await rect('[data-plots-rail]'));
  await page.keyboard.press('Alt+g');

  await composeActiveFigure('Growth', .84);
  const growth = page.locator('.canvas-host [data-editor-element-id^="plot_"] .plot-hit-area').filter({visible: true}).first();
  const plot = await growth.boundingBox();
  assert(plot, 'The tutorial growth plot is not visible');
  await page.mouse.click(plot.x + plot.width / 2, plot.y + plot.height / 2);
  const aside = page.locator('aside.inspector').filter({visible: true});
  const layout = aside.getByText('Layout', {exact: true}).first();
  await layout.waitFor();
  const l = await layout.boundingBox(), right = await rect('aside.inspector');
  const top = Math.max(right.y, l.y - 175);
  await docStill('figure-plot-layout', {...right, y: top, h: Math.min(630, right.y + right.h - top)});

  const original = await growth.boundingBox();
  const handles = await page.locator('rect.handle').evaluateAll(elements => elements.map(el => {
    const r = el.getBoundingClientRect();
    return {x: r.x + r.width / 2, y: r.y + r.height / 2};
  }));
  assert(handles.length, 'No plot selection handles');
  const edge = handles.sort((a, b) => (Math.abs(a.y - original.y - original.height / 2) + original.x + original.width - a.x)
                                     - (Math.abs(b.y - original.y - original.height / 2) + original.x + original.width - b.x))[0];
  await drag(edge, {x: edge.x - original.width * .31, y: edge.y});
  await page.waitForFunction(width => document.querySelector('.canvas-host .plot-hit-area')?.getBoundingClientRect().width < width * .92, original.width);
  await docStill('figure-plot-reflowed');

  const align = await composeActiveFigure('Alignment', .79);
  await page.mouse.click(align.x + 15, align.y + align.h - 18);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('a');
  await page.locator('.align-arrange-panel').filter({visible: true}).waitFor();
  await docStill('figure-align-arrange');
  await page.keyboard.press('Escape');

  await composeActiveFigure('Connectors', .80);
  await page.keyboard.press('Escape');
  const draw = async (key, from, to) => {
    await page.keyboard.press(key);
    await settle();
    const board = await rect('.canvas-host rect.figure-bg.active');
    const point = ([x,y]) => ({x: board.x + x * board.w, y: board.y + y * board.h});
    await drag(point(from), point(to));
  };
  await draw('Alt+r', [.16,.28], [.39,.58]);
  await draw('Alt+r', [.62,.19], [.87,.49]);
  await draw('Shift+l', [.27,.43], [.74,.34]);
  await page.keyboard.press('v');
  const elements = page.locator('.canvas-host [data-editor-element-id^="rect_"]').filter({visible: true});
  await elements.nth(1).waitFor();
  const element = await elements.nth(1).boundingBox();
  const board = await rect('.canvas-host rect.figure-bg.active');
  assert(element.x >= board.x && element.x + element.width <= board.x + board.w, 'Connector shape must sit inside its figure');
  await drag({x: element.x + element.width / 2, y: element.y + element.height / 2},
             {x: element.x + element.width / 2, y: element.y + element.height / 2 + board.h * .24});
  await docStill('figure-sticky-connector');
  await page.keyboard.press('Escape');
}

async function drag(from, to) {
  await page.mouse.move(from.x, from.y);
  await sleep(180);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, {steps: 24});
  await sleep(320);
  await page.mouse.up();
  await sleep(650);
}

async function settingsAndPaper() {
  await page.locator('button[aria-label="Settings"]').click();
  const cursor = page.locator('.bk').getByRole('heading', {name: 'Cursor', exact: true});
  await cursor.evaluate(el => el.scrollIntoView({block: 'start'}));
  const panel = await rect('.bk > *');
  await docStill('settings-cursor', panel);
  await page.getByRole('button', {name: 'Done', exact: true}).click();

  await openManuscript();
  const content = page.locator('.cm-editor .cm-content').filter({visible: true}).first();
  await content.click({position: {x: 42, y: 42}});
  await page.keyboard.press('Alt+f');
  const figures = page.locator('.fv').filter({visible: true}).first();
  await figures.getByText('Fig. 2', {exact: true}).first().click();
  await figures.locator('[aria-label="Panels to reference"] button').nth(1).click();
  await page.waitForFunction(() => {
    const image = document.querySelector('.fv .stage img');
    return image?.complete && image.naturalWidth > 0;
  });
  const sidebar = await rect('.dm-wrap');
  await docStill('paper-figures-pane', sidebar);
  await spelling();
}

async function spelling() {
  await openManuscript();
  const content = page.locator('.cm-editor .cm-content').filter({visible: true}).first();
  await page.keyboard.press('Escape');
  await content.click({position: {x: 42, y: 42}});
  await page.keyboard.press('Control+End');
  for (let blank = 0; blank < 6; blank++) await page.keyboard.press('Enter');
  await page.keyboard.type('The responses were aproximatly stable across the recordings.', {delay: 55});
  const word = content.locator('.cm-spelling-issue').filter({hasText: 'aproximatly'}).last();
  await word.waitFor({timeout: 18000});
  await word.hover();
  const spelling = page.locator('.cm-spelling-menu').filter({visible: true});
  await spelling.waitFor();
  const card = await rect('.cm-spelling-menu'), issue = await word.boundingBox();
  const crop = union(card, {x: issue.x - 180, y: issue.y, w: 485, h: issue.height});
  await capture('paper-spelling', {
    keepPointer: true,
    category: 'feature-captures',
    box: {x: crop.x - 25, y: crop.y - 25, w: crop.w + 50, h: crop.h + 53},
  });
}

async function features() {
  await figureFeatures();
  await settingsAndPaper();
}

async function techniques() {
  await mode('Slide');
  await page.locator('span[title^="Double-click to rename"]').filter({hasText: 'The same journey, six different timings.'}).click();
  const timeline = page.locator('[aria-label="Animation timeline"]').filter({visible: true});
  if (!(await timeline.count())) await page.getByRole('button', {name: /^Animate/}).filter({visible: true}).click();
  await timeline.locator('button[data-step-index="1"]').click();
  const edit = page.getByRole('button', {name: /^Edit after step/}).filter({visible: true});
  if (await edit.getAttribute('aria-pressed') !== 'true') await edit.click();
  const lane = name => timeline.locator(`button.track-label[title^="${name} ·"]`);
  const animationStill = (name, box) => capture(name, {category: 'docs-screenshots', box});
  await lane('Smooth').click();
  await animationStill('slides-easing-workspace');
  await animationStill('slides-timeline', await rect('[aria-label="Animation timeline"]'));

  const props = page.locator('.props').filter({has: page.getByRole('button', {name: 'Easing curve', exact: true})}).filter({visible: true});
  const easing = props.getByRole('button', {name: 'Easing curve', exact: true});
  const field = await rect('.curve-field');
  await animationStill('animation-curve-field', {x: field.x - 7, y: field.y - 13, w: field.w + 14, h: field.h + 26});
  await easing.click();
  const editor = page.getByRole('dialog', {name: 'Easing curve editor', exact: true});
  await editor.locator('button[data-curve="bouncy"]').click();
  const spring = await rect('.curve-popover');
  await animationStill('animation-curve-spring', {x: spring.x - 7, y: spring.y - 7, w: spring.w + 14, h: spring.h + 14});
  await page.keyboard.press('Escape');

  const style = props.getByRole('button', {name: 'Animation style', exact: true});
  if (!(await style.innerText()).includes('Smooth change')) {
    await style.click();
    const existing = props.getByRole('button', {name: 'Smooth change', exact: true}).filter({visible: true});
    if (await existing.count()) {
      await existing.click();
    } else {
      await props.getByRole('button', {name: 'Save as new style…', exact: true}).click();
      await props.getByRole('textbox', {name: 'New animation style name'}).fill('Smooth change');
      await props.getByRole('button', {name: 'Save', exact: true}).click();
    }
  }
  await style.click();
  await props.getByRole('button', {name: 'Detach', exact: true}).waitFor();
  await animationStill('animation-style-picker');
  await style.click();

  const duration = props.locator('input[data-fld="d"]');
  await duration.fill('2200');
  await duration.press('Tab');
  const override = props.getByRole('button', {name: 'Use style duration', exact: true});
  await override.waitFor();
  const value = await duration.boundingBox(), reset = await override.boundingBox();
  const rail = await rect('.props');
  await animationStill('animation-style-override', {
    x: rail.x - 5, y: value.y - 36, w: rail.w + 10, h: reset.y + reset.height - value.y + 84,
  });
  await override.click();

  await lane('Bouncy').click();
  const anchor = props.getByRole('button', {name: 'Follow timing', exact: true});
  if (await anchor.count()) {
    if (await anchor.getAttribute('aria-expanded') !== 'true') await anchor.click();
    await props.locator('.anchor-choices > div').filter({hasText: 'Smooth'}).getByRole('button', {name: 'end', exact: true}).click();
  }
  await props.locator('.anchor-description').filter({hasText: /after Smooth.*end/}).waitFor();
  await animationStill('animation-follow-timing');
}

try {
  await groups[group]();
  if (errors.length) throw Error(errors.join('\n'));
  await fs.writeFile(path.join(folder, 'captures.json'), JSON.stringify({source, outputs, manifestFor}, null, 2) + '\n');
} catch (error) {
  await shot(path.join(folder, 'capture-error.png'));
  throw error;
} finally {
  await cdp.detach();
  await browser.close();
}
