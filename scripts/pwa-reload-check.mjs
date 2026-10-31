#!/usr/bin/env node
// E519: run through browser-lane.sh against ONE ordinary serve-build preview.
// Virtual A/B/C change only document/build and worker bytes; assets stay on the
// same checked preview. Never register a worker from an observation probe.
import {createServer,request} from 'node:http';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium,webkit,devices,errors as playwrightErrors} from 'playwright';

/** @typedef {'A'|'B'|'C'} Stage */
/** @typedef {import('playwright').Page} Page */
/** @param {string} source */
const digest=source=>createHash('sha256').update(source).digest('hex');

/** One immutable source; no asset bank or repository clone.
 * @param {string} base */
export async function createReloadProxy(base) {
  const origin=new URL(base);
  if(!['127.0.0.1','localhost','[::1]'].includes(origin.hostname)||origin.protocol!=='http:')throw new Error('Use an ordinary loopback serve-build preview');
  const read=async(/** @type {string} */name)=>{
    const response=await fetch(new URL(name,origin));if(!response.ok)throw new Error(`Missing preview ${name}: ${response.status}`);return response.text();
  };
  /** @type {unknown} */
  const version=JSON.parse(await read('/version.json'));
  if(typeof version!=='object'||version===null||!('build' in version)||typeof version.build!=='string'||version.build.length===0)throw new Error('Missing source build identity');
  const sourceBuild=version.build,html=await read('/index.html'),bootstrap=await read('/sw.js');
  const corePath=/importScripts\(["'](\/sw-core\/[a-f0-9]{64}\.js)["']\)/u.exec(bootstrap)?.[1];
  if(corePath===undefined)throw new Error('Unexpected source worker bootstrap');
  const coreResponse=await fetch(new URL(corePath,origin));
  if(!coreResponse.ok)throw new Error(`Missing preview ${corePath}: ${coreResponse.status}`);
  const core=await coreResponse.text(),coreCache=coreResponse.headers.get('cache-control');
  if(coreCache===null)throw new Error('Source worker core has no cache policy');
  if(!corePath.includes(digest(core))||!core.includes(sourceBuild)||!html.includes(sourceBuild))throw new Error('Mixed source document/worker');
  const stamp=sourceBuild.slice(sourceBuild.indexOf('-')+1);
  const builds={A:sourceBuild,B:`bbbbbbb-${stamp}`,C:`ccccccc-${stamp}`};
  const variant=(/** @type {string} */build)=>{
    const worker=core.replaceAll(sourceBuild,build),path=`/sw-core/${digest(worker)}.js`;
    return {build,html:html.replaceAll(sourceBuild,build),core:worker,path,bootstrap:`importScripts(${JSON.stringify(path)});\n`,version:JSON.stringify({...version,build})};
  };
  const variants={A:variant(builds.A),B:variant(builds.B),C:variant(builds.C)};
  /** @type {Stage} */let latest='A';let installDelay=0;
  /** @type {{stage:Stage,path:string,delayMs:number}[]} */const requests=[];
  /** Local receipts only; never forward session identifiers to a remote service.
   * @type {unknown[]} */const telemetry=[];
  /** @type {Set<ReturnType<typeof setTimeout>>} */const timers=new Set();
  /** @type {Set<import('node:http').ClientRequest>} */const upstream=new Set();
  /** @type {Set<import('node:net').Socket>} */const sockets=new Set();let closedWireBytes=0;
  const server=createServer((req,res)=>{
    const path=new URL(req.url??'/',origin).pathname,current=variants[latest];
    if(current===undefined){res.writeHead(500);res.end();return;}
    if(path==='/api/telemetry'&&req.method==='POST'){
      let raw='';req.setEncoding('utf8');
      req.on('data',chunk=>{raw+=String(chunk);});
      req.on('end',()=>{
        /** @type {unknown} */let body;
        try{body=JSON.parse(raw);}catch{res.writeHead(400);res.end();return;}
        /** @param {unknown} value @returns {value is object} */
        const object=value=>typeof value==='object'&&value!==null&&!Array.isArray(value);
        if(Buffer.byteLength(raw)>16384||!object(body)
          ||!('kind' in body)||body.kind!=='session'||!('end' in body)||body.end!=='clean'
          ||!('install' in body)||typeof body.install!=='string'
          ||!('build' in body)||typeof body.build!=='string'
          ||!('heartbeat' in body)||!object(body.heartbeat)
          ||!('session' in body.heartbeat)||typeof body.heartbeat.session!=='string'
          ||!('error' in body.heartbeat)||body.heartbeat.error!==false
          ||!('contextLost' in body.heartbeat)||body.heartbeat.contextLost!==false){
          res.writeHead(400);res.end();return;
        }
        telemetry.push(body);res.writeHead(204,{'Cache-Control':'no-store'});res.end();
      });return;
    }
    const delayMs=path==='/manifest.webmanifest'?installDelay:0;requests.push({stage:latest,path,delayMs});
    const knownCore=Object.values(variants).find(row=>row.path===path);
    const body=path==='/'||path==='/index.html'?current.html:path==='/version.json'?current.version:path==='/sw.js'?current.bootstrap:knownCore?.core;
    if(body!==undefined){
      if(path==='/'||path==='/index.html')res.setHeader('X-PWA-Repro-Network-Document','1');
      const etag=`W/"${digest(body)}"`;
      res.setHeader('Content-Type',path==='/version.json'?'application/json':path==='/'||path==='/index.html'?'text/html; charset=utf-8':'text/javascript; charset=utf-8');
      res.setHeader('Cache-Control',knownCore===undefined?path==='/version.json'?'no-store':'no-cache':coreCache);res.setHeader('ETag',etag);
      if(req.headers['if-none-match']===etag){res.writeHead(304);res.end();}
      else if(knownCore!==undefined&&coreResponse.headers.get('content-encoding')==='gzip'
        &&req.headers['accept-encoding']?.split(',').some(value=>value.trim()==='gzip')){
        res.setHeader('Content-Encoding','gzip');res.setHeader('Vary','Accept-Encoding');res.end(gzipSync(body));
      }else res.end(body);
      return;
    }
    const forward=()=>{
      const headers={...req.headers,host:origin.host};delete headers.connection;
      const stream=request(new URL(req.url??'/',origin),{method:req.method,headers},reply=>{res.writeHead(reply.statusCode??502,reply.headers);reply.pipe(res);});
      upstream.add(stream);stream.on('close',()=>{upstream.delete(stream);});
      stream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});
      res.on('close',()=>{stream.destroy();});req.pipe(stream);
    };
    if(delayMs===0)forward();else{
      const timer=setTimeout(()=>{timers.delete(timer);if(!res.destroyed)forward();},delayMs);timers.add(timer);
      res.on('close',()=>{clearTimeout(timer);timers.delete(timer);});
    }
  });
  server.on('connection',socket=>{
    sockets.add(socket);socket.on('close',()=>{closedWireBytes+=socket.bytesWritten;sockets.delete(socket);});
  });
  await new Promise(/** @param {(value:unknown)=>void} _resolve */_resolve=>{server.listen(0,'127.0.0.1',()=>_resolve(undefined));});
  const address=server.address();if(address===null||typeof address==='string')throw new Error('Missing reload proxy address');
  return {
    url:`http://127.0.0.1:${address.port}/`,sourceBuild,builds,requests,telemetry,
    wireBytes(){let total=closedWireBytes;for(const socket of sockets)total+=socket.bytesWritten;return total;},
    /** @param {Stage} stage @param {number} [delay] */
    deploy(stage,delay=0){latest=stage;installDelay=delay;},
    async verifySource(){/** @type {unknown} */const final=JSON.parse(await read('/version.json'));if(typeof final!=='object'||final===null||!('build' in final)||final.build!==sourceBuild)throw new Error('Served source changed during reload check');},
    async close(){for(const timer of timers)clearTimeout(timer);for(const stream of upstream)stream.destroy();server.closeAllConnections();await new Promise(/** @param {(value:unknown)=>void} _resolve */_resolve=>{server.close(()=>_resolve(undefined));});},
  };
}

