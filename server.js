'use strict';
const { loadConfig, loadEnv } = require('./src/config');
const { createOpenAI } = require('./src/openai');
const { createApp } = require('./src/app');
loadEnv();
try {
  const config = loadConfig();
  const server = createApp(config, createOpenAI(config)).listen(config.port, '127.0.0.1', () => {
    console.log(`風味 RAG：http://127.0.0.1:${config.port}/rag.html`);
    console.log('僅監聽本機。金鑰與索引狀態請查看頁面提示。');
  });
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? '連接埠已被占用，請設定其他 PORT。' : '伺服器無法啟動。'); process.exitCode = 1; });
} catch { console.error('設定無效，請檢查 .env 與 README。'); process.exitCode = 1; }
