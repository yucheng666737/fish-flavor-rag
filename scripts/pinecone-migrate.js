'use strict';
const { loadConfig, loadEnv } = require('../src/config');
const { migrate } = require('../src/pinecone-store');
const { AppError } = require('../src/errors');
loadEnv();
(async () => {
  if (process.argv.length > 2) throw new AppError('INVALID_ARGUMENT', '此指令不接受命令列參數。');
  const result = await migrate(loadConfig());
  console.log(JSON.stringify({ ...result, reused_local_embeddings: true }, null, 2));
})().catch(error => {
  console.error(error instanceof AppError ? `${error.code}: ${error.message}` : 'PINECONE_MIGRATION_FAILED: 遷移未完成，原本機索引保留。');
  process.exitCode = 1;
});
