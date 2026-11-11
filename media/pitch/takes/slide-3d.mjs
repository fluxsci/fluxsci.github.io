/** Slides 5: 3D that moves. A slide of the SARS-CoV-2 spike in the slide editor, its four steps
 *  listed in the Animator; Slide plays them: the model turns a full circle (Turntable), the
 *  receptor-binding domain swings up (a vertex morph between two cryo-EM structures, two shape
 *  frames of one mesh: plots/protein_structure/spike_opening, made by
 *  CORE/protein_structure/pure_scripts/spike_opening.py in the generator repo), and the model's
 *  camera flies in on that domain while the title and the state line rewrite themselves. Stop
 *  returns to the editor.
 *
 *  The deck is built in `prepare` with the Flux CLI on the scratch project (no overlay). WebGL
 *  flags, the scale-2 window and the renderer check follow model3d.mjs. The stage is set to 116 %
 *  rather than Fit (see setup): measured on the stage, that is what keeps the live model at 60 fps. */
import fs from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {clearDecks} from './_slides.mjs';

const CLI=path.join(os.homedir(),'flux/dist/flux-cli.mjs');
export const DECK='tour3d';
const MODEL='plots/protein_structure/spike_opening.glb';

function flux(root,...args){const r=spawnSync(process.execPath,[CLI,...args,'--root',root],{encoding:'utf8',cwd:root});if(r.status!==0)throw Error('flux '+args.join(' ')+': '+r.stderr+r.stdout);return (r.stdout+'\n'+r.stderr).trim();}
const lastId=(out,prefix)=>{const m=out.match(new RegExp(prefix+'_[a-z0-9_]+','g'));if(!m)throw Error('No '+prefix+' id in: '+out);return m[m.length-1];};
const deckFile=root=>path.join(root,'slides',DECK,'deck.json');

export const TEXT={
  title:'How the spike reaches\nfor its receptor',
  closed:'Closed: all three\nreceptor-binding domains\nlie folded down.',
  open:'Open: one domain swings\nup, exposing the surface\nthat binds ACE2.',
  rbd:'The receptor-binding\ndomain',
  rbdNote:'It grips ACE2 on our\ncells, and is a main target\nof neutralising antibodies.',
  source:'SARS-CoV-2 spike, cryo-EM structures. Closed:\nPDB 6VXX (Walls et al., 2020). One domain up:\nPDB 6VSB (Wrapp et al., 2020). The motion\ninterpolates between the two structures.',
};
// The whole opening follows one ease, gentle = bezier(a,0,1-a,1); it is played as two linear
// shape blends (closed → halfway → open, see spike_opening.py), each taking its half of the curve.
const A=0.42,r2=v=>+v.toFixed(3),FIRST=`bezier(${A},0,${r2((1+A)/2)},0.5)`,SECOND=`bezier(${r2((1-A)/2)},0.5,${r2(1-A)},1)`;

// The close-up: the raised RBD a little right of centre, seen 20° round and from slightly above
// (pan computed from the model's bounds so the domain's centroid lands at stage (425, 195)). The
// scale bar, which grows with the zoom, fades out on the way in.
// The model's box spans the slide's height and its right 450 units (not the whole slide): the live
// model's canvas is then 30 % smaller, which is what keeps playback at 60 fps on the stage.
const BOX={x:190,w:450};
const BAR={stroke:'#878580',fill:'#878580',dx:140,dy:-6};
const FLY={orbitAzimuth:5,orbitElevation:15,orbitZoom:2.8,orbitPanX:-0.318,orbitPanY:0.660,overrides:{scalebar:{...BAR,opacity:0}}};

