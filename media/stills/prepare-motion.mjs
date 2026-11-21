import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {HOMEPAGE, MOTION} from '../film-slides.mjs';

export default {
  async prepare(project) {
    const projectPath = path.join(project, 'project.json');
    const manifest = JSON.parse(await fs.readFile(projectPath, 'utf8'));
    const entry = manifest.slides.find(({id}) => id === MOTION);
    assert(entry, 'The approved Plots in Motion deck is missing from the capture project');
    const deckPath = path.join(project, entry.path);
    const deck = JSON.parse(await fs.readFile(deckPath, 'utf8'));
    const allowed = new Set(HOMEPAGE.filter(({deck}) => deck === MOTION).map(({slide}) => slide));
    deck.slides = deck.slides.filter(({id}) => allowed.has(id));
    assert.equal(deck.slides.length, allowed.size);
    manifest.title = 'Plots in Motion';
    manifest.slides = [entry];
    manifest.supplementary = [];
    const figPath = path.join(project, 'fig/index.json');
    const figIndex = JSON.parse(await fs.readFile(figPath, 'utf8'));
    const canvas = {id: 'canvas-1', name: 'Figures'};
    await fs.mkdir(path.join(project, 'fig/canvases'), {recursive: true});
    await fs.writeFile(path.join(project, 'fig/canvases/canvas-1.json'), JSON.stringify({...canvas, schemaVersion: figIndex.schemaVersion, figures: []}, null, 2));
    await fs.writeFile(figPath, JSON.stringify({...figIndex, canvases: [canvas], figures: [], assets: []}, null, 2));
    await fs.writeFile(projectPath, JSON.stringify(manifest, null, 2));
    await fs.writeFile(deckPath, JSON.stringify(deck, null, 2));
  },
};