/** Observation uses getRegistration and BUILD messages only: no register/update job.
 * @param {Page} page */
function state(page) {
  return page.evaluate(async()=>{
    /** @param {ServiceWorker|null|undefined} worker */
    const build=worker=>worker===null||worker===undefined?Promise.resolve(null):new Promise(/** @param {(value:string|null)=>void} _resolve */_resolve=>{
      const channel=new MessageChannel();
      let timer=0;
      const finish=(/** @type {string|null} */value)=>{window.clearTimeout(timer);channel.port1.close();channel.port2.close();_resolve(value);};
      timer=window.setTimeout(()=>finish(null),2000);
      channel.port1.onmessage=event=>{/** @type {unknown} */const data=event.data;finish(typeof data==='object'&&data!==null&&'build' in data&&typeof data.build==='string'?data.build:null);};
      try{worker.postMessage({type:'BUILD'},[channel.port2]);}catch{finish(null);}
    });
    const registration=await navigator.serviceWorker.getRegistration(),pill=document.querySelector('.ws-update');
    /** @type {unknown} */const documentBuild=Reflect.get(globalThis,'__WS_BUILD_ID__');
    return {doc:typeof documentBuild==='string'?documentBuild:null,controller:await build(navigator.serviceWorker.controller),waiting:await build(registration?.waiting),installing:registration?.installing?.state??null,
      lit:pill?.classList.contains('newer')===true,text:pill?.textContent,title:document.querySelector('#hud.intro .ws-menu:not(.hide), #hud.intro .ws-main:not(.hide)')!==null};
  });
}

