/** Shared by the "Bring your own agent" takes: the connected agent (agent.mjs) and the app
 *  surfaces it is reached through (Annotate's composer, the Inbox thread, toasts).
 *
 *  The agent is one Claude Code session for every clip, named "heron" by Flux (presence names
 *  hash the session id; this id hashes to heron, the name the docs use). */
import {startAgent} from '../agent.mjs';

export const HERON='d8d9fd75-9c93-44a9-86b5-1f04a72fac84';
export const SURFACE='.annotation-surface',COMPOSER='.annotation-composer',INBOX='.inbox-panel';

/** Connect the agent to the stage's project (before the grab) and wait until the app shows it. */
export async function connectAgent(ctx,{sessionId=HERON}={}){
  const agent=await startAgent({sessionId,log:m=>console.log(m)});
  ctx.agent=agent;
  await ctx.need('the agents chip in the title bar',()=>ctx.page.evaluate(()=>[...document.querySelectorAll('button,span,div')].some(n=>n.children.length<3&&/^1 agent\b/.test(n.textContent.trim()))),20000);
  return agent;
}

/** Choose `name` in Annotate's To: (Tab cycles recipients; Flux remembers the choice per project),
 *  the way a user sets it once. Opens and closes Annotate before the grab; returns the composer's
 *  box (it is fixed to the window's lower right). Needs the agent watching (play() started). */
export async function rememberRecipient(ctx,name='heron'){
  const {page,rect,need,sleep}=ctx;
  await page.keyboard.press('Control+Shift+M');
  await need('Annotate',()=>rect(COMPOSER),15000);await sleep(800);
  const pill=()=>page.evaluate(()=>document.querySelector('.annotation-composer .to-pill')?.textContent.replace(/\s+/g,' ').trim()??'');
  for(let i=0;i<6&&!(await pill()).includes(name);i++){await page.keyboard.press('Tab');await sleep(350);}
  if(!(await pill()).includes(name))throw Error('Annotate cannot address '+name+': To: reads '+await pill());
  await need(name+' watching',()=>page.evaluate(()=>/watching/.test(document.querySelector('.annotation-composer')?.textContent??'')),20000);
  const box=await rect(COMPOSER);
  await page.keyboard.press('Escape');
  await need('Annotate closed',async()=>!(await rect(SURFACE)),5000);await sleep(600);
  return box;
}

/** The screen point at `at` (0..1 of its length) along an SVG path inside a plot element. */
export function pointOnPart({page},elementId,partId,at=0.6){
  return page.evaluate(([elementId,partId,at])=>{
    const g=document.querySelector(`.canvas-host [data-editor-element-id="${elementId}"] [id="${elementId}__${partId}"]`);
    const p=g?.tagName==='path'?g:g?.querySelector('path');
    if(!p)return null;
    const q=p.getPointAtLength(p.getTotalLength()*at),m=p.getScreenCTM();
    return {x:q.x*m.a+q.y*m.c+m.e,y:q.x*m.b+q.y*m.d+m.f};
  },[elementId,partId,at]);
}

/** The computed stroke of a plot part as the canvas shows it. */
export const partStroke=({page},elementId,partId)=>page.evaluate(([e,p])=>{
  const g=document.querySelector(`.canvas-host [data-editor-element-id="${e}"] [id="${e}__${p}"]`);
  const n=g?.tagName==='path'?g:g?.querySelector('path');return n?getComputedStyle(n).stroke:null;},[elementId,partId]);

/** Texts of the toasts on screen. */
export const toastTexts=({page})=>page.evaluate(()=>[...document.querySelectorAll('.toast')].map(n=>n.textContent.replace(/\s+/g,' ').trim()));
