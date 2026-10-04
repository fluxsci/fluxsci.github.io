import { spawnSync } from 'node:child_process';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, SOURCE, OUTPUT } from './paths.mjs';
import { quartoBinary } from './quarto.mjs';
import { checkSource, checkOutput } from './check.mjs';
import {writeDirectory,decorateDocuments} from './docs.mjs';
import {routes,ORIGIN} from './routes.mjs';

await writeDirectory();
await checkSource();
const binary = quartoBinary();
await rm(OUTPUT, { recursive: true, force: true });
const rendered = spawnSync(binary, ['render', SOURCE], { cwd: ROOT, stdio: 'inherit' });
if (rendered.status !== 0) process.exit(rendered.status ?? 1);
// The reviewed route directory supplies the custom search index and shared document frame.
await rm(path.join(OUTPUT, 'search.json'), { force:true });
await decorateDocuments();
await writeFile(path.join(OUTPUT, '.nojekyll'), '');
// Minimal HTML is intentional: only public routes belong in the search-engine sitemap.
await writeFile(path.join(OUTPUT,'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+routes.filter(r=>r.source!=='404.qmd').map(r=>`<url><loc>${ORIGIN}${r.url}</loc></url>`).join('')+'</urlset>\n');
await checkOutput();
console.log(`Built and verified ${path.relative(ROOT, OUTPUT)}/`);
