'use strict';
const local = require('./local-store');
const pinecone = require('./pinecone-store');
const backend = config => config.store === 'pinecone' ? pinecone : local;
module.exports = {
  validVector: local.validVector,
  cosine: local.cosine,
  ingest: (config, provider, options) => backend(config).ingest(config, provider, options),
  loadIndex: config => backend(config).loadIndex(config),
  retrieve: (config, provider, query, options) => backend(config).retrieve(config, provider, query, options),
};
