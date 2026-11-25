'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { AppError } = require('./errors');
const { readCorpus } = require('./corpus');

function validVector(v, dimension) {
  return Array.isArray(v) && v.length > 0 && (!dimension || v.length === dimension)
    && v.every(x => Number.isFinite(x)) && v.some(x => x !== 0);
}
function cosine(a, b) {
  if (!validVector(a) || !validVector(b, a.length)) throw new AppError('INVALID_EMBEDDING', '向量維度或內容無效，請重新建立索引。');
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
async function ingest(config, provider, { dryRun = false } = {}) {
  const corpus = await readCorpus(config.knowledgeDir);
  if (dryRun) return { files: corpus.files, chunks: corpus.chunks.length, dryRun: true };
  const indexed = [];
  let dimension;
  for (let i = 0; i < corpus.chunks.length; i += 32) {
    const batch = corpus.chunks.slice(i, i + 32);
    const vectors = await provider.embed(batch.map(c => c.text));
    if (!Array.isArray(vectors) || vectors.length !== batch.length) throw new AppError('INVALID_EMBEDDING', '向量數量不符，保留舊索引。');
    for (let j = 0; j < batch.length; j++) {
      if (!validVector(vectors[j], dimension)) throw new AppError('INVALID_EMBEDDING', '向量內容無效，保留舊索引。');
      dimension ||= vectors[j].length;
      indexed.push({ ...batch[j], vector: vectors[j] });
    }
  }
  const index = {
    version: 1, embeddingModel: config.embeddingModel, dimension,
    corpusHash: corpus.hash, createdAt: new Date().toISOString(),
    files: corpus.files, chunks: indexed,
  };
  await fs.mkdir(path.dirname(config.indexPath), { recursive: true });
  const temporary = `${config.indexPath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(index), { mode: 0o600, flag: 'wx' });
    await fs.rename(temporary, config.indexPath);
  } finally { await fs.rm(temporary, { force: true }); }
  return { files: index.files, chunks: indexed.length, dimension, embeddingModel: index.embeddingModel };
}
async function loadIndex(config) {
  let data;
  try { data = JSON.parse(await fs.readFile(config.indexPath, 'utf8')); } catch (error) {
    if (error.code === 'ENOENT') throw new AppError('INDEX_MISSING', '尚未建立知識索引，請執行 npm run ingest。');
    throw new AppError('INDEX_INVALID', '索引檔案無法讀取，請重新執行匯入。');
  }
  if (data.version !== 1 || !Array.isArray(data.chunks) || !data.chunks.length
    || !Number.isInteger(data.dimension) || data.dimension <= 0
    || data.chunks.some(c => !c.id || typeof c.text !== 'string' || !c.source || !c.title || !validVector(c.vector, data.dimension))
    || new Set(data.chunks.map(c => c.id)).size !== data.chunks.length) {
    throw new AppError('INDEX_INVALID', '索引結構無效，請重新執行匯入。');
  }
  if (data.embeddingModel !== config.embeddingModel) throw new AppError('INDEX_MODEL_MISMATCH', '嵌入模型已變更，請重新建立索引。');
  const corpus = await readCorpus(config.knowledgeDir);
  if (data.corpusHash !== corpus.hash) throw new AppError('INDEX_STALE', '知識文件已變更，請重新執行 npm run ingest。');
  return data;
}
async function retrieve(config, provider, query, { sources, extractiveNutrition } = {}) {
  const index = await loadIndex(config);
  const [vector] = await provider.embed([query]);
  if (!validVector(vector, index.dimension)) throw new AppError('INVALID_EMBEDDING', '查詢向量與索引維度不同，請檢查模型設定。');
  return index.chunks.filter(chunk => !sources || sources.includes(chunk.source))
    .map(({ vector: stored, ...chunk }) => ({ ...chunk, score: cosine(vector, stored) }))
    .filter(c => c.score >= config.minScore).sort((a, b) => b.score - a.score)
    .slice(0, sources ? Math.min(extractiveNutrition ? 11 : 8, Math.max(config.topK, sources.length)) : config.topK);
}
module.exports = { ingest, loadIndex, retrieve, cosine, validVector };