export function buildDeck(root,o={}){
  flux(root,'new-deck','--id',DECK,'--title','Spike','--theme','flux-dark');
  const first=JSON.parse(fs.readFileSync(deckFile(root),'utf8')).slides[0].id;
  const slide=lastId(flux(root,'add-slide',DECK,'--name','The spike opens','--layout','blank'),'slide');
  flux(root,'delete-slide','--force',DECK,first);
  const model=lastId(flux(root,'add-slide-model',DECK,slide,MODEL,'--x',String(BOX.x),'--y','0','--width',String(BOX.w),'--height','360','--name','Spike trimer'),'model3d');
  flux(root,'set-model-view',model,'--deck',DECK,'--slide',slide,'--azimuth',String(o.az??345),'--elevation','8','--zoom',String(o.zoom??0.92),'--pan-x',String(o.panX??-0.3),'--pan-y','0');
  // The scale bar is drawn in the scene's ink (near black); on the dark slide it takes the body grey.
  const deck=JSON.parse(fs.readFileSync(deckFile(root),'utf8')),el=deck.slides[0].elements.find(e=>e.id===model);
  el.overrides={...(el.overrides??{}),scalebar:{...BAR}};
  fs.writeFileSync(deckFile(root),JSON.stringify(deck,null,2));
  flux(root,'validate-deck',DECK);
  const t=(text,x,y,w,size,extra=[])=>lastId(flux(root,'add-text',DECK,slide,text,'--x',String(x),'--y',String(y),'--width',String(w),'--size-pt',String(size),'--sizing','auto-h',...extra),'text');
  const title=t(TEXT.title,40,44,330,22,['--weight','700','--color','#fffcf0']);
  const state=t(TEXT.closed,40,150,240,13,['--color','#cecdc3']);
  const source=t(TEXT.source,40,290,250,7.5,['--color','#878580']);
  const beat=label=>lastId(flux(root,'add-beat',DECK,slide,'--label',label),'beat');
  const turn=beat('Turn'),open1=beat('Open'),open2=beat('Open, continued'),fly=beat('Fly in');
  flux(root,'set-beat',DECK,slide,open2,'--advance','auto','--auto-delay','0');
  flux(root,'add-turntable',DECK,slide,turn,model,'--turns','1','--duration',String(o.turnMs??6000));
  const half=o.openMs??1250;
  flux(root,'set-transform',DECK,slide,open1,model,'--state',JSON.stringify({modelStates:{'frame-1':1}}),'--start','200','--duration',String(half),'--curve',FIRST);
  flux(root,'set-transform',DECK,slide,open2,model,'--state',JSON.stringify({modelStates:{'frame-1':0,'frame-2':1}}),'--duration',String(half),'--curve',SECOND);
  flux(root,'set-transform',DECK,slide,open2,state,'--state',JSON.stringify({text:TEXT.open,color:'#ec8b49'}),'--start','200','--duration','450','--easing','smooth');
  // The close-up retitles the slide in place: the title and the state line rewrite themselves as
  // the camera arrives (no extra objects, so Design shows exactly the slide as it opens).
  flux(root,'set-animation',DECK,slide,fly,source,'--append','--preset','fadeOut','--start','600','--duration','450');
  flux(root,'set-transform',DECK,slide,fly,model,'--state',JSON.stringify(o.flyState??FLY),'--start','600','--duration',String(o.flyMs??2600),'--easing','smooth');
  flux(root,'set-transform',DECK,slide,fly,title,'--state',JSON.stringify({text:TEXT.rbd,color:'#ec8b49'}),'--start','1900','--duration','450','--easing','smooth');
  flux(root,'set-transform',DECK,slide,fly,state,'--state',JSON.stringify({text:TEXT.rbdNote,color:'#cecdc3'}),'--start','2150','--duration','450','--easing','smooth');
  // Animator lanes show names, not "text 2"
  const named=JSON.parse(fs.readFileSync(deckFile(root),'utf8'));
  for(const [id,name] of [[title,'Title'],[state,'State line'],[source,'Sources']])named.slides[0].elements.find(e=>e.id===id).name=name;
  fs.writeFileSync(deckFile(root),JSON.stringify(named,null,2));
  flux(root,'validate-deck',DECK);
  return {slide,model,title,state,source,beats:{turn,open1,open2,fly}};
}

