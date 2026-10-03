'use strict';
const { AppError } = require('./errors');
function safeHost(value) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9.-]*\.pinecone\.io$/i.test(value)) throw new AppError('PINECONE_HOST', 'Pinecone 回傳的索引主機無效。');
  return `https://${value}`;
}
function createPinecone(config, fetchImpl = fetch) {
  async function request(url, body) {
    if (!config.pineconeApiKey) throw new AppError('PINECONE_CONFIG', '請在本機 .env 設定 PINECONE_API_KEY。');
    let response;
    try {
      response = await fetchImpl(url, {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { 'Api-Key': config.pineconeApiKey, 'X-Pinecone-Api-Version': '2025-10', 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { throw new AppError('PINECONE_UNAVAILABLE', 'Pinecone 連線失敗或逾時。', 502); }
    if (!response.ok) {
      const code = [401, 403].includes(response.status) ? 'PINECONE_AUTH' : response.status === 429 ? 'PINECONE_LIMIT' : response.status === 404 ? 'PINECONE_NOT_FOUND' : 'PINECONE_ERROR';
      throw new AppError(code, 'Pinecone 請求失敗，請檢查金鑰、索引名稱、額度與服務狀態。', 502);
    }
    try { return await response.json(); } catch { throw new AppError('PINECONE_FORMAT', 'Pinecone 回覆格式無效。', 502); }
  }
  let info;
  return {
    async describe() {
      if (!/^[a-z0-9][a-z0-9-]{0,44}$/.test(config.pineconeIndex || '')) throw new AppError('PINECONE_CONFIG', 'PINECONE_INDEX 名稱無效。');
      info ||= await request(`https://api.pinecone.io/indexes/${config.pineconeIndex}`);
      safeHost(info.host);
      if (info.metric !== 'cosine' || !Number.isInteger(info.dimension) || !info.status?.ready) throw new AppError('PINECONE_INDEX', '需要已就緒、使用 cosine 的 dense 向量索引。');
      return info;
    },
    async post(endpoint, body) {
      const description = await this.describe();
      if (!['/vectors/upsert', '/query', '/describe_index_stats'].includes(endpoint)) throw new AppError('PINECONE_ENDPOINT', '不支援此資料庫操作。');
      return request(`${safeHost(description.host)}${endpoint}`, body);
    },
    async fetch(ids, namespace) {
      const description = await this.describe();
      const params = new URLSearchParams({ namespace });
      for (const id of ids) params.append('ids', id);
      return request(`${safeHost(description.host)}/vectors/fetch?${params}`);
    },
  };
}
module.exports = { createPinecone, safeHost };
