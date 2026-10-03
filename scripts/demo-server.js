'use strict';
// Desktop launcher protocol: only this process's loopback URL goes to stdout.
const { loadEnv, loadConfig } = require('../src/config');
const { createApp } = require('../src/app');
const { createOpenAI } = require('../src/openai');
loadEnv();
try {
  const config = loadConfig();
  const server = createApp(config, createOpenAI(config)).listen(0, '127.0.0.1', () => {
    console.log(`DEMO_READY:http://127.0.0.1:${server.address().port}/`);
  });
  server.on('error', () => { console.error('DEMO_FAILED'); process.exitCode = 1; });
  let stopping = false;
  function stop() {
    if (stopping) return;
    stopping = true;
    server.close(() => process.exit(0));
    server.closeAllConnections();
    setTimeout(() => process.exit(0), 1500).unref();
  }
  process.stdin.setEncoding('utf8');
  let input = '';
  process.stdin.on('data', data => { input += data; if (input.includes('STOP\n')) stop(); });
  process.stdin.on('end', stop);
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
} catch { console.error('DEMO_CONFIG_FAILED'); process.exitCode = 1; }
