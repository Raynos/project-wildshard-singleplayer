// Manual native transport validation; run through scripts/browser-lane.sh.
import assert from 'node:assert/strict';
import {chromium,devices} from 'playwright';
import {KEYCHAIN_ARGS} from './chromium-keychain.mjs';
import {profileReleaseWorker} from './release-worker-profile.mjs';
import {observeReleaseStorage} from './release-storage-profile.mjs';
import {createServer} from 'node:http';
const server=createServer((_request,response)=>response.end('<!doctype html><title>Native diagnostic fixture</title>'));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
/** @type {import('playwright').Browser|undefined} */
let browser;
try{
 browser=await chromium.launch({headless:true,args:[...KEYCHAIN_ARGS,'--mute-audio']});
 const context=await browser.newContext({...devices['iPhone 16 Pro'],deviceScaleFactor:2});
 await context.addInitScript(observeReleaseStorage);
 const address=server.address();assert.ok(address!==null&&typeof address!=='string');
 const page=await context.newPage();await page.goto(`http://127.0.0.1:${address.port}/`);
 await page.evaluate(()=>new Promise((resolve,reject)=>{
  const request=indexedDB.open('native-proof',1);request.onupgradeneeded=()=>request.result.createObjectStore('fixture');
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const database=request.result,transaction=database.transaction('fixture','readwrite');transaction.objectStore('fixture').put('unchanged native write','fixture');transaction.onabort=()=>{database.close();resolve();};transaction.abort();};
 }));
 await page.evaluate(()=>new Promise((resolve,reject)=>{
  const request=indexedDB.open('native-proof',1);request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const database=request.result,transaction=database.transaction('fixture','readwrite'),store=transaction.objectStore('fixture');store.add('first','same');store.add('second','same');transaction.onabort=()=>{database.close();resolve();};transaction.oncomplete=()=>reject(new Error('Native duplicate key was not refused'));};
 }));
 const storage=await page.evaluate(()=>Reflect.get(globalThis,'__releaseStorageFaults'));
 assert.ok(storage.rows.some(row=>row.event==='abort'&&row.database==='native-proof'));
 assert.ok(storage.rows.some(row=>row.error==='ConstraintError'&&row.stores.includes('fixture')));
 assert.equal(storage.dropped,0);
 const pending=page.waitForEvent('worker');
 await page.evaluate(()=>{
  const worker=new Worker(URL.createObjectURL(new Blob([`onmessage=e=>{const port=e.ports[0];port.onmessage=event=>{const data=event.data;const bytes=new Uint8Array(data.bytes)[0]%2===0?data.bytes:data.bytes.slice(0);port.postMessage({...data,bytes},[bytes]);};postMessage('ready');};`],{type:'text/javascript'})));
  const channel=new MessageChannel();
  Reflect.set(globalThis,'portProof',{port:channel.port1,worker});
  return new Promise(resolve=>{worker.onmessage=()=>resolve();worker.postMessage({},[channel.port2]);});
 });
 const worker=await pending;
 const stop=await profileReleaseWorker(browser,worker.url(),'tmp/codex-release/native-port-worker.json',{page,durationMs:10000});
 await page.evaluate(async()=>{
  const {port}=Reflect.get(globalThis,'portProof');
  for(let i=1;i<=200;i++){
   const delivered=new Promise(resolve=>{port.onmessage=event=>resolve(event.data);});
   const bytes=new Uint8Array([i&255,i>>8,12,45]).buffer;
   port.postMessage({channel:'unreliable',bytes},[bytes]);
   if(bytes.byteLength!==0)throw Error('Native transfer did not detach');
   const data=await delivered;if(new Uint8Array(data.bytes)[0]!== (i&255))throw Error('Echo payload changed');
  }
 });
 const evidence=await stop();
 const {readFileSync}=await import('node:fs');
 const ports=JSON.parse(readFileSync(evidence.portFile,'utf8'));
 assert.deepEqual(ports.errors,[]);assert.equal(ports.page.overflow,false);assert.equal(ports.worker.overflow,false);
 assert.equal(ports.page.rows.filter(row=>row.direction==='send').length,200);
 assert.equal(ports.worker.rows.filter(row=>row.direction==='send').length,200);
 assert.ok(ports.page.rows.filter(row=>row.direction==='receive').length>=199);
 assert.ok(ports.worker.rows.filter(row=>row.direction==='receive').length>=199);
 assert.equal(ports.worker.rows.filter(row=>row.direction==='receive'&&row.length===0).length,100,'Forwarded native buffers stay explicitly unavailable');
 assert.ok(ports.worker.rows.filter(row=>row.direction==='receive'&&row.length===4).length>=99,'Copied native replies retain matchable incoming headers');
 assert.equal(await page.evaluate(()=>Reflect.has(globalThis,'__releasePortStop')),false);
 assert.equal(await worker.evaluate(()=>Reflect.has(globalThis,'__releasePortStop')),false);
 console.log('PASS actual Chromium page/worker CDP capture, 200 native transfers each way, both observers removed; diagnostic validation only, no road verdict');
 await context.close();
}finally{try{await browser?.close();}finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}}
