// Through sim-lane: node scripts/loading-benchmark/update-safari.mjs BEFORE_URL AFTER_URL BEFORE_SHA AFTER_SHA OUT_DIR
// Original app/worker bytes behind a switching observation proxy. No forced GC, cache deletion or worker bypass.
import {execFileSync,spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {setTimeout as sleep} from 'node:timers/promises';
import {observeTransport} from './transport.mjs';
import {soakInspector} from '../soak/inspector.mjs';
import {accuracyRecorder} from './accuracy-data.mjs';
import {loadingCardIndex} from './catalogue.mjs';
import {updateReport,updateProgressReport} from './update-report.mjs';
import {saveFixtureCode} from '../debug-settings.mjs';

const [before,after,beforePin,afterPin,directory]=process.argv.slice(2),udid=process.env.SIM_UDID;
const progressOnly=process.argv.includes('--progress-only');
if(!udid||!before||!after||!directory||! /^[a-f0-9]{40}$/u.test(beforePin??'')||! /^[a-f0-9]{40}$/u.test(afterPin??''))throw new Error('sim-lane, two owned URLs, exact source SHAs and output directory required');
const out=directory;mkdirSync(out,{recursive:true});
let current=before,inspector,selected,video;
async function stopVideo(){const child=video;video=undefined;if(child&&child.exitCode===null&&child.signalCode===null){child.kill('SIGINT');await once(child,'exit');}}
function record(){
 const key='__loadingUpdate',rows=JSON.parse(sessionStorage.getItem(key)??'[]');
 const put=(kind,detail={})=>{rows.push({kind,host:Date.now(),at:performance.now(),origin:performance.timeOrigin,...detail});sessionStorage.setItem(key,JSON.stringify(rows));};
 window.__loadingUpdate={put};put('document',{href:location.href});
 document.addEventListener('ws:ready',()=>{put('ready');if(document.querySelector('.ws-main-select'))requestAnimationFrame(()=>{requestAnimationFrame(()=>{put('titlePaint');});});});
 addEventListener('pagehide',()=>put('pagehide'));
 addEventListener('ws-sw-waiting',()=>put('waiting'));
 navigator.serviceWorker?.addEventListener('controllerchange',()=>put('controllerchange'));
 addEventListener('error',e=>put('error',{message:e.message}));
 addEventListener('unhandledrejection',e=>put('error',{message:String(e.reason)}));
 let signature='';
 new MutationObserver(()=>{
  const screen=document.querySelector('.ws-update-screen');
  if(screen){
   const detail={phase:screen.dataset.phase,fact:screen.querySelector('[role="status"]')?.textContent,steps:[...screen.querySelectorAll('li')].map(row=>row.textContent)};
   const next=JSON.stringify(detail);if(next!==signature){signature=next;put('updateProgress',detail);}
  }else if(signature!==''){
   signature='';put('updateHidden');
   if(document.querySelector('.ws-main-select'))requestAnimationFrame(()=>{requestAnimationFrame(()=>{put('updateTitlePaint');});});
  }
 }).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-phase']});
}
const oldVersion=await(await fetch(new URL('/version.json',before))).json(),newVersion=await(await fetch(new URL('/version.json',after))).json();
if(!oldVersion.build.startsWith(beforePin.slice(0,7))||!newVersion.build.startsWith(afterPin.slice(0,7)))throw new Error('Served source pin mismatch');
const transport=await observeTransport(()=>current,{recorder:record,prelude:`(${accuracyRecorder.toString()})();`,bodyHashes:true});const base=transport.base;
async function port(){const s=createServer();await new Promise(resolve=>{s.listen(0,'127.0.0.1',resolve);});const address=s.address();if(address===null||typeof address==='string')throw new Error('Inspector port did not bind');const p=address.port;await new Promise(resolve=>{s.close(resolve);});return p;}
const list=await port(),first=await port(),socket=execFileSync('xcrun',['simctl','getenv',udid,'RWI_LISTEN_SOCKET'],{encoding:'utf8'}).trim();
const proxy=spawn('ios_webkit_debug_proxy',['-s',`unix:${socket}`,'-c',`null:${list},:${first}-${first+8}`],{stdio:['ignore','ignore','pipe']});
let proxyLog='';proxy.stderr.on('data',x=>{proxyLog+=x;});
async function connect(){inspector?.close();inspector=undefined;let last='';const end=Date.now()+60000;while(Date.now()<end){for(let p=first;p<=first+8;p++){try{const pages=await(await fetch(`http://127.0.0.1:${p}/json`,{signal:AbortSignal.timeout(500)})).json(),page=pages.find(x=>x.id===selected&&x.url?.startsWith(base))??pages.findLast(x=>x.url?.startsWith(base));if(page){selected=page.id;inspector=soakInspector(page.webSocketDebuggerUrl);await inspector.opened;await sleep(600);await inspector.evaluate('performance.now()');return;}}catch(e){last=String(e);inspector?.close();inspector=undefined;}}await sleep(300);}throw new Error(`No Inspector: ${last}`);}
async function evaluate(expression){return await inspector.evaluate(expression);}
async function wait(expression,ms=90000){const end=Date.now()+ms;while(Date.now()<end){try{const x=JSON.parse(await evaluate(`JSON.stringify({ready:!!(${expression}),fatal:document.querySelector('#wserr .msg')?.textContent??''})`));if(x.fatal)throw new Error(x.fatal);if(x.ready)return;}catch(e){if(!/Inspector|closed|destroyed|target|context|Cannot find|not opened/i.test(String(e)))throw e;await connect();}await sleep(200);}throw new Error(`Timeout: ${expression}`);}
async function gesture(expression){const x=await inspector.send('Runtime.evaluate',{expression,returnByValue:true,emulateUserGesture:true});if(x.wasThrown)throw new Error(x.result?.description??'Gesture failed');}
async function collect(){return JSON.parse(await evaluate(`JSON.stringify({href:location.href,origin:performance.timeOrigin,now:performance.now(),accuracy:window.__loadingAccuracy,pill:document.querySelector('.ws-update')?.textContent,rows:JSON.parse(sessionStorage.getItem('__loadingUpdate')??'[]'),backgrounds:[...document.querySelectorAll('.ws-menu-card-img,.ws-menu-dots i,.ws-menu-hero')].map(x=>({background:getComputedStyle(x).backgroundImage,thumb:getComputedStyle(x).getPropertyValue('--thumb'),visible:x.getClientRects().length>0})),images:[...document.images].map(i=>({src:i.currentSrc,complete:i.complete,width:i.naturalWidth,visible:i.getClientRects().length>0})),resources:performance.getEntriesByType('resource').map(x=>x.toJSON())})`));}
function probeArt(){
 const urls=[...new Set([...document.querySelectorAll('.ws-menu-card-img,.ws-menu-dots i,.ws-menu-hero')].flatMap(x=>[getComputedStyle(x).backgroundImage,getComputedStyle(x).getPropertyValue('--thumb')]).flatMap(v=>[...v.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m=>m[1])))];
 window.__loadingUpdateArt={done:0,total:urls.length,rows:[]};
 for(const src of urls){const im=new Image();const finish=ok=>{window.__loadingUpdateArt.rows.push({src,ok,width:im.naturalWidth});window.__loadingUpdateArt.done++};im.onload=()=>finish(true);im.onerror=()=>finish(false);im.src=src;}
}
async function art(){await evaluate(`(${probeArt.toString()})();true`);await wait('window.__loadingUpdateArt.done===window.__loadingUpdateArt.total',30000);return JSON.parse(await evaluate('JSON.stringify(window.__loadingUpdateArt)'));}
async function cachedURLs(){
 await evaluate(`window.__loadingUpdateCaches=null;caches.keys().then(names=>Promise.all(names.map(async name=>({name,urls:(await(await caches.open(name)).keys()).map(row=>row.url)})))).then(rows=>{window.__loadingUpdateCaches=rows;});true`);
 await wait('window.__loadingUpdateCaches!==null');return JSON.parse(await evaluate('JSON.stringify(window.__loadingUpdateCaches)'));
}
function shot(name){execFileSync('xcrun',['simctl','io',udid,'screenshot',`${out}/${name}.png`],{stdio:'ignore'});}
const result={before,after,beforePin,afterPin,base,oldVersion,newVersion};
try{
 execFileSync('xcrun',['simctl','launch',udid,'com.apple.mobilesafari'],{stdio:'ignore'});execFileSync('xcrun',['simctl','openurl',udid,base]);await connect();
 await wait('document.querySelector(".ws-main-select") && navigator.serviceWorker.controller!==null');
 await evaluate(`${saveFixtureCode({scope:'device',key:'devMode',data:true})};${saveFixtureCode({scope:'global',key:'settings',data:{volume:0,music:0},merge:true})};setTimeout(()=>location.reload(),50);true`);
 await sleep(500);await connect();await wait('document.documentElement.dataset.dev!==undefined && document.querySelector(".ws-main-select")');
 shot('before-title');result.beforeState=await collect();result.beforeCaches=await cachedURLs();
 current=after;result.switchHost=Date.now();
 await gesture('document.querySelector(".ws-main-select").click()');await sleep(1000);shot('stale-select');result.staleSelect=await collect();result.staleArt=await art();await evaluate(`navigator.serviceWorker.getRegistration().then(r=>{
 const track=()=>{const worker=r.installing;if(worker){window.__loadingUpdate.put('worker-state',{state:worker.state});worker.addEventListener('statechange',()=>window.__loadingUpdate.put('worker-state',{state:worker.state}));}};
 r.addEventListener('updatefound',track);track();window.__loadingUpdate.put('update-request');return r.update();}).catch(e=>window.__loadingUpdate.put('update-error',{message:String(e)}));true`);
 await wait('Boolean(window.__ws_sw?.waiting)',120000);result.waitingHost=Date.now();result.waitingState=await collect();
 if(progressOnly){video=spawn('xcrun',['simctl','io',udid,'recordVideo','--codec=h264',`${out}/update.mp4`],{stdio:'ignore'});await sleep(300);}
 result.tapHost=Date.now();await gesture('window.__loadingUpdate.put("tap");document.querySelector(".ws-update").click();true');
 if(progressOnly){await sleep(80);shot('updating');}
 await sleep(500);await connect();
 await wait(`document.querySelector('.ws-main-select') && document.querySelector('.ws-update')?.textContent?.toLowerCase().includes('${result.newVersion.build.slice(0,7)}')`,120000);
 result.titleHost=Date.now();result.afterState=await collect();result.afterCaches=await cachedURLs();
 if(progressOnly){
  await wait('document.querySelector(".ws-update-screen")===null && JSON.parse(sessionStorage.getItem("__loadingUpdate")??"[]").some(row=>row.kind==="updateTitlePaint")',15000);
  result.afterState=await collect();shot('updated-title');await stopVideo();
  result.transport=transport.receipts;result.htmlFixtures=transport.htmlFixtures;result.report=updateProgressReport(result.afterState.rows);
  writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));
  if(!result.report.pass||result.afterState.accuracy.errors.length>0)throw new Error('Update progress acceptance refused; see event clocks');
 }else{
 await gesture('document.querySelector(".ws-main-select").click()');await sleep(1000);shot('after-select');result.afterSelect=await collect();result.afterArt=await art();
 const names=JSON.parse(await evaluate('JSON.stringify([...document.querySelectorAll(".ws-menu-card > b")].map(x=>x.textContent))'));
 const index=loadingCardIndex(names,'_template');
 await gesture(`document.querySelector('.ws-menu-dots i[data-i="${index}"]').click()`);
 result.templateTapHost=Date.now();await gesture('document.querySelector(".ws-menu-play").click()');
 await sleep(500);await connect();await wait('window.__wildshard?.world && document.querySelector(".ws-load")===null',150000);
 result.templateReadyHost=Date.now();result.templateState=await collect();shot('template-after-update');
 result.transport=transport.receipts;result.htmlFixtures=transport.htmlFixtures;result.report=updateReport(result);writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));
 if(result.report.staleArt.failed.length>0||result.report.newArt.failed.length>0||[result.beforeState,result.staleSelect,result.afterState,result.templateState].some(state=>state.accuracy.errors.length>0))throw new Error('Update art or application fault; see captured states');
 }
 console.log(JSON.stringify(result.report));
} catch(error){result.error=String(error);result.transport=transport.receipts;try{result.failureState=await collect();shot('failure');}catch{/* A lost target must not replace the original refusal. */}writeFileSync(`${out}/failed.json`,JSON.stringify(result,null,2));throw error;}
finally{await stopVideo();try{await evaluate('location.replace("about:blank")');}catch{/* The page already navigated or closed. */}inspector?.close();proxy.kill('SIGTERM');try{execFileSync('xcrun',['simctl','terminate',udid,'com.apple.mobilesafari'],{stdio:'ignore'});}catch{/* Safari is already closed. */}await transport.close();writeFileSync(`${out}/proxy.log`,proxyLog);}
