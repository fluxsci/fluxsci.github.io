/** Run with the pinned Flux Electron binary, --flux-source PATH --project PATH.
 * Opens real project files through the real preload in a disposable profile.
 * No application sources or personal FluxConfig are read or changed. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {app,BrowserWindow}=require('electron');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1]};
const source=arg('--flux-source'),project=arg('--project');if(!source||!project)throw Error('Explicit --flux-source and --project paths required');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'flux-neural-native-')),artifacts=path.resolve(arg('--artifacts')||path.join(__dirname,'../.cache/neural-native'));fs.mkdirSync(artifacts,{recursive:true});
const sandboxHome=path.join(scratch,'profile');fs.mkdirSync(sandboxHome,{recursive:true});
os.homedir=()=>sandboxHome;
const configBase=process.platform==='darwin'?path.join(sandboxHome,'Library','Application Support','flux'):process.platform==='win32'?path.join(sandboxHome,'AppData','Roaming','flux'):path.join(sandboxHome,'.config','flux');
fs.mkdirSync(configBase,{recursive:true});const config=path.join(sandboxHome,'FluxConfig');fs.mkdirSync(path.join(config,'FluxLib'),{recursive:true});fs.mkdirSync(path.join(sandboxHome,'downloads'),{recursive:true});fs.writeFileSync(path.join(configBase,'preferences.json'),JSON.stringify({fluxConfigPath:config,captureDir:path.join(sandboxHome,'downloads')}));
process.env.FLUX_NO_MIGRATE='1';delete process.env.VITE_DEV_SERVER_URL;
// The application's normal argv route opens this folder, just as `flux open` does.
process.argv=[process.argv[0],process.argv[1],project];app.disableHardwareAcceleration();
require(path.join(source,'electron/main.cjs'));
const checks=[],errors=[];let win;const js=code=>win.webContents.executeJavaScript(code,true);const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,label,ms=30000){const start=Date.now();while(Date.now()-start<ms){try{if(await fn())return;}catch{}await pause(100)}throw Error(`Timeout: ${label}`)}
function check(ok,label){checks.push({ok:!!ok,label});if(!ok)throw Error(label)}
const clickMode=async name=>{await js(`document.querySelector('button[aria-label="${name}"]').click()`);};
(async()=>{try{
 await wait(async()=>{win=BrowserWindow.getAllWindows()[0];return!!win},'native window');win.setSize(1500,950);win.webContents.on('console-message',(_event,level,message)=>{if(level>=3)errors.push(message)});
 await wait(()=>js('!!document.querySelector(".cm-editor")'),'Paper with real project');
 check(app.getPath('userData').startsWith(sandboxHome+path.sep),'isolated native profile');check(await js('!window.__flux&&!!window.fig'),'built application with actual preload');
 check(await js(`document.body.innerText.includes('Neuronal networks flexibly encode diverse stimuli')`),'on-disk manuscript discovered');
 await wait(()=>js('document.querySelectorAll(".cm-editor svg").length>0'),'native embedded figure');
 fs.writeFileSync(path.join(artifacts,'paper.png'),(await win.webContents.capturePage()).toPNG());
 await clickMode('Figure');await wait(()=>js(`document.body.innerText.includes('From neurons to population codes')`),'native Figure composition');
 check(await js(`document.body.innerText.includes('Response structure and variation')`),'both compositions listed');
 fs.writeFileSync(path.join(artifacts,'figure.png'),(await win.webContents.capturePage()).toPNG());
 await clickMode('Slide');await wait(()=>js(`document.body.innerText.includes('From neurons to neural codes')`),'native deck');
 check(await js(`document.querySelectorAll('.filmstrip .thumb,.slide-thumb,.filmstrip button').length>0||document.body.innerText.includes('Many neurons')`),'editable slide filmstrip mounted');
 fs.writeFileSync(path.join(artifacts,'slides.png'),(await win.webContents.capturePage()).toPNG());
 check(!fs.readdirSync(path.join(project,'fig/canvases')).some(n=>n.includes('.corrupt-')),'no figure quarantine');
 check(!fs.readdirSync(path.join(project,'slides/neural-populations')).some(n=>n.includes('.corrupt-')),'no deck quarantine');
 const result={ok:true,checks,errors,project:path.basename(project),productRevision:require('node:child_process').execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim()};fs.writeFileSync(path.join(artifacts,'result.json'),JSON.stringify(result,null,2));console.log('NEURAL_NATIVE '+JSON.stringify(result));
}catch(error){if(win){fs.writeFileSync(path.join(artifacts,'failure.png'),(await win.webContents.capturePage()).toPNG());console.log('NEURAL_DOM '+await js('document.body.innerText.slice(0,9000)'))}console.log('NEURAL_NATIVE '+JSON.stringify({ok:false,checks,errors,error:String(error.stack||error)}));process.exitCode=1;}finally{app.exit(process.exitCode||0)}})();
