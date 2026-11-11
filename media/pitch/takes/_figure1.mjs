/** Shared by the takes filmed on Figure 1 ("Protein Structure", canvas_4 of the demonstration
 *  project): the panels' element ids, how each clip's result carries into the next clip, and the
 *  common opening (the whole figure, resting on the window's bottom edge).
 *
 *  The project holds the owner's "EndStateFig 1": Figure 1 as it should look after every clip.
 *  The clips run in a fixed order (c, d, e, f, b); a take that follows others starts from a
 *  scratch project in which the earlier panels already carry their end state, so the figure a
 *  reader sees improves from clip to clip and never snaps back.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as lib from '../lib.mjs';

export const CANVAS_FILE='fig/canvases/canvas_mw9xvia1yeq4_19.json';
export const FIGURE='fig_mw9xvia2yeq4_20',END_STATE='fig_mwbbj4skqum2_24';
/** Element ids in Figure 1 and their counterparts in EndStateFig 1. */
export const PANELS={
  a:{plot:'plot_mwayte0up9qz_145'},
  b:{ribbon:'model3d_mwazjhsup9qz_151',surface:'model3d_mwayxs86p9qz_150',end:{model3d_mwayxs86p9qz_150:'model3d_mwbbj4skqum2_9'},fields:['orbitAzimuth','orbitElevation','orbitRoll']},
  c:{plot:'plot_mwb01958p9qz_171',end:{plot_mwb01958p9qz_171:'plot_mwbbj4skqum2_12'},fields:['colorScale']},
  d:{plot:'plot_mwazmkzrp9qz_157',end:{plot_mwazmkzrp9qz_157:'plot_mwbbj4skqum2_11'},fields:['overrides']},
  e:{none:'plot_mwb06ncxp9qz_179',competitive:'plot_mwb06nd2p9qz_181',noncompetitive:'plot_mwb06nd7p9qz_183',uncompetitive:'plot_mwb06ndcp9qz_185',end:{plot_mwb06ncxp9qz_179:'plot_mwbbj4skqum2_16',plot_mwb06nd2p9qz_181:'plot_mwbbj4skqum2_17'},fields:['overrides']},
  f:{plot:'plot_mwb03mfpp9qz_173',end:{plot_mwb03mfpp9qz_173:'plot_mwbbj4skqum2_13'},fields:['view']},
};
export const sel=id=>lib.elementSelector(id);

/** In the scratch project, give the panels in `done` their end state (before the app opens). */
export function carryOver(projectDir,done=[]){
  const file=path.join(projectDir,CANVAS_FILE),canvas=JSON.parse(fs.readFileSync(file,'utf8'));
  const figure=canvas.figures.find(f=>f.id===FIGURE),end=canvas.figures.find(f=>f.id===END_STATE);
  for(const panel of done){
    const {end:pairs,fields}=PANELS[panel];
    for(const [from,to] of Object.entries(pairs)){
      const element=figure.elements.find(e=>e.id===from),target=end.elements.find(e=>e.id===to);
      for(const field of fields){if(target[field]===undefined)delete element[field];else element[field]=structuredClone(target[field]);}
    }
  }
  fs.writeFileSync(file,JSON.stringify(canvas,null,2));
}

/** Open canvas_4 with Figure 1 zoomed so it is about `figureWidth` px across (zoom moves in
 *  steps, so read the boxes back) and standing `bottomGap` px above the window's bottom edge,
 *  centred in the canvas or with its left edge at `left`. `rails: false` hides Flux's side
 *  rails first (Ctrl+B, Ctrl+Shift+B), so the canvas spans the window. Leaves in ctx.boxes:
 *  `figure` (the page), `canvas`, and `whole` (the opening frame: the figure with `margin` px of
 *  canvas either side). Call placeFigure1 again after moving the figure. */
export async function openFigure1(ctx,{figureWidth=1166,rails=true,left,bottomGap=135,margin=32}={}){
  await lib.openCanvas(ctx,'canvas_4');
  if(!rails){await ctx.page.keyboard.press('Control+b');await ctx.sleep(400);await ctx.page.keyboard.press('Control+Shift+B');await ctx.sleep(800);}
  const anchor=sel(PANELS.a.plot);
  const a0=await ctx.rect(anchor);
  await lib.zoomCanvas(ctx,anchor,a0.w*figureWidth/(await page0(ctx)).w);
  return placeFigure1(ctx,{left,bottomGap,margin});
}
/** Pan Figure 1 so its left edge is at `left` (default: centred) and its bottom `bottomGap` px
 *  above the window's bottom edge; refresh ctx.boxes.figure / canvas / whole. */
export async function placeFigure1(ctx,{left,bottomGap=135,margin=32}={}){
  const anchor=sel(PANELS.a.plot);
  let page=await page0(ctx);
  const host=await ctx.rect('.canvas-host');
  left??=host.x+(host.w-page.w)/2;
  const a=await ctx.rect(anchor);
  await lib.panCanvas(ctx,anchor,{x:a.x+(left-page.x),y:a.y+(ctx.HEIGHT-bottomGap-page.h-page.y)});
  page=await page0(ctx);
  ctx.boxes.figure=page;ctx.boxes.canvas=host;
  const w=page.w+2*margin,h=w/ctx.ASPECT;
  ctx.boxes.whole={x:page.x-margin,y:Math.max(host.y+2,Math.min(ctx.HEIGHT-2-h,page.y+page.h/2-h/2)),w,h};
  return page;
}
/** Figure 1's page box (it is the first figure of the canvas in document order). */
async function page0(ctx){const pages=await lib.figurePages(ctx);return pages[0];}
