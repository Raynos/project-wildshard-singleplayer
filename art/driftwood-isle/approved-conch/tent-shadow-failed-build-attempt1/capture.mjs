#!/usr/bin/env node
/** Fixed nine-view paired diagnostic. No clock mocking or private cache access. */
import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../selected-native-color-view/build.mjs';
import { FUTURE_DIST } from './source-gate.mjs';
import { CHROME, hash, canonical, assertIdentity } from './manifest.mjs';
import { EVIDENCE, verifyHost, safeNew, budget } from './build.mjs';
import { assertComparable, assertShader } from './contract.mjs';
export const VIEWS=['front','left','right','back','top','diag-front','diag-left','diag-right','diag-back'];
if(process.argv.length!==2 || Object.keys(process.env).some(k=>k.startsWith('CONCH_QA_')))throw new Error('Fixed diagnostic capture takes no overrides');
const before=verifyHost(), output=resolve(ROOT,EVIDENCE);safeNew(output);mkdirSync(output,{recursive:true});
const report={schema:'wildshard.conch.tent-diagnostic.capture.v1',startedAt:new Date().toISOString(),identityBefore:before,
  scope:'New common public frozen-rest control/tent pair only. No old-host zero-clock parity, performance, gameplay or quality acceptance.',
  qualitativePCFStippling:'pending independent visual review; inconclusive until confirmed',acceptance:false,pairs:[],errors:[],completed:false};
const save=()=>{writeFileSync(resolve(output,'report.json'),canonical(report)+'\n');budget();};save();
const built=resolve(ROOT,FUTURE_DIST),server=createServer((req,res)=>{
  const path=resolve(built,'.'+decodeURIComponent(new URL(req.url??'/','http://localhost').pathname));
  if(!path.startsWith(built+sep)){res.writeHead(403).end();return;}
  try {res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.glb':'model/gltf-binary'})[extname(path)]??'application/octet-stream');res.end(readFileSync(path));}
  catch {res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
const captures={};
try {
  browser=await chromium.launch({executablePath:resolve(ROOT,CHROME),headless:true,args:['--mute-audio','--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  report.browserVersion=browser.version();
  for(const variant of ['control','tent']) {
    assertIdentity(before,verifyHost());
    const context=await browser.newContext({...devices['iPhone 16 Pro'],viewport:{width:402,height:874},deviceScaleFactor:1});
    try {
      const page=await context.newPage();page.setDefaultTimeout(120000);
      page.on('pageerror',error=>report.errors.push(`${variant}: ${error.message}`));
      page.on('response',response=>{if(response.status()>=400)report.errors.push(`${variant}: HTTP ${response.status()} ${new URL(response.url()).pathname}`);});
      await page.goto(`http://127.0.0.1:${server.address().port}/${variant}.html`,{waitUntil:'domcontentloaded'});
      await page.locator('#practice-start').tap();
      await page.waitForFunction(()=>window.__practiceDemo?.arena.entered===true || !document.querySelector('#practice-start')?.disabled);
      if(!await page.evaluate(()=>window.__practiceDemo?.arena.entered===true))throw new Error(await page.locator('#practice-status').textContent()??'Boot failed');
      await page.waitForFunction(()=>window.__practiceDemo?.arena.activeTargets.length===1 && window.__practiceDemo.game.clock.running===false);
      const setup=await page.evaluate(async()=>{window.__conchObservation=await window.__installConchTentObservation();return {setup:window.__conchObservation.setup,identity:window.__conchObservation.identity};});
      writeFileSync(resolve(output,variant+'-setup.json'),canonical(setup)+'\n',{flag:'wx'});
      captures[variant]={setup,views:{}};
      for(const view of VIEWS) {
        const result=await page.evaluate(view=>window.__conchObservation.capture(view),view);
        if(result.repeatByteIdentical!==true)throw new Error('Unstable repeated rest capture');
        const {image,programs,...observation}=result;
        if(!image.startsWith('data:image/png;base64,'))throw new Error('Missing actual PNG');
        const bytes=Buffer.from(image.slice('data:image/png;base64,'.length),'base64'),file=`${view}-${variant}.png`;
        writeFileSync(resolve(output,file),bytes,{flag:'wx'});
        const shaders=[];
        for(const program of programs) {
          assertShader(program.fragment,variant);
          const digest=hash(program.fragment),name=`${variant}-${digest}.frag`;
          if(!shaders.some(s=>s.sha256===digest))writeFileSync(resolve(output,name),program.fragment,{flag:'w'});
          shaders.push({mesh:program.mesh,name:program.name,linked:program.linked,file:name,sha256:digest});
        }
        const visibility=JSON.parse(execFileSync('python3',['art/driftwood-isle/approved-conch/selected-native-color-view/visible_pixels.py',resolve(output,file)],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));
        if(!visibility.visibleCandidate)throw new Error(`Blank/occluded ${variant} ${view}`);
        const item={...observation,shaders,image:{file,bytes:bytes.length,sha256:hash(bytes),visibility}};
        captures[variant].views[view]=item;
        writeFileSync(resolve(output,`${view}-${variant}.json`),canonical(item)+'\n',{flag:'wx'});budget();
      }
      await page.evaluate(()=>window.__conchObservation.dispose());
    } finally {await context.close();}
  }
  assertComparable(captures.control.setup.setup,captures.tent.setup.setup);
  for(const view of VIEWS) {
    const control=captures.control.views[view],tent=captures.tent.views[view];
    assertComparable(control.state,tent.state);
    report.pairs.push({view,strictControlsEqual:true,control,tent});
  }
  report.identityAfter=verifyHost();assertIdentity(before,report.identityAfter);
  if(report.errors.length || report.pairs.length!==9)throw new Error('Capture incomplete or browser errors present');
  report.completed=true;
} catch(error) {report.errors.push(error instanceof Error?error.message:String(error));process.exitCode=1;}
finally {
  await browser?.close();await new Promise(r=>server.close(r));
  try {report.identityAfter=verifyHost();assertIdentity(before,report.identityAfter);}catch(error){report.errors.push(String(error));report.completed=false;process.exitCode=1;}
  report.finishedAt=new Date().toISOString();save();
}
console.log(JSON.stringify({output:EVIDENCE,completed:report.completed,pairs:report.pairs.length,errors:report.errors,qualitativePCFStippling:report.qualitativePCFStippling}));
