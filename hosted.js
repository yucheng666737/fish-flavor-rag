'use strict';
const express = require('express');
const { createHash, timingSafeEqual } = require('node:crypto');
const { createApp } = require('./src/app');
const { loadConfig } = require('./src/config');
const { createOpenAI } = require('./src/openai');

const digest = value => createHash('sha256').update(value).digest();

function createHostedApp(env, provider) {
  const config = loadConfig(env);
  const host = env.RENDER_EXTERNAL_HOSTNAME;
  if (!/^[a-z0-9-]+\.onrender\.com$/.test(host || '') ||
      !env.DEMO_PASSWORD || env.DEMO_PASSWORD.length < 20 ||
      config.store !== 'pinecone' || !config.apiKey || !config.pineconeApiKey) {
    throw new Error('Missing protected demo settings');
  }
  config.publicOrigin = 'https://' + host;
  const auth = digest('Basic ' + Buffer.from('interview:' + env.DEMO_PASSWORD).toString('base64'));
  const app = express();
  app.disable('x-powered-by');
  app.get('/livez', (_req, res) => res.sendStatus(200));
  let day = '';
  let calls = 0;
  app.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    if (req.headers.host !== host) return res.sendStatus(403);
    if (!timingSafeEqual(auth, digest(req.get('Authorization') || ''))) {
      res.set('WWW-Authenticate', 'Basic realm="Interview demo", charset="UTF-8"');
      return res.sendStatus(401);
    }
    next();
  });
  app.use('/api', (_req, res, next) => {
    const today = new Date().toISOString().slice(0, 10);
    if (day !== today) { day = today; calls = 0; }
    if (calls >= 100) return res.status(429).json({message: '本次展示的查詢額度已用完。'});
    calls++;
    next();
  });
  app.use(createApp(config, provider || createOpenAI(config)));
  return app;
}

if (require.main === module) {
  const config = loadConfig();
  createHostedApp(process.env).listen(config.port, '0.0.0.0');
}
module.exports = { createHostedApp };
