'use strict';
const { createHash } = require('node:crypto');
const { AppError } = require('./errors');
const { readCorpus } = require('./corpus');
const { validVector, loadIndex: loadLocalIndex } = require('./local-store');
const { createPinecone } = require('./pinecone');
const MANIFEST = '__fish_rag_manifest_v1';
const fail = () => new AppError('PINECONE_DATA', '雲端知識資料不完整或與本機文件不符，請重新匯入。');

function namespaceFor(config, hash) {
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(config.pineconeNamespace || '')) throw new AppError('PINECONE_CONFIG', 'PINECONE_NAMESPACE 請使用 1–32 位英數字、底線或連字號。');
  const version = createHash('sha256').update(`${hash}:${config.embeddingModel}`).digest('hex').slice(0, 32);
  return `${config.pineconeNamespace}-${version}`;
}
function metadata(chunk, config, hash) {
  return { kind: 'chunk', text: chunk.text, source: chunk.source, title: chunk.title, chunk: chunk.chunk, model: config.embeddingModel, corpusHash: hash };
}
function equalMetadata(actual, expected) {
  return actual && Object.entries(expected).every(([key, value]) => actual[key] === value);
}
async function context(config, client) {
  const corpus = await readCorpus(config.knowledgeDir);
  const info = await client.describe();
  return { corpus, dimension: info.dimension, namespace: namespaceFor(config, corpus.hash) };
}
async function ready(config, client, ctx) {
  const result = await client.fetch([MANIFEST], ctx.namespace);
  const m = result.vectors?.[MANIFEST]?.metadata;
  if (!equalMetadata(m, { kind: 'manifest', model: config.embeddingModel, corpusHash: ctx.corpus.hash, chunks: ctx.corpus.chunks.length, dimension: ctx.dimension, files: ctx.corpus.files })) {
    throw new AppError('PINECONE_NOT_INGESTED', '此版本知識文件尚未完成 Pinecone 匯入，請執行 npm run pinecone:migrate 或 npm run ingest。');
  }
  return { version: 1, storage: 'pinecone', embeddingModel: m.model, dimension: m.dimension, corpusHash: m.corpusHash, files: m.files, chunkCount: m.chunks, namespace: ctx.namespace };
}
async function loadIndex(config, client = createPinecone(config)) {
  return ready(config, client, await context(config, client));
}

