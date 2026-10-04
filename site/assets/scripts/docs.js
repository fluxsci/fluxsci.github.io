(() => {
 'use strict';
 for(const button of document.querySelectorAll('[data-copy]')) {
  button.hidden=false;
  button.addEventListener('click',async()=>{
   const code=document.getElementById(button.dataset.copy)?.querySelector('code');
   if(!code)return;
   try{await navigator.clipboard.writeText(code.textContent.trimEnd());button.textContent='Copied';button.setAttribute('aria-label','Copied to clipboard');}
   catch{const range=document.createRange();range.selectNodeContents(code);getSelection().removeAllRanges();getSelection().addRange(range);button.textContent='Select & copy';}
   setTimeout(()=>{button.textContent='Copy';button.setAttribute('aria-label','Copy command or code');},2200);
  });
 }
 // Focused teaching examples load only after an intentional click.
 const studies=[...document.querySelectorAll('[data-doc-study]')];
 const frames=new Map();
 const pause=box=>frames.get(box)?.contentWindow?.postMessage({type:'flux-demo-pause'},location.origin);
 for(const box of studies){
  const button=box.querySelector('[data-study-start]');button.hidden=false;
  button.addEventListener('click',()=>{
   if(frames.has(box))return;
   const iframe=document.createElement('iframe');iframe.src=box.dataset.docStudy;
   iframe.title=button.dataset.title;iframe.setAttribute('allow','fullscreen');
   const stage=box.querySelector('.doc-study-stage');
   iframe.style.height=Math.ceil(stage.clientWidth*440/800+64)+'px';
   stage.querySelector('img').hidden=true;button.hidden=true;stage.append(iframe);frames.set(box,iframe);
   iframe.addEventListener('load',()=>iframe.focus({preventScroll:true}),{once:true});
  });
 }
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.data?.type!=='flux-docs-resize')return;
  const height=e.data.height;if(!Number.isFinite(height)||height<100||height>2000)return;
  for(const frame of frames.values())if(e.source===frame.contentWindow)frame.style.height=Math.ceil(height)+'px';
 });
 if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(!entry.isIntersecting)pause(entry.target);});studies.forEach(box=>observer.observe(box));}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)studies.forEach(pause);});
 for(const lab of document.querySelectorAll('.timing-lab')){
  const options=lab.querySelector('.timing-options');options.hidden=false;
  const buttons=[...options.querySelectorAll('button')],panels=[...lab.querySelectorAll('.timing-panel')];
  const select=button=>{buttons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));panels.forEach(p=>p.hidden=p.id!==button.getAttribute('aria-controls'));};
  buttons.forEach(button=>button.addEventListener('click',()=>select(button)));select(buttons[0]);
 }
 // Mark the current section without moving focus or changing the URL.
 const toc=[...document.querySelectorAll('.doc-toc a')],sections=toc.map(a=>document.getElementById(decodeURIComponent(a.hash.slice(1))));
 let scheduled=false;
 function updateSection(){scheduled=false;let index=0;sections.forEach((section,i)=>{if(section?.getBoundingClientRect().top<150)index=i;});toc.forEach((a,i)=>{if(i===index)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}
 if(toc.length){window.addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(updateSection);}},{passive:true});updateSection();}
 const dialog=document.getElementById('docs-search'),input=document.getElementById('search-query');
 if(!dialog||!input)return;
 let index,opener,active=-1;
 const results=dialog.querySelector('.search-results'),status=dialog.querySelector('.search-status');
 const load=()=>index??=fetch('/search-index.json').then(r=>{if(!r.ok)throw Error();return r.json();}).catch(()=>{index=undefined;return null;});
 const opens=[...document.querySelectorAll('[data-search-open]')];
 for(const button of opens){button.hidden=false;button.addEventListener('click',()=>open(button));button.addEventListener('pointerenter',load,{once:true});}
 async function open(from){opener=from;dialog.showModal();input.focus();await render();}
 function close(){dialog.close();opener?.focus();}
 async function render(){
  const query=input.value.trim().toLowerCase(),tokens=query.split(/\s+/).filter(Boolean);active=-1;
  const entries=await load();if(!entries){status.textContent='Search could not load. Browse the documentation directory below.';results.replaceChildren();const li=document.createElement('li'),a=document.createElement('a');a.href='/docs/';a.textContent='Browse documentation →';li.append(a);results.append(li);return;}
  if(input.value.trim().toLowerCase()!==query)return;
  const matched=entries.map(entry=>{const title=entry.title.toLowerCase(),summary=entry.description.toLowerCase(),body=(entry.text||'').toLowerCase();return {entry,score:tokens.every(t=>(title+' '+summary+' '+body).includes(t))?tokens.reduce((s,t)=>s+(title.includes(t)?20:summary.includes(t)?5:1),0):0};}).filter(x=>!tokens.length||x.score).sort((a,b)=>b.score-a.score).slice(0,12);
  results.replaceChildren();
  for(const {entry}of matched){const li=document.createElement('li'),a=document.createElement('a'),title=document.createElement('strong'),desc=document.createElement('span');a.href=entry.url;title.textContent=entry.title+(entry.external?' ↗':'');desc.textContent=entry.description;a.append(title,desc);li.append(a);results.append(li);}
  status.textContent=query?(matched.length?`${matched.length} result${matched.length===1?'':'s'}`:'No matching topics. Try “plots”, “slides”, or “agents”.'):'Explore a guide, or type to search.';
 }
 input.addEventListener('input',render);
 dialog.querySelector('[data-search-close]').addEventListener('click',close);
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
 dialog.addEventListener('close',()=>opener?.focus());
 dialog.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp'].includes(e.key))return;const links=[...results.querySelectorAll('a')];if(!links.length)return;e.preventDefault();active=(active+(e.key==='ArrowDown'?1:-1)+links.length)%links.length;links[active].focus();});
 document.addEventListener('keydown',e=>{if(e.key==='/'&&!dialog.open&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.target.closest('input,textarea,select,[contenteditable]')){e.preventDefault();open(opens[0]);}});
 // Keep the mobile table of contents compact; desktop always shows the navigation.
 const nav=document.querySelector('.docs-mobile-nav'),mq=matchMedia('(max-width: 900px)');
 if(nav){const sync=()=>{nav.open=!mq.matches;};sync();mq.addEventListener('change',sync);}
})();