// Where the stage's corner sits (116 %, 744 × 418 px): centred in the canvas column.
const STAGE_AT={x:310,y:270};
/** The grab: the window below the title bar (the clock square sits in the title bar above it). */
const coverOf=(b,ctx)=>{const y=Math.ceil(b.titlebar.y+b.titlebar.h)+1;return {x:0,y,w:ctx.WIDTH,h:ctx.HEIGHT-y};};
const busy=()=>{try{return /compose\.py|master\.mkv/.test(execFileSync('ps',['-eo','args'],{encoding:'utf8'}));}catch{return false;}};
/** Centre of the Animator's toolbar button whose text is exactly `label`. */
const button=(page,label)=>page.evaluate(label=>{const b=[...document.querySelectorAll('.animator button')].find(b=>b.textContent.trim()===label);if(!b)return null;const q=b.getBoundingClientRect();return {x:q.x+q.width/2,y:q.y+q.height/2,box:{x:q.x,y:q.y,w:q.width,h:q.height}};},label);
/** The stage's status line: "Design · initial object properties" while editing, "Inspecting step
 *  4 · 3.20s" while a preview plays or holds its last frame. A cheap read (textContent forces no
 *  layout), so polling it during the grab costs the live model no frames. */
const status=page=>page.evaluate(()=>document.querySelector('.edit-label')?.textContent??'');
const EDITING=/^Design/,LANDED=/Inspecting step 4 · 3\.20s/;
// Turn 6 s; open 0.2 + 2 × 1.25 s; fly in 0.6 + 2.6 s.
const PLAY_MS=6000+200+2500+3200;

