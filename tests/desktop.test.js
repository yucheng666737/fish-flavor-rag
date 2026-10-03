'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
test('desktop server starts without secrets on loopback and stops on launcher request',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'fish-demo-'));
  const envPath=path.join(dir,'.env');await fs.writeFile(envPath,'RAG_STORE=local\n');
  const env={...process.env,RAG_ENV_FILE:envPath};
  for(const key of Object.keys(env)) if(key.startsWith('OPENAI_')||key.startsWith('PINECONE_')||(key.startsWith('RAG_')&&key!=='RAG_ENV_FILE'))delete env[key];
  env.RAG_INDEX_PATH=path.join(dir,'no-index.json');
  const child=spawn(process.execPath,[path.join(__dirname,'../scripts/demo-server.js')],{env,stdio:['pipe','pipe','pipe'],windowsHide:true});
  t.after(async()=>{if(child.exitCode===null)child.kill();await fs.rm(dir,{recursive:true,force:true});});
  const exit=new Promise(resolve=>child.once('exit',resolve));
  const url=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('start timeout')),10000);
    child.once('error',reject);let out='';
    child.stdout.on('data',data=>{out+=data;const match=out.match(/DEMO_READY:(http:\/\/127\.0\.0\.1:\d+\/)/);if(match){clearTimeout(timeout);resolve(match[1]);}});
  });
  assert.equal((await fetch(url)).status,200);
  const health=await(await fetch(url+'api/health')).json();
  assert.equal(health.api_key_configured,false);
  assert.equal(health.status,'setup_required');
  child.stdin.write('STOP\n');
  assert.equal(await exit,0);
  await assert.rejects(fetch(url));
});
