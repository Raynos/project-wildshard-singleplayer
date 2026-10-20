import {chromium,devices} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {exactInventory,verifyHostReceipt} from '../selected-native-view/identity.mjs';
import {installTransport} from './adapter.mjs';
const {values}=parseArgs({options:Object.fromEntries(['host','baseline-evidence','transport','output','chrome'].map(name=>[name,{type:'string'}]))});
for(const key of ['host','baseline-evidence','transport','output','chrome'])if(!values[key])throw new Error(`Required --${key}`);
const directory=resolve(import.meta.dirname),host=resolve(values.host);
const output=resolve(values.output);mkdirSync(output); // Refuse overwrite.
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=p=>readFileSync(resolve(host,p));
const verify=()=>{const receipt=read('selected-view-host-files.json'),files=exactInventory(host);verifyHostReceipt(JSON.parse(receipt),files,read('conch-preview.json'));return {receiptSha256:hash(receipt),files};};
const before=verify(),transportBytes=readFileSync(resolve(values.transport)),transport=JSON.parse(transportBytes);
const old=JSON.parse(readFileSync(resolve(values['baseline-evidence'],'actual-runtime-geometry.json')));
const report={schema:'wildshard.conch.source-surface-transport.v1',host:'retained-selected-view-attempt3',scope:'REST-only transport control. Not current public Arena Conch4, performance, gameplay, visual or runtime admission.',startedAt:new Date().toISOString(),hostBefore:before,transportSha256:hash(transportBytes),scriptHashes:Object.fromEntries(['prepare.py','adapter.mjs','capture.mjs'].map(p=>[p,hash(readFileSync(resolve(directory,p)))])),pairs:[],errors:[],completed:false};
const save=()=>writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const server=createServer((req,res)=>{const pathname=new URL(req.url??'/','http://localhost').pathname;const path=resolve(host,'.'+(pathname==='/'?'/index.html':pathname));if(!path.startsWith(host+sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.glb':'model/gltf-binary'})[extname(path)]??'application/octet-stream');res.end(readFileSync(path));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,page;
try{
 browser=await chromium.launch({executablePath:resolve(values.chrome),headless:true,args:['--mute-audio','--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({...devices['iPhone 16 Pro'],viewport:{width:402,height:874},deviceScaleFactor:1});page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>{report.errors.push(e.message);save();});
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});await page.locator('#practice-start').tap();await page.waitForFunction(()=>window.__practiceDemo?.arena.activeTargets.length===1);
 const setup=await page.evaluate(installTransport,transport);writeFileSync(resolve(output,'setup.json'),JSON.stringify(setup)+'\n');
 if(JSON.stringify(setup.setup.geometry)!==JSON.stringify(old.geometry))throw new Error('Retained baseline geometry/material/bind snapshot differs from original capture');
 report.baselineMatchesOriginal=true;report.setupChecks=setup.checks;save();
 for(const view of ['front','left','right','back','top','diag-front','diag-left','diag-right','diag-back']){
  const {captures,shaderSources,...observation}=await page.evaluate(view=>window.__transport.capture(view),view);
  const shaders=shaderSources.map(rows=>rows.map(row=>{const sha=hash(row.source),file=`shader-${sha}.glsl`;writeFileSync(resolve(output,file),row.source);return {type:row.type,sha256:sha,file};}));
  const images={};for(const [variant,url] of Object.entries(captures)){const bytes=Buffer.from(url.split(',')[1],'base64'),file=`${view}-${variant}.png`;writeFileSync(resolve(output,file),bytes,{flag:'wx'});images[variant]={file,sha256:hash(bytes),bytes:bytes.length};}
  const file=`${view}-observation.json`;writeFileSync(resolve(output,file),JSON.stringify({...observation,shaders,images})+'\n',{flag:'wx'});report.pairs.push({view,file,images});save();console.log(`Captured ${view}`);
 }
 report.hostAfter=verify();if(JSON.stringify(report.hostAfter)!==JSON.stringify(before))throw new Error('Retained host bytes changed');report.completed=report.pairs.length===9&&report.errors.length===0;
}catch(e){report.errors.push(String(e));throw e;}finally{
 if(page){try{report.restored=await page.evaluate(()=>window.__transport?.restore()??{notInstalled:true});}catch(e){report.errors.push(`Restoration: ${e}`);}}
 await browser?.close();await new Promise(r=>server.close(r));report.finishedAt=new Date().toISOString();save();
}
console.log(JSON.stringify({completed:report.completed,pairs:report.pairs.length,restored:report.restored}));
