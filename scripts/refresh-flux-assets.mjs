/** Prepare the isolated screenshot project and render its figures through the pinned Flux runtime.
 *  Source is read-only. The live slides come from the launch film (refresh-slides.mjs). */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const site=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg=name=>{const at=process.argv.indexOf(name);return at<0?null:process.argv[at+1];};
if(!arg('--flux-source')||!arg('--project'))throw Error('Pass --flux-source /path/to/pinned/flux and --project /path/to/authored/project.');
const source=path.resolve(arg('--flux-source')),authored=path.resolve(arg('--project')),project=path.join(site,'.cache','visual-project');
const DECK_ID='website-showcase';
const pin=JSON.parse(await fs.readFile(path.join(site,'flux-source.json'),'utf8'));
if(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==pin.revision)throw Error('Flux checkout does not match flux-source.json');
if(execFileSync('git',['-C',source,'diff','--name-only','HEAD','--','src','flux-core','scripts','brand','electron','package.json','package-lock.json'],{encoding:'utf8'}).trim())throw Error('Product source must be clean before export');
if(!process.env.FLUX_ASSET_CHILD){
 execFileSync(process.execPath,['scripts/gen-slide-embed-assets.mjs'],{cwd:source,stdio:'inherit'});
 execFileSync(process.execPath,['scripts/gen-model3d-viewer.mjs'],{cwd:source,stdio:'inherit'});
 execFileSync(process.execPath,['--import',path.join(source,'node_modules/tsx/dist/loader.mjs'),fileURLToPath(import.meta.url),...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,FLUX_ASSET_CHILD:'1'}});process.exit(0);
}
const load=rel=>import(pathToFileURL(path.join(source,rel)).href);
const [{validateDeckFile,validateProjectManifest},{ensureDom,renderFigureSvg}]=await Promise.all([load('src/lib/project/validate.ts'),load('flux-core/render.ts')]);
const exists=p=>fs.access(p).then(()=>true,()=>false);
const write=async(rel,value)=>{const out=path.join(project,rel);await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,value);};
const validate=(label,errors)=>{if(errors.length)throw Error(`${label}: ${errors.join('; ')}`);};
const {prepareShowcase}=await import('../media/showcase.mjs');
const {inputs:plotInputHashes}=await prepareShowcase(source,authored,project);
const manifest=JSON.parse(await fs.readFile(path.join(project,'project.json'),'utf8'));validate('Project manifest',validateProjectManifest(manifest));
const figureIndex=JSON.parse(await fs.readFile(path.join(project,'fig/index.json'),'utf8'));
manifest.figures=figureIndex.figures;
const deckEntry=manifest.slides.find(d=>d.id===DECK_ID);if(!deckEntry)throw Error(`Project must contain the ${DECK_ID} deck.`);
const deck=JSON.parse(await fs.readFile(path.join(project,deckEntry.path),'utf8'));validate('Deck',validateDeckFile(deck));
await ensureDom();
for(const fig of manifest.figures??[]){const warnings=[];await renderFigureSvg(project,fig.id,{model3dPolicy:'project',warnings});const svg=await renderFigureSvg(project,fig.id,{model3dPolicy:'project',posterSurface:{kind:'raster',dpi:240},warnings});if(warnings.length)throw Error(warnings.join('\n'));await write(`fig/renders/${fig.id}.svg`,svg);}
for(const [src,dst]of[['brand/flux-mark-phyllotaxis.svg','site/assets/brand/flux-mark.svg'],['src/styles/fonts/Gelasio.woff2','site/assets/fonts/Gelasio.woff2'],['src/styles/fonts/Gelasio-italic.woff2','site/assets/fonts/Gelasio-italic.woff2']])await fs.copyFile(path.join(source,src),path.join(site,dst));
await fs.copyFile(path.join(source,'LICENSE'),path.join(site,'site/assets/licenses/Flux-MIT.txt'));
const files=['site/assets/brand/flux-mark.svg','site/assets/fonts/Gelasio.woff2','site/assets/fonts/Gelasio-italic.woff2','site/assets/licenses/Flux-MIT.txt'];
const outputs=Object.fromEntries(await Promise.all(files.map(async rel=>{const data=await fs.readFile(path.join(site,rel));return[rel,{bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}];})));
const projectInputs=['project.json',deckEntry.path,'fig/index.json',...(await fs.readdir(path.join(project,'fig/canvases'))).filter(f=>f.endsWith('.json')).map(f=>`fig/canvases/${f}`)];
const inputHashes=Object.fromEntries(await Promise.all(projectInputs.map(async rel=>[rel,createHash('sha256').update(await fs.readFile(path.join(project,rel))).digest('hex')])));
await fs.writeFile(path.join(site,'media/native-assets.json'),JSON.stringify({source:{repository:pin.repository,revision:pin.revision,version:pin.version},description:'Two unchanged authored figures from the confirmed master project, rendered for the website screenshots, plus the Flux mark, fonts and license. Public experimental data, computed examples and reference structures; see visual credits. The live slides are recorded in media/slides.json.',project:{id:manifest.id,title:manifest.title,inputHashes,plotInputHashes},outputs},null,2)+'\n');
console.log(`Prepared the screenshot project with ${manifest.figures.length} figure renders; authored project files preserved.`);
