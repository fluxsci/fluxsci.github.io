// Rebuild the website-owned social preview from the approved Flux brand assets.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const mark = await readFile(path.join(root, 'site/assets/brand/flux-mark.svg'));
const font = await readFile(path.join(root, 'site/assets/fonts/Gelasio.woff2'));
const browser = await chromium.launch(process.env.SOCIAL_CHROME ? { executablePath: process.env.SOCIAL_CHROME } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Flux social preview</title>
    <style>
      @font-face{font-family:Gelasio;src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');font-weight:400 700}
      *{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;background:#fffcf0;color:#100f0f}
      body{padding:56px 66px;font-family:Gelasio,Georgia,serif;position:relative}
      header{display:flex;align-items:center;gap:12px;font-size:38px;font-weight:700}
      header img{width:46px;height:46px}h1{font-size:74px;line-height:1.08;letter-spacing:-2.8px;font-weight:400;margin:55px 0 24px;max-width:790px}
      p{font:20px/1.6 system-ui,sans-serif;color:#575653;margin:0}
      .modules{position:absolute;left:66px;bottom:48px;right:66px;border-top:1px solid #dad8ce;padding-top:23px;font:16px system-ui,sans-serif;display:flex;justify-content:space-between;color:#575653}
      .bloom{position:absolute;width:250px;height:250px;right:52px;top:176px}
      .site{color:#205ea6}
    </style>
    <header><img alt="" src="data:image/svg+xml;base64,${mark.toString('base64')}">Flux</header>
    <h1>A unified<br>scientific workspace.</h1>
    <p>Your figures, papers, and ideas. Connected for you and your AI collaborators.</p>
    <img class="bloom" alt="" src="data:image/svg+xml;base64,${mark.toString('base64')}">
    <div class="modules"><span>Paper &nbsp;·&nbsp; Figure &nbsp;·&nbsp; Slides &nbsp;·&nbsp; Library &nbsp;·&nbsp; Reader</span><span class="site">fluxsci.github.io</span></div>
  </html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(root, 'site/assets/brand/social-card.png') });
} finally { await browser.close(); }
