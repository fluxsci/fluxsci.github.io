/** Clip (AI 2): in Slides, ask for the animation you can picture.
 *
 *  The talk's "Deuterium uptake" slide (panel d's plot, hdx_uptake_ramp, from _slides.mjs), the
 *  Animator open with no steps yet. Annotate (Ctrl+Shift+M), an arrow to the curves, and the
 *  request, sent to "heron" (the connected Claude Code session, agent.mjs). The agent claims it,
 *  adds a step, and the Animator fills with the clips it writes, one curve after another; it
 *  replies and resolves; the user plays the step and the curves draw, fastest exchange first,
 *  then the labels arrive. The reply is read in the Inbox at the end.
 *
 *  The agent's work is Claude's own, done on an explore stage for this request and replayed:
 *  it read the plot's data (get_plot_data: six fitted series peptide-1…6, half-uptake times from
 *  about 0.1 min to over 100 min, so peptide-1 is the fastest), added a click step, and wrote one
 *  clip per fitted curve in that order with set_animation: the app's own Draw along x for a bare
 *  line (drawOn, x clock, lead dot, 0.8 s), each 0.65 s after the last, then the two labels'
 *  default Rise in once the last curve is down. The data points stay on the slide throughout (a
 *  first version also staggered each peptide's points and error bars in: 20 lanes, too many to
 *  read in the Animator; kept simple). Each verb is one write of the deck, which the open editor
 *  reloads live.
 */
import fs from 'node:fs';
import path from 'node:path';
import {buildTalk,flux,DECK_TITLE} from './_slides.mjs';
import {button} from './slide-become.mjs';

