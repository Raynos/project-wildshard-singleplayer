#!/usr/bin/env node
/** One bounded original4 baseline + full candidate cycle, no build or permission inference. */
import { chromium, devices } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { ROOT, ORIGINAL, DIRECTORY, hash, canonical, same, inventory, verifyProduct, productPin } from './admission.mjs';
import { CHROME } from './manifest.mjs';
import { DIST, EVIDENCE, verifyHost, safeNew, budget } from './build.mjs';
import { installPublic4CameraObservation } from './camera-observation.mjs';
import { installLiveEvidence } from './observe.mjs';
import { checkLiveEvidence, emptyStores, cycleChecks, compareOriginal } from './checks.mjs';

function assertBrowserLane() {
 let pid=process.ppid;
 for(let depth=0;pid>1&&depth<40;depth++){
  const args=execFileSync('ps',['-p',String(pid),'-o','args='],{encoding:'utf8'});
  if(args.includes('scripts/browser-lane.sh _slot '))return;
  pid=Number(execFileSync('ps',['-p',String(pid),'-o','ppid='],{encoding:'utf8'}).trim());
 }
 throw new Error('Capture requires actual browser-lane.sh _slot ancestor');
}
if(process.argv.length!==2||Object.keys(process.env).some(k=>k.startsWith('CONCH_QA_')))throw new Error('Fixed capture takes no input/output/clock overrides');
if(resolve('.')!==ROOT)throw new Error('Run from repository root');
assertBrowserLane();
const identityBefore=verifyHost(),out=resolve(ROOT,EVIDENCE);safeNew(out);mkdirSync(out,{recursive:true});
const report={schema:'wildshard.conch.public4-tent.complete-cycle.v1',startedAt:new Date().toISOString(),identityBefore,acceptance:false,completed:false,errors:[],runs:{},loaded:[],scope:'Normal-clock diagnostic follow camera and logged player placement/aim. Not ordinary first-person play. No phone cadence inference.'};
const save=()=>{writeFileSync(join(out,'report.json'),canonical(report)+'\n');budget();};save();
const roots={original4:resolve(ROOT,ORIGINAL),tent:resolve(ROOT,DIST)},allowed={original4:inventory(roots.original4),tent:identityBefore.files};
let browser=null,context=null,page=null,watchdog=null,startedWall=0,current=null,totalScreens=0;const activeReads=new Set(),retained=new Map();
const server=createServer((req,res)=>{
 try {
  const url=new URL(req.url??'/','http://localhost'),variant=current?.variant,root=roots[variant];
  if(!root)throw new Error('Unknown fixed host');
  if(url.pathname==='/favicon.ico'){res.writeHead(204).end();return;}
  const relative=decodeURIComponent(url.pathname).slice(1)||'index.html',path=resolve(root,relative);
  if(!path.startsWith(root+sep)||!existsSync(path)||!realpathSync(path).startsWith(root+sep))throw new Error('Invalid static path');
  const bytes=readFileSync(path);if(hash(bytes)!==allowed[variant][relative])throw new Error('Static served bytes differ from verified host');
  report.loaded.push({variant,path:relative,sha256:hash(bytes),bytes:bytes.length,at:Date.now()});
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.glb':'model/gltf-binary'})[extname(path)]??'application/octet-stream');res.end(bytes);
 }catch(error){report.errors.push(`static: ${error.message}`);res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin=`http://127.0.0.1:${server.address().port}`;
const remaining=()=>Math.max(1,600000-(Date.now()-startedWall));
const sample=()=>page.evaluate(()=>{
 const d=window.__practiceDemo,a=d.arena.activeTargets[0];return {wall:performance.now(),time:d.game.frameTime,frame:d.game.frameCount,state:d.game.app.state,boutTime:d.arena.opponent.elapsed,targets:d.arena.activeTargets.length,enemy:{kind:a?.kind,hp:a?.hp,maxHp:a?.maxHp,alive:a?.alive,state:a?.state,mem:{...a?.mem},speed:a?.speed,deathT:a?.deathT,strike:a?JSON.parse(d.arena.opponent.callbacks.control(a).snapshot()).strike:null},playerHp:d.arena.playerVitals.health,loot:d.arena.opponent.loot?.receipt,status:document.querySelector('#practice-status')?.textContent};
});
const stores=async label=>{const row=await page.evaluate(async()=>{
 const d=window.__practiceDemo,saves=d?.game.app.saves;return {local:Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])),session:Object.fromEntries(Object.keys(sessionStorage).map(k=>[k,sessionStorage.getItem(k)])),indexedDB:(await indexedDB.databases()).map(d=>d.name).sort(),serviceWorkers:(await navigator.serviceWorker.getRegistrations()).length,state:saves?{docs:JSON.parse(saves.exportAll()).docs,shard:saves.inspectShard({id:'driftwood-isle'}),generation:saves.inspectShardGeneration({id:'driftwood-isle'})}:null};
 });current.stores.push({label,...row});if(!emptyStores([row]))throw new Error(`Persistent state not empty: ${label}`);return row;};
