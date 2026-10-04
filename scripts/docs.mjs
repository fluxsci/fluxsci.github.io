import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {load} from 'cheerio';
import {ROOT,OUTPUT} from './paths.mjs';
import {routes,groups,ORIGIN} from './routes.mjs';
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(item,current='')=>`<a href="${item.url}"${item.url===current?' aria-current="page"':''}>${escape(item.title)}${item.external?'<span class="upstream-mark" aria-label="on GitHub">↗</span>':''}</a>`;
export async function writeDirectory(){
 const cards=groups.map(g=>`<section class="directory-group" id="${g.id}"><div class="directory-heading"><h2>${escape(g.title)}</h2><span>${String(g.items.length).padStart(2,'0')}</span></div><div class="directory-items">${g.items.map(item=>`<a class="directory-item" href="${item.url}"><h3>${escape(item.title)} <span aria-hidden="true">${item.external?'↗':'→'}</span></h3><p>${escape(item.description)}</p></a>`).join('')}</div></section>`).join('\n');
 await writeFile(path.join(ROOT,'site/docs/index.qmd'),`---\ntitle: "Documentation"\ndescription: "A guide to the whole Flux ecosystem: Paper, Figure, Slides, Library, Reader, fluxplot, AI workflows, integrations, and reference."\n---\n\n\`\`\`{=html}\n<p class="eyebrow">The Flux documentation</p><h1>A place for every<br><em>part of the work.</em></h1><p class="doc-lead">Learn the workflow, explore a workspace, or find the exact command. Start with a small project and follow the connections.</p><div class="docs-start"><a href="/docs/first-project.html"><span class="eyebrow">Start making</span><h2>Your first project <span>→</span></h2><p>A plot, a figure, a manuscript, and a presentation. One connected workflow.</p><span class="reading-time">20 minutes · Step by step</span></a><a href="/docs/projects-and-files.html"><span class="eyebrow">Understand the foundations</span><h2>Projects and files <span>→</span></h2><p>What lives in a project, how it updates, and what to keep when you share.</p><span class="reading-time">6 minutes · Core concepts</span></a></div><p class="migration-note">The guide is moving here. Links marked <span aria-hidden="true">↗</span> open the current reference on GitHub while its new edition is prepared.</p>${cards}\n\`\`\`\n`);
}
function header(current){return `<a class="skip-link" href="#main-content">Skip to content</a><header class="site-header"><div class="header-inner"><a class="wordmark" href="/" aria-label="Flux home"><img src="/assets/brand/flux-mark.svg" alt="" width="40" height="40"><span>Flux</span></a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-navigation">Menu</button><nav class="main-navigation" id="main-navigation" aria-label="Main navigation"><a href="/#explore">Explore</a><a href="/docs/"${current.startsWith('/docs')?' aria-current="page"':''}>Documentation</a><a href="https://github.com/fluxsci/flux">GitHub ↗</a></nav><div class="header-actions"><button class="search-open" data-search-open type="button" hidden>Search <kbd>/</kbd></button><label class="theme-select"><span class="visually-hidden">Appearance</span><select id="appearance" aria-label="Appearance"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><a class="header-start" href="/install/">Install Flux <span aria-hidden="true">↗</span></a></div></div></header>`;}
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
   const content=$('body').html();
   // Minimal Quarto documents have no app chrome. The site owns the shared frame.
   const headings=$('h2[id]').toArray().map(el=>({title:$(el).text(),id:$(el).attr('id')}));
   const toc=route.kind==='directory'?'':`<aside class="doc-toc" aria-label="On this page"><p>On this page</p><nav>${headings.map(h=>`<a href="#${h.id}">${escape(h.title.replace(/^\d+\.\s*/,''))}</a>`).join('')}</nav></aside>`;
   const side=route.kind==='install'?'':`<aside class="docs-sidebar"><details class="docs-mobile-nav" open><summary>Browse documentation</summary><nav aria-label="Documentation"><a class="docs-overview" href="/docs/"${route.url==='/docs/'?' aria-current="page"':''}>Documentation home</a>${groups.map((g,i)=>`<details class="docs-nav-group" ${i<2?'open':''}><summary>${escape(g.title)}</summary>${g.items.map(item=>link(item,route.url)).join('')}</details>`).join('')}</nav></details></aside>`;
   $('body').html(`${header(route.url)}<div class="docs-layout ${route.kind==='install'?'install-layout':''} ${route.kind==='directory'?'directory-layout':''}">${side}<main id="main-content" class="doc-content ${route.kind==='directory'?'docs-directory':''}">${content}<div class="doc-source">Based on the current Flux documentation · <a href="https://github.com/fluxsci/fluxsci.github.io/blob/main/site/${route.source}">Improve this page ↗</a></div></main>${toc}</div><footer class="docs-footer"><a class="wordmark" href="/">Flux</a><p>Built around the work. Built around you.</p><a href="/docs/">Documentation</a><a href="/install/">Installation</a><a href="https://github.com/fluxsci/flux">GitHub ↗</a></footer>${mediaDialog}${searchDialog}`);
   search.push({title:route.title,url:route.url,description:$('.doc-lead').text().trim(),text:$('.doc-content').text().replace(/\s+/g,' ').trim(),external:false});
  }else if(route.url==='/'){
   $('.header-actions').prepend('<button class="search-open" data-search-open type="button" hidden>Search <kbd>/</kbd></button>');$('body').append(searchDialog);
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
