import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {load} from 'cheerio';
import {ROOT,OUTPUT} from './paths.mjs';
import {routes,groups,ORIGIN} from './routes.mjs';
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(item,current='')=>`<a href="${item.url}"${item.url===current?' aria-current="page"':''}>${escape(item.title)}</a>`;
export async function writeDirectory(){
 const cards=groups.map(g=>`<section class="directory-group" id="${g.id}"><div class="directory-heading"><h2>${escape(g.title)}</h2><span>${g.items.length} ${g.items.length===1?'guide':'guides'}</span></div><div class="directory-items">${g.items.map(item=>`<a class="directory-item" href="${item.url}"><h3>${escape(item.title)}<span aria-hidden="true">→</span></h3><p>${escape(item.description)}</p></a>`).join('')}</div></section>`).join('\n');
 await writeFile(path.join(ROOT,'site/docs/index.qmd'),`---\ntitle: "Documentation"\ndescription: "Guides and reference for the whole Flux ecosystem: Paper, Figure, Slides, Library, Reader, fluxplot, AI agents, integrations and the command line."\n---\n\n\`\`\`{=html}\n<p class="eyebrow">Documentation</p><h1>Learn Flux.</h1><p class="doc-lead">Start with a complete first project, understand how a project is organised, or go straight to a workspace, the Python plotting library or a reference page.</p><div class="docs-start"><a href="/install/"><span class="eyebrow">Step 1</span><h2>Install Flux <span aria-hidden="true">→</span></h2><p>One command on macOS or Linux, then the companions you need.</p><span class="reading-time">5 minutes</span></a><a href="/docs/first-project.html"><span class="eyebrow">Step 2</span><h2>Your first project <span aria-hidden="true">→</span></h2><p>A plot, a figure, a manuscript and a presentation, connected from the start.</p><span class="reading-time">20 minutes · Step by step</span></a><a href="/docs/projects-and-files.html"><span class="eyebrow">Step 3</span><h2>Projects and files <span aria-hidden="true">→</span></h2><p>What lives in a project, how it updates, and what to keep when you share.</p><span class="reading-time">6 minutes · Core concepts</span></a></div><div class="workspace-guides" aria-label="Explore visually"><a href="/docs/figure.html"><img src="/assets/media/figure.webp" width="1500" height="950" alt="A neuroscience figure in Flux" loading="lazy"><span>Compose a figure <b aria-hidden="true">→</b></span></a><a href="/docs/slides.html"><img src="/assets/media/slides.webp" width="1500" height="950" alt="A scientific slide and its animation timeline" loading="lazy"><span>Build a presentation <b aria-hidden="true">→</b></span></a><a href="/docs/semantic-plots.html"><img src="/assets/media/docs/explorer-fluxbox.svg" width="720" height="540" alt="A fluxbox plot with named parts" loading="lazy"><span>Explore a semantic plot <b aria-hidden="true">→</b></span></a></div>${cards}\n\`\`\`\n`);
}
const icon={
 menu:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
 sun:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1"/></svg>',
 arrow:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>',
 external:'<svg class="icon external-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5H5v14h14v-4M12 5h7v7M19 5 9 15"/></svg>'
};
export function header(current=''){
 const nav=[['/docs/','Documentation',current.startsWith('/docs')&&current!=='/docs/fluxplot.html'],['/docs/fluxplot.html','fluxplot',current==='/docs/fluxplot.html'],['/install/','Install',current==='/install/']];
 return `<a class="skip-link" href="#main-content">Skip to content</a><header class="site-header"><div class="header-inner"><a class="wordmark" href="/" aria-label="Flux home"><img src="/assets/brand/flux-mark.svg" alt="" width="40" height="40"><span>Flux</span></a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-navigation">${icon.menu}<span>Menu</span></button><nav class="main-navigation" id="main-navigation" aria-label="Main navigation">${nav.map(([url,title,active])=>`<a href="${url}"${active?' aria-current="page"':''}${url==='/install/'?' class="nav-install"':''}>${title}</a>`).join('')}<a href="https://github.com/fluxsci/flux">GitHub${icon.external}</a></nav><div class="header-actions"><button class="search-open" data-search-open type="button" hidden>Search <kbd>/</kbd></button><label class="theme-select">${icon.sun}<span class="visually-hidden">Appearance</span><select id="appearance" aria-label="Appearance"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><a class="header-start" href="/install/">Install Flux${icon.arrow}</a></div></div></header>`;
}
export function footer(){
 const column=(title,items)=>`<div><h2>${title}</h2>${items.map(([url,label])=>`<a href="${url}">${label}</a>`).join('')}</div>`;
 return `<footer class="site-footer"><div class="footer-inner"><div class="footer-brand"><a class="wordmark" href="/" aria-label="Flux home"><img src="/assets/brand/flux-mark.svg" alt="" width="36" height="36"><span>Flux</span></a><p>A free, open-source desktop workspace for scientific figures, papers, talks and the literature behind them.</p></div><nav class="footer-columns" aria-label="Site map">${column('Flux',[['/install/','Install'],['/docs/','Documentation'],['/docs/first-project.html','Your first project'],['/docs/shortcuts.html','Keyboard shortcuts'],['/docs/connect.html','Connect an AI agent']])}${column('fluxplot',[['/docs/fluxplot.html','Quickstart'],['/docs/semantic-plots.html','Semantic plots'],['/docs/fluxplot-api.html','Python API reference'],['https://github.com/fluxsci/fluxplot','fluxplot on GitHub']])}${column('Project',[['https://github.com/fluxsci/flux','Flux on GitHub'],['https://github.com/fluxsci/flux/issues','Report an issue'],['/docs/contributing.html','Contributing and support'],['/docs/visual-credits.html','Visual and data credits']])}</nav><div class="footer-bottom"><span>Free and open source under the MIT license · macOS and Linux</span><a href="#main-content">Back to top ↑</a></div></div></footer>`;
}
const searchDialog=`<dialog class="search-dialog" id="docs-search" aria-labelledby="search-title"><div class="search-heading"><h2 id="search-title">Search the docs</h2><button type="button" data-search-close aria-label="Close search">Esc</button></div><label class="visually-hidden" for="search-query">Search documentation</label><input type="search" id="search-query" placeholder="Try “figures”, “3D”, or “export”…" autocomplete="off"><p class="search-status" role="status">Search guides, workspaces, and reference topics.</p><ul class="search-results" aria-label="Search results"></ul><p class="search-help">↑ ↓ to move · Enter to open · Esc to close</p></dialog>`;
const mediaDialog=`<dialog class="media-dialog" id="media-dialog" aria-labelledby="media-dialog-caption"><div class="media-dialog-inner"><button class="dialog-close" type="button" aria-label="Close enlarged image">Close ×</button><img id="media-dialog-image" alt=""><p id="media-dialog-caption"></p></div></dialog>`;
export async function decorateDocuments(){
 const search=[];
 for(const route of routes){
  const filename=path.join(OUTPUT,route.output),$=load(await readFile(filename,'utf8'));
  $('link[rel="canonical"]').remove();$('head').append(`<link rel="canonical" href="${ORIGIN}${route.url}">`);
  $('meta[property="og:url"]').attr('content',ORIGIN+route.url);
  if(route.kind){
   $('#title-block-header, .quarto-title-block').remove();
   const group=groups.find(g=>g.items.some(item=>item.url===route.url));
   if(route.kind==='guide'){
    $('.eyebrow').first().replaceWith(`<nav class="doc-breadcrumb" aria-label="Breadcrumb"><a href="/docs/">Documentation</a><span aria-hidden="true">/</span><a href="/docs/#${group?.id||'reference'}">${escape(group?.title||'Reference')}</a></nav>`);
    const words=$('body').text().trim().split(/\s+/).length;
    if(!$('.guide-meta').length)$('.doc-lead').first().after(`<div class="guide-meta"><span>${Math.max(2,Math.round(words/220))} min read</span><span>${escape(group?.title||'Flux guide')}</span></div>`);
   }
   $('h2[id],h3[id]').each((i,el)=>{const heading=$(el);heading.append(`<a class="heading-link" href="#${heading.attr('id')}" aria-label="Link to ${escape(heading.text())}"><span aria-hidden="true">#</span></a>`);});
   // Wide reference tables scroll inside the column instead of squeezing their last column.
   // Pipe tables escape | inside code spans; the escape is not part of the command.
   $('table code').each((i,el)=>{const code=$(el);if(code.text().includes('\\|'))code.text(code.text().replace(/\\\|/g,'|'));});
   // Long slash-, pipe- or comma-joined tokens get break opportunities so a reference table never forces a sideways scroll.
   $('td').each((i,el)=>{$(el).contents().each(function(){walkText(this);});});
   function walkText(node){if(node.type==='text'){if(/\S{22,}/.test(node.data)&&/[\/|,]/.test(node.data)){$(node).replaceWith(escape(node.data).replace(/\S{22,}/g,tok=>tok.replace(/([\/|,])(?=\S)/g,'$1<wbr>')));}}else if(node.type==='tag'&&node.name!=='wbr'){$(node).contents().each(function(){walkText(this);});}}
   $('table').each((i,el)=>{const table=$(el);if(table.parent().hasClass('table-wrap'))return;const columns=table.find('thead th').length||table.find('tr').first().children().length;table.wrap(`<div class="table-wrap" data-columns="${columns}" tabindex="0" role="region" aria-label="${escape(table.find('caption').text().trim()||'Table, scrolls sideways on narrow screens')}"></div>`);});
   // Scrollable diagrams are reachable from the keyboard too.
   $('.doc-diagram').attr('tabindex','0');
   const content=$('body').html();
   // Minimal Quarto documents have no app chrome. The site owns the shared frame.
   const headings=$($('h2[id]').length<=2?'h2[id],h3[id]':'h2[id]').toArray().map(el=>({title:$(el).clone().find('.heading-link').remove().end().text(),id:$(el).attr('id')}));
   const toc=route.kind==='directory'?'':`<aside class="doc-toc" aria-label="On this page"><p>On this page</p><nav>${headings.map(h=>`<a href="#${h.id}">${escape(h.title.replace(/^\d+\.\s*/,''))}</a>`).join('')}</nav></aside>`;
   const side=route.kind==='install'?'':`<aside class="docs-sidebar"><details class="docs-mobile-nav" open><summary>Browse documentation</summary><nav aria-label="Documentation"><a class="docs-overview" href="/docs/"${route.url==='/docs/'?' aria-current="page"':''}>Documentation home</a>${groups.map((g,i)=>`<details class="docs-nav-group" ${i===0||g.items.some(item=>item.url===route.url)?'open':''}><summary>${escape(g.title)}</summary>${g.items.map(item=>link(item,route.url)).join('')}</details>`).join('')}</nav></details></aside>`;
   // Previous and next run through the whole reading order, so no section ends in a dead end.
   const sequence=groups.flatMap(g=>g.items.map(item=>({...item,group:g.title}))),current=sequence.findIndex(item=>item.url===route.url);
   const pageLinks=route.kind==='guide'?`<nav class="guide-pagination" aria-label="Previous and next guide">${[sequence[current-1],sequence[current+1]].map((item,i)=>item?`<a href="${item.url}"><span>${i?'Next →':'← Previous'}${item.group!==group?.title?` · ${escape(item.group)}`:''}</span><strong>${escape(item.title)}</strong></a>`:'<span></span>').join('')}</nav>`:'';
   $('body').html(`${header(route.url)}<div class="docs-layout ${route.kind==='install'?'install-layout':''} ${route.kind==='directory'?'directory-layout':''}">${side}<main id="main-content" class="doc-content ${route.kind==='directory'?'docs-directory':''}" data-page="${route.output.replace(/^docs\//,'').replace(/\/?index\.html$|\.html$/,'')}">${content}${pageLinks}<div class="doc-source"><a href="https://github.com/fluxsci/fluxsci.github.io/blob/main/site/${route.source}">Improve this page on GitHub ↗</a></div></main>${toc}</div>${footer()}${mediaDialog}${searchDialog}`);
   search.push({title:route.title,url:route.url,description:$('.doc-lead').text().trim(),text:$('.doc-content').text().replace(/\s+/g,' ').trim(),external:false});
  }else{
   // The homepage and the error page keep their own main content inside the shared frame.
   $('#title-block-header, .quarto-title-block').remove();
   const main=$('body').html();
   $('body').html(`${header(route.url)}${main}${footer()}${mediaDialog}${searchDialog}`);
  }
  // Let keyboard users scroll code examples that overflow on narrow screens.
  $('pre').attr('tabindex','0');
  $('pre').each((i,el)=>{const pre=$(el),code=pre.find('code');if(!code.length||code.hasClass('language-text'))return;const id=`copy-code-${i}`;pre.attr('id',id).addClass('copyable-code');pre.after(`<button class="copy-code" type="button" data-copy="${id}" aria-label="Copy command or code" hidden>Copy</button>`);pre.add(pre.next()).wrapAll('<div class="code-example"></div>');});
  await writeFile(filename,$.html());
 }
 const local=new Set(search.map(x=>x.url));
 for(const group of groups)for(const item of group.items)if(!local.has(item.url))search.push({...item,text:group.title+' '+item.description});
 await writeFile(path.join(OUTPUT,'search-index.json'),JSON.stringify(search)+'\n');
}
