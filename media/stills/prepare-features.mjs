import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {seedShowcase} from './prepare-showcase.mjs';

const cache = fileURLToPath(new URL('../../.cache/', import.meta.url));

export default {
  async prepare(project, {source}) {
    await seedShowcase(project);
    const home = path.join(path.dirname(project), 'home');
    const cli = (...args) => execFileSync(process.execPath, [path.join(source, 'dist/flux-cli.mjs'), ...args, '--root', project],
      {cwd: project, env: {...process.env, HOME: home, XDG_CONFIG_HOME: home}, encoding: 'utf8'});
    await fs.mkdir(path.join(project, 'plots/analysis'), {recursive: true});
    for (const name of ['growth.svg', 'growth.fluxplot.json', 'growth.recipe.json']) {
      await fs.copyFile(path.join(cache, 'review/docs-plots', name), path.join(project, 'plots/analysis', name));
    }
    await fs.cp(path.join(cache, 'review/dissections'), path.join(project, 'plots/_dissections/showcase'), {recursive: true});
    for (const [id, nickname] of [['growth', 'Growth'], ['align', 'Alignment'], ['connect', 'Connectors']]) {
      cli('create-figure', '--id', id, '--nickname', nickname, '--width', '680', '--height', '445');
    }
    cli('import-plots', 'growth', 'plots/analysis/growth.svg');
    for (const [name, x, y] of [['rose', '36', '80'], ['section-a', '245', '55'], ['section-gamma', '462', '109']]) {
      cli('add-panel', 'align', 'plots/showcase/' + name + '.svg', '--x', x, '--y', y, '--width', '183', '--height', '161');
    }
    const manifestPath = path.join(project, 'project.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    const deckPath = 'slides/docs-techniques/deck.json';
    const deck = JSON.parse(await fs.readFile(path.join(cache, 'docs-techniques/deck.json'), 'utf8'));
    await fs.mkdir(path.join(project, path.dirname(deckPath)), {recursive: true});
    await fs.writeFile(path.join(project, deckPath), JSON.stringify(deck));
    manifest.slides = [{id: deck.id, title: deck.title, path: deckPath, order: 1}];
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  },
};
