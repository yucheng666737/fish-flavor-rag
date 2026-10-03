'use strict';
const path = require('node:path');
const { AppError } = require('./errors');
const ROOT = path.resolve(__dirname, '..');
function number(value, fallback, min, max, integer = false) {
  const n = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    throw new AppError('INVALID_CONFIG', '數值設定超出允許範圍。');
  }
  return n;
}
function loadConfig(env = process.env) {
  const store = env.RAG_STORE || 'local';
  if (!['local', 'pinecone'].includes(store)) throw new AppError('INVALID_CONFIG', 'RAG_STORE 僅接受 local 或 pinecone。');
  return {
    store,
    pineconeApiKey: env.PINECONE_API_KEY || '',
    pineconeIndex: env.PINECONE_INDEX || 'fish-flavor-rag',
    pineconeNamespace: env.PINECONE_NAMESPACE || 'fish-rag',
    root: ROOT,
    apiKey: env.OPENAI_API_KEY || '',
    embeddingModel: env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    chatModel: env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    knowledgeDir: path.resolve(ROOT, env.RAG_KNOWLEDGE_DIR || 'knowledge/demo'),
    indexPath: path.resolve(ROOT, env.RAG_INDEX_PATH || '.data/index.json'),
    minScore: number(env.RAG_MIN_SCORE, 0.30, 0, 1),
    topK: number(env.RAG_TOP_K, 5, 1, 8, true),
    port: number(env.PORT, 3000, 1, 65535, true),
  };
}
function loadEnv() {
  require('dotenv').config({ path: process.env.RAG_ENV_FILE || path.join(ROOT, '.env'), quiet: true });
}
module.exports = { ROOT, loadConfig, loadEnv };