// A content-versioned namespace prevents deleted/changed documents from appearing in new searches.
// Publish the ready marker only after every text/vector record has been fetched and verified.
async function publish(config, index, client = createPinecone(config), pause = ms => new Promise(r => setTimeout(r, ms))) {
  const ctx = await context(config, client);
  if (index.corpusHash !== ctx.corpus.hash || index.embeddingModel !== config.embeddingModel || index.dimension !== ctx.dimension || index.chunks.length !== ctx.corpus.chunks.length) throw fail();
  const originals = new Map(ctx.corpus.chunks.map(c => [c.id, c]));
  const records = index.chunks.map(c => {
    const original = originals.get(c.id);
    if (!original || !equalMetadata(c, original) || !validVector(c.vector, ctx.dimension)) throw fail();
    return { id: c.id, values: c.vector, metadata: metadata(c, config, ctx.corpus.hash) };
  });
  if (new Set(records.map(r => r.id)).size !== records.length) throw fail();
  for (let i = 0; i < records.length; i += 32) {
    const batch = records.slice(i, i + 32);
    const response = await client.post('/vectors/upsert', { namespace: ctx.namespace, vectors: batch });
    if (response.upsertedCount !== batch.length) throw fail();
  }
  let verified = false;
  for (let attempt = 0; attempt < 15; attempt++) {
    verified = true;
    for (let i = 0; i < records.length; i += 100) {
      const batch = records.slice(i, i + 100);
      const result = await client.fetch(batch.map(c => c.id), ctx.namespace);
      for (const expected of batch) {
        const got = result.vectors?.[expected.id];
        if (!got || !equalMetadata(got.metadata, expected.metadata) || !validVector(got.values, ctx.dimension) || got.values.some((v,j) => Math.abs(v - expected.values[j]) > 1e-6 * Math.max(1,Math.abs(expected.values[j])))) verified = false;
      }
    }
    if (verified) break;
    if (attempt < 14) await pause(1000);
  }
  if (!verified) throw new AppError('PINECONE_PENDING', 'Pinecone 資料尚未全部可讀，未標記完成；稍後可安全重跑匯入。');
  const marker = { id: MANIFEST, values: records[0].values, metadata: { kind: 'manifest', model: config.embeddingModel, corpusHash: ctx.corpus.hash, chunks: records.length, dimension: ctx.dimension, files: ctx.corpus.files } };
  await client.post('/vectors/upsert', { namespace: ctx.namespace, vectors: [marker] });
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      await ready(config, client, ctx);
      return { storage: 'pinecone', files: ctx.corpus.files, chunks: records.length, dimension: ctx.dimension, namespace: ctx.namespace, embeddingModel: config.embeddingModel };
    } catch (error) {
      if (error.code !== 'PINECONE_NOT_INGESTED' || attempt === 14) throw error;
      await pause(1000);
    }
  }
}
async function migrate(config, client = createPinecone(config)) {
  return publish(config, await loadLocalIndex(config), client);
}
async function ingest(config, provider, { dryRun = false } = {}, client = createPinecone(config)) {
  const corpus = await readCorpus(config.knowledgeDir);
  if (dryRun) return { storage: 'pinecone', files: corpus.files, chunks: corpus.chunks.length, dryRun: true };
  const info = await client.describe();
  const chunks = [];
  for (let i = 0; i < corpus.chunks.length; i += 32) {
    const batch = corpus.chunks.slice(i, i + 32);
    const vectors = await provider.embed(batch.map(c => c.text));
    if (!Array.isArray(vectors) || vectors.length !== batch.length || vectors.some(v => !validVector(v, info.dimension))) throw new AppError('INVALID_EMBEDDING', '嵌入向量與 Pinecone 維度不符。');
    batch.forEach((c, j) => chunks.push({ ...c, vector: vectors[j] }));
  }
  return publish(config, { corpusHash: corpus.hash, embeddingModel: config.embeddingModel, dimension: info.dimension, chunks }, client);
}
async function retrieve(config, provider, query, { sources } = {}, client = createPinecone(config)) {
  const ctx = await context(config, client);
  await ready(config, client, ctx);
  const vectors = await provider.embed([query]);
  const vector = vectors?.[0];
  if (!validVector(vector, ctx.dimension)) throw new AppError('INVALID_EMBEDDING', '查詢向量與 Pinecone 維度不符。');
  const filter = { kind: { $eq: 'chunk' }, model: { $eq: config.embeddingModel }, corpusHash: { $eq: ctx.corpus.hash } };
  if (sources) filter.source = { $in: sources };
  const topK = sources ? Math.min(8, Math.max(config.topK, sources.length)) : config.topK;
  const result = await client.post('/query', { namespace: ctx.namespace, vector, topK, includeMetadata: true, includeValues: false, filter });
  if (!Array.isArray(result.matches)) throw fail();
  const originals = new Map(ctx.corpus.chunks.map(c => [c.id, c]));
  const seen = new Set();
  return result.matches.map(match => {
    const original = originals.get(match.id);
    if (!original || seen.has(match.id) || !Number.isFinite(match.score) || !equalMetadata(match.metadata, metadata(original, config, ctx.corpus.hash)) || (sources && !sources.includes(original.source))) throw fail();
    seen.add(match.id);
    const { text, title, source, chunk } = match.metadata;
    return { id: match.id, text, title, source, chunk, score: match.score };
  }).filter(c => c.score >= config.minScore).sort((a,b) => b.score-a.score).slice(0,topK);
}
module.exports = { ingest, loadIndex, retrieve, migrate, publish, namespaceFor };
