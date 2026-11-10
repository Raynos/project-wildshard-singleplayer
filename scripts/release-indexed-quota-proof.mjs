// Loopback-only native fault injection; production quotas/backends never change.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {KEYCHAIN_ARGS} from './chromium-keychain.mjs';
import {observeReleaseStorage} from './release-storage-profile.mjs';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const engine=resolve(process.argv[2]);
const baseline=process.argv.find(arg=>arg.startsWith('--baseline='))?.slice(11);
if(baseline!==undefined&&!/^[a-f0-9]{40}$/u.test(baseline))throw Error('Expected full baseline commit');
const prototype=process.argv.find(arg=>arg.startsWith('--prototype='))?.slice(12);
if(baseline!==undefined&&prototype!==undefined)throw Error('Choose one negative control');
const indexed=resolve(engine,'src/client/engine/saves/indexed.ts');
const historical=baseline!==undefined?execFileSync('git',['show',`${baseline}:src/client/engine/saves/indexed.ts`],{cwd:engine,encoding:'utf8'}):prototype!==undefined?readFileSync(prototype,'utf8'):null;
const {build}=await import(pathToFileURL(resolve(engine,'node_modules/rolldown/dist/index.mjs')).href);
const source=`import{openIndexedSaves}from${JSON.stringify(resolve(engine,'src/client/engine/saves/indexed.ts'))};import{ASSET_CACHE_NAME}from${JSON.stringify(resolve(engine,'src/client/engine/pwa/cacheNames.ts'))};globalThis.proof={openIndexedSaves,ASSET_CACHE_NAME};`;
const output=await build({input:'fixture',plugins:[{name:'fixture',resolveId:id=>id==='fixture'?'\0fixture':null,load:id=>id==='\0fixture'?source:id===indexed?historical:null}],write:false,platform:'browser',output:{format:'esm',minify:true}});
const server=createServer((req,res)=>{if(req.url==='/recomputable-part'){res.setHeader('content-type','application/octet-stream');res.end(Buffer.alloc(1792*1024,173));return;}res.setHeader('content-type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?output.output[0].code:'<!doctype html><script type="module" src="/fixture.js"></script>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser,session;
const timer=setTimeout(()=>{process.exitCode=1;void browser?.close();},8000);timer.unref();
try{
 browser=await chromium.launch({headless:true,args:[...KEYCHAIN_ARGS,'--mute-audio']});
 const context=await browser.newContext();await context.addInitScript(observeReleaseStorage);
 if(process.argv.includes('--cleared-native-buffer'))await context.addInitScript(()=>{
  const resources=[];let recorded;
  globalThis.resourceRecorded=new Promise(resolve=>{recorded=resolve;});
  globalThis.__bootTiming={version:1,begin:()=>0,resources};
  new PerformanceObserver(list=>{for(const row of list.getEntries()){resources.push({url:row.name,decodedBodySize:row.decodedBodySize});if(new URL(row.name).pathname==='/recomputable-part')recorded();}}).observe({type:'resource',buffered:true});
 });
 const page=await context.newPage(),address=server.address();assert.ok(address!==null&&typeof address!=='string');
 const origin=`http://127.0.0.1:${address.port}`;await page.goto(origin);await page.waitForFunction(()=>globalThis.proof!==undefined);
 session=await context.newCDPSession(page);assert.equal(new URL(origin).hostname,'127.0.0.1');
 await session.send('Storage.overrideQuotaForOrigin',{origin,quotaSize:3*1024*1024});
 const prepared=await page.evaluate(async()=>{
  const {openIndexedSaves,ASSET_CACHE_NAME}=globalThis.proof,api=await openIndexedSaves('native-pressure');
  const bytes=new Uint8Array(512*1024);for(let at=0;at<bytes.length;at+=65536)crypto.getRandomValues(bytes.subarray(at,at+65536));
  const payload=btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join(''));
  const original=await api.write('last-good',payload);
  await(await caches.open(ASSET_CACHE_NAME)).put('/recomputable-part',await fetch('/recomputable-part'));
  if(globalThis.resourceRecorded!==undefined){await globalThis.resourceRecorded;performance.clearResourceTimings();}
  globalThis.pressure={api,payload};return {original};
 });assert.equal(prepared.original,true);
 const before=await session.send('Storage.getUsageAndQuota',{origin});
 const race=process.argv.includes('--race-delete'),close=process.argv.includes('--close-drain'),cross=process.argv.includes('--cross-handle');
 const result=await page.evaluate(async({race,close,cross})=>{
  const {api,payload}=globalThis.pressure,opening=indexedDB.open('native-pressure',1);
  const db=await new Promise((resolve,reject)=>{opening.onsuccess=()=>resolve(opening.result);opening.onerror=()=>reject(opening.error);});
  const writes=[];let final;
  let raceResult;
  if(race){
   // Exhaust the native reservation without changing the quota. Hold the
   // actual recovery delete while a later delete of the same save is queued.
   const original=Cache.prototype.delete;let entered,release;
   const waiting=new Promise(resolve=>{entered=resolve;}),allowed=new Promise(resolve=>{release=resolve;});
   Cache.prototype.delete=async function(...args){entered();await allowed;return Reflect.apply(original,this,args);};
   try{
    let older;
    for(let i=0;i<12;i++){
     const attempt=api.write('candidate',payload+':retry'+i);
     const event=await Promise.race([attempt.then(ok=>({kind:'saved',ok})),waiting.then(()=>({kind:'recovery'}))]);
     if(event.kind==='recovery'){older=attempt;break;}writes.push(event.ok);
    }
    if(older===undefined)throw Error('Native quota recovery was not reached');
    const second=cross?await globalThis.proof.openIndexedSaves('native-pressure'):api;
    const newer=second.write('candidate',null);
    await new Promise((resolve,reject)=>{const r=db.transaction('saves').objectStore('saves').get('candidate');r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});
    release();raceResult=await Promise.all([older,newer]);if(cross)second.close();
   }finally{release();Cache.prototype.delete=original;}
  }
  // Native IDB may spend a cached space reservation before refreshing the
  // origin's shared usage. Bounded updates exercise that real reservation.
  else for(let i=0;i<12;i++){final=payload+':'+i;writes.push(await api.write('candidate',final));}
  const read=key=>new Promise((resolve,reject)=>{const r=db.transaction('saves').objectStore('saves').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  let drain;
  if(close){const first=api.write('drain','first'),second=api.write('drain','second');api.close();drain={writes:await Promise.all([first,second]),value:await read('drain')};}
  const lastGood=await read('last-good'),candidate=await read('candidate');db.close();api.close();
  return {writes,raceResult,drain,candidateAbsent:candidate===undefined,lastGoodKept:lastGood===payload,candidateDurable:race?null:candidate===final,faults:globalThis.__releaseStorageFaults,cacheRetained:(await caches.match('/recomputable-part'))!==undefined};
 },{race,close,cross});
 const after=await session.send('Storage.getUsageAndQuota',{origin});
 console.log('NATIVE CACHE PRESSURE',JSON.stringify({before,result,after}));
 assert.equal(result.lastGoodKept,true);
 if(close)assert.deepEqual(result.drain,{writes:[true,true],value:'second'});
 if(race){assert.deepEqual(result.raceResult,cross?[false,true]:[true,true]);assert.equal(result.candidateAbsent,true,'Older recovery must never resurrect a newer delete');}
 else if(process.argv.includes('--expect-save')||(baseline===undefined&&prototype===undefined)){assert.ok(result.writes.every(Boolean));assert.equal(result.candidateDurable,true);}
 else{assert.ok(result.writes.includes(false));assert.equal(result.candidateDurable,false);assert.ok(result.faults.rows.some(row=>row.error==='QuotaExceededError'));}
 await session.send('Storage.overrideQuotaForOrigin',{origin});await session.detach();session=undefined;await context.close();
}finally{clearTimeout(timer);try{await session?.detach();}finally{try{await browser?.close();}finally{await new Promise(resolve=>server.close(resolve));}}}
