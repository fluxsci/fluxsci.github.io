#!/usr/bin/env node
/** Verify project plot variants with Flux's actual native renderer and player.
 * No saved deck, figure, website file, or machine configuration is modified.
 * node scripts/verify-advanced-morph.mjs --flux-root /path/to/flux --pairs scripts/advanced-morph-pairs.json
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (name, fallback) => { const i = argv.indexOf(name); return i < 0 ? fallback : argv[i + 1]; };
const flux = arg('--flux-root');
if (!flux) throw new Error('Pass --flux-root explicitly; verification uses that checkout’s actual renderer.');
const fluxRoot = path.resolve(flux);
const pairsPath = path.resolve(project, arg('--pairs', 'scripts/advanced-morph-pairs.json'));
const out = path.resolve(arg('--out', path.join(project, '../../.cache/neural-advanced/morph')));
const requireFlux = createRequire(path.join(fluxRoot, 'package.json'));
const { build } = requireFlux('esbuild');
const puppeteer = requireFlux('puppeteer-core');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const assert = (value, message) => { if (!value) throw new Error(message); };
const definition = JSON.parse(await fs.readFile(pairsPath, 'utf8'));
const families = [];
for (const family of definition) {
  assert(family.name && family.states?.length >= 2, 'Each family needs a name and at least two state paths.');
  const states = [];
  for (const relative of family.states) {
    const svgPath = path.resolve(project, relative);
    assert(svgPath.startsWith(project + path.sep), 'Plot states must remain inside this project.');
    const svg = await fs.readFile(svgPath, 'utf8');
    const manifest = JSON.parse(await fs.readFile(svgPath.replace(/\.svg$/, '.fluxplot.json'), 'utf8'));
    assert(manifest.artifact?.svgSha256 === sha(svg), `${relative}: original SVG checksum mismatch.`);
    states.push({ relative, svg, manifest });
  }
  families.push({ ...family, states });
}
await fs.mkdir(out, { recursive: true });
const entry = `
import { createPlayer } from ${JSON.stringify(path.join(fluxRoot, 'src/lib/slide/player/player.ts'))};
import { createDeck, addSlide, addElement, addBeat, setTransform } from ${JSON.stringify(path.join(fluxRoot, 'src/lib/slide/ops.ts'))};
import { FLUX_LIGHT } from ${JSON.stringify(path.join(fluxRoot, 'src/lib/slide/theme.ts'))};
import { morphCompatible, morphSeriesPixels, seriesAxes } from ${JSON.stringify(path.join(fluxRoot, 'src/lib/slide/player/morph.ts'))};
import { plotContractErrors } from ${JSON.stringify(path.join(fluxRoot, 'src/lib/plot/contract.ts'))};
const families = ${JSON.stringify(families)};
let player, family, deck, roots, manifests, refs, currentIndex = 0;
const host = document.getElementById('stage');
const q = id => document.getElementById('advanced-morph__' + id);
function mount(index) {
  player?.destroy(); currentIndex = index; family = families[index];
  roots = new Map(family.states.map((s,i) => ['state-' + i, new DOMParser().parseFromString(s.svg, 'image/svg+xml').documentElement]));
  manifests = new Map(family.states.map((s,i) => ['state-' + i, s.manifest]));
  const vb = roots.get('state-0').viewBox.baseVal;
  const width = vb.width * 4 / 3, height = vb.height * 4 / 3;
  deck = createDeck({ id:'verification-only', title:family.name, withTitleSlide:false, stage:{width,height} });
  const slide = addSlide(deck, {name:family.name,layout:'blank'});
  addElement(deck, slide.id, {type:'plot',id:'advanced-morph',assetId:'state-0',x:0,y:0,width,height,rotation:0,opacity:1,overrides:{}});
  family.states.slice(1).forEach((s,i) => {
    const beat = addBeat(deck,slide.id,{label:s.relative});
    setTransform(deck,slide.id,beat.id,'advanced-morph',{toAssetId:'state-'+(i+1),duration:1200,easing:'linear'});
  });
  player = createPlayer(host,deck,{theme:FLUX_LIGHT, mode:'export', reducedMotion:false,manualSteps:true,plotRoot:id=>roots.get(id),plotManifest:id=>manifests.get(id)});
  player.goTo(0,0);
  const wrap = host.querySelector('[data-el-id="advanced-morph"]');
  refs = Array.from(wrap.querySelectorAll('[id]'));
  document.getElementById('label').textContent = family.name;
  document.getElementById('family').value = String(index);
  return {width,height,issues:player.state().issues,svgCount:wrap.querySelectorAll('svg').length};
}
function sample(beat,t) {
  player.seek(0,beat,t*1200);
  const wrap = host.querySelector('[data-el-id="advanced-morph"]');
  const svg = wrap.querySelector('svg');
  const A = family.states[Math.max(0,beat-1)].manifest, B = family.states[beat].manifest;
  const inv = svg.getScreenCTM().inverse();
  const pointErrors = [], lineErrors = [], geometry = [], expected = [];
  for (const a of A.series) {
    const b = B.series.find(s=>s.id===a.id);
    const pixels = morphSeriesPixels(a,b,seriesAxes(A,a),seriesAxes(B,b),t);
    expected.push(...pixels.map(p=>({series:a.id,...p})));
    if (a.svg.line) {
      const root = q(a.svg.line);
      const line = root?.tagName.toLowerCase()==='path' ? root : root?.querySelector('path');
      const d = line?.getAttribute('d') ?? '';
      const vertices = [...d.matchAll(/[ML]\\s*(-?[\\d.e+-]+)[, ]+(-?[\\d.e+-]+)/g)].map(m=>({x:Number(m[1]),y:Number(m[2])}));
      if (vertices.length !== pixels.length) lineErrors.push({series:a.id,expected:pixels.length,actual:vertices.length});
      else pixels.forEach((p,i)=>{const error=Math.hypot(p.x-vertices[i].x,p.y-vertices[i].y);if(error>.02)lineErrors.push({series:a.id,index:p.index,error});});
      geometry.push([a.id,'line',d]);
    }
    for (const p of a.points ?? []) {
      const node = q(p.svgId), target = pixels.find(v=>v.index===p.index);
      if (!node || !target) { pointErrors.push({id:p.svgId,missing:true});continue; }
      const bounds = node.getBoundingClientRect();
      if(bounds.width<.5 || bounds.height<.5)pointErrors.push({id:p.svgId,invisible:true,width:bounds.width,height:bounds.height});
      const href = node.getAttribute('href') ?? node.getAttribute('xlink:href');
      if(href?.startsWith('#')&&!document.getElementById(href.slice(1)))pointErrors.push({id:p.svgId,brokenReference:href});
      const observed = new DOMPoint(bounds.x+bounds.width/2,bounds.y+bounds.height/2).matrixTransform(inv);
      const error = Math.hypot(observed.x-target.x,observed.y-target.y);
      if(error>.08) pointErrors.push({id:p.svgId,error,observed:{x:observed.x,y:observed.y},target});
      geometry.push([a.id,p.index,Number(observed.x.toFixed(4)),Number(observed.y.toFixed(4))]);
    }
  }
  const partialLayers = Array.from(wrap.querySelectorAll('div')).filter(n=>{const opacity=Number(getComputedStyle(n).opacity);return opacity>0&&opacity<1;}).length;
  const brokenReferences = [];
  for (const node of svg.querySelectorAll('*')) for (const attribute of node.attributes) {
    const values = [...attribute.value.matchAll(/url\\(#([^)]*)\\)/g)].map(m=>m[1]);
    if(['href','xlink:href'].includes(attribute.name)&&attribute.value.startsWith('#'))values.push(attribute.value.slice(1));
    for (const id of values)if(!document.getElementById(id))brokenReferences.push(id);
  }
  return {beat,t,issues:player.state().issues,svgCount:wrap.querySelectorAll('svg').length,partialLayers,identityPreserved:refs.every(n=>n.isConnected),lineErrors,pointErrors,brokenReferences,geometry,expected};
}
const select = document.getElementById('family');
families.forEach((f,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=f.name;select.append(o);});
select.onchange=()=>mount(Number(select.value));
document.getElementById('play').onclick=()=>{player.goTo(0,0);player.play({slide:0,fromBeat:1,toBeat:family.states.length-1});};
document.getElementById('reset').onclick=()=>player.goTo(0,0);
window.morphQA={mount,sample,play:()=>player.play({slide:0,fromBeat:1,toBeat:family.states.length-1}),state:()=>player.state(),reset:()=>player.goTo(0,0),checks:families.map(f=>({name:f.name,states:f.states.map(s=>({relative:s.relative,errors:plotContractErrors(s.svg,s.manifest,true)})),pairs:f.states.slice(1).map((s,i)=>morphCompatible(f.states[i].manifest,s.manifest))}))};
mount(0);window.morphQA.ready=true;
`;
await build({ stdin: { contents: entry, resolveDir: fluxRoot, sourcefile: 'advanced-morph-verification.ts', loader: 'ts' }, outfile: path.join(out, 'native-player.js'), bundle: true, format: 'iife', platform: 'browser', target: 'chrome120', logLevel: 'warning' });
await fs.writeFile(path.join(out, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><title>Native Flux Data morph — verification</title><style>body{margin:24px;background:#f5f4f0;color:#20252a;font:14px system-ui}header{display:flex;gap:12px;align-items:center;margin-bottom:18px}h1{font-size:17px;margin:0 12px 0 0}select,button{font:inherit;padding:7px 10px}#stage{background:white;max-width:none;box-shadow:0 1px 8px #0001}</style></head><body><header><h1 id="label"></h1><select id="family" aria-label="Plot family"></select><button id="play">Play native morph</button><button id="reset">Reset</button></header><main id="stage"></main><script src="native-player.js"></script></body></html>`);
let browser;
const report = { fluxRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fluxRoot, encoding: 'utf8' }).trim(), families: [], errors: [], checks: 0 };
try {
  browser = await puppeteer.launch({ headless: true, executablePath: arg('--browser', process.env.FLUX_CHROME || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'), args: ['--allow-file-access-from-files'], defaultViewport: { width: 1800, height: 1200, deviceScaleFactor: 1 } });
  const page = await browser.newPage();
  page.on('pageerror', error=>report.errors.push(String(error)));
  await page.goto(pathToFileURL(path.join(out, 'index.html')).href);
  await page.waitForFunction(()=>window.morphQA?.ready);
  await page.evaluate(()=>document.fonts.ready);
  const checks = await page.evaluate(()=>window.morphQA.checks);
  for (const family of checks) {
    assert(family.states.every(s=>!s.errors.length), `${family.name}: invalid source contracts: ${JSON.stringify(family.states)}`);
    assert(family.pairs.every(Boolean), `${family.name}: incompatible semantic manifests.`);
  }
  for (let index=0;index<families.length;index++) {
    const info = await page.evaluate(i=>window.morphQA.mount(i),index);
    assert(!info.issues.length && info.svgCount===1, `${families[index].name}: native player compiled a fallback or issue: ${JSON.stringify(info)}`);
    const familyReport = { name:families[index].name, states:families[index].states.map(s=>({path:s.relative,sha256:sha(s.svg)})), pairs:[] };
    for (let beat=1;beat<families[index].states.length;beat++) {
      const samples=[];
      for (const t of [0,.25,.5,.75,1]) {
        const result=await page.evaluate(({beat,t})=>window.morphQA.sample(beat,t),{beat,t});
        assert(result.svgCount===1 && result.partialLayers===0, `${familyReport.name}, beat ${beat}, ${t}: crossfade fallback.`);
        assert(result.identityPreserved, `${familyReport.name}: native playback replaced semantic nodes.`);
        assert(!result.issues.length && !result.lineErrors.length && !result.pointErrors.length && !result.brokenReferences.length, `${familyReport.name}, beat ${beat}, ${t}: incorrect native data geometry ${JSON.stringify({issues:result.issues,lines:result.lineErrors.slice(0,2),points:result.pointErrors.slice(0,2),brokenReferences:result.brokenReferences.slice(0,2)})}`);
        samples.push(result);report.checks+=4;
        if(t===0||t===.5||t===1)await (await page.$('#stage')).screenshot({path:path.join(out,`${index+1}-${beat}-${Math.round(t*100)}.png`)});
      }
      const start=samples[0].expected,end=samples[4].expected;
      const movement=start.map((p,i)=>Math.hypot(p.x-end[i].x,p.y-end[i].y));
      assert(Math.max(...movement)>1,`${familyReport.name}: no meaningful movement between states.`);
      assert(JSON.stringify(samples[2].geometry)!==JSON.stringify(samples[0].geometry)&&JSON.stringify(samples[2].geometry)!==JSON.stringify(samples[4].geometry),`${familyReport.name}: midpoint equals an endpoint.`);
      await page.evaluate(({last})=>window.morphQA.sample(last,1),{last:families[index].states.length-1});
      const reverse=await page.evaluate(({beat})=>window.morphQA.sample(beat,.5),{beat});
      assert(JSON.stringify(reverse.geometry)===JSON.stringify(samples[2].geometry),`${familyReport.name}: reverse seek is history dependent.`);
      const fresh=await page.evaluate(({index,beat})=>{window.morphQA.mount(index);return window.morphQA.sample(beat,.5);},{index,beat});
      assert(JSON.stringify(fresh.geometry)===JSON.stringify(samples[2].geometry),`${familyReport.name}: fresh midpoint differs from chained playback.`);
      report.checks+=4;
      familyReport.pairs.push({from:families[index].states[beat-1].relative,to:families[index].states[beat].relative,observations:movement.length,movingObservations:movement.filter(n=>n>.1).length,maxDisplacementSvgUnits:Math.max(...movement),nativeOpaqueMidpoints:true,stableNodes:true,reverseSeekExact:true,freshMountExact:true});
    }
    await page.evaluate(()=>{window.morphQA.reset();window.morphQA.play();});
    await page.waitForFunction(()=>!window.morphQA.state().playing,{timeout:20000});
    const playback=await page.evaluate(()=>window.morphQA.state());
    assert(!playback.issues.length && playback.beat===families[index].states.length-1,`${familyReport.name}: real playback did not reach its final state: ${JSON.stringify(playback)}`);report.checks++;
    report.families.push(familyReport);
  }
  assert(!report.errors.length,`Browser errors: ${report.errors.join('; ')}`);
  report.browser=await browser.version();report.passed=true;
} finally {
  await browser?.close();
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({passed:report.passed,checks:report.checks,families:report.families.length,report:path.join(out,'report.json'),preview:path.join(out,'index.html')},null,2));
