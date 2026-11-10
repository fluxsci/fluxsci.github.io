/** Make one pitch-article clip end to end and install it in the site.
 *
 *    node media/pitch/make.mjs --flux-source <checkout> --project <FluxProj> --take colormap [--keep <dir>]
 *    node media/pitch/make.mjs … --reuse <dir>     (recompose an existing take: new framing, same recording)
 *
 *  record.mjs drives the real app and grabs the screen; cursors.mjs renders the app's own cursor
 *  images; compose.py frames the capture and draws that pointer; the clip (1920x1440, with a 1280x960 copy for phones) and its poster land in site/assets/media/pitch/ and media/pitch.json
 *  records what they were made from (Flux revision, take, bytes and SHA-256), which the build
 *  verifies. The working files (a lossless capture and master, about 300 MB) go to a temporary folder
 *  unless --keep names one.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(path.dirname(here));
const opt=(name,fallback)=>{const at=process.argv.indexOf('--'+name);return at<0?fallback:process.argv[at+1];};
const source=opt('flux-source'),project=opt('project'),take=opt('take','colormap');
if(!source||!project)throw Error('Pass --flux-source and --project');
const reuse=opt('reuse');
const work=reuse?path.resolve(reuse):opt('keep')?path.resolve(opt('keep')):fs.mkdtempSync(path.join(os.tmpdir(),'flux-pitch-take-'));
const run=(command,args)=>execFileSync(command,args,{cwd:root,stdio:'inherit'});
if(!reuse)run(process.execPath,[path.join(here,'record.mjs'),'--flux-source',source,'--project',project,'--take',take,'--out',work]);
run(process.execPath,[path.join(here,'cursors.mjs'),work,'--flux-source',source]);
const dir='site/assets/media/pitch';fs.mkdirSync(path.join(root,dir),{recursive:true});
const clip=`${dir}/${take}.mp4`,small=`${dir}/${take}-1280.mp4`,poster=`${dir}/${take}.webp`;
run('python3',[path.join(here,'compose.py'),work,'--out',path.join(root,clip),'--small',path.join(root,small),'--poster',path.join(root,poster),'--sheet',path.join(work,'sheet.png'),'--frames',path.join(work,'frames')]);
const recorded=JSON.parse(fs.readFileSync(path.join(work,'take.json'),'utf8'));
const manifestFile=path.join(root,'media/pitch.json');
const manifest=fs.existsSync(manifestFile)?JSON.parse(fs.readFileSync(manifestFile,'utf8')):{$doc:'Clips for the pitch article, made by media/pitch/make.mjs from the real Flux app. Each take records the Flux revision it was filmed in; outputs are verified by the site build.',takes:{},outputs:{}};
manifest.takes[take]={recorded:recorded.recorded,flux:recorded.flux,window:recorded.window,project:path.basename(path.resolve(project)),seconds:+((recorded.marks.end-recorded.marks.start)/1000).toFixed(2)};
for(const file of [clip,small,poster]){const bytes=fs.readFileSync(path.join(root,file));manifest.outputs[file]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
console.log('installed',clip,small,'and',poster,'| working files in',work);