/** The slide's page on the stage (the deck is 16:9). */
const slideBox=page=>page.evaluate(()=>{const n=[...document.querySelectorAll('svg.scene-svg rect')].find(n=>{const r=n.getBoundingClientRect();return r.width>300&&Math.abs(r.width/r.height-16/9)<0.01;});if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
import {connectAgent,rememberRecipient,pointOnPart,toastTexts,SURFACE,COMPOSER,INBOX} from './_ai.mjs';

const REQUEST='Draw these curves one at a time, fastest exchange first, then bring in the labels';
// Two short paragraphs: each line fits the 480 px frame the reply is read in.
const REPLY='Done: step 1 draws the six fits, fastest exchange first.\n\nThen both labels rise in. Press Step to play it.';
const STEP='Curves, fastest first';
const GAP=650,DUR=800,EASE={kind:'bezier',p:[0.45,0.12,0.5,1]};

/** The screen point at `at` (0..1 of its length) along a plot part on the slide stage. */
const pointOn=(page,elementId,partId,at)=>page.evaluate(([e,p,at])=>{
  const g=document.querySelector(`svg.scene-svg [id="${e}__${p}"]`),n=g?.tagName==='path'?g:g?.querySelector('path');
  if(!n)return null;const q=n.getPointAtLength(n.getTotalLength()*at),m=n.getScreenCTM();
  return {x:q.x*m.a+q.y*m.c+m.e,y:q.x*m.b+q.y*m.d+m.f};},[elementId,partId,at]);
/** The deck's step 1, as the file says (the clips the agent wrote). */
const stepTracks=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8')).slides.find(s=>s.name==='Deuterium uptake').beats[1]?.tracks??[];}catch{return [];}};

/** The deck, slide and plot ids in the stage's scratch project (what list_decks reports). */
function talk(project){
  for(const d of fs.readdirSync(path.join(project,'slides'))){
    const f=path.join(project,'slides',d,'deck.json');
    let deck;try{deck=JSON.parse(fs.readFileSync(f,'utf8'));}catch{continue;}
    if(deck.title!==DECK_TITLE)continue;
    const slide=deck.slides.find(s=>s.name==='Deuterium uptake');
    return {file:f,deck:deck.id,slide:slide.id,plot:slide.elements.find(e=>e.type==='plot').id};
  }
  throw Error('No talk deck in the stage project');
}

export default {
  window:{width:1280,height:860,scale:4},
  /** The talk with its uptake slide, moved first: Flux re-opens a deck at its first slide for a
   *  moment when an outside edit reloads it, so with the slide in use first nothing flickers
   *  while the agent's edits land (an app bug, reported). */
  prepare(project){
    const ids=buildTalk(project,{slides:['hdx']});
    const deck=JSON.parse(fs.readFileSync(path.join(project,'slides',ids.deck,'deck.json'),'utf8'));
    flux(project,'reorder-slides',ids.deck,'--order',[ids.hdx.slide,...deck.slides.map(s=>s.id).filter(id=>id!==ids.hdx.slide)].join(','));
  },

  async setup(ctx){
    const {page,boxes,rect,need,sleep,WIDTH,HEIGHT}=ctx;
    await need('shell',()=>page.evaluate(()=>!!document.querySelector('.modestrip .mbtn')),60000);
    await need('slides mode',async()=>{await page.evaluate(()=>[...document.querySelectorAll('.modestrip .mbtn')].find(b=>/^Slide/.test(b.getAttribute('aria-label')))?.click());await sleep(1500);return page.evaluate(()=>!!document.querySelector('.deckpicker'));},60000);
    await sleep(1000);
    const item=await need('deck',()=>page.evaluate(t=>{const n=[...document.querySelectorAll('.deckpicker .dp-item')].find(n=>n.textContent.includes(t));if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};},DECK_TITLE));
    await page.mouse.click(item.x,item.y);await sleep(2500);
    const thumb=await need('the uptake slide',()=>page.evaluate(()=>{const n=[...document.querySelectorAll('*')].find(n=>n.children.length===0&&n.textContent.trim()==='Deuterium uptake'&&n.getBoundingClientRect().right<320&&n.getBoundingClientRect().width);if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
    await page.mouse.click(thumb.x+thumb.w/2,thumb.y-30);await sleep(1500);
    await need('the uptake slide on stage',()=>page.evaluate(()=>!![...document.querySelectorAll('svg.scene-svg text, svg.scene-svg tspan')].find(n=>/Exposed regions/.test(n.textContent))),8000);
    const animate=await need('Animate button',()=>button(page,t=>/^Animate/.test(t)));
    await page.mouse.click(animate.x+animate.w/2,animate.y+animate.h/2);
    await need('Animator',()=>button(page,t=>t==='+ Step'),15000);
    await sleep(1200);
    // The Animator at its own height (AI_LIFT px taller if set): the six curve clips show as lanes.
    const gutter=await need('the Animator\'s top edge',()=>page.evaluate(()=>{const x=innerWidth/2;for(let y=250;y<innerHeight-60;y++){const n=document.elementFromPoint(x,y);if(n&&/row-resize/.test(getComputedStyle(n).cursor))return y+1;}return null;}));
    const gx=WIDTH/2,lift=+(process.env.AI_LIFT??0);
    await page.mouse.move(gx,gutter);await page.mouse.down();
    for(let i=1;i<=12;i++){await page.mouse.move(gx,gutter-lift*i/12);await sleep(30);}
    await page.mouse.up();await sleep(1500);
    // Leave the pointer off the slide, so nothing is hovered.
    await page.mouse.move(WIDTH-60,HEIGHT/2);await sleep(300);

    const agent=await connectAgent(ctx);
    const T=talk(agent.stage.project);ctx.talk=T;
    const P=boxes.plotId=T.plot;
    const set=track=>({verb:'set_animation',args:(item,S)=>({deckId:T.deck,slideId:T.slide,beatId:S.find(s=>s.beat).result.text.match(/beat_[a-z0-9_]+/)[0],append:true,track:{target:P,...track}})});
    // One clip per fitted curve, fastest exchange first: the app's own Draw along x for a bare
    // line (x clock, lead dot), each 0.65 s after the last. The data points stay as they are.
    const clips=[];
    for(let k=1;k<=6;k++)clips.push(set({part:`peptide-${k}-fit.line`,preset:'drawOn',start:(k-1)*GAP,duration:DUR,curve:{kind:'bezier',p:[0.37,0,0.63,1]},params:{clock:'x',pen:true}}),{pause:120});
    const end=5*GAP+DUR;
    agent.play({expect:/^Draw these curves one at a time/,onStep:(i,s)=>{if(s.mark)ctx.mark(s.mark);},script:[
      {pause:500},
      {claim:true,mark:'claimed'},
      {verb:'get_plot_data',args:{target:`${T.deck}/${T.slide}`,elementId:P,fields:'series',limit:200}},
      {pause:400},
      {verb:'add_beat',args:{deckId:T.deck,slideId:T.slide,label:STEP},beat:true,mark:'beat'},
      {until:()=>ctx.stepOpen},
      {pause:350},
      ...clips,
      set({part:'annotation.1',preset:'fadeRise',start:end+100,duration:600,params:{y:24},curve:EASE}),
      set({part:'annotation.0',preset:'fadeRise',start:end+250,duration:600,params:{y:24},curve:EASE}),
      {pause:500,mark:'written'},
      {reply:REPLY,mark:'reply'},
      {until:()=>ctx.inboxOpen},
      {pause:400},
      {resolve:true,mark:'resolved'},
    ]});
    boxes.composer=await rememberRecipient(ctx,'heron');

    boxes.slide=await need('slide',()=>slideBox(page)).catch(async e=>{console.log('rects',JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('svg.scene-svg rect')].map(n=>{const r=n.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];}).filter(a=>a[0]>200))));throw e;});
    boxes.addStep=await button(page,t=>t==='+ Step');
    boxes.timeline=await need('timeline header',()=>page.evaluate(()=>{const n=[...document.querySelectorAll('*')].find(n=>n.children.length===0&&/^object\s*\/\s*effect$/i.test(n.textContent.trim()));if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
    console.log('boxes',JSON.stringify(boxes));
    await ctx.place({x:Math.round(boxes.slide.x+boxes.slide.w*0.5),y:HEIGHT-30});
    await sleep(2500);
    boxes.cover={x:12,y:12,w:WIDTH-14,h:HEIGHT-14};
    return {cover:boxes.cover};
  },

  async run(ctx){
    const {boxes,page,rect,need,sleep,glide,click,down,up,key,type,mark,agent,talk}=ctx,rest=ctx.at;
    mark('start');
    await sleep(400);
    // Off the slide, then Annotate: an arrow onto the middle curve names the plot.
    const tip=await pointOn(page,boxes.plotId,'peptide-3-fit.line',0.5);
    // A long, shallow arrow: the note's picture is cropped around it, and a landscape crop shows
    // whole in the Inbox, tip included.
    const from={x:tip.x+150,y:tip.y-40};
    await glide({x:boxes.slide.x+boxes.slide.w+40,y:from.y},{bow:0.12});
    await sleep(250);
    await key('Control+Shift+M',{label:'Ctrl+Shift+M',where:[0.2,0.9]});mark('annotate');
    await need('Annotate',()=>rect(COMPOSER));await need('frozen view',()=>rect('.annotation-shot'));
    await sleep(600);
    await glide(from,{bow:0.1});await sleep(180);
    await down();await glide(tip,{ms:650,bow:0.02});await sleep(120);await up();mark('arrow');
    const chip=await need('the plot named as the target',()=>page.evaluate(()=>[...document.querySelectorAll('.annotation-composer .target-chip')].map(n=>n.textContent).join('|')));
    if(!/hdx_uptake_ramp|peptide-3-fit|plot/.test(chip))throw Error('The arrow named '+chip);
    await sleep(300);
    await glide({x:boxes.composer.x-60,y:boxes.composer.y+boxes.composer.h-30},{bow:0.15});
    mark('type');
    await type(REQUEST,{per:44});
    if(!/heron/.test(await page.evaluate(()=>document.querySelector('.annotation-composer .to-pill')?.textContent??'')))throw Error('The note is not addressed to heron');
    await sleep(800);
    await key('Enter',{label:'enter',where:[0.12,0.12]});mark('sent');
    await need('Annotate closed',async()=>!(await rect(SURFACE)));
    // The agent adds a step: open it, and watch the clips arrive.
    const step=await need('the new step',()=>button(page,t=>/^1\s*Curves, fastest first/.test(t)),20000);
    mark('stepSeen');
    await sleep(150);
    await glide({x:step.x+step.w*0.5,y:step.y+step.h*0.5},{bow:0.12});
    await sleep(200);await click();mark('stepOpen');
    await need('step selected',()=>button(page,t=>t==='▶ Step'));
    ctx.stepOpen=true;
    // Off the chip (it names the step), to the empty end of the step row.
    await sleep(250);
    await glide({x:step.x+step.w+250,y:step.y+step.h*0.55},{bow:0.08});
    await need('eight clips',async()=>stepTracks(talk.file).length===8,30000);
    mark('clips');
    await need('the reply sent',async()=>ctx.marks.reply,20000);
    // Hold on the staircase of clips, one per curve, before playing it.
    mark('stair');
    await sleep(1200);
    // Play the step.
    const play=await button(page,t=>t==='▶ Step');
    await glide({x:play.x+play.w/2,y:play.y+play.h/2},{bow:-0.1});
    await sleep(200);await click();mark('play');
    await sleep(5000);
    mark('played');
    // The reply, in the Inbox.
    await key('Alt+q',{label:'Alt+Q',where:[0.82,0.9]});mark('inbox');
    await need('Inbox',()=>rect(INBOX));
    const row=await need('the note in the list',()=>ctx.textRect(INBOX,'.inbox-row','Draw'));
    await sleep(150);await glide({x:row.x+row.w*0.45,y:row.y+row.h*0.4},{bow:0.1});await sleep(180);await click();
    await need('the note selected',()=>page.evaluate(()=>/Claimed by heron/.test(document.querySelector('.status-chip.big')?.textContent??'')));
    ctx.inboxOpen=true;
    await need('the reply in the thread',()=>page.evaluate(t=>[...document.querySelectorAll('.thread')].some(n=>n.textContent.includes(t)),REPLY.slice(0,40)));
    mark('replySeen');
    boxes.detail=await rect('.detail');boxes.picture=await rect('.picture');boxes.noteText=await rect('.detail .full-text');
    boxes.reply=await page.evaluate(()=>{const n=[...document.querySelectorAll('.thread > *')].at(-1);const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
    await sleep(250);
    await glide({x:boxes.detail.x+boxes.detail.w*0.62,y:boxes.detail.y+boxes.detail.h-40},{bow:-0.1});
    await need('resolved',()=>page.evaluate(()=>/Resolved by heron/.test(document.querySelector('.status-chip.big')?.textContent??'')),20000);
    await agent.done;
    await sleep(Math.max(0,ctx.marks.replySeen+3500-ctx.pageTime()));
    // Alt+Q again closes it (the resolved row left the list, and focus with it).
    await key('Alt+q',{label:'Alt+Q',where:[0.86,0.12]});mark('close');
    await need('Inbox closed',async()=>!(await rect(INBOX)));
    await sleep(400);
    await glide(rest,{bow:-0.12});
    await need('toasts gone',async()=>!(await toastTexts(ctx)).length,8000);
    mark('reveal');
    await sleep(1000);
    mark('end');
    await agent.close();
  },

  /** The slide and the Animator; close on the slide for the arrow; the note while it is typed;
   *  the step chips when the agent's step appears; the Animator's staircase of clips, held; tight
   *  on the slide while the step plays; the request, then the reply, in the thread; out. */
  camera(ctx){
    const {boxes:b,marks:m,frame,around,HEIGHT}=ctx,within=b.cover;
    const sx=b.slide.x+b.slide.w/2;
    const whole=frame(sx-520,sx+520,{bottom:HEIGHT-2,within});
    const slide=around(b.slide,{pad:12,within});
    const right=b.composer.x+b.composer.w+12;
    const note=frame(right-500,right,{bottom:b.composer.y+b.composer.h+8,within});
    const chips=frame(172,172+560,{top:b.addStep.y-150,within});
    const stair=frame(172,1032,{bottom:HEIGHT-2,within});
    const dx=b.detail.x+b.detail.w/2;
    const request=frame(dx-300,dx+300,{top:b.noteText.y-14,within});
    const reply=frame(b.reply.x-6,b.reply.x+474,{bottom:b.reply.y+b.reply.h+16,within});
    return [
      [m.start,whole],[m.start+300,whole],[m.annotate+150,slide],
      [m.arrow+250,slide],[m.type+200,note],
      [m.sent+150,note],[m.sent+800,chips],
      [m.stepOpen+500,chips],[m.stepOpen+1300,stair],
      [m.play+50,stair],[m.play+650,slide],
      [m.played,slide],[m.inbox+500,request],
      [m.replySeen+400,request],[m.replySeen+1000,reply],
      [m.close,reply],[m.close+1000,whole],[m.end,whole],
    ];
  },
};
