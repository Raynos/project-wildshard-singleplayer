/** Nine exact synchronous source/native pairs from the actual isolated faceted arena. No movie. */
import { execFileSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { verifySelectedViewCaptureIdentity, newCaptureDirectory, hash } from '../selected-native-color-view/identity.mjs';
import { DIST, ROOT } from '../selected-native-color-view/build.mjs';

if(process.env.CHROME_PATH!==resolve('tmp/dot-audit/tools/chrome-headless-shell-linux64/chrome-headless-shell')) throw new Error('Only the approved installed Chrome may be used');
if(process.env.CONCH_QA_URL || process.env.CONCH_QA_DIST) throw new Error('No alternate host allowed');
const { installReceivedShadowDiagnostic } = await import('./adapter.mjs');
const before=verifySelectedViewCaptureIdentity();
const output=newCaptureDirectory(process.env.CONCH_QA_OUT ?? 'tmp/conch-color-view-qa/received-shadow-attempt1');
const report={schema:'wildshard.conch.received-shadow-diagnostic.v1',startedAt:new Date().toISOString(),identityBefore:before,
  appearance:'Received shadow diagnostic only. Exact actual candidate and original materials. receiveShadow true/false/restored; no appearance promotion.',
  scope:'Paired rest diagnostic; no animation, visual admission, gameplay cadence or physical-phone claim.',pairs:[],errors:[],completed:false};
const save=()=>writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2)+'\n');save();
const built=resolve(ROOT,DIST), server=createServer((req,res)=>{
  const path=resolve(built,`.${new URL(req.url??'/','http://localhost').pathname==='/'?'/index.html':new URL(req.url??'/','http://localhost').pathname}`);
  if(!path.startsWith(`${built}${sep}`)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.glb':'model/gltf-binary'})[extname(path)]??'application/octet-stream');res.end(readFileSync(path));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(4493,'127.0.0.1',r));
let browser;
try {
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--mute-audio','--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({...devices['iPhone 16 Pro'],viewport:{width:402,height:874},deviceScaleFactor:1});
  const page=await context.newPage();page.setDefaultTimeout(120000);
  page.on('pageerror',error=>{report.errors.push(error.message);save();});
  await page.goto('http://127.0.0.1:4493/',{waitUntil:'domcontentloaded'});
  await page.locator('#practice-start').tap();
  await page.waitForFunction(()=>window.__practiceDemo?.arena.entered===true || !document.querySelector('#practice-start')?.disabled);
  if(!await page.evaluate(()=>window.__practiceDemo?.arena.entered===true)) throw new Error(await page.locator('#practice-status').textContent()??'Boot failed');
  await page.waitForFunction(()=>window.__practiceDemo?.arena.activeTargets.length===1);
  report.setup=await page.evaluate(installReceivedShadowDiagnostic);save();
  const setup=await page.evaluate(()=>window.__installSelectedComparison());
  writeFileSync(`${output}/actual-runtime-geometry.json`,JSON.stringify(setup)+'\n');
  for(const view of ['front','left','right','back','top','diag-front','diag-left','diag-right','diag-back']) {
    await page.evaluate(view=>{const s=window.__selectedComparison;s.view=view;s.variant='native';window.__receivedShadowDiagnostic.result=null;window.__receivedShadowDiagnostic.request=true;},view);
    await page.waitForFunction(()=>window.__receivedShadowDiagnostic.error!==null || window.__receivedShadowDiagnostic.result!==null);
    const result=await page.evaluate(()=>({error:window.__receivedShadowDiagnostic.error,result:window.__receivedShadowDiagnostic.result}));
    if(result.error)throw new Error(result.error);
    const {captures,...pair}=result.result;
    const images={};
    for(const variant of ['on','off','restored']) {
      const bytes=Buffer.from(captures[variant].split(',')[1],'base64');
      images[variant]={sha256:hash(bytes),bytes:bytes.length};
      if(variant!=='restored'){const name=`${view}-${variant}.png`;writeFileSync(`${output}/${name}`,bytes,{flag:'wx'});images[variant].file=name;}
    }
    pair.images=images;
    pair.onRestoredByteIdentical=images.on.sha256===images.restored.sha256;
    pair.onOffByteIdentical=images.on.sha256===images.off.sha256;
    writeFileSync(`${output}/${view}-observation.json`,JSON.stringify(pair,null,2)+'\n',{flag:'wx'});
    report.pairs.push(pair);save();
  }
  report.restored=await page.evaluate(()=>window.__receivedShadowDiagnostic.restore());
  report.identityAfter=verifySelectedViewCaptureIdentity();
  if(JSON.stringify(report.identityAfter)!==JSON.stringify(before))throw new Error('Candidate identity changed during capture');
  report.completed=report.pairs.length===9 && report.errors.length===0;
  if(!report.completed)throw new Error('Capture has errors');
} catch(error){report.errors.push(error instanceof Error?error.message:String(error));throw error;}
finally{await browser?.close();await new Promise(r=>server.close(r));report.finishedAt=new Date().toISOString();save();}
console.info(JSON.stringify({output,pairs:report.pairs.length,completed:report.completed,reportBytes:statSync(`${output}/report.json`).size}));
