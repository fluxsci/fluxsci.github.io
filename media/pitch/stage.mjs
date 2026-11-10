/** Stage for the pitch-article clips: the real Flux desktop app on a private X display.
 *
 *  Copies the demonstration project to a scratch folder (the original is never written),
 *  isolates HOME/XDG (the owner's FluxConfig is never read), starts Xvfb at the pixel size the
 *  window needs, and launches the production Electron build with a remote-debugging port so
 *  record.mjs can drive it (record.mjs also sizes the app window to fill the display). Stays up until killed; prints one JSON line when the app is ready.
 *
 *    node media/pitch/stage.mjs --flux-source <checkout> --project <FluxProj> [--width 1400 --height 900 --scale 3 --display 97 --port 9333]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const opt=(name,fallback)=>{const at=process.argv.indexOf('--'+name);return at<0?fallback:process.argv[at+1];};
const source=path.resolve(opt('flux-source','')),original=path.resolve(opt('project',''));
if(!fs.existsSync(path.join(source,'electron/main.cjs'))||!fs.existsSync(path.join(original,'project.json')))throw Error('Pass --flux-source <checkout> and --project <FluxProj>');
const width=+opt('width',1400),height=+opt('height',900),scale=+opt('scale',3),display=':'+opt('display','97'),port=+opt('port',9333);
const xvfb=process.env.FLUX_XVFB||'Xvfb';

const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'flux-pitch-stage-'));
const project=path.join(scratch,path.basename(original));
fs.cpSync(original,project,{recursive:true,filter:p=>!/[\\/]\.meta[\\/](locks|live|feedback)([\\/]|$)/.test(p)&&!/feedback\.ndjson$/.test(p)});
for(const d of ['home','xdg'])fs.mkdirSync(path.join(scratch,d));

const children=[];
const stop=()=>{for(const c of children)try{c.kill('SIGKILL');}catch{}};
process.on('SIGINT',()=>{stop();process.exit(0);});process.on('SIGTERM',()=>{stop();process.exit(0);});

const server=spawn(xvfb,[display,'-screen','0',`${width*scale}x${height*scale}x24`,'-nolisten','tcp','-s','0','-dpms'],{stdio:'ignore'});
children.push(server);
await new Promise(r=>setTimeout(r,1200));
if(server.exitCode!==null)throw Error(`Xvfb did not start on ${display}`);

const env={...process.env,DISPLAY:display,HOME:path.join(scratch,'home'),XDG_CONFIG_HOME:path.join(scratch,'xdg'),FLUX_NO_MIGRATE:'1',ELECTRON_DISABLE_SECURITY_WARNINGS:'1'};
for(const k of ['WAYLAND_DISPLAY','VITE_DEV_SERVER_URL','ELECTRON_RUN_AS_NODE'])delete env[k];
const electron=path.join(source,'node_modules/electron/dist/electron');
const app=spawn(electron,[source,project,'--no-sandbox','--ozone-platform=x11',`--force-device-scale-factor=${scale}`,`--remote-debugging-port=${port}`,`--window-size=${width},${height}`,...(opt('extra','')).split(' ').filter(Boolean)],{cwd:source,env,stdio:['ignore','inherit','inherit']});
children.push(app);
app.on('exit',code=>{console.log(JSON.stringify({exited:code}));stop();process.exit(code??1);});

let ready=false;
for(let i=0;i<200&&!ready;i++){
  try{ready=(await fetch(`http://127.0.0.1:${port}/json/version`)).ok;}catch{}
  if(!ready)await new Promise(r=>setTimeout(r,250));
}
if(!ready)throw Error('Flux did not start');
console.log(JSON.stringify({ready:true,port,display,scratch,project,width,height,scale}));
setInterval(()=>{},1<<30);