/** @param {Page} page */
async function foreground(page){await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));}
/** Observe the mounted title pill and two real paints before a manual action.
 * @param {Page} page */
async function titleReady(page){
  await page.locator('.ws-update.visible').waitFor({state:'visible',timeout:45000});
  await page.evaluate(()=>new Promise(/** @param {(value:unknown)=>void} _resolve */_resolve=>{requestAnimationFrame(()=>{requestAnimationFrame(()=>_resolve(undefined));});}));
}
/** This ruler starts from an installed A, not a fabricated game-control event.
 * First-install timing belongs to the separate original phone-preset check.
 * @param {Page} page */
async function installFixtureWorker(page){
  await page.evaluate(async()=>{
    if(await navigator.serviceWorker.getRegistration()===undefined)await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'all'});
    await navigator.serviceWorker.ready;
  });
}
/** @param {Page} page @param {string} target */
async function waitingFor(page,target){
  const ready=await page.evaluate(async expected=>{
    const found=await navigator.serviceWorker.getRegistration();if(found===undefined)return false;
    const registration=found;
    return new Promise(/** @param {(value:boolean)=>void} _resolve */_resolve=>{
      /** @type {Set<ServiceWorker>} */const tracked=new Set(),queried=new Set();
      /** @type {Set<MessageChannel>} */const channels=new Set();
      let timer=0;
      const finish=(/** @type {boolean} */value)=>{
        window.clearTimeout(timer);registration.removeEventListener('updatefound',inspect);
        for(const worker of tracked)worker.removeEventListener('statechange',inspect);
        for(const channel of channels){channel.port1.close();channel.port2.close();}
        _resolve(value);
      };
      const track=(/** @type {ServiceWorker|null} */worker)=>{if(worker!==null&&!tracked.has(worker)){tracked.add(worker);worker.addEventListener('statechange',inspect);}};
      function inspect(){
        track(registration.installing);const worker=registration.waiting;
        if(worker===null||queried.has(worker))return;
        queried.add(worker);track(worker);
        const channel=new MessageChannel();channels.add(channel);
        channel.port1.onmessage=event=>{
          /** @type {unknown} */const data=event.data;
          channel.port1.close();channel.port2.close();channels.delete(channel);
          if(typeof data==='object'&&data!==null&&'build' in data&&typeof data.build==='string'&&data.build.startsWith(`${expected}-`))finish(true);
        };
        try{worker.postMessage({type:'BUILD'},[channel.port2]);}catch{channel.port1.close();channel.port2.close();channels.delete(channel);}
      }
      timer=window.setTimeout(()=>finish(false),60000);
      registration.addEventListener('updatefound',inspect);inspect();
    });
  },target);
  if(!ready)throw new playwrightErrors.TimeoutError(`Waiting worker did not deliver ${target} within60s`);
}
/** @param {Page} page */
async function tap(page){
  const navigation=page.waitForEvent('load',{timeout:8000}).then(()=>true,()=>false);
  await page.locator('.ws-update').tap();const loaded=await navigation;if(loaded)await titleReady(page);return loaded;
}