const guard=async()=>{
 budget();if(remaining()<=1)throw new Error('600 second browser envelope exhausted');
 const errors=await page.evaluate(()=>window.__public4LiveEvidence?.errors??[]);if(errors.length)throw new Error(errors.join('; '));
};
const wait=async ms=>{await page.waitForTimeout(Math.min(ms,remaining()));await guard();};
const until=async(predicate,arg=null,max=30000)=>{await page.waitForFunction(predicate,arg,{timeout:Math.min(max,remaining()),polling:100});await guard();};
const phase=async name=>{current.phases.push({name,wall:Date.now()});await page.evaluate(n=>{window.__conchPhase=n;},name);};
const place=async(distance,angle=0,pitch=.08)=>{current.placements.push(await page.evaluate(({distance,angle,pitch})=>{
 const d=window.__practiceDemo,a=d.arena.activeTargets[0];d.player.spawn(a.position.x+Math.sin(angle)*distance,a.position.z+Math.cos(angle)*distance,angle,a.position.y);d.player.pitch=pitch;
 return {wall:performance.now(),gameTime:d.game.frameTime,boutTime:d.arena.opponent.elapsed,phase:window.__conchPhase,distance,angle,pitch,position:d.player.position.toArray(),reason:'Diagnostic player placement/aim only; no enemy, clock, health, physics or damage-state edit'};
 },{distance,angle,pitch}));};
const aim=async()=>{current.aims.push(await page.evaluate(()=>{
 const d=window.__practiceDemo,a=d.arena.activeTargets[0],dx=d.player.position.x-a.position.x,dz=d.player.position.z-a.position.z;d.player.yaw=Math.atan2(dx,dz);d.player.pitch=Math.atan2(.4,Math.hypot(dx,dz));return{wall:performance.now(),gameTime:d.game.frameTime,yaw:d.player.yaw,pitch:d.player.pitch};
 }));};
