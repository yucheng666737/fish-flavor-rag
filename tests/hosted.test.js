'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createHostedApp } = require('../hosted');

test('interview gate protects pages and APIs before provider access', async t => {
  const host = 'test-demo.onrender.com';
  const env = { RENDER_EXTERNAL_HOSTNAME: host, DEMO_PASSWORD: 'test-only-password-12345',
    RAG_STORE: 'pinecone', OPENAI_API_KEY: 'test', PINECONE_API_KEY: 'test' };
  assert.throws(() => createHostedApp({...env, DEMO_PASSWORD: ''}));
  const server = createHostedApp(env).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const auth = 'Basic ' + Buffer.from('interview:' + env.DEMO_PASSWORD).toString('base64');
  function request(path, headers = {}, method = 'GET') {
    return new Promise((resolve, reject) => {
      const req = http.request({hostname: '127.0.0.1', port: server.address().port,
        path, headers: {Host: host, ...headers}, method}, res => {
        res.resume(); res.on('end', () => resolve(res.statusCode));
      });
      req.on('error', reject); req.end();
    });
  }
  assert.equal(await request('/livez'), 200);
  for (const path of ['/', '/api/health', '/api/rag', '/api/rag-recommend']) {
    assert.equal(await request(path, {}, path.includes('rag') ? 'POST' : 'GET'), 401);
  }
  assert.equal(await request('/', {Authorization: auth}), 200);
  assert.equal(await request('/', {Authorization: auth, Origin: 'https://other.example'}), 403);
  for (let i = 0; i < 100; i++) assert.equal(await request('/api/rag', {Authorization: auth}, 'POST'), 415);
  assert.equal(await request('/api/rag', {Authorization: auth}, 'POST'), 429);
});
