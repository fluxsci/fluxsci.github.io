/** Save what a staged session changed in its scratch project as a materials overlay.
 *
 *    node media/pitch/save-overlay.mjs <scratch project> <original project> <name>
 *
 *  Every file that is new or different in the scratch project (ignoring .meta's locks, live
 *  state, journals and notes, and fig/renders) is copied to media/pitch/materials/<name>/, laid
 *  out like the project. A take's `prepare` applies it with lib.applyOverlay(projectDir, name).
 *  Use this when a clip's starting material (a deck, a manuscript) is easier to make by hand in
 *  the staged app than to script; keep overlays small and say in the take what they hold.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const [scratch,original,name]=process.argv.slice(2);
if(!scratch||!original||!name)throw Error('usage: save-overlay.mjs <scratch project> <original project> <name>');
const out=path.join(path.dirname(fileURLToPath(import.meta.url)),'materials',name);
const skip=rel=>/^\.meta\/(locks|live|feedback|journal|sessions)/.test(rel)||/^\.meta\/[^/]*\.(ndjson|lock)$/.test(rel)||/^fig\/renders\//.test(rel)||/\.bak$/.test(rel)||/^exports\//.test(rel);
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
let count=0,bytes=0;
(function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name),rel=path.relative(scratch,file);
    if(entry.isDirectory()){walk(file);continue;}
    if(!entry.isFile()||skip(rel))continue;
    const base=path.join(original,rel);
    if(fs.existsSync(base)&&fs.statSync(base).size===fs.statSync(file).size&&hash(base)===hash(file))continue;
    fs.mkdirSync(path.dirname(path.join(out,rel)),{recursive:true});
    fs.copyFileSync(file,path.join(out,rel));count++;bytes+=fs.statSync(file).size;
  }
})(scratch);
console.log(`overlay ${name}: ${count} files, ${(bytes/1e6).toFixed(2)} MB → ${out}`);
