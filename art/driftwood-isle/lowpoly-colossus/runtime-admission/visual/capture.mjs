import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
const base=path.resolve('art/driftwood-isle/lowpoly-colossus');
const host=path.resolve('../puffer-native-v38-clean-c4339d9/tmp/puffer-native-preview-v70-neutral-gray-v2-dist');
const bundle=path.resolve('tmp/colossus-native-visual/bundle');
const out=path.resolve('tmp/colossus-native-visual/capture-original');fs.mkdirSync(out,{recursive:true});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const report={schema:'wildshard.colossus.native-rest-render.v1',scope:'Frozen rest-only geometry diagnostic in unchanged V70 renderer host; no Colossus gameplay or admission',started:new Date().toISOString(),sourceSha256:hash(base+'/tide-root-colossus-v4.glb'),hostPreview:JSON.parse(fs.readFileSync(host+'/puffer-preview.json')),errors:[],httpErrors:[],views:[]};
if(report.sourceSha256!=='8c94ed4a452f10ca5c9e1e663c7437c2905e42b90bf5abe9faaf970391a8189b')throw Error('Source pin mismatch');
report.pins=JSON.parse(fs.readFileSync(base+'/runtime-admission/visual/frozen-inputs.json'));
for(const pin of report.pins.files){const p=path.resolve(pin.path);if(fs.statSync(p).size!==pin.bytes||hash(p)!==pin.sha256)throw Error('Frozen input mismatch: '+pin.path);}
const routes={'/diagnostic/original/mesh-map.json':base+'/runtime-admission/v4-skin1/mesh-map.json','/diagnostic/original/source.glb':base+'/tide-root-colossus-v4.glb','/diagnostic/original/metadata.json':base+'/runtime-admission/v4-skin1/metadata.json','/diagnostic/original/payload.bin':base+'/runtime-admission/v4-skin1/payload.bin','/diagnostic/diagnostic.js':bundle+'/diagnostic.js'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost').pathname;const p=routes[u]??path.resolve(host,'.'+(u==='/'?'/index.html':u));if(!p.startsWith(host+path.sep)&&!Object.values(routes).includes(p)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.wasm':'application/wasm','.css':'text/css'})[path.extname(p)]??'application/octet-stream');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(4531,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:path.resolve('tmp/dot-audit/tools/chrome-headless-shell-linux64/chrome-headless-shell'),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({...devices['iPhone 16 Pro'],deviceScaleFactor:3});const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.httpErrors.push(r.url());});
try{
await page.goto('http://127.0.0.1:4531/');await page.getByRole('button',{name:'Start practice',exact:true}).click();await page.waitForFunction(()=>window.__practiceDemo?.arena.activeTargets.length===1);
report.setup=await page.evaluate(async()=>{
 const d=window.__practiceDemo,g=d.game,a=d.arena.activeTargets[0];g.hold=true;g.viewmodel.visible=false;g.camera.fov=45;g.camera.updateProjectionMatrix();
 const {prepare}=await import('/diagnostic/diagnostic.js');
 const state=await prepare(a.mesh.material);window.__colossusDiagnostic=state;
 state.origin=a.mesh.position.clone();state.origin.y=900;
 state.source.position.copy(state.origin);state.native.position.copy(state.origin);
 state.source.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])g.sky.setupMaterial(m);});
 g.rootScene.add(state.source,state.native);a.mesh.visible=false;
 // Remove only first-person render layer objects, not arena/world geometry.
 const hidden=[];g.rootScene.traverse(o=>{if(o.isMesh&&o.layers.mask!==1){hidden.push({name:o.name,layers:o.layers.mask});o.visible=false;}});
 document.querySelectorAll('body > :not(canvas):not(script)').forEach(e=>e.style.display='none');
 const label=document.createElement('div');label.id='diagnostic-label';label.style.cssText='position:fixed;top:8px;left:8px;right:8px;z-index:999999;background:#000d;color:#fff;font:13px monospace;padding:8px';document.body.append(label);
 const mats=Array.isArray(a.mesh.material)?a.mesh.material:[a.mesh.material];
 return {...state.stats,origin:state.origin.toArray(),hidden,material:mats.map(m=>({type:m.type,side:m.side,color:m.color?.toArray(),flatShading:m.flatShading,vertexColors:m.vertexColors})),pixelRatio:g.renderer.getPixelRatio(),passes:g.composer.passes.map(p=>({enabled:p.enabled,name:p.constructor.name})),light:g.sky.csm.lights.map(l=>({color:l.color.toArray(),intensity:l.intensity,position:l.position.toArray()}))};
});
const views=[['front',[0,3.1,16],[0,2.7,0]],['left',[-16,3.1,0],[0,2.7,0]],['right',[16,3.1,0],[0,2.7,0]],['back',[0,3.1,-16],[0,2.7,0]],['top',[0,17,.01],[0,2.7,0]],['front-left',[-12,4.8,12],[0,2.7,0]],['front-right',[12,4.8,12],[0,2.7,0]],['rear-left',[-12,4.8,-12],[0,2.7,0]],['rear-right',[12,4.8,-12],[0,2.7,0]],['eye-heart',[0,3.1,6],[0,3.1,0]],['shin-front',[-1.02,1.05,1.7],[-1.02,1.05,.25]],['shin-back',[-1.02,1.05,-1.2],[-1.02,1.05,.25]],['seam-isolated-front',[-1.02,1.05,1.2],[-1.02,1.05,.25]],['seam-isolated-back',[-1.02,1.05,-.7],[-1.02,1.05,.25]]];
for(const [name,position,target] of views)for(const mode of ['source','native','native-double','source-front']){
 const state=await page.evaluate(({name,position,target,mode})=>{
  const g=window.__practiceDemo.game,s=window.__colossusDiagnostic;
  s.isolate(name.startsWith('seam-isolated') ? 81 : null);
  s.source.visible=mode.startsWith('source');s.native.visible=mode.startsWith('native');s.setSide(s.native,mode==='native-double');s.setSide(s.source,mode==='source');
  g.camera.position.set(...position).add(s.origin);g.camera.up.set(0,1,0);g.camera.lookAt(...target.map((v,i)=>v+s.origin.getComponent(i)));g.camera.updateMatrixWorld(true);g.sky.csm.updateFrustums();g.sky.csm.update();g.rootScene.updateMatrixWorld(true);
  document.querySelector('#diagnostic-label').textContent=`COLOSSUS V4 · ${name} · ${mode}\nREST DIAGNOSTIC ONLY · same game lights/camera`;
  for(let i=0;i<3;i++)g.composer.render(0);
  return {camera:g.camera.position.toArray(),target:target.map((v,i)=>v+s.origin.getComponent(i)),fov:g.camera.fov,frame:g.frameCount};
 },{name,position,target,mode});
 const file=`${name}-${mode}.png`;await page.screenshot({path:path.join(out,file)});report.views.push({name,mode,...state,file,sha256:hash(path.join(out,file))});
}
report.storage=await page.evaluate(async()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage),caches:await caches.keys(),workers:(await navigator.serviceWorker.getRegistrations()).length,databases:await indexedDB.databases()}));
report.passed=report.errors.length===0&&report.httpErrors.length===0;
}finally{report.finished=new Date().toISOString();await context.close();await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(out+'/receipt.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