export default {
  // Live 3D: WebGL on the GPU (see model3d.mjs), and scale 2 so the model is never enlarged.
  // 38 px taller than 4:3: the title bar (38 px) stays out of every frame, and the wide frame below
  // it is the whole width of the window, so nothing is cut at its sides.
  window:{width:1440,height:1118,scale:2},
  electronArgs:['--ignore-gpu-blocklist','--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE','--disable-gpu-compositing'],
  // Only this deck in the scratch copy: the deck list shows it alone, not the owner's test decks.
  prepare(project){clearDecks(project);buildDeck(project);},
  async setup(ctx){
    const {page,need,sleep,rect,boxes}=ctx;
    const renderer=await page.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2');const info=gl?.getExtension('WEBGL_debug_renderer_info');return gl?String(gl.getParameter(info?info.UNMASKED_RENDERER_WEBGL:gl.RENDERER)):null;});
    if(!renderer||/swiftshader|llvmpipe/i.test(renderer))throw Error('The stage has no hardware WebGL2 ('+renderer+'); the model would not play smoothly');
    await need('shell',()=>page.evaluate(()=>!!document.querySelector('button[aria-label=Slide]')),30000);
    await need('slide mode',async()=>{if(await page.getByText('Spike',{exact:true}).count())return true;await page.evaluate(()=>document.querySelector('button[aria-label=Slide]').click());await sleep(1500);return false;},45000);
    await sleep(1000);
    await page.getByText('Spike',{exact:true}).click();
    await need('the spike slide',()=>page.evaluate(()=>/How the spike reaches/.test(document.querySelector('.canvas-host')?.textContent??'')),20000);
    await page.getByText('Animate ⏱',{exact:true}).click();
    const slideButton=await need('Animator',()=>button(page,'Slide'),10000);
    await sleep(1500);
    // Stage at 116 % (100 %, then one zoom notch), centred above the Animator. Measured on this
    // stage: at Fit (141 %, 906 px) the software-composited stage reaches the screen at ~30 fps
    // while the model plays; at 116 % (744 px) at 60 fps. So the stage is smaller, not the frame.
    const SEL='.canvas-host rect.figure-bg';
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='100%'&&b.getBoundingClientRect().y<200).click());await sleep(800);
    let q=await rect(SEL);await page.mouse.move(q.x+q.w/2,q.y+q.h/2);
    await page.keyboard.down('Control');await page.mouse.wheel(0,-100);await page.keyboard.up('Control');await sleep(1200);
    q=await rect(SEL);const host=await rect('.canvas-host');
    await ctx.lib.panCanvas({page,rect},SEL,{x:STAGE_AT.x,y:STAGE_AT.y});await sleep(1000);
    q=await rect(SEL);if(Math.abs(q.w-744)>6)throw Error('Stage not at 116 %: '+q.w);
    // Warm-up: play the whole slide once off camera (GLB decode, shaders, every shape frame),
    // then Stop. Stop leaves the Animator on the last step, exactly as the take will end.
    await page.mouse.click(slideButton.x,slideButton.y);
    await need('warm-up playback reaches the close-up',async()=>LANDED.test(await status(page)),30000);
    await sleep(2500);
    const stop=await button(page,'■ Stop');
    await page.mouse.click(stop.x,stop.y);
    await need('back to Design after the warm-up',async()=>EDITING.test(await status(page))&&!(await rect('.preview-host')),10000);
    await sleep(1500);
    boxes.stage=(await ctx.lib.figurePages(ctx))[0];
    boxes.slide=(await button(page,'Slide')).box;boxes.stop=(await button(page,'■ Stop')).box;
    boxes.steps=await rect('.step-strip');boxes.newStep=await rect('.new-step');
    if(!boxes.stage||!boxes.steps||!boxes.newStep)throw Error('Stage or step strip not found');
    boxes.host=await rect('.canvas-host');
    boxes.titlebar=await page.evaluate(()=>{const n=document.querySelector('button[aria-label=Slide]')?.closest('header,[class*=titlebar],[class*=topbar]');const q=n?.getBoundingClientRect();return q?{x:q.x,y:q.y,w:q.width,h:q.height}:null;});
    if(!boxes.titlebar||boxes.titlebar.h>60)throw Error('Title bar not found: '+JSON.stringify(boxes.titlebar));
    // Rest on the empty end of the step strip: from there the pointer reaches Slide and Stop
    // without crossing a lane (hovering a lane outlines its object on the stage).
    await ctx.place({x:Math.round(boxes.newStep.x+boxes.newStep.w+150),y:Math.round(boxes.steps.y+boxes.steps.h/2)});
    await sleep(2500);
    for(let waited=0;busy();waited+=2000){if(waited>900000)throw Error('The machine stayed busy encoding other clips');await sleep(2000);}
    return {cover:coverOf(boxes,ctx)};
  },

  async run(ctx){
    const {boxes,need,sleep,glide,click,mark,page}=ctx,rest=ctx.at,c=b=>({x:b.x+b.w/2,y:b.y+b.h/2});
    mark('start');
    await sleep(1300);
    await glide(c(boxes.slide),{bow:0.14});
    await sleep(220);await click();mark('play');
    // Back off the button to the resting place while the slide plays.
    await sleep(450);
    await glide(rest,{bow:0.1});
    await sleep(PLAY_MS-400);
    await need('the slide played to its end',async()=>LANDED.test(await status(page)),3000);mark('closeUp');
    await sleep(1800);
    await glide(c(boxes.stop),{bow:-0.12});
    await sleep(220);await click();mark('stopped');
    await need('back to Design',async()=>EDITING.test(await status(page))&&!(await ctx.rect('.preview-host')),5000);
    await sleep(900);
    await glide(rest,{bow:0.12});mark('rested');
    await sleep(2100);
    mark('end');
  },

  /** The whole editor; in on the stage and its steps while the slide plays; back out. */
  camera(ctx){
    const {boxes:b,marks:m,frame}=ctx;
    const cover=coverOf(b,ctx);
    // Everything below the app's title bar, from the left rail rightwards.
    const wide=frame(0,cover.h*ctx.ASPECT,{top:cover.y,within:cover});
    // The stage with the Animator under it, edge to edge across the editor's middle column.
    const play=frame(b.host.x+2,b.host.x+1016,{top:b.stage.y-34,within:cover});
    return [
      [m.start,wide],[m.start+700,wide],[m.play-150,play],
      [m.stopped+700,play],[m.rested+1350,wide],[m.end,wide],
    ];
  },
};
