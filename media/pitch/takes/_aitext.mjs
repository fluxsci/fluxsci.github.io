/** Shared by the two "ask the literature" AI takes (ai-paper, ai-reader): Annotate addressed to
 *  the connected agent, and the Inbox thread where its reply is read.
 *
 *  Both clips are about text, so the note goes without its picture: "Attach view" is switched off
 *  once before the take (the composer remembers it, as it remembers To:), which keeps the Inbox
 *  thread to the request and the reply, both in one close frame. The targets still name the exact
 *  passage. */
import {SURFACE,COMPOSER,INBOX} from './_ai.mjs';

/** Before the grab: open Annotate, choose `name` in To: (Tab cycles recipients) and switch
 *  Attach view off, then close it again. Returns the composer's box. Needs the agent watching. */
export async function addressAgent(ctx,name='heron',{attach=false}={}){
  const {page,rect,need,sleep}=ctx;
  await page.keyboard.press('Control+Shift+M');
  await need('Annotate',()=>rect(COMPOSER),15000);await sleep(800);
  const pill=()=>page.evaluate(()=>document.querySelector('.annotation-composer .to-pill')?.textContent.replace(/\s+/g,' ').trim()??'');
  for(let i=0;i<6&&!(await pill()).includes(name);i++){await page.keyboard.press('Tab');await sleep(350);}
  if(!(await pill()).includes(name))throw Error('Annotate cannot address '+name+': To: reads '+await pill());
  await need(name+' watching',()=>page.evaluate(()=>/watching/.test(document.querySelector('.annotation-composer')?.textContent??'')),20000);
  const toggle=()=>page.evaluate(()=>{
    const label=[...document.querySelectorAll('.annotation-composer label, .annotation-composer *')].find(n=>n.children.length<4&&/^\s*Attach view\s*$/.test(n.textContent));
    const input=label?.querySelector('input')??label?.closest('label')?.querySelector('input')??label?.parentElement?.querySelector('input[type=checkbox],[role=switch]');
    if(!input)return null;const r=(input.getBoundingClientRect().width?input:label).getBoundingClientRect();
    return {on:input.checked??input.getAttribute('aria-checked')==='true',x:r.x+r.width/2,y:r.y+r.height/2};});
  let t=await need('Attach view',toggle,5000);
  if(t.on!==attach){await page.mouse.click(t.x,t.y);await sleep(400);t=await toggle();}
  if(t.on!==attach)throw Error('Attach view did not switch '+(attach?'on':'off'));
  const box=await rect(COMPOSER);box.field=await rect(COMPOSER+' textarea');
  await page.keyboard.press('Escape');
  await need('Annotate closed',async()=>!(await rect(SURFACE)),5000);await sleep(600);
  return box;
}

/** The box of the last message in the open Inbox item's thread (the agent's reply). */
export const lastMessage=({page})=>page.evaluate(()=>{const n=[...document.querySelectorAll('.inbox-panel .thread > *')].at(-1);if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
/** The box of the request (the item's own text) in the open Inbox item. */
export const requestBox=({page})=>page.evaluate(()=>{const n=document.querySelector('.inbox-panel .full-text')??document.querySelector('.inbox-panel .origin');if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
/** The Inbox list row whose text includes `text`. */
export const rowBox=({page},text)=>page.evaluate(t=>{const n=[...document.querySelectorAll('.inbox-panel .inbox-row')].find(n=>n.textContent.includes(t));if(!n)return null;const r=n.getBoundingClientRect();return r.width?{x:r.x,y:r.y,w:r.width,h:r.height}:null;},text);
/** True once the thread shows `text`. */
export const threadHas=({page},text)=>page.evaluate(t=>[...document.querySelectorAll('.inbox-panel .thread')].some(n=>n.textContent.replace(/\s+/g,' ').includes(t)),text);
export {SURFACE,COMPOSER,INBOX};