/** @param {string} base @param {'webkit'|'chromium'} engine @param {string[]} scenarios @param {boolean} fixed */
export async function checkReloads(base,engine,scenarios,fixed) {
  const proxy=await createReloadProxy(base);
  /** @type {import('playwright').Browser|undefined} */let browser;
  /** @type {unknown[]} */const results=[];
  try {
    browser=await(engine==='webkit'?webkit:chromium).launch(engine==='chromium'?{args:['--mute-audio','--use-angle=metal']}:{});
    for(const scenario of scenarios){
      proxy.deploy('A');
      const context=await browser.newContext({...devices['iPhone 16 Pro']});
      await context.addInitScript(()=>{if(location.protocol==='http:'){const url=new URL(location.href);url.searchParams.set('mute','1');history.replaceState(history.state,'',url);}});
      const page=await context.newPage();
      /** @type {string[]} */const errors=[];
      /** @type {{url:string,status:number,method:string,body:string|null}[]} */const httpErrors=[];
      /** An HTML fetch/precache is not a navigation. The origin marker cannot
       * appear on the controlling worker's baked DOCUMENT response.
       * @type {{url:string,network:boolean}[]} */const navigations=[];
      page.on('pageerror',error=>errors.push(error.stack??error.message));page.on('console',message=>{if(message.type()==='error')errors.push(`${message.text()} ${JSON.stringify(message.location())}`);});
      page.on('response',response=>{
        if(response.status()>=400)httpErrors.push({url:response.url(),status:response.status(),method:response.request().method(),body:response.request().postData()});
        if(response.request().isNavigationRequest())navigations.push({url:response.url(),network:response.headers()['x-pwa-repro-network-document']==='1'});
      });
      const started=performance.now(),requestStart=proxy.requests.length;let taps=0,manualReloads=0,timeout=null;
      /** @type {number[]} */const warmReloadBytes=[];
      /** @type {Awaited<ReturnType<typeof state>>[]} */const observations=[];
      try {
        await page.goto(proxy.url,{waitUntil:'load'});
        if(navigations.at(-1)?.network!==true)throw new Error('Uncontrolled A did not expose the origin document marker');
        await installFixtureWorker(page);
        await page.reload({waitUntil:'load'});
        await page.waitForFunction(()=>navigator.serviceWorker.controller!==null&&document.querySelector('#hud.intro .ws-menu:not(.hide), #hud.intro .ws-main:not(.hide)')!==null,null,{timeout:45000});
        await titleReady(page);
        if(navigations.at(-1)?.network!==false)throw new Error('Installed A did not serve its own controlled document');
        // Let the ordinary title prefetch finish; never stop or omit its work.
        // This primes a warm origin, not a cold-loading performance sample.
        await page.waitForLoadState('networkidle',{timeout:45000});
        observations.push(await state(page));
        const warmStart=proxy.requests.length,wireStart=proxy.wireBytes(),navigationStart=navigations.length;
        if(scenario==='no-deploy'){
          for(let index=0;index<3;index++){
            const before=proxy.wireBytes();await page.reload({waitUntil:'load'});await titleReady(page);
            await page.waitForLoadState('networkidle',{timeout:45000});
            warmReloadBytes.push(proxy.wireBytes()-before);manualReloads++;observations.push(await state(page));
          }
        }else{
          if(scenario==='abc-mid-install'){
            proxy.deploy('B');await foreground(page);await waitingFor(page,proxy.builds.B);
            proxy.deploy('C',25000);
          }else{proxy.deploy('B',scenario==='ab-delayed'?25000:0);}
          await foreground(page);
          const target=scenario==='abc-mid-install'?proxy.builds.C:proxy.builds.B;
          if(fixed&&scenario==='abc-mid-install')await page.waitForFunction(()=>document.querySelector('.ws-update')?.classList.contains('newer')===false,null,{timeout:8000,polling:100});
          try{for(let index=0;index<(fixed?1:8);index++){
            await page.waitForFunction(()=>document.querySelector('.ws-update')?.classList.contains('newer')===true,null,{timeout:60000,polling:100});
            const offered=await state(page);observations.push(offered);
            if(fixed&&offered.waiting?.startsWith(`${target}-`)!==true)throw new Error('Pill offered a worker that cannot deliver the newest build');
            await tap(page);taps++;observations.push(await state(page));
            const current=observations.at(-1);if(current?.doc===target&&!current.lit)break;
            if(index===0){
              await waitingFor(page,target);const installed=await state(page);observations.push(installed);
              if(installed.waiting?.startsWith(`${target}-`)!==true)throw new Error('Install wait returned before the exact worker was waiting');
            }
          }}catch(error){if(fixed||!(error instanceof playwrightErrors.TimeoutError))throw error;timeout=error.message;}
        }
        if((scenario==='ab-delayed'||scenario==='abc-mid-install')&&!proxy.requests.slice(requestStart).some(row=>row.delayMs===25000))throw new Error('Delayed install did not request its delayed shell asset');
        const final=await state(page),target=scenario==='no-deploy'?proxy.builds.A:scenario==='abc-mid-install'?proxy.builds.C:proxy.builds.B;
        const aligned=observations.every(row=>row.doc!==null&&row.controller?.startsWith(`${row.doc}-`)===true);
        const networkDocuments=navigations.slice(navigationStart).filter(row=>row.network).length;
        const originHtmlRequests=proxy.requests.slice(warmStart).filter(row=>row.path==='/'||row.path==='/index.html').length;
        const warmWireBytes=scenario==='no-deploy'?proxy.wireBytes()-wireStart:null;
        const passed=aligned&&networkDocuments===0&&warmReloadBytes.every(bytes=>bytes<100000)&&final.doc===target&&!final.lit&&(scenario==='no-deploy'?taps===0:taps===1)&&final.controller?.startsWith(`${target}-`)===true;
        const warmRequests=scenario==='no-deploy'?proxy.requests.slice(warmStart):null;
        const result={engine,scenario,sourceBuild:proxy.sourceBuild,target,taps,manualReloads,passed,aligned,networkDocuments,originHtmlRequests,navigations:navigations.slice(navigationStart),setup:'explicit A install and network-quiet title; not a cold phone profile',warmWireBytes,warmReloadBytes,warmBudgetPerReload:100000,warmRequests,timeout,elapsedMs:performance.now()-started,final,observations,errors,httpErrors};results.push(result);console.log(JSON.stringify(result));
        if(errors.length>0||httpErrors.length>0)throw new Error(`Unexpected browser errors: ${errors.join('; ')} ${JSON.stringify(httpErrors)}`,{cause:result});
        if(fixed&&!passed)throw new Error(`One-tap contract failed: ${engine}/${scenario}`,{cause:result});
      }finally{await context.close();}
    }
    await proxy.verifySource();return {engine,sourceBuild:proxy.sourceBuild,results,requests:proxy.requests,telemetry:proxy.telemetry};
  }finally{await browser?.close();await proxy.close();}
}

