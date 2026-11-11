/** Slides 4: one thing becomes another. On a slide made from Figure 1's uptake curves (panel d,
 *  finished) beside a bar chart of the six peptides' half-times, the six fitted curves Become the
 *  six bars: Ctrl+click one curve, Shift+click the other five, B, drag a box round the bars,
 *  Space. Then ▶ Play in the Animator, framed on the slide alone: each curve swells, lifts off and
 *  lands as its own bar, in its own colour, in its own row.
 *
 *  Materials: the deck is built in the scratch project by _become.mjs (Flux CLI, every run). Its
 *  bar chart, plots/protein_structure/hdx_half_times, was made for this from the uptake model of
 *  hdx_uptake_ramp (demo repo, CORE/protein_structure/pure_scripts/tour_become.py).
 *
 *  Why ▶ Play and not Present: Present asks for fullscreen, and a fullscreen element covers the
 *  recorder's clock square, so the compositor could not time those frames. The Animator plays
 *  the slide with the same player, and on a 4:3 deck the slide fills a 4:3 frame.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildBecomeSlide,DECK_TITLE} from './_become.mjs';

export const portOf=argv=>{const at=argv.indexOf('--port');return at<0?'9333':argv[at+1];};
export const handoff=port=>path.join(os.tmpdir(),`flux-tour-become-${port}.json`);

/** Slides mode, the tour deck, and the Animator dock open (so nothing reflows later). */
export async function openBecomeSlide(ctx){
  const {page,need,sleep}=ctx;
  await need('shell',()=>page.evaluate(()=>!!document.querySelector('.modestrip .mbtn')),60000);
  await need('slides mode',async()=>{await page.evaluate(()=>[...document.querySelectorAll('.modestrip .mbtn')].find(b=>/^Slide/.test(b.getAttribute('aria-label')))?.click());await sleep(1500);return page.evaluate(()=>!!document.querySelector('.deckpicker'));},60000);
  await sleep(1000);
  const item=await need('deck',()=>page.evaluate(t=>{const n=[...document.querySelectorAll('.deckpicker .dp-item')].find(n=>n.textContent.includes(t));if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};},DECK_TITLE));
  await page.mouse.click(item.x,item.y);await sleep(2500);
  const animate=await need('Animate button',()=>button(page,t=>/^Animate/.test(t)));
  await page.mouse.click(animate.x+animate.w/2,animate.y+animate.h/2);
  await need('Animator',()=>button(page,t=>t==='+ Step'),15000);
  await sleep(1500);
}
export const button=(page,test)=>page.evaluate(src=>{const test=eval(src);const n=[...document.querySelectorAll('button')].find(b=>b.getBoundingClientRect().width&&test(b.textContent.trim()));if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},test.toString());
/** The slide's page on the stage (the 4:3 white rect). */
export const slideBox=page=>page.evaluate(()=>{const n=[...document.querySelectorAll('svg.scene-svg rect')].find(n=>{const r=n.getBoundingClientRect();return r.width>300&&Math.abs(r.width/r.height-4/3)<0.01;});if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
export const partBox=(page,id)=>page.evaluate(id=>{const n=document.querySelector(`svg.scene-svg [id="${id}"]`);if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},id);
/** The stage element ids of the two plots, by their source files. */
export const plotIds=page=>page.evaluate(()=>{const ids=[...document.querySelectorAll('svg.scene-svg [data-editor-element-id^="plot_"]')].map(n=>n.getAttribute('data-editor-element-id'));const has=(id,s)=>!!document.querySelector(`svg.scene-svg [id="${id}__${s}"]`);return {uptake:ids.find(id=>has(id,'peptide-1-fit.line')),bars:ids.find(id=>has(id,'peptide-1-half-time.bar.0'))};});
/** A point on each fitted curve as far as possible from every data marker, error bar and the
 *  other curves, so a click there can only hit the line. */
export const curveGrips=(page,uptake)=>page.evaluate(U=>{
  const q=s=>document.querySelector(`svg.scene-svg [id="${U}__${s}"]`);
  const path=i=>{const g=q(`peptide-${i}-fit.line`);return g.tagName==='path'?g:g.querySelector('path');};
  const screen=(p,pt)=>{const m=p.getScreenCTM();return {x:pt.x*m.a+pt.y*m.c+m.e,y:pt.x*m.b+pt.y*m.d+m.f};};
  const marks=[...document.querySelectorAll(`svg.scene-svg [id^="${U}__peptide-"]`)].filter(n=>/\.(point\.\d+|errorbar)$/.test(n.id)).flatMap(n=>n.id.endsWith('errorbar')?[...n.querySelectorAll('path,line')].map(c=>{const r=c.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,h:r.height};}):[(r=>({x:r.x+r.width/2,y:r.y+r.height/2,h:0}))(n.getBoundingClientRect())]);
  const curves=[1,2,3,4,5,6].map(i=>{const p=path(i),L=p.getTotalLength();return Array.from({length:120},(_,k)=>screen(p,p.getPointAtLength(L*k/119)));});
  const plot=document.querySelector(`svg.scene-svg [data-editor-element-id="${U}"]`).getBoundingClientRect();
  return curves.map((c,i)=>{
    let best=null;
    for(let k=12;k<108;k++){
      const p=c[k];
      const dm=Math.min(...marks.map(m=>Math.max(0,Math.hypot(p.x-m.x,(p.y-m.y))-m.h/2)));
      const dc=Math.min(...curves.flatMap((o,j)=>j===i?[]:o.map(r=>Math.hypot(p.x-r.x,p.y-r.y))));
      const score=Math.min(dm,dc*0.8)-Math.abs(p.x-(plot.x+plot.width*0.45))*0.01;
      if(!best||score>best.score)best={x:p.x,y:p.y,score,dm,dc};
    }
    return best;
  });
},uptake);

export default {
  // 3 device px per CSS px (not 4): every framing here is at least 760 px wide, and the
  // morph renders a third faster on the software stage.
  window:{width:1840,height:1100,scale:3},
  async prepare(project,{source}={}){
    const ids=buildBecomeSlide(project,{source});
    fs.writeFileSync(handoff(portOf(process.argv)),JSON.stringify({project,...ids}));
  },

  async setup(ctx){
    const {page,boxes,need,sleep}=ctx;
    await openBecomeSlide(ctx);
    boxes.slide=await need('slide',()=>slideBox(page));
    const ids=await need('plots',async()=>{const r=await plotIds(page);return r.uptake&&r.bars?r:null;});
    boxes.ids=ids;
    boxes.uptake=await partBox(page,`${ids.uptake}__peptide-1-fit.line`).then(()=>page.evaluate(U=>{const r=document.querySelector(`svg.scene-svg [data-editor-element-id="${U}"]`).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},ids.uptake));
    boxes.grips=await curveGrips(page,ids.uptake);
    if(boxes.grips.some(g=>g.dm<5||g.dc<6))throw Error('No clean grip on a curve: '+JSON.stringify(boxes.grips));
    boxes.bar1=await partBox(page,`${ids.bars}__peptide-1-half-time.bar.0`);
    boxes.bar6=await partBox(page,`${ids.bars}__peptide-6-half-time.bar.0`);
    // The timeline zoomed out (Ctrl+wheel, three notches) so a 3 s clip fits beside its label.
    for(let i=0;i<3;i++){await page.mouse.move(900,980);await page.keyboard.down('Control');await page.mouse.wheel(0,100);await page.keyboard.up('Control');await sleep(450);}
    const s=boxes.slide;
    boxes.rest={x:Math.round(s.x-150),y:Math.round(s.y+s.h*0.6)};          // dark canvas left of the slide
    await ctx.place(boxes.rest);
    await sleep(2500);
    boxes.cover={x:160,y:30,w:1840-162,h:1100-32};
    return {cover:boxes.cover};
  },

  async run(ctx){
    const {page,boxes,need,sleep,glide,click,down,up,key,hold,release,type,mark}=ctx,rest=ctx.at;
    const text=()=>page.evaluate(()=>document.body.innerText);
    const g=boxes.grips;
    mark('start');
    await sleep(900);
    // ---- the six curves: Ctrl+click drills to one, Shift+click adds its siblings ----
    await glide(g[0],{bow:0.12});
    await sleep(180);
    await hold('Control',{where:[0.12,0.9]});await sleep(120);
    await click();mark('first');
    await release('Control');
    await need('one curve picked',async()=>/PLOT PART\s+line · peptide-1-fit\b/.test(await text()));
    await sleep(260);
    // the other five quickly: they are the first one's siblings
    await hold('Shift',{where:[0.12,0.9]});
    for(let i=1;i<6;i++){
      await glide(g[i],{bow:i%2?0.16:-0.16,ms:240});
      await sleep(70);await click({hold:70});
      await sleep(40);
    }
    await release('Shift');mark('curves');
    await need('six curves picked',async()=>/PLOT PARTS\s*·\s*6\b/.test(await text()));
    await sleep(650);
    // ---- B: the Become picker; a box round the six bars picks them, numbered ----
    await key('b',{label:'B',where:[0.12,0.9]});mark('picker');
    await need('picker',async()=>/becomes…/.test(await text()));
    await sleep(700);
    const b1=boxes.bar1,b6=boxes.bar6;
    const from={x:b1.x-16,y:b1.y-14},to={x:b6.x+b6.w+12,y:b6.y+b6.h+8};
    await glide(from,{bow:0.1});
    await sleep(160);
    await down();mark('box');await sleep(120);
    await glide(to,{bow:0,ms:1000});
    await sleep(240);await up();mark('picked');
    await need('six bars picked',async()=>/6 picked/.test(await text()));
    await sleep(750);
    await key(' ',{label:'Space',where:[0.12,0.9]});mark('confirm');
    await need('hand-off made',async()=>/hands off to/.test(await text()));
    // The track as written: curve n hands off to bar n's set (six line parts, six bars).
    const {project}=JSON.parse(fs.readFileSync(handoff(portOf(process.argv)),'utf8'));
    const deckFile=fs.readdirSync(path.join(project,'slides')).map(d=>path.join(project,'slides',d,'deck.json')).find(f=>{try{return JSON.parse(fs.readFileSync(f,'utf8')).title===DECK_TITLE;}catch{return false;}});
    const track=await need('track saved',()=>{try{return JSON.parse(fs.readFileSync(deckFile,'utf8')).slides[0].beats[1]?.tracks[0]??null;}catch{return null;}},8000);
    const want=[1,2,3,4,5,6].map(i=>`peptide-${i}-fit.line`).join(),got=[...track.parts].sort().join();
    if(got!==want||track.to.become.ref.parts.length!==6)throw Error('The Become does not hand the six curves to the six bars: '+JSON.stringify({parts:track.parts,to:track.to.become.ref}));
    await sleep(400);
    // ---- its timing on the timeline: drag the clip's end out to 2.4 s, then the clip itself to
    //      start at 0.6 s (a beat of stillness after the click, so the before state reads) ----
    const clipBox=()=>page.evaluate(()=>{const t=[...document.querySelectorAll('.lane-row .bar-time')][0];const r=t?.parentElement.getBoundingClientRect();return r&&r.width?{x:r.x,y:r.y,w:r.width,h:r.height,label:t.textContent.trim()}:null;});
    let clip=await need('the new clip',async()=>{const c=await clipBox();return c?.label==='1.20s'?c:null;});
    const pps=clip.w/1.2,y=clip.y+clip.h/2;
    boxes.clip={...clip,end:clip.x+pps*3.0};
    await glide({x:clip.x+clip.w-2,y},{bow:0.12});mark('timing');
    await sleep(180);await down();await sleep(110);
    await glide({x:clip.x+pps*2.4-1,y},{bow:0,ms:900});
    await sleep(200);await up();mark('longer');
    clip=await need('2.4 s clip',async()=>{const c=await clipBox();return c?.label==='2.40s'?c:null;});
    await sleep(250);
    const grip={x:clip.x+clip.w*0.45,y};
    await glide(grip,{bow:-0.2});
    await sleep(160);await down();await sleep(110);
    await glide({x:grip.x+pps*0.6,y},{bow:0,ms:560});
    await sleep(180);await up();mark('later');
    await need('timing saved',()=>{try{const t=JSON.parse(fs.readFileSync(deckFile,'utf8')).slides[0].beats[1].tracks[0];return Math.abs(t.duration-2400)<=25&&Math.abs(t.start-600)<=25;}catch{return false;}},6000).catch(()=>{const t=JSON.parse(fs.readFileSync(deckFile,'utf8')).slides[0].beats[1].tracks[0];throw Error(`The clip is ${t.duration} ms from ${t.start} ms, not 2400 from 600`);});
    mark('timed');
    await sleep(300);
    // ---- ▶ Play: the slide plays the step ----
    boxes.play=await need('Play',()=>button(page,t=>t==='▶ Play'));
    await glide({x:boxes.play.x+boxes.play.w*0.45,y:boxes.play.y+boxes.play.h/2},{bow:-0.12});
    await sleep(200);await click();mark('play');
    // off the slide at once (out of the frame), so nothing covers the playback
    await glide(rest,{bow:0.1,ms:420});
    await sleep(600+2400-420);
    mark('played');
    await sleep(1650+1000);
    mark('end');
  },

  /** The editor (picker bar, slide, Animator); in on the slide while the curves are picked; out
   *  again for the picker, the bars and the new lane; onto the slide and the Play button under it
   *  for the playback; back out. */
  camera(ctx){
    const {boxes:b,marks:m,frame,around}=ctx,s=b.slide,within=b.cover;
    const cx=s.x+s.w/2;
    // the picker bar's text from its first letter, the slide, and the Animator down to its lanes
    const wide=frame(165,165+1100,{top:100,within});
    const slide=around(s,{pad:14,within});
    const playTop=s.y-6,playBottom=b.play.y+b.play.h+8;
    const play=frame(cx-(playBottom-playTop)*4/3/2,cx+(playBottom-playTop)*4/3/2,{top:playTop,within});
    // the timeline: the clip's label and the ruler, from 0 s to past 3 s
    const c=b.clip,timing=frame(c.x-40,c.end+60,{bottom:c.y+c.h+105,within});   // above the hand-off toast
    const tight=around(s,{pad:6,within});
    return [
      [m.start,wide],[m.start+450,wide],[m.start+1350,slide],
      [m.curves+250,slide],[m.picker+100,wide],
      [m.confirm+700,wide],[m.timing-100,timing],
      [m.later+350,timing],[m.play-150,play],
      [m.play+120,play],[m.play+560,tight],
      [m.played+1650,tight],[m.played+2550,wide],[m.end,wide],
    ];
  },
};
