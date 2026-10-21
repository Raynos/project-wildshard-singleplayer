// Reproduce hashed worker-core cache reuse and eviction through browser-lane.
// Run Node with --experimental-transform-types --import ./scripts/sim-node-loader.mjs.
import http from 'node:http';
import {createHash,randomBytes} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {chromium,devices} from 'playwright';
import {workerScripts} from '../../vite/pwa-plugin.ts';

const out=process.argv.find(value=>value.startsWith('--out='))?.slice(6);
if(!out)throw new Error('Requires --out=receipt.json');
const results=[];
const pressure=Number(process.argv.find(value=>value.startsWith('--pressure='))?.slice(11)??0);
if(!Number.isSafeInteger(pressure)||pressure<0||pressure>192)throw new Error('Pressure must be an integer in 0..192 MiB');
const pressureBody=pressure>0?randomBytes(1024*1024):null;
const browser=await chromium.launch({headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 for(const encoding of ['identity','gzip']){
  let version='first';const requests=[],cores=new Map();
  const current=()=>{
   const core=`const version=${JSON.stringify(version)};self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));self.addEventListener('message',event=>{if(event.data==='VERSION')event.ports[0].postMessage(version)});/*${'bounded fixture '.repeat(3600)}*/`;
   const scripts=workerScripts(core);cores.set(`/${scripts.fileName}`,core);return scripts;
  };
  const server=http.createServer((request,response)=>{
   const path=new URL(request.url,'http://local').pathname,scripts=current();
   if(path.startsWith('/pressure/')&&pressureBody!==null){
    response.writeHead(200,{'content-type':'application/octet-stream','cache-control':'public, max-age=31536000, immutable','content-length':String(pressureBody.length)});
    response.end(pressureBody);return;
   }
   if(path==='/sw.js'||cores.has(path)){
    const body=path==='/sw.js'?scripts.bootstrap:cores.get(path),etag=`"${createHash('sha256').update(body).digest('hex')}"`;
    const status=request.headers['if-none-match']===etag?304:200;
    const wire=encoding==='gzip'&&path!=='/sw.js'?gzipSync(body):Buffer.from(body);
    requests.push({path,status,bodyBytes:status===304?0:wire.length,requestHeaders:request.headers});
    response.writeHead(status,{'content-type':'application/javascript','cache-control':path==='/sw.js'?'no-cache':'public, max-age=31536000, immutable',etag,
      ...(encoding==='gzip'&&path!=='/sw.js'?{'content-encoding':'gzip'}:{}),'content-length':status===304?'0':String(wire.length)});
    response.end(status===304?undefined:wire);return;
   }
   response.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});
   response.end(`<!doctype html><title>Worker core Chromium probe</title><script>
window.ready=false;window.version=null;window.error=null;
async function refresh(){const channel=new MessageChannel();window.version=await new Promise(resolve=>{channel.port1.onmessage=event=>resolve(event.data);navigator.serviceWorker.controller.postMessage('VERSION',[channel.port2])})}
navigator.serviceWorker.addEventListener('controllerchange',refresh);
(async()=>{try{window.reg=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'all'});await navigator.serviceWorker.ready;if(navigator.serviceWorker.controller)await refresh();window.ready=true}catch(error){window.error=String(error)}})();
</script>`);
  });
  await new Promise(resolve=>{server.listen(0,'127.0.0.1',resolve);});
  const address=server.address();
  if(address===null||typeof address==='string')throw new Error('Probe server did not bind');
  const base=`http://127.0.0.1:${address.port}`;
  const {defaultBrowserType:_engine,...phone}=devices['iPhone 16 Pro'];
  const context=await browser.newContext(phone);
  let page=await context.newPage();
  const ready=async()=>{await page.waitForFunction(()=>window.ready&&window.version==='first',undefined,{timeout:30000});};
  const update=async phase=>{const from=requests.length;await page.evaluate(()=>window.reg.update());await page.waitForTimeout(500);results.push({encoding,phase,mode:await page.evaluate(()=>window.reg.updateViaCache),requests:requests.slice(from)});};
  try{
   await page.goto(base);await ready();results.push({encoding,phase:'register',requests:[...requests]});
   await update('unchanged-same-page');
   if(pressure>0){
    await page.evaluate(async count=>{for(let at=0;at<count;at++)await(await fetch(`/pressure/${at}.bin`)).arrayBuffer();},pressure);
    await update('unchanged-after-cache-pressure');
   }
   await page.close();await new Promise(resolve=>{setTimeout(resolve,1000);});
   const from=requests.length;page=await context.newPage();await page.goto(base);await ready();await page.waitForTimeout(1000);
   results.push({encoding,phase:'unchanged-new-page',requests:requests.slice(from)});
   await update('unchanged-after-new-page');
   version='other';await update('changed-core');await page.waitForFunction(()=>window.version==='other',undefined,{timeout:30000});
   results.push({encoding,phase:'changed-core-reached-client',version:await page.evaluate(()=>window.version)});
  }finally{await context.close();await new Promise(resolve=>{server.close(resolve);});}
 }
}finally{await browser.close();mkdirSync(dirname(out),{recursive:true});writeFileSync(out,`${JSON.stringify({pressureMiB:pressure,results},null,2)}\n`);}
console.info(JSON.stringify(results));