/** G872: whole-process close/relaunch stand-in for the unavailable Simulator GUI.
 * The SAME profile and origin survive; no registration or cache is cleared.
 * @param {string} base */
export async function checkRestart(base){
  const proxy=await createReloadProxy(base);mkdirSync(resolve('tmp'),{recursive:true});
  const profile=mkdtempSync(resolve('tmp/pwa-reload-profile-'));
  /** @type {import('playwright').BrowserContext|undefined} */let context;
  /** @type {string[]} */const errors=[];
  const launch=async()=>{
    const owner=await webkit.launchPersistentContext(profile,{...devices['iPhone 16 Pro']});
    await owner.addInitScript(()=>{if(location.protocol==='http:'){const url=new URL(location.href);url.searchParams.set('mute','1');history.replaceState(history.state,'',url);}});
    const page=owner.pages()[0]??await owner.newPage();
    page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    page.on('response',response=>{if(response.status()>=400)errors.push(`HTTP${response.status()} ${response.url()}`);});
    return {owner,page};
  };
  try{
    let opened=await launch();context=opened.owner;let page=opened.page;
    await page.goto(proxy.url,{waitUntil:'load'});
    await installFixtureWorker(page);await page.reload({waitUntil:'load'});
    await page.waitForSelector('#hud.intro .ws-menu:not(.hide), #hud.intro .ws-main:not(.hide)',{timeout:45000});await titleReady(page);
    proxy.deploy('B',25000);await foreground(page);
    await page.waitForFunction(()=>document.querySelector('.ws-update')?.classList.contains('newer')===true);
    await tap(page);await waitingFor(page,proxy.builds.B);await tap(page);
    const wedged=await state(page),cacheBefore=await page.evaluate(()=>caches.keys());
    if(wedged.doc!==proxy.builds.A||wedged.waiting?.startsWith(`${proxy.builds.B}-`)!==true||!wedged.lit)throw new Error('Baseline did not wedge before whole-process close');
    await context.close();context=undefined;
    opened=await launch();context=opened.owner;page=opened.page;
    await page.goto(proxy.url,{waitUntil:'load'});
    await page.waitForSelector('#hud.intro .ws-menu:not(.hide), #hud.intro .ws-main:not(.hide)',{timeout:45000});await titleReady(page);
    const afterRestart=await state(page),cacheAfter=await page.evaluate(()=>caches.keys());
    const profileRetained=afterRestart.controller!==null&&cacheAfter.some(key=>cacheBefore.includes(key));
    let tapsAfterRestart=0;
    if(profileRetained&&afterRestart.doc===proxy.builds.A){
      try{
        await page.waitForFunction(()=>{/** @type {unknown} */const api=Reflect.get(globalThis,'__ws_sw');return typeof api==='object'&&api!==null&&'waiting' in api&&api.waiting!==null;},null,{timeout:8000});
        await tap(page);tapsAfterRestart++;
      }catch(error){if(!(error instanceof playwrightErrors.TimeoutError))throw error;}
    }
    const final=await state(page),survived=profileRetained?final.doc!==proxy.builds.B||final.controller?.startsWith(`${proxy.builds.B}-`)!==true||final.lit:null;
    const result={scenario:'kill-mid-install',engine:'webkit',sourceBuild:proxy.sourceBuild,profileRetained,tapsBeforeClose:2,tapsAfterRestart,survived,wedged,afterRestart,final,cacheBefore,cacheAfter,errors};
    console.log(JSON.stringify(result));await proxy.verifySource();
    if(errors.length>0)throw new Error(`Unexpected browser errors: ${errors.join('; ')}`,{cause:result});
    if(!profileRetained)throw new Error('Persistent WebKit did not retain its worker/cache profile; kill finding is unavailable',{cause:result});
    return result;
  }finally{await context?.close();await proxy.close();rmSync(profile,{recursive:true,force:true});}
}

