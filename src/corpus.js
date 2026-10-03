'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { AppError } = require('./errors');
const digest = text => createHash('sha256').update(text).digest('hex');
const CHUNK_SIZE = 700;
const OVERLAP = 100;

function splitText(text) {
  const clean = text.replace(/\r\n/g, '\n').trim();
  const chunks = [];
  for (let start = 0; start < clean.length;) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);
    if (end < clean.length) {
      const breakAt = clean.lastIndexOf('\n', end);
      if (breakAt > start + CHUNK_SIZE / 2) end = breakAt;
    }
    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end === clean.length) break;
    start = end - OVERLAP;
  }
  return chunks;
}

function hasSecret(text) {
  return /pcsk_[A-Za-z0-9_-]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)
    || /(?:api[_-]?key|password|secret|token)\s*[:=]\s*["']?[A-Za-z0-9_/-]{16,}/i.test(text);
}

async function readCorpus(dir) {
  const files = [];
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isSymbolicLink()) throw new AppError('UNSAFE_SOURCE', '知識資料夾不可包含符號連結。');
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (/\.(md|txt)$/i.test(entry.name)) {
        if (files.length >= 200 || (await fs.stat(file)).size > 200000) {
          throw new AppError('CORPUS_TOO_LARGE', '本機版本每份文件上限 200 KB，最多 200 份文件。');
        }
        const text = (await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
        if (!text) continue;
        if (hasSecret(text)) throw new AppError('SECRET_IN_SOURCE', '文件中發現疑似秘密，已停止匯入；未傳送文件內容。');
        files.push({ source: path.relative(dir, file).split(path.sep).join('/'), text });
      }
    }
  }
  try { await walk(dir); } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('SOURCE_UNAVAILABLE', '無法讀取知識資料夾，請檢查 RAG_KNOWLEDGE_DIR。');
  }
  const chunks = files.flatMap(file => {
    const title = file.text.match(/^#\s+(.+)$/m)?.[1] || file.source;
    return splitText(file.text).map((text, i) => ({
      id: digest(`${file.source}\n${i}\n${text}`).slice(0, 24),
      source: file.source, title, text, chunk: i + 1,
    }));
  });
  if (!chunks.length) throw new AppError('EMPTY_CORPUS', '知識資料夾沒有可匯入的 Markdown 或文字內容。');
  if (chunks.length > 1000) throw new AppError('CORPUS_TOO_LARGE', '本機版本最多匯入 1000 個文字片段。');
  return { files: files.length, chunks, hash: digest(JSON.stringify({ files, CHUNK_SIZE, OVERLAP })) };
}
module.exports = { readCorpus, splitText, hasSecret };
