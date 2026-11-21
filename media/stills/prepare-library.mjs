import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {seedShowcase} from './prepare-showcase.mjs';

export default {
  async prepare(project) {
    await seedShowcase(project);
    // The demonstration library contains the selected public references and CC BY PDFs.
    const library = fileURLToPath(new URL('../pitch/materials/tour-library/FluxConfig', import.meta.url));
    const home = path.join(path.dirname(project), 'home', 'FluxConfig');
    await fs.cp(library, home, {recursive: true});
    const records = path.join(home, 'FluxLib/.fluxlib');
    await fs.mkdir(records, {recursive: true});
    const key = 'jumperHighlyAccurateProtein2021';
    const tags = ['structure prediction', 'protein folding'];
    await fs.writeFile(path.join(records, 'enrich.json'), JSON.stringify({
      [key]: {
        key,
        abstract: 'Jumper and colleagues introduced AlphaFold and tested its protein structure predictions against experimental structures in CASP14. The paper describes the network design and the use of physical and biological constraints.',
        keywords: tags,
        sources: ['https://doi.org/10.1038/s41586-021-03819-2'],
        fetchedAt: '2026-11-11T00:00:00.000Z',
      },
    }));
    await fs.writeFile(path.join(records, 'organize.json'), JSON.stringify({
      version: 1,
      items: {[key]: {tags, collections: ['Structural biology'], status: 'read'}},
    }));
  },
};
