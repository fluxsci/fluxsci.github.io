/** A connected agent for the AI clips of the pitch article.
 *
 *  The stage's HOME is isolated: no agent credentials, no Claude Code session. In these clips the
 *  agent is Claude (in Claude Code), who did the work for real while the take was being written:
 *  on an explore stage it read the on-camera request, looked at the figure, chose and made the
 *  edit with Flux's verbs, and wrote its reply. The take keeps what it did as a script of verb
 *  calls plus the reply text, and this harness replays that session against the take's scratch
 *  project through Flux's real agent interface, so the take is repeatable:
 *
 *   - it starts Flux's own stdio MCP server (`dist/flux-mcp.mjs`, the server `flux mcp` runs) as
 *     an MCP client, with the stage's isolated HOME, so it reaches the app through the same live
 *     bridge an agent would;
 *   - it identifies honestly as Claude Code (the environment Claude Code gives the MCP servers it
 *     spawns: CLAUDECODE=1, CLAUDE_CODE_ENTRYPOINT, a session id, and an MCP client named
 *     `claude-code`), so the app shows "claude · cli · <name>";
 *   - it calls `connect {target, live, noRender}`, which binds the project and writes the session's
 *     presence (the app's agents chip, AI status → Sessions, the To: menu), then heartbeats;
 *   - `wait_for_inbox` (watch mode: the session shows as watching) returns the note the take's
 *     on-camera user sends from Annotate; the harness checks it is the expected request, then
 *     `claim_item`, the scripted verb calls (each a real edit the app picks up live), `reply_item`
 *     and `resolve_item`.
 *
 *  Nothing is faked: the edit happens through the verbs during the take, and the reply travels
 *  through the real inbox thread. The pauses (a short think before the claim, the work between
 *  calls) are the only staging; they keep the pace believable on camera.
 *
 *    const agent=await startAgent({sessionId});          // in setup, before the grab
 *    agent.play({expect:/dashed reference/, script:[{pause:1500},{claim:true},
 *      {tool:'dispatch_command',args:{command:{…}}},{reply:'Done. …'},{resolve:true}]});
 *    … the take sends the note from Annotate …
 *    await agent.done;                                   // the edit landed and the reply is in
 *    await agent.close();
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const FLUX=process.env.FLUX_SOURCE||path.join(process.env.HOME,'flux');
const sdk=p=>import(path.join(FLUX,'node_modules/@modelcontextprotocol/sdk/dist/esm/client',p));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/** The stage serving `port`: its scratch project, HOME and XDG (from the Electron command line). */
export function findStage(port){
  const ps=execFileSync('ps',['-eo','args'],{encoding:'utf8',maxBuffer:1<<24}).split('\n');
  const line=ps.find(l=>l.includes(`--remote-debugging-port=${port}`)&&l.includes('flux-pitch-stage-'));
  if(!line)throw Error('No Flux stage on port '+port);
  const project=line.split(/\s+/).find(a=>a.includes('flux-pitch-stage-')&&fs.existsSync(path.join(a,'project.json')));
  if(!project)throw Error('Could not find the stage project on port '+port);
  const scratch=path.dirname(project);
  return {project,home:path.join(scratch,'home'),xdg:path.join(scratch,'xdg')};
}

/** The port this take is recording on (record.mjs's --port). */
export const stagePort=()=>{const at=process.argv.indexOf('--port');return at<0?9333:+process.argv[at+1];};

/** Start the agent: spawn Flux's MCP server and connect it to the stage's project.
 *  `sessionId` fixes the session's id, and so its name (presence names hash the id). */
