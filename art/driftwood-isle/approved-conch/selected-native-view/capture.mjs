/** Nine exact synchronous source/native pairs from the actual isolated faceted arena. No movie. */
import { execFileSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { verifySelectedViewCaptureIdentity, newCaptureDirectory, hash } from './identity.mjs';
import { DIST, ROOT } from './build.mjs';

if(process.env.CHROME_PATH!==resolve('tmp/dot-audit/tools/chrome-headless-shell-linux64/chrome-headless-shell')) throw new Error('Only the approved installed Chrome may be used');
if(process.env.CONCH_QA_URL || process.env.CONCH_QA_DIST) throw new Error('No alternate host allowed');
const before=verifySelectedViewCaptureIdentity();
const output=newCaptureDirectory(process.env.CONCH_QA_OUT ?? 'tmp/conch-selected-view-qa/attempt3');
const report={schema:'wildshard.conch.selected-native-view.capture.v1',startedAt:new Date().toISOString(),identityBefore:before,
  appearance:'Exact corrected source GLB/source materials versus actual unchanged faceted host; post-facet normals/colors intentionally measured, not claimed preserved.',
  scope:'Paired rest diagnostic; no animation, visual admission, gameplay cadence or physical-phone claim.',pairs:[],errors:[],completed:false};
const save=()=>writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2)+'\n');save();
const built=resolve(ROOT,DIST), server=createServer((req,res)=>{
  const path=resolve(built,`.${new URL(req.url??'/','http://localhost').pathname==='/'?'/index.html':new URL(req.url??'/','http://localhost').pathname}`);
  if(!path.startsWith(`${built}${sep}`)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.glb':'model/gltf-binary'})[extname(path)]??'application/octet-stream');res.end(readFileSync(path));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(4488,'127.0.0.1',r));
let browser;
try {
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--mute-audio','--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({...devices['iPhone 16 Pro'],viewport:{width:402,height:874},deviceScaleFactor:1});
  const page=await context.newPage();page.setDefaultTimeout(120000);
  page.on('pageerror',error=>{report.errors.push(error.message);save();});
  await page.goto('http://127.0.0.1:4488/',{waitUntil:'domcontentloaded'});
  await page.locator('#practice-start').tap();
  await page.waitForFunction(()=>window.__practiceDemo?.arena.entered===true || !document.querySelector('#practice-start')?.disabled);
  if(!await page.evaluate(()=>window.__practiceDemo?.arena.entered===true)) throw new Error(await page.locator('#practice-status').textContent()??'Boot failed');
  await page.waitForFunction(()=>window.__practiceDemo?.arena.activeTargets.length===1);
  const setup=await page.evaluate(()=>window.__installSelectedComparison());
  writeFileSync(`${output}/actual-runtime-geometry.json`,JSON.stringify(setup)+'\n');
  const original=JSON.parse(readFileSync('art/driftwood-isle/approved-conch/selected-native-normals/native/conch-character-pass-native.json'));
  const channels={position:'positions',normal:'normals',color:'colorsLinear',skinIndex:'skinIndices',skinWeight:'skinWeights',furLen:'furLen'};
  report.attributeComparison={};
  for(const [channel,key] of Object.entries(channels)) {
    const expected=original.parts.flatMap(p=>Array.from(channel==='skinIndex'?Uint16Array.from(p[key]):Float32Array.from(p[key])));
    const actual=setup.geometry.flatMap(m=>m.attributes[channel].values);
    if(expected.length!==actual.length)throw new Error(`Actual ${channel} count differs`);
    let changed=0,maxAbs=0;for(let i=0;i<actual.length;i++){const delta=Math.abs(actual[i]-expected[i]);if(delta!==0)changed++;maxAbs=Math.max(maxAbs,delta);}
    report.attributeComparison[channel]={components:actual.length,changed,maxAbs};
    if(!['normal','color'].includes(channel)&&changed!==0)throw new Error(`Unexpected native ${channel} mutation`);
  }
  save();
  for(const view of ['front','left','right','back','top','diag-front','diag-left','diag-right','diag-back']) {
    await page.evaluate(view=>{const s=window.__selectedComparison;s.view=view;s.variant='native';s.pair=null;s.requestPair=true;},view);
    await page.waitForFunction(()=>window.__selectedComparison.error!==null || window.__selectedComparison.pair!==null);
    const result=await page.evaluate(()=>({error:window.__selectedComparison.error,pair:window.__selectedComparison.pair}));
    if(result.error)throw new Error(result.error);
    const pair=result.pair;
    const {captures:pendingPixels,...observation}=pair;
    if(!pendingPixels)throw new Error('Missing paired image payloads');
    writeFileSync(`${output}/${view}-observation.json`,JSON.stringify(observation,null,2)+'\n',{flag:'wx'});
    if(JSON.stringify(pair.nativeRoot)!==JSON.stringify(pair.sourceRoot))throw new Error('Source/native root mismatch');
    if(JSON.stringify(pair.lightState.native)!==JSON.stringify(pair.lightState.source) || JSON.stringify(pair.lightState.source)!==JSON.stringify(pair.lightState.after))throw new Error('Light state changed within matched pair');
    const images={};
    for(const variant of ['native','source']) {
      const data=pair.captures[variant];if(!data.startsWith('data:image/png;base64,'))throw new Error('Missing actual canvas PNG');
      const bytes=Buffer.from(data.slice('data:image/png;base64,'.length),'base64'),name=`${view}-${variant}.png`;
      writeFileSync(`${output}/${name}`,bytes,{flag:'wx'});
      const visibility=JSON.parse(execFileSync('python3',['art/driftwood-isle/approved-conch/selected-native-view/visible_pixels.py',`${output}/${name}`],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));
      images[variant]={file:name,bytes:bytes.length,sha256:hash(bytes),visibility};
      if(!visibility.visibleCandidate)throw new Error(`Blank/occluded character view: ${view} ${variant}`);
    }
    delete pair.captures;report.pairs.push({...pair,images});save();
  }
  await page.screenshot({path:`${output}/phone-rest-diagnostic.png`});
  report.identityAfter=verifySelectedViewCaptureIdentity();
  if(JSON.stringify(report.identityAfter)!==JSON.stringify(before))throw new Error('Candidate identity changed during capture');
  report.completed=report.pairs.length===9 && report.errors.length===0;
  if(!report.completed)throw new Error('Capture has errors');
} catch(error){report.errors.push(error instanceof Error?error.message:String(error));throw error;}
finally{await browser?.close();await new Promise(r=>server.close(r));report.finishedAt=new Date().toISOString();save();}
console.info(JSON.stringify({output,pairs:report.pairs.length,completed:report.completed,reportBytes:statSync(`${output}/report.json`).size}));
