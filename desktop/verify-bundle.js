'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {loadConfig,loadEnv}=require('../src/config');
(async()=>{
  const bundle=path.resolve(process.argv[2]||'');
  assert.ok(process.argv[2],'bundle path required');
  loadEnv();const config=loadConfig();
  const secrets=[config.apiKey,config.pineconeApiKey].filter(Boolean).map(s=>Buffer.from(s));
  let checked=0;
  async function scan(dir){
    for(const e of await fs.readdir(dir,{withFileTypes:true})){
      assert.ok(!e.isSymbolicLink(),'symlink not allowed');
      assert.ok(!['.env','.data','private','artifacts','baseline','.git'].includes(e.name),'private path in bundle');
      const p=path.join(dir,e.name);
      if(e.isDirectory())await scan(p);
      else {const b=await fs.readFile(p);assert.ok(!secrets.some(s=>b.includes(s)),'secret detected; content suppressed');checked++;}
    }
  }
  await scan(bundle);
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'fish-portable-'));
  let child;
  try{
    const envFile=path.join(root,'.env');await fs.writeFile(envFile,'RAG_STORE=local\n');
    const env={...process.env};
    for(const key of Object.keys(env))if(/^(OPENAI_|PINECONE_|RAG_)/.test(key))delete env[key];
    env.RAG_ENV_FILE=envFile;env.RAG_INDEX_PATH=path.join(root,'missing.json');
    child=spawn(path.join(bundle,'runtime/node.exe'),[path.join(bundle,'app/scripts/demo-server.js')],{cwd:root,env,windowsHide:true,stdio:['pipe','pipe','pipe']});
    const exited=new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});
    const url=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('portable startup timeout')),15000);let text='';
      child.once('error',e=>{clearTimeout(timer);reject(e);});
      child.once('exit',()=>{clearTimeout(timer);reject(Error('portable exited before ready'));});
      child.stdout.on('data',b=>{text+=b;const match=text.match(/DEMO_READY:(http:\/\/127\.0\.0\.1:\d+\/)/);if(match){clearTimeout(timer);resolve(match[1]);}});
    });
    for(const page of ['', 'flavor.html','report.html','rag.html','vendor/chart/chart.umd.js'])assert.equal((await fetch(url+page)).status,200);
    const health=await(await fetch(url+'api/health')).json();assert.equal(health.api_key_configured,false);assert.equal(health.status,'setup_required');
    for(const p of ['.env','src/config.js','.data/index.json'])assert.equal((await fetch(url+p)).status,404);
    child.stdin.write('STOP\n');
    const timer=setTimeout(()=>child.kill(),5000);
    assert.equal(await exited,0);clearTimeout(timer);
    await assert.rejects(fetch(url));
    console.log(JSON.stringify({passed:true,files_scanned:checked,secret_matches:0,bundled_runtime:true,no_credentials:true,static_pages:true,private_paths_blocked:true,shutdown:true},null,2));
  } finally {if(child&&child.exitCode===null)child.kill();await fs.rm(root,{recursive:true,force:true});}
})().catch(()=>{console.error('BUNDLE_VERIFICATION_FAILED: 封裝驗證未通過，未輸出秘密或原始例外。');process.exitCode=1;});
