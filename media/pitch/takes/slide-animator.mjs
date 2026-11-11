/** Slides 6: the Animator. The slide from "slide-become", its Become already made (one step, one
 *  clip on the timeline: the six curves hand off to the six bars together, 2.4 s from 0.6 s). Select the
 *  clip, drag its end out to 3 s, raise Piece lag to 0.5, and play the step: now the curves peel
 *  off one after another, top to bottom, each landing as its bar while the playhead runs along
 *  the clip.
 *
 *  Plan point 6 asked for six bar clips dragged into a stagger and a spring with a small bounce.
 *  In Flux a Become with a set of parts is ONE clip whose pieces fly together; their stagger is
 *  the clip's own Piece lag (the Animator's control for exactly this), and a hand-off's flight is
 *  clamped to its path (data never overshoots), so a spring would only arrive early and sit:
 *  no bounce to film. This take shows the real controls that make the point.
 *
 *  Materials: the deck from _become.mjs plus the Become step (addBecomeStep), written as the app
 *  writes it when the Become is made by hand (see slide-become).
 */
import fs from 'node:fs';
import path from 'node:path';
import {buildBecomeSlide,addBecomeStep,DECK_TITLE} from './_become.mjs';
import {openBecomeSlide,slideBox,button,portOf,handoff} from './slide-become.mjs';

const LAG=0.5,START=600,FROM=2400,DURATION=3000;
const deckFile=()=>{const {project}=JSON.parse(fs.readFileSync(handoff(portOf(process.argv)),'utf8'));return fs.readdirSync(path.join(project,'slides')).map(d=>path.join(project,'slides',d,'deck.json')).find(f=>{try{return JSON.parse(fs.readFileSync(f,'utf8')).title===DECK_TITLE;}catch{return false;}});};
const track=()=>{try{return JSON.parse(fs.readFileSync(deckFile(),'utf8')).slides[0].beats[1].tracks[0];}catch{return null;}};
const rectOf=(page,sel,text)=>page.evaluate(([sel,text])=>{const n=[...document.querySelectorAll(sel)].find(n=>n.getBoundingClientRect().width&&(!text||n.textContent.trim()===text));if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},[sel,text]);
/** The Animation inspector's range input whose row reads `label`. */
const slider=(page,label)=>page.evaluate(label=>{const n=[...document.querySelectorAll('input[type=range]')].find(n=>(n.closest('label,div')?.textContent||'').trim().startsWith(label));if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,value:+n.value,min:+n.min,max:+n.max};},label);

