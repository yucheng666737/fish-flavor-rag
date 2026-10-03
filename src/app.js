'use strict';
const express = require('express');
const path = require('node:path');
const { AppError } = require('./errors');
const { loadIndex } = require('./store');
const { answerQuestion, recommendationQuery, recommendationSources } = require('./rag');

function createApp(config, provider) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
    });
    const allowed = new Set([`localhost:${req.socket.localPort}`, `127.0.0.1:${req.socket.localPort}`]);
    if (!allowed.has(req.headers.host)) return next(new AppError('INVALID_HOST', '本機服務不接受此主機名稱。', 403));
    if (req.headers.origin && !new Set([...allowed].map(h => `http://${h}`)).has(req.headers.origin)) return next(new AppError('INVALID_ORIGIN', '不接受跨網站請求。', 403));
    if (req.headers['sec-fetch-site'] === 'cross-site') return next(new AppError('INVALID_ORIGIN', '不接受跨網站請求。', 403));
    next();
  });
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use(express.json({ limit: '8kb', strict: true }));
  app.get('/api/health', async (req, res) => {
    let index;
    try { index = await loadIndex(config); } catch (error) {
      return res.json({ status: 'setup_required', api_key_configured: Boolean(config.apiKey), index_ready: false, code: error.code || 'INDEX_UNAVAILABLE', message: error instanceof AppError ? error.message : '無法讀取索引。' });
    }
    res.json({ status: config.apiKey ? 'ready' : 'setup_required', api_key_configured: Boolean(config.apiKey), index_ready: true, files: index.files, storage: config.store || 'local', chunks: index.chunkCount ?? index.chunks.length, embedding_model: index.embeddingModel, generation_model: config.chatModel, message: config.apiKey ? '索引與本機設定就緒；API 可用性須以實際問答確認。' : '尚未設定 OpenAI API 金鑰。' });
  });
  const attempts = new Map();
  let active = 0;
  app.post(['/api/rag', '/api/rag-recommend'], async (req, res) => {
    if (!req.is('application/json')) throw new AppError('INVALID_CONTENT_TYPE', '請使用 application/json。', 415);
    const now = Date.now(), ip = req.ip;
    for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
    const entry = attempts.get(ip) || { count: 0, until: now + 60000 };
    entry.count++; attempts.set(ip, entry);
    if (entry.count > 30 || active >= 2) { res.set('Retry-After', '60'); throw new AppError('RATE_LIMIT', '請求過於頻繁，請稍後重試。', 429); }
    const query = req.path === '/api/rag-recommend' ? recommendationQuery(req.body) : req.body?.query;
    const sources = req.path === '/api/rag-recommend' ? recommendationSources(req.body) : undefined;
    active++;
    const extractiveNutrition = req.path === '/api/rag-recommend' && req.body.section === 'nutrition';
    const flavorElement = req.path === '/api/rag-recommend' && !req.body.section && !req.body.elements ? req.body.elementName : undefined;
    try { res.json(await answerQuestion(config, provider, query, { sources, extractiveNutrition, flavorElement })); } finally { active--; }
  });
  app.use('/vendor/chart', express.static(path.join(config.root, 'node_modules/chart.js/dist'), { dotfiles: 'deny' }));
  app.use('/vendor/fontawesome', express.static(path.join(config.root, 'node_modules/@fortawesome/fontawesome-free'), { dotfiles: 'deny' }));
  app.use(express.static(path.join(config.root, 'public'), { dotfiles: 'deny', index: 'index.html' }));
  app.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: '找不到此頁面或 API。' } }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.too.large') return res.status(413).json({ error: { code: 'BODY_TOO_LARGE', message: '請求內容過大。' } });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON 格式不正確。' } });
    const known = error instanceof AppError;
    res.status(known ? error.status : 500).json({ error: { code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : '服務暫時無法處理請求。' } });
  });
  return app;
}
module.exports = { createApp };
