import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bib} from '../showcase.mjs';

const manuscript = fileURLToPath(new URL('../demo-manuscript.qmd', import.meta.url));

export async function seedShowcase(project) {
  await fs.copyFile(manuscript, path.join(project, 'paper/manuscript.qmd'));
  await fs.writeFile(path.join(project, 'references/library.bib'), bib);
}

export default {prepare: seedShowcase};