export default {
  window:{width:1840,height:1100,scale:3},
  async prepare(project,{source}={}){
    const ids=buildBecomeSlide(project,{source});addBecomeStep(project,ids);
    fs.writeFileSync(handoff(portOf(process.argv)),JSON.stringify({project,...ids}));
  },

  async setup(ctx){
    const {page,boxes,need,sleep}=ctx;
    await openBecomeSlide(ctx);
    // The Become's step, so its clip is on the timeline.
    const beat=await need('Beat 1 chip',()=>button(page,t=>/^1\s*Beat 1/.test(t)));
    await page.mouse.click(beat.x+beat.w/2,beat.y+beat.h/2);
    // The timeline zoomed out (Ctrl+wheel, four notches) so the clip's new end fits.
    for(let i=0;i<4;i++){await page.mouse.move(900,980);await page.keyboard.down('Control');await page.mouse.wheel(0,100);await page.keyboard.up('Control');await sleep(450);}
    boxes.bar=await need('the Become clip',()=>page.evaluate(()=>{const t=[...document.querySelectorAll('.lane-row .bar-time')].find(n=>n.textContent.trim()==='2.40s');const r=t?.parentElement.getBoundingClientRect();return r&&r.width?{x:r.x,y:r.y,w:r.width,h:r.height}:null;}));
    boxes.lane=await rectOf(page,'.lane-row');
    boxes.slide=await need('slide',()=>slideBox(page));
    boxes.step=await need('Step',()=>button(page,t=>t==='▶ Step'));
    boxes.rest={x:Math.round(boxes.slide.x-120),y:Math.round(boxes.slide.y+boxes.slide.h*0.6)};
    await ctx.place(boxes.rest);
    await sleep(2500);
    boxes.cover={x:166,y:30,w:1840-166-2,h:1100-32};
    return {cover:boxes.cover};
  },

  async run(ctx){
    const {page,boxes,need,sleep,glide,click,down,up,mark}=ctx,rest=ctx.at,b=boxes.bar;
    mark('start');
    await sleep(900);
    // ---- select the clip: the inspector shows its timing and hand-off controls ----
    await glide({x:b.x+b.w*0.42,y:b.y+b.h/2},{bow:0.1});
    await sleep(200);await click();mark('select');
    boxes.lag=await need('Piece lag',()=>slider(page,'Piece lag'));
    if(boxes.lag.value!==0)throw Error('Piece lag does not start at 0');
    await sleep(700);
    // ---- drag its end: 2.4 s → 3.0 s long ----
    const perMs=b.w/FROM,edge={x:b.x+b.w-2,y:b.y+b.h/2};
    await glide(edge,{bow:-0.1});
    await sleep(200);await down();mark('drag0');await sleep(120);
    await glide({x:b.x+perMs*DURATION-1,y:edge.y},{bow:0,ms:1100});
    await sleep(220);await up();mark('drag1');
    await need('3 s',async()=>Math.abs((track()?.duration??0)-DURATION)<=25,4000).catch(async()=>{throw Error('Duration is '+track()?.duration);});
    await sleep(700);
    // ---- Piece lag 0 → 0.5: the pieces peel off one after another ----
    const s=boxes.lag,thumb=14,at=v=>({x:s.x+thumb/2+(s.w-thumb)*(v-s.min)/(s.max-s.min),y:s.y+s.h/2});
    await glide(at(0),{bow:0.12});
    await sleep(220);await down();mark('lag0');await sleep(120);
    await glide(at(LAG),{bow:0,ms:850});
    await sleep(200);await up();mark('lag1');
    await need('Piece lag 0.5',async()=>Math.abs((track()?.pairLag??0)-LAG)<1e-6,4000).catch(async()=>{throw Error('Piece lag is '+track()?.pairLag);});
    await sleep(800);
    // ---- play the step ----
    const st=boxes.step;
    await glide({x:st.x+st.w*0.5,y:st.y+st.h/2},{bow:0.14});
    await sleep(200);await click();mark('play');
    // off the frame at once (right of the slide), clear of the slide and the timeline
    await glide({x:boxes.slide.x+boxes.slide.w+260,y:boxes.slide.y+boxes.slide.h*0.55},{bow:-0.1,ms:520});
    await sleep(START+DURATION+1700-520);
    mark('played');
    await sleep(900);
    await glide(rest,{bow:0.12});
    await sleep(1300);
    mark('end');
  },

  /** The slide and its timeline; in on the clip's end for the drag; across to the inspector (the
   *  bars beside it) for Piece lag; out to the slide and the timeline for the playback. */
  camera(ctx){
    const {boxes:B,marks:m,frame,around}=ctx,s=B.slide,b=B.bar,within=B.cover;
    const laneY=b.y+b.h/2;
    // slide and lane together, from the lane's labels
    const cx=s.x+s.w/2,span=(top,bottom)=>(bottom-top)*4/3;
    const wide=frame(cx-span(s.y-24,laneY+60)/2,cx+span(s.y-24,laneY+60)/2,{top:s.y-24,within});
    // the clip from its label to past its new end, the ruler above it
    const drag=frame(b.x-50,b.x+b.w*DURATION/FROM+80,{bottom:laneY+170,within});
    const lag=frame(B.lag.x-560,B.lag.x+B.lag.w+40,{cy:B.lag.y+60,within});
    const play=frame(cx-span(s.y-12,laneY+40)/2,cx+span(s.y-12,laneY+40)/2,{top:s.y-12,within});
    return [
      [m.start,wide],[m.start+500,wide],[m.select-100,drag],
      [m.drag1+500,drag],[m.lag0-150,lag],
      [m.lag1+600,lag],[m.play-100,play],
      [m.played+300,play],[m.played+1500,wide],[m.end,wide],
    ];
  },
};
