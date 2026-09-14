import { spawnSync } from 'node:child_process';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, SOURCE, OUTPUT } from './paths.mjs';
import { quartoBinary } from './quarto.mjs';
import { checkSource, checkOutput } from './check.mjs';
import { bundleProject } from './bundle-project.mjs';

await bundleProject();
await checkSource();
const binary = quartoBinary();
await rm(OUTPUT, { recursive: true, force: true });
const rendered = spawnSync(binary, ['render', SOURCE], { cwd: ROOT, stdio: 'inherit' });
if (rendered.status !== 0) process.exit(rendered.status ?? 1);
// Quarto still writes a search index with search:false. The single-page site has no search UI.
await rm(path.join(OUTPUT, 'search.json'), { force:true });
await writeFile(path.join(OUTPUT, '.nojekyll'), '');
// Minimal HTML is intentional: only public routes belong in the search-engine sitemap.
await writeFile(path.join(OUTPUT, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://fluxsci.github.io/</loc></url></urlset>\n');
await checkOutput();
console.log(`Built and verified ${path.relative(ROOT, OUTPUT)}/`);
