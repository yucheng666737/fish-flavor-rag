'use strict';
const { loadConfig, loadEnv } = require('../src/config');
const { createOpenAI } = require('../src/openai');
const { ingest } = require('../src/store');
const { AppError } = require('../src/errors');
loadEnv();
(async () => {
  if (process.argv.slice(2).some(arg => arg !== '--dry-run')) throw new AppError('INVALID_ARGUMENT', '僅支援 --dry-run；資料來源請透過 RAG_KNOWLEDGE_DIR 設定。');
  const config = loadConfig();
  const result = await ingest(config, createOpenAI(config), { dryRun: process.argv.includes('--dry-run') });
  console.log(JSON.stringify(result, null, 2));
})().catch(error => {
  console.error(error instanceof AppError ? `${error.code}: ${error.message}` : '匯入失敗；請檢查本機路徑與寫入權限。');
  process.exitCode = 1;
});
