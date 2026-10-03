'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ReportCache = require('../public/js/report-cache');
const RecipeModel = require('../public/js/recipe-model');
function storage() { const m=new Map(); return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}; }
const answer = text => ({answer:text,insufficient_evidence:false,sources:[],recommended_elements:[]});
test('report page revisit renders identical three sections without another request',async()=>{
    const saved=storage();saved.setItem('selectedElements',JSON.stringify([{name:'lemon'}]));
    const source=fs.readFileSync(path.join(__dirname,'../public/js/report-rag.js'),'utf8');
    let calls=0;
    async function visit(){
        let callback;const rendered=[];const nodes=new Map();
        const node=()=>({append(){},replaceChildren(){},addEventListener(){}});
        vm.runInNewContext(source,{
            localStorage:saved,RecipeModel,ReportCache,window:{location:{}},
            document:{addEventListener:(event,fn)=>{callback=fn;},querySelector:()=>null,getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);}},
            RagClient:{node,ask:async payload=>{calls++;return answer(payload.section+'-'+calls);},render:(container,data,options)=>{assert.equal(options.showRecommendations,false);rendered.push(data.answer);},showError:()=>assert.fail('unexpected report error')},
        });
        callback();
        await new Promise(resolve=>setImmediate(resolve));
        assert.equal(rendered.length,3);return rendered;
    }
    const first=await visit();assert.equal(calls,3);
    assert.deepEqual(await visit(),first);assert.equal(calls,3);
    saved.setItem('selectedElements',JSON.stringify([{name:'honey'}]));
    await visit();assert.equal(calls,6,'changed recipe regenerates all sections');
});
test('cache respects identity and repeated ingredient proportions but ignores drag order',async()=>{
    const saved=storage();let calls=0;const request=async()=>answer(String(++calls));
    await ReportCache.create(saved,'custom',['lemon','honey','lemon']).get('flavor',request);
    await ReportCache.create(saved,'custom',['honey','lemon','lemon']).get('flavor',request);assert.equal(calls,1);
    await ReportCache.create(saved,'custom',['honey','lemon']).get('flavor',request);assert.equal(calls,2);
    await ReportCache.create(saved,'fitness',['honey','lemon']).get('flavor',request);assert.equal(calls,3);
});
test('failed sections retry while completed sections stay fixed; concurrent calls share request',async()=>{
    const saved=storage();let calls=0;const cache=ReportCache.create(saved,'custom',['lemon']);
    const request=async()=>{calls++;return answer('fixed');};
    await Promise.all([cache.get('flavor',request),cache.get('flavor',request)]);assert.equal(calls,1);
    await assert.rejects(cache.get('nutrition',async()=>{throw Error('offline');}));
    const revisit=ReportCache.create(saved,'custom',['lemon']);
    assert.equal((await revisit.get('flavor',request)).answer,'fixed');assert.equal(calls,1);
    await revisit.get('nutrition',request);assert.equal(calls,2);
});
test('corrupt or unavailable storage does not block generation',async()=>{
    for(const saved of [{getItem:()=>'{broken',setItem(){}},{getItem(){throw Error();},setItem(){throw Error();}}]){
        const cache=ReportCache.create(saved,'custom',['lemon']);
        assert.equal((await cache.get('flavor',async()=>answer('ok'))).answer,'ok');
    }
});
test('share page has no recommendation panel or RAG client calls',()=>{
    const html=fs.readFileSync(path.join(__dirname,'../public/share.html'),'utf8');
    const js=fs.readFileSync(path.join(__dirname,'../public/js/share.js'),'utf8');
    assert.doesNotMatch(html,/aiRecommendation|文件檢索推薦|rag-client\.js/);
    assert.doesNotMatch(js,/RagClient|initAIRecommendation/);
});