async function main(){
  const args=process.argv.slice(2),value=(/** @type {string} */name)=>args.find(arg=>arg.startsWith(`--${name}=`))?.slice(name.length+3);
  const base=value('base'),engine=value('engine')??'webkit',out=value('out')??'tmp/pwa-reload/reading.json',fixed=value('expect')==='one';
  if(base===undefined||!['webkit','chromium','both'].includes(engine))throw new Error('browser-lane.sh node scripts/pwa-reload-check.mjs --base=http://127.0.0.1:PORT --engine=webkit|chromium|both [--expect=one] [--out=tmp/...json]');
  const scenarios=value('scenario')?.split(',')??['no-deploy','ab-immediate','ab-delayed','abc-mid-install'];
  if(scenarios.some(name=>!['no-deploy','ab-immediate','ab-delayed','abc-mid-install','kill-mid-install'].includes(name))||(scenarios.includes('kill-mid-install')&&scenarios.length!==1))throw new Error('Unknown reload scenario');
  const results=[];
  try{
    if(scenarios.length===1&&scenarios[0]==='kill-mid-install')results.push(await checkRestart(base));
    else for(const selected of engine==='both'?['webkit','chromium']:[engine]){
      if(selected!=='webkit'&&selected!=='chromium')throw new Error('Unknown browser');results.push(await checkReloads(base,selected,scenarios,fixed));
    }
  }catch(error){
    if(error instanceof Error&&error.cause!==undefined)results.push({refused:true,message:error.message,reading:error.cause});
    throw error;
  }finally{mkdirSync(dirname(resolve(out)),{recursive:true});writeFileSync(out,JSON.stringify(results,null,2));}
}
if(process.argv[1]!==undefined&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
