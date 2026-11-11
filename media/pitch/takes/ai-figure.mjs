/** Clip (AI 1): in Figure, point at it and say what you want.
 *
 *  Finished Figure 1. Annotate (Ctrl+Shift+M) freezes the view; an arrow drawn to the dashed
 *  reference curve in panel e names its plot as the note's target; the request is typed and sent
 *  to "heron", a Claude Code session connected to the project (agent.mjs). The agent claims the
 *  note (the app's toast), recolours the three dashed curves on the live canvas one plot at a
 *  time, then answers in the note's thread while the Inbox is open, and resolves it.
 *
 *  The agent's work is Claude's own: given this request on an explore stage, it looked at the
 *  note's picture and the plots' data (the dashed curve is the series "uninhibited", grey
 *  #878580, in the three inhibitor plots; the uninhibited enzyme's own fit in the first plot is
 *  #205ea6), and recoloured that series' line through the live bridge (dispatch_command
 *  restyle_part: one undoable edit each, the same edit set_series_color writes for a line series).
 *  The script below replays exactly those calls and that reply.
 *
 *  Layout: side rails hidden; Figure 1 stands so panel e is just left of and above Annotate's
 *  composer (fixed to the window's lower right): the arrow's target and the note fit one frame.
 *  The Inbox is a centred dialog; its thread pane is framed close while the reply is read.
 */
import {PANELS,sel,openFigure1,placeFigure1,carryOver,FIGURE} from './_figure1.mjs';
import {connectAgent,rememberRecipient,pointOnPart,partStroke,toastTexts,SURFACE,COMPOSER,INBOX} from './_ai.mjs';

const E=PANELS.e,INHIBITED=[E.competitive,E.noncompetitive,E.uncompetitive],ALL=[E.none,...INHIBITED];
const REQUEST='Make these dashed reference curves the blue of the uninhibited enzyme, in all three plots';
// Two short paragraphs: each line fits the 480 px frame the reply is read in.
const REPLY='Done: the three dashed curves are now the uninhibited blue.\n\nStill dashed, so they read as the reference.';
const BLUE='#205ea6',BLUE_CSS='rgb(32, 94, 166)';

