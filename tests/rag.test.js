'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const httpClient = require('node:http');
const { loadConfig } = require('../src/config');
const { readCorpus, splitText } = require('../src/corpus');
const { ingest, loadIndex, retrieve, cosine } = require('../src/store');
const { answerQuestion, validateAnswer, recommendationQuery, recommendationSources } = require('../src/rag');
const { createOpenAI } = require('../src/openai');
const { createApp } = require('../src/app');

// Deliberately deterministic test doubles. These tests do not validate real OpenAI quality or connectivity.
test('all twelve design flavors have document-backed next steps even when model omits them', async t => {
  const { config, provider } = await fixture(t);
  config.knowledgeDir = path.join(config.root, 'knowledge/demo');
  config.minScore = 0;
  await ingest(config, provider);
  const base = await http(t, config, provider);
  for (const elementName of ['lemon','honey','ginger','lavender','mint','vanilla','cinnamon','orange','rose','chamomile','cranberry','goji']) {
    const res = await fetch(`${base}/api/rag-recommend`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({identity:'custom',elementName}) });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.recommended_elements.length >= 2, elementName);
    assert.ok(data.recommended_elements.every(r => r.citation_ids.every(id => data.sources.some(s => s.id === id && s.file === `${elementName}.md`))));
  }
  const fish = await fs.readFile(path.join(config.knowledgeDir,'nutrition-fish.md'),'utf8');
  assert.doesNotMatch(fish.match(/^呈現摘要：(.+)$/m)[1], /MU10|牧田|露露|11克|900毫克/);
});
function fakeProvider() {
  return {
    calls: { embed: 0, generate: 0 },
    async embed(texts) {
      this.calls.embed++;
      return texts.map(text => text.includes('檸檬') ? [1, 0, 0] : text.includes('蜂蜜') ? [0, 1, 0] : [0, 0, 1]);
    },
    async generate(query, contexts) {
      this.calls.generate++;
      const c = contexts[0];
      return { answer: `${c.text} [${c.id}]`, insufficient_evidence: false, citation_ids: [c.id], recommended_elements: [] };
    },
  };
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fish-rag-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const knowledgeDir = path.join(root, 'knowledge');
  await fs.mkdir(knowledgeDir);
  await fs.writeFile(path.join(knowledgeDir, 'lemon.md'), '# 檸檬\n檸檬的設計特色為柑橘酸香。');
  await fs.writeFile(path.join(knowledgeDir, 'honey.md'), '# 蜂蜜\n蜂蜜的設計特色為蜜香。');
  const config = { ...loadConfig({}), knowledgeDir, indexPath: path.join(root, 'index.json'), apiKey: 'test-only', minScore: .7 };
  return { config, provider: fakeProvider(), root };
}
async function http(t, config, provider) {
  const server = createApp(config, provider).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}
