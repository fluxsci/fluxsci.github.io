import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createStaticServer } from '../scripts/serve.mjs';

test('preview serves only built public files and returns a real 404', async () => {
  const server = createStaticServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const request = (url, method = 'GET') => new Promise((resolve, reject) => {
    const req = http.request({ host:'127.0.0.1', port, path:url, method }, response => {
      let body = ''; response.on('data', chunk => body += chunk); response.on('end', () => resolve({ status:response.statusCode, headers:response.headers, body }));
    }); req.on('error', reject); req.end();
  });
  try {
    assert.equal((await request('/')).status, 200);
    assert.equal((await request('/does-not-exist')).status, 404);
    assert.equal((await request('/../package.json')).status, 403);
    assert.equal((await request('/%2e%2e/package.json')).status, 403);
    assert.equal((await request('/%2eenv')).status, 403);
    assert.equal((await request('/bad%zz')).status, 400);
    assert.equal((await request('/', 'POST')).status, 405);
    const head = await request('/', 'HEAD'); assert.equal(head.status, 200); assert.equal(head.body, '');
    assert.match(head.headers['content-type'], /text\/html/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