export default {
  // A small window at 4x: every app text is large in a 480 px frame, and the Annotate surface (a
  // full-window frozen still under a drawing layer) has few enough pixels to keep up at 4x.
  window:{width:1040,height:780,scale:4},
  prepare(project){carryOver(project,['c','d','e','f','b']);},

  async setup(ctx){
    const {boxes,rect,need,sleep,lib,WIDTH,HEIGHT}=ctx;
    // Figure 1 about 860 px across, centred and high in the window: panel e's upper plots stand
    // just above Annotate's composer (fixed to the lower right), its lower plots behind it.
    await openFigure1(ctx,{rails:false,figureWidth:860,bottomGap:104,margin:14});
    await placeFigure1(ctx,{left:(WIDTH-boxes.figure.w)/2,bottomGap:104,margin:14});
    const t0=await rect(sel(E.competitive));
    if(t0.y+t0.h>HEIGHT-16-236)throw Error('Panel e\'s upper plots would be under the composer');
    boxes.e=lib.union(...await Promise.all(ALL.map(id=>rect(sel(id)))));
    boxes.target=await rect(sel(E.competitive));
    for(const id of INHIBITED)if(await partStroke(ctx,id,'uninhibited.line')==='rgb(135, 133, 128)');else throw Error('A dashed reference is not grey to begin with: '+id);

    // The agent: connect, start watching for the note, and let Annotate address it by name.
    const agent=await connectAgent(ctx);
    const plot=id=>({target:FIGURE,elementId:id});
    agent.play({expect:/^Make these dashed reference curves/,onStep:(i,s)=>{if(s.mark)ctx.mark(s.mark);},script:[
      {pause:900},
      {claim:true,mark:'claimed'},
      {verb:'get_plot_data',args:{...plot(E.competitive),fields:'series',limit:4}},
      {verb:'get_plot_data',args:{...plot(E.none),fields:'series',limit:4}},
      {pause:700},
      ...INHIBITED.flatMap((id,i)=>[
        {tool:'dispatch_command',args:{command:{type:'restyle_part',elementId:id,partId:'uninhibited.line',patch:{stroke:BLUE}}},mark:'edit'+i},
        {pause:650}]),
      {until:()=>ctx.inboxOpen},
      {pause:700},
      {reply:REPLY,mark:'reply'},
      {pause:500},
      {resolve:true,mark:'resolved'},
    ]});
    boxes.composer=await rememberRecipient(ctx,'heron');

    await ctx.place({x:Math.round(boxes.figure.x+boxes.figure.w*0.34),y:HEIGHT-30});
    await sleep(2500);
    boxes.cover={x:boxes.whole.x,y:boxes.whole.y,w:WIDTH-2-boxes.whole.x,h:HEIGHT-2-boxes.whole.y};
    if(boxes.whole.y+boxes.whole.h>HEIGHT-2)throw Error('The opening frame does not fit the window');
    return {cover:boxes.cover};
  },

  async run(ctx){
    const {boxes,page,rect,need,sleep,glide,click,down,up,key,type,mark,agent,lib}=ctx,rest=ctx.at;
    mark('start');
    await sleep(700);
    // Reach toward panel e and open Annotate.
    // The dashed curve in the upper right plot, just above the composer. A short, shallow arrow
    // from the upper left keeps the note's picture (cropped around the marks) on the page and
    // landscape enough for the Inbox to show the tip.
    const tip=await pointOnPart(ctx,E.competitive,'uninhibited.line',0.62);
    const from={x:tip.x-100,y:tip.y-36};
    if(from.y>boxes.composer.y-20)throw Error('The arrow would start under the composer');
    // The chord is pressed off the page: the frozen still must not carry a canvas hover outline.
    await glide({x:boxes.figure.x+boxes.figure.w+24,y:from.y-24},{bow:0.12});
    await sleep(250);
    await key('Control+Shift+M',{label:'Ctrl+Shift+M',where:[0.18,0.9]});mark('annotate');
    boxes.composer=await need('Annotate',()=>rect(COMPOSER));
    await need('frozen view',()=>rect('.annotation-shot'));
    await sleep(700);
    // Draw an arrow onto the dashed curve: its tip names the plot.
    await glide(from,{bow:0.1});
    await sleep(180);
    await down();await glide(tip,{ms:700,bow:0.02});await sleep(120);await up();mark('arrow');
    const chip=await need('the plot named as the target',()=>page.evaluate(()=>[...document.querySelectorAll('.annotation-composer .target-chip')].map(n=>n.textContent).join('|')));
    if(!/line "uninhibited"|michaelis_menten_competitive/.test(chip))throw Error('The arrow named '+chip);
    // Off the plot, so the pointer hides nothing while the note is typed.
    await sleep(300);
    await glide({x:boxes.composer.x-60,y:boxes.composer.y+boxes.composer.h-30},{bow:0.15});
    mark('type');
    await type(REQUEST,{per:52});
    const to=await page.evaluate(()=>document.querySelector('.annotation-composer .to-pill')?.textContent??'');
    if(!/heron/.test(to))throw Error('The note is not addressed to heron: '+to);
    await sleep(900);
    await key('Enter',{label:'enter',where:[0.14,0.14]});mark('sent');
    await need('Annotate closed',async()=>!(await rect(SURFACE)));
    // The agent at work: claimed (toast), then the three curves, one plot at a time.
    await need('claimed',async()=>(await toastTexts(ctx)).some(t=>t.startsWith('heron claimed')),15000);
    mark('claimedSeen');
    for(const id of INHIBITED)await need('the curve recoloured in '+id,async()=>await partStroke(ctx,id,'uninhibited.line')===BLUE_CSS,20000);
    mark('edited');
    await sleep(1300);
    // The Inbox: the note, and the agent's answer arriving in its thread.
    await key('Alt+q',{label:'Alt+Q',where:[0.86,0.86]});mark('inbox');
    boxes.inbox=await need('Inbox',()=>rect(INBOX));
    const row=await need('the note in the list',()=>ctx.textRect(INBOX,'.inbox-row','Make'));
    await sleep(500);
    await glide({x:row.x+row.w*0.45,y:row.y+row.h*0.4},{bow:0.1});
    await sleep(200);await click();
    await need('the note selected',()=>page.evaluate(()=>/Claimed by heron/.test(document.querySelector('.status-chip.big')?.textContent??'')));
    boxes.detail=await rect('.detail');boxes.picture=await rect('.picture');boxes.noteText=await rect('.detail .full-text');
    ctx.inboxOpen=true;
    // Park the pointer below the thread, clear of the reply.
    await sleep(250);
    await glide({x:boxes.detail.x+boxes.detail.w*0.62,y:boxes.detail.y+boxes.detail.h-40},{bow:-0.1});
    await need('the reply in the thread',()=>page.evaluate(t=>[...document.querySelectorAll('.thread')].some(n=>n.textContent.includes(t)),REPLY.slice(0,40)),20000);
    mark('replySeen');
    boxes.reply=await page.evaluate(()=>{const n=[...document.querySelectorAll('.thread > *')].at(-1);const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
    await need('resolved',()=>page.evaluate(()=>/Resolved by heron/.test(document.querySelector('.status-chip.big')?.textContent??'')),20000);
    mark('resolvedSeen');
    await agent.done;
    await sleep(Math.max(0,ctx.marks.replySeen+3200-ctx.pageTime()));
    // Alt+Q again closes it (Escape would need focus in the panel; the resolved row left the list).
    await key('Alt+q',{label:'Alt+Q',where:[0.86,0.14]});mark('close');
    await need('Inbox closed',async()=>!(await rect(INBOX)));
    await sleep(500);
    await glide(rest,{bow:-0.12});
    await need('toasts gone',async()=>!(await toastTexts(ctx)).length,8000);
    for(const id of INHIBITED)if(await partStroke(ctx,id,'uninhibited.line')!==BLUE_CSS)throw Error('The edit did not hold in '+id);
    mark('reveal');
    // Close on panel e (the camera holds it ~1.8 s from the close), then out to the figure.
    await sleep(Math.max(1300,ctx.marks.close+3900-ctx.pageTime()));
    mark('end');
    await agent.close();
  },

  /** The whole figure; close on the composer under the arrow while the note is typed; close on
   *  panel e while its curves turn; the request, then the reply, in the thread; panel e again,
   *  held; out to the figure. */
  camera(ctx){
    const {boxes:b,marks:m,frame,around}=ctx,within=b.cover;
    const whole=frame(b.whole.x,b.whole.x+b.whole.w,{top:b.whole.y,within});
    const right=b.composer.x+b.composer.w+12;
    const note=frame(right-560,right,{bottom:b.composer.y+b.composer.h+8,within});
    const panel=around(b.e,{pad:12,within});
    const cx=b.detail.x+b.detail.w/2,w=Math.max(480,Math.min(580,b.detail.w));
    const request=frame(cx-w/2,cx+w/2,{top:b.noteText.y-14,within});
    const reply=frame(b.reply.x-6,b.reply.x+474,{bottom:b.reply.y+b.reply.h+16,within});
    return [
      [m.start,whole],[m.start+400,whole],[m.annotate+150,note],
      [m.sent+150,note],[m.sent+900,panel],
      [m.inbox-100,panel],[m.inbox+600,request],
      [m.replySeen,request],[m.replySeen+600,reply],
      [m.close,reply],[m.close+700,panel],
      [m.close+2500,panel],[m.close+3500,whole],[m.end,whole],
    ];
  },
};
