import http from 'node:http';
import { createReadStream } from 'node:fs';
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUTPUT, isInside } from './paths.mjs';

const MIME = { '.zip':'application/zip', '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.avif':'image/avif', '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf', '.mp4':'video/mp4', '.webm':'video/webm', '.xml':'application/xml', '.txt':'text/plain; charset=utf-8', '.vtt':'text/vtt' };

export function createStaticServer(root = OUTPUT) {
  return http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow:'GET, HEAD' }); response.end(); return;
    }
    try {
      const pathname = decodeURIComponent((request.url ?? '/').split('?')[0]);
      if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(part => part.startsWith('.'))) {
        response.writeHead(403); response.end('Forbidden'); return;
      }
      let filename = path.resolve(root, `.${pathname}`);
      if (!isInside(root, filename)) { response.writeHead(403); response.end('Forbidden'); return; }
      let stat = await lstat(filename).catch(() => null);
      if (stat?.isDirectory()) { filename = path.join(filename, 'index.html'); stat = await lstat(filename).catch(() => null); }
      let status = 200;
      if (!stat?.isFile() || stat.isSymbolicLink()) { filename = path.join(root, '404.html'); stat = await lstat(filename).catch(() => null); status = 404; }
      if (!stat?.isFile() || !isInside(await realpath(root), await realpath(filename))) { response.writeHead(404); response.end('Not found'); return; }
      const headers = { 'Content-Type': MIME[path.extname(filename)] ?? 'application/octet-stream', 'Content-Length':stat.size };
      response.writeHead(status, headers);
      if (request.method === 'HEAD') response.end();
      else createReadStream(filename).on('error', () => response.destroy()).pipe(response);
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 : 500); response.end('Request failed');
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--port')) throw new Error('Usage: npm run preview -- [--port 1430]');
  const port = Number(args[1] ?? process.env.PORT ?? 1430);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be between 1024 and 65535.');
  await lstat(path.join(OUTPUT, 'index.html')).catch(() => { throw new Error('Run npm run build before npm run preview.'); });
  const server = createStaticServer();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Stop the existing preview or choose PORT.` : error); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Flux website: http://127.0.0.1:${port}`));
}
