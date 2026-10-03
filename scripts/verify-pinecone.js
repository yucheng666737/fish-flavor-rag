'use strict';
const assert = require('node:assert/strict');
const { loadEnv, loadConfig } = require('../src/config');
const { createOpenAI } = require('../src/openai');
const { createApp } = require('../src/app');
const { loadIndex, retrieve } = require('../src/pinecone-store');
const { AppError } = require('../src/errors');
loadEnv();
(async () => {
  const config = { ...loadConfig(), store: 'pinecone' };
  const provider = createOpenAI(config);
  const index = await loadIndex(config);
  const hits = await retrieve(config, provider, '檸檬的風味特色與搭配方向是什麼？', { sources: ['lemon.md'] });
  assert.ok(hits.some(c => c.source === 'lemon.md' && c.text.includes('檸檬')));
  const server = createApp(config, provider).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.storage, 'pinecone');
    assert.equal(health.status, 'ready');
    for (const section of ['flavor', 'nutrition', 'usage']) {
      const res = await fetch(`${base}/api/rag-recommend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity: 'custom', elements: ['fishessence','lemon','honey','ginger'], section }) });
      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.insufficient_evidence, false);
      assert.ok(data.answer.length > 0 && data.sources.length > 0);
      assert.doesNotMatch(data.answer, /蘇蔡|牧田|MU10|露露魚淬/i);
    }
    for (const elementName of ['honey', 'lavender']) {
      const res = await fetch(`${base}/api/rag-recommend`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ identity:'custom', elementName }) });
      const data = await res.json();
      assert.equal(res.status, 200);
      assert.ok(data.recommended_elements.length >= 2);
    }
    console.log(JSON.stringify({ passed: true, storage: 'pinecone', chunks: index.chunkCount, checks: ['cloud_text_retrieval', 'health', 'flavor', 'nutrition', 'usage'] }, null, 2));
  } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
})().catch(error => {
  console.error(error instanceof AppError ? `${error.code}: ${error.message}` : 'PINECONE_VERIFICATION_FAILED: 真實雲端驗證未通過。');
  process.exitCode = 1;
});
