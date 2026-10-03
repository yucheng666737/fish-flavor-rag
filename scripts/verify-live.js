'use strict';
// This command intentionally uses the real OpenAI API and fails if configuration is missing.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { loadEnv, loadConfig } = require('../src/config');
const { createOpenAI } = require('../src/openai');
const { createApp } = require('../src/app');
const { ingest, loadIndex, cosine } = require('../src/store');
const { answerQuestion } = require('../src/rag');
const { AppError } = require('../src/errors');
loadEnv();
(async () => {
  const config = loadConfig();
  if (config.store === 'pinecone') throw new AppError('USE_PINECONE_CHECK', 'Pinecone 模式請執行 npm run verify:pinecone。');
  if (!config.apiKey) throw new AppError('MISSING_API_KEY', '真實驗證需要本機 .env 的 OPENAI_API_KEY；不會以模擬回覆代替。');
  const provider = createOpenAI(config);
  const stages = [];
  const stats = await ingest(config, provider);
  stages.push({ stage: 'real_embedding_and_persistence', ...stats });
  const flavors = [ ['lemon', '檸檬'], ['honey', '蜂蜜'], ['ginger', '薑汁'], ['lavender', '薰衣草'], ['mint', '薄荷'], ['vanilla', '香草'], ['cinnamon', '肉桂'], ['orange', '柳橙'], ['rose', '玫瑰'], ['chamomile', '洋甘菊'], ['cranberry', '蔓越莓'], ['goji', '枸杞'] ];
  const index = await loadIndex(config);
  const vectors = await provider.embed(flavors.map(([, name]) => `${name}的風味特色與搭配方向是什麼？`));
  const coverage = flavors.map(([id, name], i) => {
    const top = index.chunks.map(c => ({ source: c.source, score: cosine(vectors[i], c.vector) }))
      .filter(c => c.score >= config.minScore).sort((a, b) => b.score - a.score).slice(0, 3);
    return { flavor: name, hit: top.some(c => c.source === `${id}.md`), top_sources: top.map(c => c.source) };
  });
  assert.ok(coverage.every(c => c.hit), 'FLAVOR_RETRIEVAL_COVERAGE_FAILED');
  stages.push({ stage: 'all_flavors_retrieval_top3', passed: coverage.length, total: flavors.length, coverage });
  const server = createApp(config, provider).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [query, expectedSource] of [
      ['檸檬的風味特色是什麼？', 'lemon.md'],
      ['配方鱸魚精基底佔多少？每次加入風味增加多少，最多幾次？', 'recipe-rules.md'],
    ]) {
      const response = await fetch(`${base}/api/rag`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
      const answer = await response.json();
      assert.equal(response.status, 200, answer.error?.code || 'RAG_HTTP_ERROR');
      assert.equal(answer.insufficient_evidence, false);
      assert.ok(answer.sources.some(s => s.file === expectedSource), 'EXPECTED_SOURCE_NOT_CITED');
      stages.push({ stage: 'real_http_rag', query, answer });
    }
    const unavailable = await answerQuestion(config, provider, '公司 2025 年的營業收入精確是多少元？');
    assert.equal(unavailable.insufficient_evidence, true, 'UNSUPPORTED_QUESTION_NOT_ABSTAINED');
    stages.push({ stage: 'unsupported_question_abstention', passed: true });
    // A random fact exists only in a newly indexed document, proving use of retrieved context.
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'fish-rag-live-'));
    try {
      const marker = randomUUID();
      const knowledgeDir = path.join(temp, 'knowledge');
      await fs.mkdir(knowledgeDir);
      await fs.writeFile(path.join(knowledgeDir, 'provenance.md'), `# 本次驗證資料\n本次風味測試批次代碼為 ${marker}。此代碼僅作文件檢索驗證。`);
      const checkConfig = { ...config, knowledgeDir, indexPath: path.join(temp, 'index.json'), minScore: .1 };
      await ingest(checkConfig, provider);
      const check = await answerQuestion(checkConfig, provider, '本次風味測試批次代碼是什麼？請逐字引用完整代碼。');
      assert.ok(check.answer.includes(marker), 'RETRIEVED_RANDOM_FACT_MISSING');
      assert.equal(check.sources[0].file, 'provenance.md');
      stages.push({ stage: 'new_document_random_fact', passed: true });
    } finally { await fs.rm(temp, { recursive: true, force: true }); }
    await fs.mkdir(path.join(config.root, 'artifacts'), { recursive: true });
    await fs.writeFile(path.join(config.root, 'artifacts/live-verification.json'), JSON.stringify({ timestamp: new Date().toISOString(), mode: 'real-openai', stages }, null, 2));
    console.log('PASS: 真實嵌入、12 種風味檢索、HTTP 問答與引用、無資料拒答、新文件隨機事實驗證。');
    console.log('詳細結果：artifacts/live-verification.json（Git 忽略；不含金鑰）。');
  } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
})().catch(error => {
  console.error(error instanceof AppError ? `${error.code}: ${error.message}` : 'LIVE_VERIFICATION_FAILED: 真實驗證未通過；請檢查網路、模型回覆或測試斷言。');
  process.exitCode = 1;
});