export async function startAgent({port=stagePort(),sessionId,live=true,log=()=>{}}={}){
  const stage=findStage(port);
  const {Client}=await sdk('index.js'),{StdioClientTransport}=await sdk('stdio.js');
  const env={...process.env,HOME:stage.home,XDG_CONFIG_HOME:stage.xdg,
    CLAUDECODE:'1',CLAUDE_CODE_ENTRYPOINT:'cli',CLAUDE_CODE_SESSION_ID:sessionId,AI_AGENT:'claude-code_agent'};
  for(const k of ['FLUX_PROJECT','FLUX_CLIENT','FLUX_RUNNER_TOKEN','FLUX_RUNNER_STATE','ELECTRON_RUN_AS_NODE','CLAUDE_CODE_CHILD_SESSION'])delete env[k];
  const transport=new StdioClientTransport({command:process.execPath,args:[path.join(FLUX,'dist/flux-mcp.mjs')],env,cwd:stage.project,stderr:'pipe'});
  let stderr='';transport.stderr?.on('data',b=>{stderr+=b;});
  const client=new Client({name:'claude-code',version:'2.1'},{capabilities:{}});
  await client.connect(transport);
  const t0=Date.now(),calls=[];
  /** Call one MCP tool; throws on a tool error (a wrong take must fail). */
  async function call(name,args={},{timeout=120000,retry}={}){
    const started=Date.now();
    const r=await client.callTool({name,arguments:args},undefined,{timeout,resetTimeoutOnProgress:true});
    const texts=(r.content||[]).filter(c=>c.type==='text').map(c=>c.text),text=texts.join('\n');
    calls.push({name,args,ms:Date.now()-started,error:!!r.isError});
    if(name!=='wait_for_inbox'||r.isError)log(`[agent +${((Date.now()-t0)/1000).toFixed(1)}s] ${name} ${r.isError?'ERROR ':''}${text.slice(0,160).replace(/\s+/g,' ')}`);
    // "deferred: … is locked": the user is mid-edit in the app; an agent waits a moment and retries.
    if(r.isError&&/deferred: .* is locked/.test(text)&&(retry??0)<40){await sleep(350);return call(name,args,{timeout,retry:(retry??0)+1});}
    if(r.isError)throw Error(`${name} failed: ${text.slice(0,600)}`);
    // The first text block is the result; packets add picture captions and images after it.
    return {...r,text,json:(()=>{try{return JSON.parse(texts[0]);}catch{return null;}})()};
  }
  /** Any verb by name (the core toolset lists only some; flux_verb runs the rest). */
  const verb=(name,args)=>call('flux_verb',{verb:name,args});
  const connected=await call('connect',{target:stage.project,live,noRender:true},{timeout:300000});
  const session=await readSession(stage.project,sessionId);
  log(`[agent] connected as ${session?.display}`);

  let stopped=false,cursor;const ignored=new Set();
  /** Wait for the next routed note (watch mode: annotations), checking it is the one expected. */
  async function waitForNote({expect,timeoutMs=120000}={}){
    const deadline=Date.now()+timeoutMs;
    while(Date.now()<deadline){
      if(stopped)throw Error('The agent was closed while waiting for a note');
      const r=await call('wait_for_inbox',{mode:'annotations',timeoutMs:Math.min(30000,deadline-Date.now()),...(cursor?{cursor}:{})},{timeout:60000});
      const out=r.json??r.structuredContent;cursor=out?.cursor;
      if(process.env.PITCH_AGENT_DEBUG)log('[agent] wait → '+JSON.stringify({...out,cursor:undefined}).slice(0,400));
      if(out?.stopped)throw Error('The user stopped this session watching');
      const items=out?.items??[];
      const item=items.find(i=>i.status!=='resolved'&&(!expect||expect.test(i.text)));
      if(item)return item;
      // An item routed to this session comes back on every call: note it once, then pace the loop.
      for(const i of items)if(!ignored.has(i.id)){ignored.add(i.id);log(`[agent] not the expected note: ${JSON.stringify(i.text)} (${i.status})`);}
      if(items.length)await sleep(500);
    }
    throw Error('No note arrived for the agent');
  }
  /** Play one exchange. Waits for the note the on-camera user sends (its text must match
   *  `expect`), then runs `script` in order, one entry at a time:
   *    {pause: ms}                     wait (the agent thinking or working between calls)
   *    {tool: name, args}              an MCP tool call (a read or an edit); args may be (item, script) => args,
   *                                   reading earlier entries' `.result` (e.g. a new beat's id)
   *    {verb: name, args}              any registry verb, through flux_verb
   *    {claim: true | 'note'}          claim_item on the note
   *    {reply: 'text'}                 reply_item in the note's thread
   *    {resolve: true}                 resolve_item
   *    {until: () => bool}             wait until the take says so (polled; e.g. the Inbox is open)
   *  `onStep(i, step)` runs after each entry (a take marks moments with it). Returns at once;
   *  `agent.done` settles when the exchange is over, or rejects (a wrong take must fail). */
  function play({expect,script=[],timeoutMs=3600000,onStep}={}){  // long: the grab may wait minutes for the machine-wide recording lock
    const state={item:null};
    const done=(async()=>{
      const item=state.item=await waitForNote({expect,timeoutMs});
      await onStep?.(-1,{note:item});
      for(const [i,s] of script.entries()){
        if(s.pause)await sleep(s.pause);
        else if(s.until){while(!stopped&&!(await s.until()))await sleep(80);}
        else if(s.tool)s.result=await call(s.tool,typeof s.args==='function'?s.args(item,script):s.args);
        else if(s.verb)s.result=await verb(s.verb,typeof s.args==='function'?s.args(item,script):s.args);
        else if(s.claim)await call('claim_item',{id:item.id,...(typeof s.claim==='string'?{note:s.claim}:{})});
        else if(s.reply)await call('reply_item',{id:item.id,text:s.reply});
        else if(s.resolve)await call('resolve_item',{id:item.id});
        else throw Error('Unknown agent step '+JSON.stringify(s));
        await onStep?.(i,s);
      }
      return state;
    })();
    agent.done=done;agent.state=state;
    done.catch(e=>log('[agent] the exchange failed: '+(e?.stack??e)));
    return done;
  }
  async function close(){
    stopped=true;
    try{await client.close();}catch{}
    return {calls,stderr};
  }
  const agent={client,call,verb,play,waitForNote,close,stage,session,connected,calls,get stderr(){return stderr;}};
  return agent;
}

async function readSession(project,id){
  const dir=path.join(project,'.meta/live/sessions');
  for(let i=0;i<50;i++){
    try{for(const f of fs.readdirSync(dir)){const s=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));if(s.id===id)return s;}}catch{}
    await sleep(100);
  }
  return null;
}
