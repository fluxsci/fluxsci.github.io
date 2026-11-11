/** Recompute a recorded take's camera keys from its take file, without re-recording.
 *
 *    node media/pitch/recamera.mjs <take dir>
 *
 *  The camera is a pure function of the boxes and moments the recording saved, so a framing
 *  change in takes/<name>.mjs only needs this and a recompose (make.mjs --reuse does both).
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as lib from './lib.mjs';
const dir=path.resolve(process.argv[2]),file=path.join(dir,'take.json');
const saved=JSON.parse(fs.readFileSync(file,'utf8'));
const take=(await import(path.join(path.dirname(fileURLToPath(import.meta.url)),'takes',saved.take+'.mjs'))).default;
const ASPECT=saved.aspect??4/3,SCALE=saved.window.scale;
const ctx={lib,boxes:saved.boxes,marks:saved.marks,log:saved,WIDTH:saved.window.width,HEIGHT:saved.window.height,SCALE,ASPECT,
  frame:(x0,x1,o={})=>lib.frame(x0,x1,{aspect:ASPECT,...o}),
  around:(box,o={})=>lib.around(box,{aspect:ASPECT,minWidth:Math.ceil(1920/SCALE),...o})};
saved.camera=take.camera(ctx).map(([t,f])=>({t:+t.toFixed(1),...f}));
fs.writeFileSync(file,JSON.stringify(saved,null,1));
console.log('camera:',saved.camera.length,'keys');
