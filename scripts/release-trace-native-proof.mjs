// Outside-hook real CDP control: post-sample inspection must not be recorded.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {chromium,devices} from 'playwright';
import {KEYCHAIN_ARGS} from './chromium-keychain.mjs';
import {profileReleaseWorker as current} from './release-worker-profile.mjs';
const baseline=process.argv.find(arg=>arg.startsWith('--baseline='))?.slice(11);
let profile=current;
if(baseline!==undefined){
  assert.match(baseline,/^[a-f0-9]{40}$/u);
  const source=execFileSync('git',['show',`${baseline}:scripts/release-worker-profile.mjs`],{encoding:'utf8'});
  const imported=source.replace("'./release-port-profile.mjs'",JSON.stringify(new URL('./release-port-profile.mjs',import.meta.url).href));
  profile=(await import('data:text/javascript;base64,'+Buffer.from(imported).toString('base64'))).profileReleaseWorker;
}
const out=resolve('tmp/codex-release/trace-native');mkdirSync(out,{recursive:true});
const server=createServer((request,response)=>{
  response.setHeader('Content-Type',request.url==='/worker.js'?'text/javascript':'text/html');
  response.end(request.url==='/worker.js'?'setInterval(()=>{let n=0;for(let i=0;i<10000;i++)n+=Math.sqrt(i);globalThis.last=n;},16);':'<!doctype html><title>Native trace boundary</title>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser,stop;
const watchdog=setTimeout(()=>{process.exitCode=1;void browser?.close().catch(error=>console.error('Native proof browser cleanup refused',error));server.close();},8000);watchdog.unref();
try{
  browser=await chromium.launch({headless:true,args:[...KEYCHAIN_ARGS,'--mute-audio']});
  const context=await browser.newContext({...devices['iPhone 16 Pro'],deviceScaleFactor:2});
  const page=await context.newPage(),address=server.address();assert(address!==null&&typeof address!=='string');
  const origin=`http://127.0.0.1:${address.port}`;await page.goto(origin);
  const workerReady=page.waitForEvent('worker');await page.evaluate(()=>{globalThis.fixtureWorker=new Worker('/worker.js');});const worker=await workerReady;
  const marker='release-post-sample-source-inspection';let marked=false,closedStreams=0;
  const refuseEnd=process.argv.includes('--refuse-end-response');
  const observing={newBrowserCDPSession:async()=>{
    const root=await browser.newBrowserCDPSession();
    return new Proxy(root,{get(target,key){
      if(key==='send')return async(method,params)=>{
        if(method==='IO.close')closedStreams++;
        if(refuseEnd&&method==='Tracing.end'){await target.send(method,params);throw new Error('Owned native end response refusal');}
        if(!marked&&method==='Target.sendMessageToTarget'&&JSON.parse(params.message).method==='Debugger.enable'){
          marked=true;await page.evaluate(marker=>console.timeStamp(marker),marker);
        }
        return target.send(method,params);
      };
      const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
    }});
  }};
  const file=resolve(out,'capture.json');
  stop=await profile(observing,worker.url(),file,{durationMs:200,page});
  await new Promise(resolve=>setTimeout(resolve,250));
  if(refuseEnd){
    await assert.rejects(stop,/Owned native end response refusal/u);stop=undefined;
    assert.equal(closedStreams,1,'the accepted native stream must close despite its refused response');
    const cpu=JSON.parse(readFileSync(file.replace(/\.json$/u,'-cpu.json'),'utf8'));
    assert(cpu.profile.samples.length>0);assert.match(cpu.traceError,/Owned native end response refusal/u);
    console.log(JSON.stringify({native:true,refusalPreserved:true,closedStreams,baseline:baseline??null}));
  }else{
    const result=await stop();stop=undefined;
    assert(marked,'actual post-sample source inspection ran');
    const trace=JSON.parse(gunzipSync(readFileSync(result.trace.file)).toString());
    assert.equal(trace.traceEvents.some(event=>event.name==='TimeStamp'&&event.args?.data?.message===marker),false,'native trace must exclude actual post-sample inspection');
    assert(result.profile.samples.length>0);assert(result.trace.bytes<=128*1024*1024);
    console.log(JSON.stringify({native:true,postSampleInspection:true,traceBytes:result.trace.bytes,samples:result.profile.samples.length,baseline:baseline??null}));
  }
}finally{
  try{await stop?.().catch(()=>undefined);}finally{try{await browser?.close();}finally{server.close();clearTimeout(watchdog);}}
}