const post = (base, body, headers = {}) => fetch(`${base}/api/rag`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('baseline: original startup refuses to serve without both API keys (no dependencies executed)', async t => {
  const file = path.join(__dirname, '../baseline/server.js');
  try { await fs.access(file); } catch { t.skip('Original private baseline is not distributed'); return; }
  const source = await fs.readFile(file, 'utf8');
  const marker = new Error('BASELINE_EXIT');
  let exitCode;
  const stubs = { express: () => { throw new Error('Should not reach Express'); }, cors() {}, '@pinecone-database/pinecone': { Pinecone() {} }, openai: { OpenAI() {} }, dotenv: { config() {} }, path };
  assert.throws(() => vm.runInNewContext(source, {
    require: name => stubs[name], process: { env: {}, exit(code) { exitCode = code; throw marker; } }, console: { error() {} },
  }), error => error === marker);
  assert.equal(exitCode, 1);
});
test('corpus covers every draggable ingredient and base, no API required for dry run', async () => {
  const config = loadConfig({});
  const corpus = await readCorpus(config.knowledgeDir);
  const html = await fs.readFile(path.join(config.root, 'public/flavor.html'), 'utf8');
  const ingredients = [...html.matchAll(/data-element="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ingredients.length, 12);
  for (const name of [...ingredients, 'fishessence', 'recipe-rules']) assert.ok(corpus.chunks.some(c => c.source === `${name}.md`));
  const result = await ingest(config, { embed() { throw new Error('No API in dry run'); } }, { dryRun: true });
  assert.equal(result.files, 30);
});
test('chunking is bounded with overlap and no empty chunks', () => {
  const parts = splitText('甲'.repeat(1700));
  assert.ok(parts.length >= 3);
  assert.ok(parts.every(c => c.length <= 700 && c.length > 0));
  assert.equal(parts[0].slice(-100), parts[1].slice(0, 100));
});
test('adding and removing a flavor restores every original flavor score', async () => {
  const source = await fs.readFile(path.join(__dirname, '../public/js/flavor.js'), 'utf8');
  const baseline = { freshness: 0, richness: 6, sweetness: 0, naturalness: 3, aftertaste: 5 };
  const context = vm.createContext({ window: { flavorStats: { ...baseline } }, document: { addEventListener() {} }, console: { log() {} } });
  vm.runInContext(source, context);
  for (const type of ['清新', '濃郁', '甘甜', '天然', '持久']) {
    context.updateFlavorStats(type);
    context.decreaseFlavorStats(type);
  }
  assert.deepEqual(context.window.flavorStats, baseline);
});
test('report proportions respect the base, repeated selections and unallocated remainder', () => {
  const { calculate } = require('../public/js/recipe-model');
  const recipe = calculate([{ name: 'fishessence' }, { name: 'lemon', display: '<script>' }, { name: 'lemon' }]);
  assert.equal(recipe.filled, 70);
  assert.deepEqual(recipe.proportions, { '鱸魚精': 50, '檸檬': 20, '未配置': 30 });
  assert.equal(recipe.stats.freshness, 4);
  assert.equal(calculate(null).filled, 50);
  assert.equal(calculate(Array(20).fill({ name: 'honey' })).filled, 100);
  assert.equal(recipe.elements[1].display, '檸檬');
});
test('secret-like documents are blocked before embedding', async t => {
  const { config, provider } = await fixture(t);
  await fs.writeFile(path.join(config.knowledgeDir, 'private.txt'), 'OPENAI_API_KEY=sk-' + 'test'.repeat(10));
  await assert.rejects(ingest(config, provider), { code: 'SECRET_IN_SOURCE' });
  assert.equal(provider.calls.embed, 0);
});
test('empty corpus fails explicitly', async t => {
  const { config } = await fixture(t);
  const empty = path.join(path.dirname(config.knowledgeDir), 'empty');
  await fs.mkdir(empty);
  await assert.rejects(readCorpus(empty), { code: 'EMPTY_CORPUS' });
});
test('ingest -> persist -> retrieve -> generate returns actual source excerpts', async t => {
  const { config, provider } = await fixture(t);
  const stats = await ingest(config, provider);
  assert.equal(stats.chunks, 2);
  const result = await answerQuestion(config, provider, '檸檬特色？');
  assert.equal(result.sources[0].file, 'lemon.md');
  assert.match(result.sources[0].excerpt, /柑橘酸香/);
  assert.equal(result.insufficient_evidence, false);
  assert.equal(provider.calls.generate, 1);
});
test('reindex removes deleted documents and reflects changed content', async t => {
  const { config, provider } = await fixture(t);
  await ingest(config, provider);
  const old = await loadIndex(config);
  await fs.unlink(path.join(config.knowledgeDir, 'honey.md'));
  await fs.writeFile(path.join(config.knowledgeDir, 'lemon.md'), '# 檸檬\n檸檬的新來源內容。');
  await assert.rejects(loadIndex(config), { code: 'INDEX_STALE' });
  await ingest(config, provider);
  const updated = await loadIndex(config);
  assert.equal(updated.chunks.length, 1);
  assert.notEqual(updated.chunks[0].id, old.chunks.find(c => c.source === 'lemon.md').id);
});
test('failed ingestion preserves previous index', async t => {
  const { config, provider } = await fixture(t);
  await ingest(config, provider);
  const before = await fs.readFile(config.indexPath, 'utf8');
  await assert.rejects(ingest(config, { embed: async () => [[NaN], [1]] }), { code: 'INVALID_EMBEDDING' });
  assert.equal(await fs.readFile(config.indexPath, 'utf8'), before);
});
test('changing embedding model is rejected before querying API', async t => {
  const { config, provider } = await fixture(t);
  await ingest(config, provider);
  await assert.rejects(retrieve({ ...config, embeddingModel: 'other-model' }, provider, '檸檬'), { code: 'INDEX_MODEL_MISMATCH' });
  assert.equal(provider.calls.embed, 1);
});
test('zero, NaN and mismatched vectors are rejected', () => {
  for (const v of [[0, 0], [NaN, 1], [1]]) assert.throws(() => cosine([1, 0], v), { code: 'INVALID_EMBEDDING' });
  assert.equal(cosine([1, 0], [0, 1]), 0);
});
test('low relevance abstains without invoking generation', async t => {
  const { config, provider } = await fixture(t);
  await ingest(config, provider);
  const answer = await answerQuestion(config, provider, '天文資料？');
  assert.equal(answer.insufficient_evidence, true);
  assert.deepEqual(answer.sources, []);
  assert.equal(provider.calls.generate, 0);
});
test('fabricated citations, uncited answers, malformed and mixed refusal output rejected', () => {
  const contexts = [{ id: 'real-source' }];
  const good = { answer: '內容 [real-source]', insufficient_evidence: false, citation_ids: ['real-source'], recommended_elements: [] };
  assert.equal(validateAnswer(good, contexts), good);
  for (const answer of [null, { ...good, citation_ids: ['invented'] }, { ...good, citation_ids: [] }, { ...good, insufficient_evidence: true }, { ...good, answer: '內容 [invented]' }, { ...good, recommended_elements: [{ element: '檸檬', reason: '原因', citation_ids: [] }] }]) {
    assert.throws(() => validateAnswer(answer, contexts), { code: 'UNGROUNDED_ANSWER' });
  }
});
test('recommendations validate known ingredients and identities', () => {
  assert.match(recommendationQuery({ identity: 'custom', elementName: 'lemon' }), /檸檬/);
  for (const body of [{ identity: 'unknown', elementName: 'lemon' }, { identity: 'custom', elementName: '<script>' }, { identity: 'custom', elements: [] }]) assert.throws(() => recommendationQuery(body));
});
test('nutrition and usage use only the relevant knowledge for selected ingredients', async t => {
  const { config, provider } = await fixture(t);
  config.knowledgeDir = path.join(config.root, 'knowledge/demo');
  config.minScore = 0;
  await ingest(config, provider);
  const base = await http(t, config, provider);
  for (const section of ['nutrition', 'usage']) {
    for (const elements of [['fishessence'], ['fishessence', 'lemon', 'honey', 'ginger'], ['fishessence', 'lavender', 'rose', 'chamomile', 'goji', 'mint']]) {
      const body = { identity: 'custom', elements, section };
      let retrievedSources;
      const generate = fakeProvider().generate;
      provider.generate = function(query, contexts) {
        retrievedSources = contexts.map(c => c.source);
        return generate.call(this, query, contexts);
      };
      const response = await fetch(`${base}/api/rag-recommend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.insufficient_evidence, false);
      const allowed = recommendationSources(body);
      assert.ok(data.sources.every(s => allowed.includes(s.file)));
      if (section === 'nutrition') {
        assert.equal(retrievedSources, undefined, 'nutrition must not invoke the generator');
        assert.equal(data.answer_mode, 'retrieved_reference');
        assert.equal(data.models.generation, null);
        assert.equal(data.sources.length, elements.length);
        for (const source of data.sources) {
          const summary = source.excerpt.match(/^呈現摘要：(.+)$/m)[1];
          assert.ok(data.answer.includes(summary), 'reviewed form, units and numbers must remain unchanged');
        }
        assert.doesNotMatch(data.answer, /本專案|本網站|未提供|無法計算/);
        continue;
      }
      assert.deepEqual(new Set(retrievedSources), new Set(allowed));
      assert.ok(data.sources.every(s => allowed.includes(s.file)));
      if (!elements.includes('honey')) assert.ok(retrievedSources.every(s => !s.includes('honey')));
    }
  }
  assert.throws(() => recommendationQuery({ identity: 'custom', elements: ['fishessence'], section: '../../.env' }), { code: 'INVALID_SECTION' });
});
test('API health and static pages run without credentials', async t => {
  const { config, provider } = await fixture(t);
  config.apiKey = '';
  const base = await http(t, config, provider);
  assert.equal((await fetch(`${base}/`)).status, 200);
  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.api_key_configured, false);
  assert.equal(health.code, 'INDEX_MISSING');
  const response = await post(base, { query: '檸檬' });
  assert.equal(response.status, 503);
  assert.equal(provider.calls.embed, 0);
});
test('HTTP RAG and legacy recommendation routes return grounded results', async t => {
  const { config, provider } = await fixture(t);
  await ingest(config, provider);
  const base = await http(t, config, provider);
  const response = await post(base, { query: '檸檬' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sources[0].file, 'lemon.md');
  const legacy = await fetch(`${base}/api/rag-recommend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity: 'office', elementName: 'lemon' }) });
  assert.equal(legacy.status, 200);
  assert.ok((await legacy.json()).benefit_description);
});
test('source, environment, knowledge, index and path traversal are not served', async t => {
  const { config, provider } = await fixture(t);
  const base = await http(t, config, provider);
  for (const file of ['/server.js', '/.env', '/package.json', '/knowledge/demo/lemon.md', '/.data/index.json', '/src/openai.js', '/baseline/server.js', '/%2e%2e%2fserver.js']) {
    assert.equal((await fetch(base + file)).status, 404, file);
  }
});
test('cross-site requests and arbitrary Host headers are blocked', async t => {
  const { config, provider } = await fixture(t);
  const base = await http(t, config, provider);
  assert.equal((await post(base, { query: '檸檬' }, { Origin: 'https://evil.example' })).status, 403);
  // Node fetch controls Host itself; use the low-level client to actually send a forged Host.
  const hostStatus = await new Promise((resolve, reject) => {
    httpClient.get(base, { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject);
  });
  assert.equal(hostStatus, 403);
  assert.equal(provider.calls.embed, 0);
});
test('invalid JSON, oversized input, invalid query and content type rejected', async t => {
  const { config, provider } = await fixture(t);
  const base = await http(t, config, provider);
  assert.equal((await post(base, { query: 'x'.repeat(9000) })).status, 413);
  assert.equal((await post(base, { query: 'x'.repeat(501) })).status, 400);
  assert.equal((await post(base, { query: null })).status, 400);
  assert.equal((await fetch(`${base}/api/rag`, { method: 'POST', body: 'x' })).status, 415);
  assert.equal((await fetch(`${base}/api/rag`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
  assert.equal(provider.calls.embed, 0);
});
test('request quota protects paid endpoints', async t => {
  const { config, provider } = await fixture(t);
  const base = await http(t, config, provider);
  for (let i = 0; i < 30; i++) await post(base, { query: '' });
  assert.equal((await post(base, { query: '檸檬' })).status, 429);
});
test('OpenAI adapter uses a fixed host, bearer header and structured output', async () => {
  const config = { ...loadConfig({}), apiKey: 'sentinel-secret-not-real' };
  const requests = [];
  const provider = createOpenAI(config, async (url, init) => {
    requests.push({ url, ...init });
    if (url.endsWith('/embeddings')) return Response.json({ data: [{ index: 0, embedding: [1, 2] }] });
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ answer: '答案', citation_ids: ['a'], recommended_elements: [], insufficient_evidence: false }) } }] });
  });
  await provider.embed(['檸檬']);
  await provider.generate('檸檬？', [{ id: 'a', title: '檸檬', source: 'lemon.md', text: '風味' }]);
  assert.equal(requests[0].url, 'https://api.openai.com/v1/embeddings');
  assert.equal(requests[0].headers.Authorization, 'Bearer sentinel-secret-not-real');
  assert.equal(requests[0].redirect, 'error');
  const body = JSON.parse(requests[1].body);
  assert.equal(body.response_format.json_schema.strict, true);
  assert.deepEqual(body.response_format.json_schema.schema.properties.citation_ids.items.enum, ['a']);
  assert.deepEqual(body.response_format.json_schema.schema.properties.recommended_elements.items.properties.citation_ids.items.enum, ['a']);
  assert.equal(body.store, false);
  assert.equal(requests[1].body.includes(config.apiKey), false);
});
test('provider errors never echo key or upstream body', async () => {
  const key = 'sentinel-secret-not-real';
  const provider = createOpenAI({ ...loadConfig({}), apiKey: key }, async () => Response.json({ error: { message: key } }, { status: 401 }));
  await assert.rejects(provider.embed(['檸檬']), e => e.code === 'UPSTREAM_AUTH' && !e.message.includes(key));
});
test('provider refuses missing key, malformed embeddings, refusal and truncation', async () => {
  await assert.rejects(createOpenAI(loadConfig({}), () => { throw new Error('Must not fetch'); }).embed(['a']), { code: 'MISSING_API_KEY' });
  const config = { ...loadConfig({}), apiKey: 'test-only' };
  await assert.rejects(createOpenAI(config, async () => Response.json({ data: [] })).embed(['a']), { code: 'INVALID_EMBEDDING' });
  await assert.rejects(createOpenAI(config, async () => Response.json({ choices: [{ message: { refusal: 'no' }, finish_reason: 'stop' }] })).generate('a', []), { code: 'MODEL_REFUSAL' });
  await assert.rejects(createOpenAI(config, async () => Response.json({ choices: [{ message: { content: '{}' }, finish_reason: 'length' }] })).generate('a', []), { code: 'INCOMPLETE_ANSWER' });
});
