'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { loadConfig } = require('../src/config');
const local = require('../src/local-store');
const cloud = require('../src/pinecone-store');
const { createPinecone, safeHost } = require('../src/pinecone');
const { readCorpus, hasSecret } = require('../src/corpus');

// In-memory Pinecone protocol double: verifies our adapter, not the cloud service.
function fakeCloud() {
  const data = new Map(), calls = [];
  return {
    data, calls,
    async describe() { return { dimension: 3 }; },
    async fetch(ids, namespace) { return { vectors: Object.fromEntries(ids.filter(id => data.has(namespace+':'+id)).map(id => [id, structuredClone(data.get(namespace+':'+id))])) }; },
    async post(endpoint, body) {
      calls.push({ endpoint, body });
      if (endpoint === '/vectors/upsert') {
        for (const v of body.vectors) data.set(body.namespace+':'+v.id, structuredClone(v));
        return { upsertedCount: body.vectors.length };
      }
      if (endpoint === '/query') {
        const matches = [...data.entries()].filter(([key,r]) => key.startsWith(body.namespace+':') && Object.entries(body.filter).every(([k, condition]) => condition.$in ? condition.$in.includes(r.metadata[k]) : r.metadata[k] === condition.$eq))
          .map(([,r]) => ({ id:r.id, metadata:r.metadata, score:local.cosine(body.vector,r.values) }))
          .sort((a,b) => b.score-a.score).slice(0,body.topK);
        return { matches };
      }
      throw new Error('Unexpected operation');
    },
  };
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'fish-pinecone-test-'));
  t.after(() => fs.rm(root,{recursive:true,force:true}));
  const knowledgeDir = path.join(root,'knowledge');
  await fs.mkdir(knowledgeDir);
  await fs.writeFile(path.join(knowledgeDir,'lemon.md'),'# 檸檬\n檸檬的柑橘風味。');
  await fs.writeFile(path.join(knowledgeDir,'honey.md'),'# 蜂蜜\n蜂蜜的甜味。');
  const config = {...loadConfig({}),store:'pinecone',knowledgeDir,indexPath:path.join(root,'index.json'),minScore:.3};
  const provider = { async embed(texts) { return texts.map(t => t.includes('檸檬') ? [1,0,0] : [0,1,0]); } };
  await local.ingest(config,provider);
  return {config,provider,client:fakeCloud()};
}
test('Pinecone migration preserves text and vectors; cloud query applies source filter',async t => {
  const {config,provider,client}=await fixture(t);
  const before=await fs.readFile(config.indexPath,'utf8');
  const result=await cloud.migrate(config,client);
  assert.equal(result.chunks,2);
  assert.equal((await cloud.loadIndex(config,client)).chunkCount,2);
  const hits=await cloud.retrieve(config,provider,'檸檬',{sources:['lemon.md']},client);
  assert.equal(hits.length,1);
  assert.equal(hits[0].text,'# 檸檬\n檸檬的柑橘風味。');
  const request=client.calls.find(c=>c.endpoint==='/query').body;
  assert.equal(request.includeMetadata,true);
  assert.equal(request.includeValues,false);
  assert.deepEqual(request.filter.source,{$in:['lemon.md']});
  assert.equal(await fs.readFile(config.indexPath,'utf8'),before);
  await cloud.migrate(config,client);
  assert.equal(client.data.size,3,'idempotent migration');
});
test('corpus/model changes select a new namespace and cannot use stale records',async t=>{
  const {config,provider,client}=await fixture(t);
  await cloud.migrate(config,client);
  const old=(await cloud.loadIndex(config,client)).namespace;
  await fs.rm(path.join(config.knowledgeDir,'honey.md'));
  await assert.rejects(cloud.loadIndex(config,client),{code:'PINECONE_NOT_INGESTED'});
  await cloud.ingest(config,provider,{},client);
  assert.notEqual((await cloud.loadIndex(config,client)).namespace,old);
  const hits=await cloud.retrieve(config,provider,'檸檬',{},client);
  assert.ok(hits.every(c=>c.source==='lemon.md'));
  await assert.rejects(cloud.loadIndex({...config,embeddingModel:'different'},client),{code:'PINECONE_NOT_INGESTED'});
});
test('failed upsert does not publish ready marker or modify local backup',async t=>{
  const {config,client}=await fixture(t);
  const before=await fs.readFile(config.indexPath,'utf8');
  client.post=async()=>{throw new Error('simulated upload failure');};
  await assert.rejects(cloud.migrate(config,client));
  await assert.rejects(cloud.loadIndex(config,client),{code:'PINECONE_NOT_INGESTED'});
  assert.equal(await fs.readFile(config.indexPath,'utf8'),before);
});
test('bad dimension or altered cloud text is rejected before generation',async t=>{
  const {config,provider,client}=await fixture(t);
  client.describe=async()=>({dimension:4});
  await assert.rejects(cloud.migrate(config,client),{code:'PINECONE_DATA'});
  assert.equal(client.calls.length,0);
  client.describe=async()=>({dimension:3});
  await cloud.migrate(config,client);
  const record=[...client.data.values()].find(r=>r.metadata.source==='lemon.md');
  record.metadata.text='tampered';
  await assert.rejects(cloud.retrieve(config,provider,'檸檬',{},client),{code:'PINECONE_DATA'});
});
test('eventual consistency retries readback and excludes marker from searches',async t=>{
  const {config,provider,client}=await fixture(t);
  const fetch=client.fetch.bind(client);
  let pending=true,waits=0;
  client.fetch=async(...args)=>{if(pending){pending=false;return {vectors:{}};}return fetch(...args);};
  await cloud.publish(config,await local.loadIndex(config),client,async()=>{waits++;});
  assert.equal(waits,1);
  const hits=await cloud.retrieve(config,provider,'檸檬',{},client);
  assert.ok(hits.every(c=>!c.id.startsWith('__')));
});
test('missing configuration, unsafe hosts and upstream errors never expose credentials',async()=>{
  for(const host of ['evil.test','x.pinecone.io.evil.test','x.pinecone.io/path','user@x.pinecone.io','http://x.pinecone.io']) assert.throws(()=>safeHost(host));
  assert.equal(safeHost('example.svc.us-east1.pinecone.io'),'https://example.svc.us-east1.pinecone.io');
  let calls=0;
  await assert.rejects(createPinecone(loadConfig({}),async()=>{calls++;}).describe(),{code:'PINECONE_CONFIG'});
  assert.equal(calls,0);
  const key='test-only-secret';
  const config={...loadConfig({}),pineconeApiKey:key};
  const client=createPinecone(config,async(url,options)=>{
    assert.equal(url,'https://api.pinecone.io/indexes/fish-flavor-rag');
    assert.equal(options.redirect,'error');
    return {ok:false,status:401,json:async()=>({message:key})};
  });
  await assert.rejects(client.describe(),err=>err.code==='PINECONE_AUTH'&&!String(err).includes(key));
  const bad=createPinecone(config,async()=>({ok:true,json:async()=>({host:'evil.test',dimension:3,metric:'cosine',status:{ready:true}})}));
  await assert.rejects(bad.post('/query',{}),{code:'PINECONE_HOST'});
});
test('Pinecone dry run needs no credentials and sends no text',async()=>{
  const config={...loadConfig({}),store:'pinecone'};
  const result=await cloud.ingest(config,{embed(){throw new Error('must not call');}},{dryRun:true});
  assert.equal(result.chunks,(await readCorpus(config.knowledgeDir)).chunks.length);
  assert.equal(result.dryRun,true);
});
test('Pinecone keys in knowledge text are blocked before upload',()=>{
  assert.equal(hasSecret('pcsk_'+'a'.repeat(40)),true);
});