const screenshot=async name=>{
 if(++totalScreens>24)throw new Error('Portrait frame cap');const path=join(out,current.variant,`${name}.jpg`);await page.screenshot({path,type:'jpeg',quality:85,scale:'css'});current.screens.push({path:`${current.variant}/${name}.jpg`,sha256:hash(readFileSync(path)),sample:await sample()});save();
};
const retry=async()=>{await page.locator('#practice-retry').tap();await until(()=>window.__practiceDemo.arena.activeTargets[0]?.hp===60&&window.__practiceDemo.arena.playerVitals.health===100);};
const preserve=async()=>{
 if(!page||page.isClosed()||!current)return null;
 const epoch=current.epoch??'main',key=current.variant+'/'+epoch;
 if(retained.has(key))return retained.get(key);
 const promise=(async()=>{
  const data=await page.evaluate(()=>({trace:window.__conchRenderTrace??[],events:window.__conchEvents??[],geometry:window.__conchRuntimeGeometry??[],live:window.__public4LiveEvidence??null}));
  const directory=join(out,current.variant,...(epoch==='main'?[]:[epoch]));mkdirSync(directory,{recursive:true});
  const evidence={};for(const[kind,value]of Object.entries(data)){const text=JSON.stringify(value),path=join(directory,`${kind}.json`);writeFileSync(path,text,{flag:'wx'});evidence[kind]={path:path.slice(out.length+1),bytes:Buffer.byteLength(text),sha256:hash(text)};}
  if(epoch==='main')current.evidence=evidence;else current.reloadEvidence=evidence;
  budget();return data;
 })();retained.set(key,promise);return promise;
};
async function closeContext(){
 if(!context)return;
 await Promise.all(activeReads);
 const video=page?.video();current.videoStopRequestedAt=Date.now();await context.close();context=null;
 if(video){const path=await video.path();current.video={path:path.slice(out.length+1),bytes:readFileSync(path).length,sha256:hash(readFileSync(path)),stopClosedAt:Date.now()};}
 page=null;save();
}
async function start(variant){
 current=report.runs[variant]={variant,errors:[],stores:[],placements:[],aims:[],phases:[],screens:[],responses:[]};mkdirSync(join(out,variant),{recursive:true});
 verifyProduct(roots[variant]);
 context=await browser.newContext({...devices['iPhone 16 Pro'],viewport:{width:402,height:874},deviceScaleFactor:1,recordVideo:{dir:join(out,variant,'video'),size:{width:402,height:874}}});
 page=await context.newPage();page.setDefaultTimeout(Math.min(60000,remaining()));
 page.on('pageerror',error=>{current.errors.push(error.message);report.errors.push(`${variant}: ${error.message}`);});
 page.on('console',message=>{if(message.type()==='error'){current.errors.push(message.text());report.errors.push(`${variant}: ${message.text()}`);}});
 page.on('response',response=>{
  const task=(async()=>{const url=new URL(response.url());if(url.origin!==origin)throw new Error('Unexpected remote request');if(url.pathname==='/favicon.ico'&&response.status()===204)return;if(!response.ok())throw new Error(`HTTP ${response.status()} ${url.pathname}`);const bytes=await response.body(),path=url.pathname.slice(1)||'index.html';if(hash(bytes)!==allowed[variant][path])throw new Error(`Loaded response identity mismatch ${path}`);current.responses.push({path,sha256:hash(bytes),bytes:bytes.length});})().catch(error=>{current.errors.push(error.message);report.errors.push(`${variant}: ${error.message}`);}).finally(()=>activeReads.delete(task));activeReads.add(task);
 });
 await page.goto(`${origin}/index.html`,{waitUntil:'domcontentloaded'});await stores('before-start');
 await page.locator('#practice-start').tap();await until(()=>window.__practiceDemo?.arena.entered===true,null,90000);
 await page.evaluate(v=>{window.__public4VariantLabel=v==='tent'?'TENT FILTER':'ORIGINAL PCF';},variant);
 current.camera=await page.evaluate(installPublic4CameraObservation);current.setup=await page.evaluate(installLiveEvidence,variant);await stores('after-start');
 await phase('idle');await place(14);await wait(2200);
 await phase('approach');await place(5);await until(()=>window.__practiceDemo.arena.activeTargets[0].speed>.1);await wait(1600);await screenshot('approach');
 await phase('defense');await place(2.1);await aim();
 await until(()=>window.__practiceDemo.arena.playerVitals.health<100,null,60000);
 await until(()=>window.__practiceDemo.arena.activeTargets[0].mem['conch-st']===2,null,30000);await wait(900);await screenshot('attack-recovery');
}
let originalData=null,tentData=null;
try {
 startedWall=Date.now();browser=await chromium.launch({executablePath:resolve(ROOT,CHROME),headless:true,args:['--no-sandbox','--mute-audio','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 report.browserVersion=browser.version();watchdog=setTimeout(()=>{report.errors.push('Browser envelope ending; preserving partial evidence');void Promise.race([preserve(),new Promise(done=>setTimeout(done,4000))]).finally(()=>browser?.close());},Math.max(1,remaining()-5000));
 await start('original4');await stores('control-combat');originalData=await preserve();current.cadence=checkLiveEvidence(originalData,'original4');await closeContext();
 await start('tent');
 await phase('stop');await place(2.1);await until(()=>window.__practiceDemo.arena.activeTargets[0].speed<.05);await wait(900);
 await phase('resume-walk');await place(5);await until(()=>window.__practiceDemo.arena.activeTargets[0].speed>.1);await wait(1200);
 await phase('pause');await page.keyboard.press('Escape');await until(()=>window.__practiceDemo.game.app.state==='paused');current.pauseStart=await sample();await wait(1200);current.pauseEnd=await sample();await screenshot('paused');
 await page.keyboard.press('Escape');await until(()=>window.__practiceDemo.game.app.state==='practice');await until(t=>window.__practiceDemo.arena.opponent.elapsed>t,current.pauseEnd.boutTime,10000);
 await wait(1000);current.resume=await sample();await stores('pause-resume');
 await phase('guard-counter');
 for(let attempt=0;attempt<4;attempt++){
  await retry();await place(2.1);await aim();await until(()=>{const a=window.__practiceDemo.arena.activeTargets[0];return a.mem['conch-st']===1&&a.mem['regular-clock']<.25;},null,40000);
  await page.locator('.ws-touch-attack').tap();await wait(4500);
  if(await page.evaluate(()=>window.__conchRenderTrace.some(r=>r.stage===3)))break;
 }
 await screenshot('guard-counter');
 for(const trial of [{name:'idle',stage:0,min:0},{name:'early-windup',stage:1,min:.05},{name:'late-windup',stage:1,min:.35},{name:'active',stage:1,min:.6},{name:'recovery',stage:2,min:.05}]){
  await phase(`interruption-${trial.name}`);await retry();await place(2.1);await aim();
  await until(({stage,min})=>{const a=window.__practiceDemo.arena.activeTargets[0];return a.mem['conch-st']===stage&&a.mem['regular-clock']>=min;},trial,30000);
  await page.locator('.ws-touch-attack').tap();await wait(2000);
 }
 await retry();await phase('sword-death');
 for(let attempt=0;attempt<24;attempt++){
  const row=await sample();if(!row.enemy.alive||row.playerHp===0)break;
  await place(2.2,0,.03);await page.locator('.ws-touch-attack').tap();await wait(1100);
 }
 current.sword=await sample();await screenshot('sword-result');
 if(!current.sword.enemy.alive){
  await place(1.4);await until(()=>window.__practiceDemo.arena.opponent.loot?.receipt.complete===true,null,30000);
  await phase('corpse-settle');await wait(8000);current.reward=await sample();await screenshot('death-reward');await page.locator('.ws-touch-attack').tap();await wait(1500);current.rewardStable=await sample();
 }
 await stores('reward');await retry();current.retry=await sample();await stores('reward-retry');await phase('player-defeat');
 const defeatDeadline=Math.min(Date.now()+180000,startedWall+600000);
 while(Date.now()<defeatDeadline){if((await sample()).playerHp===0)break;await place(.85,0,.15);await aim();await wait(1600);}
 current.playerDefeat=await sample();await screenshot('player-defeat');await page.locator('.ws-touch-attack').tap();await wait(600);current.defeatedAttack=await sample();
 await retry();current.defeatRetry=await sample();await stores('defeat-retry');
 tentData=await preserve();current.cadence=checkLiveEvidence(tentData,'tent');current.checks=cycleChecks(tentData,current);report.comparison=compareOriginal(originalData,tentData);
 // Retain pre-reload streams before their globals disappear. Reload exercises the ordinary entry again.
 current.epoch='reload';await page.reload({waitUntil:'domcontentloaded'});await stores('after-reload-before-start');await page.locator('#practice-start').tap();await until(()=>window.__practiceDemo?.arena.entered===true,null,90000);
 current.reentry=await sample();await stores('reload-start');await page.evaluate(()=>{window.__public4VariantLabel='TENT RELOAD';});await page.evaluate(installPublic4CameraObservation);await page.evaluate(installLiveEvidence,'tent');await phase('reload-attack');await place(2.1);await aim();await until(()=>window.__practiceDemo.arena.playerVitals.health<100,null,60000);await wait(900);
 const reload=await preserve();current.reloadCadence=checkLiveEvidence(reload,'tent');await stores('reload-combat');
 current.checks.reentry=current.reentry.enemy.hp===60&&current.reentry.playerHp===100&&current.reentry.enemy.kind==='conch-duelist';current.checks.stores=emptyStores(current.stores);
 await Promise.all(activeReads);await closeContext();
 if(Object.values(report.runs.tent.checks).some(value=>value!==true))throw new Error('One or more complete-cycle checks failed');
 report.completed=report.errors.length===0;
}catch(error){report.errors.push(error.message);process.exitCode=1;if(page&&!page.isClosed()){try{await preserve();}catch(e){report.errors.push(`partial evidence: ${e.message}`);}}}
finally{
 if(watchdog)clearTimeout(watchdog);
 try{await closeContext();}catch(error){report.errors.push(`video close: ${error.message}`);}
 await browser?.close();await Promise.allSettled(activeReads);await new Promise(done=>server.close(done));report.browserWallSeconds=(Date.now()-startedWall)/1000;
 try{report.identityAfter=verifyHost();same(identityBefore,report.identityAfter);}catch(error){report.errors.push(`final identity: ${error.message}`);}
 for(const run of Object.values(report.runs))if(run.video){try{
  const path=join(out,run.video.path);run.video.probe=JSON.parse(execFileSync('/usr/bin/ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',path],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024}));
  const digest=execFileSync('/usr/bin/ffmpeg',['-v','error','-i',path,'-map','0:v:0','-f','framemd5','-'],{encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});writeFileSync(join(out,run.variant,'video-framemd5.txt'),digest);
  const frames=digest.split('\n').filter(s=>s&&!s.startsWith('#')),hashes=frames.map(s=>s.split(',').at(-1).trim());run.video.decodedFrames=frames.length;run.video.uniqueDecodedImages=new Set(hashes).size;run.video.repeatedAdjacentFrames=hashes.filter((value,i)=>i>0&&value===hashes[i-1]).length;run.video.frameDigestSha256=hash(digest);
  const stream=run.video.probe.streams.find(s=>s.codec_type==='video');if(!stream||stream.width!==402||stream.height!==874||Number(stream.nb_read_frames)!==frames.length||frames.length<2||run.video.uniqueDecodedImages<2)throw new Error('Movie frame coverage/dimensions failed');
  const pts=frames.map(line=>Number(line.split(',')[2]));if(pts.some((value,i)=>!Number.isFinite(value)||(i>0&&value<=pts[i-1])))throw new Error('Non-monotonic decoded movie timestamps');
  run.video.caveat='Encoded frames include duplicate images. Actual engine cadence and distinct render-frame counts are separately reported; no assumed 30 fps playback fidelity.';
 }catch(error){report.errors.push(`video probe ${run.variant}: ${error.message}`);}}
 for(const run of Object.values(report.runs))if(run.evidence?.geometry){try{
  execFileSync(process.execPath,['scripts/qa-conch-readable-damage-geometry.mjs',join(out,run.variant)],{cwd:ROOT,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});const file=join(out,run.variant,'damage-geometry.json');run.weightedDamageGeometry={path:`${run.variant}/damage-geometry.json`,sha256:hash(readFileSync(file)),allFourWeightsAndNativeOrderVerified:JSON.parse(readFileSync(file)).allFourWeightsAndNativeOrderVerified};
 }catch(error){report.errors.push(`weighted native geometry ${run.variant}: ${error.message}`);}}
 const movieSeconds=Object.values(report.runs).reduce((sum,run)=>sum+Number(run.video?.probe?.format?.duration??0),0);report.totalMovieSeconds=movieSeconds;if(movieSeconds>600.5)report.errors.push('Total movie duration exceeded 600 second cap');
 for(const run of Object.values(report.runs)){const loaded=new Set(run.responses.map(row=>row.path)),index=JSON.parse(readFileSync(join(roots[run.variant],'practice-product/shard.json'))),body=Object.keys(productPin().files).find(path=>path.includes('conch-canonical-'));run.loadedCriticalFiles=[body,'practice-product/shard.json',...index.files.map(file=>'practice-product/'+file.path)];if(run.loadedCriticalFiles.some(path=>!loaded.has(path)))report.errors.push(`Missing loaded exact runtime product files: ${run.variant}`);}
 report.endedAt=new Date().toISOString();if(report.errors.length){report.completed=false;process.exitCode=1;}save();
}
