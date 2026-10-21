#!/usr/bin/env node
// G557/G559: real grid entry, look, leave; own residency and independent CDP process readings.
// scripts/browser-lane.sh --max 15 node scripts/grid-ready-chromium.mjs --base=URL --pin=SHA --out=DIR
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve as resolvePath} from 'node:path';
import {chromium,devices} from 'playwright';
import {saveFixture,harnessPins} from './debug-settings.mjs';
import {frameFloorSettingsCode} from './frame-floor-settings.mjs';
import {gridFloorPlans,gridFloorDeclaredPlan,gridFloorDocumentIdentity,stageFloorGrid,driveFloorGrid,gridFloorWitnessFailures} from './frame-floor-grid.mjs';
import {chromiumProcessPeaks,ownedResidencyBytes} from './grid-ready-memory.mjs';

const arg=(key,fallback)=>process.argv.find(value=>value.startsWith(`--${key}=`))?.slice(key.length+3)??fallback;
const base=arg('base',''),pin=arg('pin',''),out=arg('out','');
if(!base||!/^[a-f0-9]{40}$/u.test(pin)||!out)throw new Error('Requires --base, --pin and --out');
const slugs=arg('shards','_template,blender-template,sunscar-dunes,far-reach').split(',');
if(slugs.length===0||slugs.some(slug=>!/^[a-z_-]+$/u.test(slug))||new Set(slugs).size!==slugs.length)throw new Error('Invalid measured shards');
const version=await(await fetch(new URL('/version.json',base))).json();
if(!version.build?.startsWith(pin.slice(0,7)))throw new Error('Served SHA differs');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--mute-audio','--use-angle=metal','--ignore-gpu-blocklist']});
const {defaultBrowserType:_engine,...phone}=devices['iPhone 16 Pro'];
const profiling=arg('profile','0')==='1';
const receipt={schema:1,source:pin,protocol:{profiler:profiling,glObserver:'off',...(profiling?{quiet:false}:arg('quiet','0')==='1'?{quiet:true}:{}),
  memory:'Residency sampled every 250 ms; CDP detailed private-footprint dumps outside timed windows, no forced GC. Page process totals informational.',
  timing:'Live clock, drawn-frame cadence, real held-input road entry and leave; one declared road seed per independent case. No layout or cap changes.'},runs:[]};
let failed=false;
const interruption={on:false};
process.once('SIGTERM',()=>{interruption.on=true;void browser.close();});
try {
 const session=await browser.newBrowserCDPSession(),context=await browser.newContext(phone),page=await context.newPage();
 let errors=[];
 page.on('pageerror',error=>{errors.push(error.message);});
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await context.addInitScript({content:frameFloorSettingsCode({tier:'phone',fps:'auto'})});
  await saveFixture(context,{scope:'global',key:'gfx',data:{dpr:'2',aa:'auto'}});
  await saveFixture(context,{scope:'device',key:'devMode',data:true});
  await harnessPins(context,{seed:357,browser:'Chromium / iPhone 16 Pro',lane:'sp-x1-grid-ready'});
  await page.goto(base,{waitUntil:'load'});await page.locator('.ws-main-grid').click();
  await page.waitForFunction(()=>window.__wildshard?.shard?.grid?.state().live?.live?.gameplayReady,undefined,{timeout:240000});
  const initialOverlay=page.locator('.ws-grid-reveal');if(await initialOverlay.isVisible())await initialOverlay.click();
  await page.waitForFunction(()=>!document.querySelector('#hud')?.classList.contains('ws-grid-revealing'),undefined,{timeout:30000});
  const initialState=await page.evaluate(()=>window.__wildshard.shard.grid.state());
  const targets=slugs.map(slug=>({slug,instance:initialState.cells.find(row=>row.slug===slug)?.instance}));
  if(arg('plots','1')==='1') {
   const plots=initialState.cells.filter(row=>row.slug.startsWith('open-plot-'));
   if(plots.length!==15||new Set(plots.map(row=>row.instance)).size!==15)throw new Error('Expected all fifteen authored plot cells');
   targets.push(...plots.map(row=>({slug:row.slug,instance:row.instance})));
  }
 for(const target of targets) {
  if(interruption.on)break;
  const {slug,instance}=target;
  const caseName=`${slug}--${instance}`;
  errors=[];
  const run={sha:pin,when:new Date().toISOString(),surface:'chromium',cohort:'grid',complete:false,glObserver:'off',
   instance,profile:{device:'iPhone 16 Pro',tier:'phone',cpu:4,muted:true},cases:[],processSamples:[]};
  const scene={shard:'grid',complete:false,errors,routes:[],rows:[]};run.cases.push(scene);receipt.runs.push(run);
  const profileStart=async()=>{if(profiling){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}};
  const profileEnd=async phase=>{if(profiling)writeFileSync(resolvePath(out,`${caseName}-${phase}.cpuprofile`),JSON.stringify((await cdp.send('Profiler.stop')).profile));};
  const dump=async phase=>{
   const events=[];
   const collect=event=>{events.push(...event.value);};session.on('Tracing.dataCollected',collect);
   try {
    await session.send('Tracing.start',{transferMode:'ReportEvents',traceConfig:{includedCategories:['disabled-by-default-memory-infra'],memoryDumpConfig:{triggers:[]}}});
    const result=await session.send('Tracing.requestMemoryDump',{levelOfDetail:'detailed',deterministic:false});
    const complete=new Promise(resolve=>{session.once('Tracing.tracingComplete',resolve);});
    await session.send('Tracing.end');await complete;
    if(!result.success)throw new Error('CDP memory dump failed');
    run.processSamples.push({phase,at:new Date().toISOString(),...chromiumProcessPeaks(events)});
   }finally{session.off('Tracing.dataCollected',collect);}
  };
  try {
   await page.waitForFunction(()=>window.__wildshard?.shard?.grid?.state().live?.live?.gameplayReady,undefined,{timeout:240000});
   const overlay=page.locator('.ws-grid-reveal');if(await overlay.isVisible())await overlay.click();
   await page.waitForFunction(()=>!document.querySelector('#hud')?.classList.contains('ws-grid-revealing'),undefined,{timeout:30000});
   const meta=await page.evaluate(()=>({tier:window.__wildshard.boot.tier,clock:window.__wildshard.app.clock.mode,
    renderScale:window.__wildshard.world.game.renderer.getPixelRatio()}));
   if(meta.tier!=='phone'||meta.clock!=='live'||meta.renderScale!==2)throw new Error(`Invalid phone configuration: ${JSON.stringify(meta)}`);
   run.observedProfile=meta;
   const state=await page.evaluate(()=>window.__wildshard.shard.grid.state());
   const cell=state.cells.find(row=>row.instance===instance);if(!cell)throw new Error(`No grid cell: ${slug}`);
   const identity=await page.evaluate(gridFloorDocumentIdentity);
   await page.evaluate(`(${installReadinessProbe.toString()})(${JSON.stringify(cell.instance)},${JSON.stringify(slug)},(${ownedResidencyBytes.toString()}))`);
   const plans=gridFloorPlans(state,'cell',{cell:cell.instance,roadApproach:true});
   const entry=await gridFloorDeclaredPlan(page,state,plans[0]);
   await page.evaluate(`(${stageFloorGrid.toString()})(${JSON.stringify(entry)},${JSON.stringify(identity)},(${driveFloorGrid.toString()}))`);
   await dump('before-entry');
   await profileStart();
   await page.evaluate(()=>window.__gridReadyProbe.start('loading'));
   const entered=await page.evaluate(`(${driveFloorGrid.toString()})(${JSON.stringify(entry)},${JSON.stringify(identity)})`);
   const entryRow=await page.evaluate(()=>window.__gridReadyProbe.stop());
   await profileEnd('entry');
   scene.rows.push({name:`grid-${entry.name}-drive`,...entryRow});
   errors.push(...gridFloorWitnessFailures(entered));
   scene.routes.push({name:entry.name,after:{current:entered.after.live.live.current,slug},witness:entered});
   await dump('entered');
   await profileStart();
   await page.evaluate(()=>window.__gridReadyProbe.start('playing'));
   await page.evaluate(()=>new Promise(resolve=>{
    const game=window.__wildshard.world.game,player=window.__wildshard.world.player,start=performance.now(),yaw=player.yaw;
    const stop=game.watchFrames(()=>{
     player.yaw=yaw+Math.min(1,(performance.now()-start)/6000)*Math.PI*2;
     if(performance.now()-start>=6000){stop();resolve(undefined);}
    });
   }));
   scene.rows.push({name:`grid-${entry.name}`,...await page.evaluate(()=>window.__gridReadyProbe.stop())});
   await profileEnd('look');
   await dump('after-look');
   await page.evaluate(label=>{
    const caption=document.createElement('div');caption.textContent=label;
    caption.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#08131f;color:white;padding:8px;font:12px sans-serif;text-align:center;pointer-events:none';
    document.body.append(caption);
   },`${pin.slice(0,7)} · ${slug} entered · iPhone 16 Pro · CPU 4x`);
   await page.screenshot({path:resolvePath(out,`${caseName}.jpg`),type:'jpeg',quality:70,scale:'css'});
   const road=entry.waypoints[0];
   const leave=await gridFloorDeclaredPlan(page,entered.after,{name:`${slug}-leave`,from:cell.instance,to:null,movement:'road-hover',
    waypoints:[road],requiredResidents:[],finishOnArrival:false});
   await profileStart();
   await page.evaluate(()=>window.__gridReadyProbe.start('playing'));
   const left=await page.evaluate(`(${driveFloorGrid.toString()})(${JSON.stringify(leave)},${JSON.stringify(identity)})`);
   scene.rows.push({name:`grid-${entry.name}-travel`,...await page.evaluate(()=>window.__gridReadyProbe.stop())});
   await profileEnd('leave');
   errors.push(...gridFloorWitnessFailures(left));scene.leave=left;
   const owned=await page.evaluate(()=>window.__gridReadyProbe.finish());
   const peaks=run.processSamples.reduce((peak,row)=>({browser:Math.max(peak.browser,row.browser),renderer:Math.max(peak.renderer,row.renderer),gpu:Math.max(peak.gpu,row.gpu)}),{browser:0,renderer:0,gpu:0});
   if(owned.playingPeakBytes<=0||owned.loadingPeakBytes<=0||owned.samples<3)throw new Error('Missing owned residency observations');
   run.memory={measurement:'chromium-residency+cdp',owner:slug,cdp:'memory-infra',...owned,
    browserProcessPeakBytes:peaks.browser,rendererProcessPeakBytes:peaks.renderer,gpuProcessPeakBytes:peaks.gpu};
   scene.complete=errors.length===0;run.complete=scene.complete;
   if(scene.rows.some(row=>!row.stallPass)||!scene.complete)failed=true;
  }catch(error){errors.push(String(error));failed=true;}
  finally {
   writeFileSync(resolvePath(out,`${caseName}.json`),JSON.stringify(run,null,2));
   writeFileSync(resolvePath(out,'receipt.json'),JSON.stringify(receipt,null,2));
   const memorySummary=run.memory===undefined?undefined:Object.fromEntries(Object.entries(run.memory).filter(([key])=>!['observations','peakClaims'].includes(key)));
   console.info(JSON.stringify({slug,instance,complete:run.complete,errors,memory:memorySummary,rows:scene.rows}));
  }
 }
}finally{await browser.close();}
if(failed)throw new Error('Grid readiness finding; see per-shard receipts');

/** Serialized browser observer: sparse residency snapshots and live drawn-frame intervals, no GL hooks. */
function installReadinessProbe(instance,slug,sumOwned) {
 window.__gridReadyProbe?.finish();
 const api=window.__wildshard,game=api.world.game,context=game.renderer.getContext(),samples=[],intervals=[],longFrames=[];
 let loadingPeak=null,playingPeak=null;
 let phase='loading',count=game.frameCount,last=0,raf=0,skipped=0,active=false,contextLost=false;
 const memory=()=>{
  const state=api.shard.grid.state(),claims=api.shard.grid.residency().claims;
  const own=claims.filter(row=>row.owner===instance||row.id===`product:grid:${slug}`);
  const row={at:performance.now(),phase,bytes:sumOwned(own,instance,slug),current:state.live.live.current};
  samples.push(row);
  const peak=()=>({...row,claims:own.map(claim=>({id:claim.id,category:claim.category,bytes:claim.bytes,accountedBytes:claim.accountedBytes,coveredBy:claim.coveredBy}))});
  if(loadingPeak===null||row.bytes>loadingPeak.bytes)loadingPeak=peak();
  if(phase==='playing'&&(playingPeak===null||row.bytes>playingPeak.bytes))playingPeak=peak();
 };
 const timer=setInterval(memory,250);memory();
 const tick=timestamp=>{
  if(!active)return;
  if(game.frameCount!==count){
   if(timestamp-last>100&&longFrames.length<300){const state=api.shard.grid.state();longFrames.push({startMs:last,endMs:timestamp,ms:timestamp-last,
    current:state.live.live.current,crossing:state.live.crossing.phase,runtimeTiming:state.live.runtimeTiming,
    workMs:game.workMs[(game.frameI+game.workMs.length-1)%game.workMs.length]});}
   intervals.push(timestamp-last);skipped+=Math.max(0,game.frameCount-count-1);last=timestamp;count=game.frameCount;}
  contextLost||=context.isContextLost();raf=requestAnimationFrame(tick);
 };
 window.__gridReadyProbe={
  start(nextPhase){phase=nextPhase;memory();intervals.length=0;longFrames.length=0;count=game.frameCount;last=performance.now();skipped=0;active=true;raf=requestAnimationFrame(tick);},
  stop(){active=false;cancelAnimationFrame(raf);memory();
   const sorted=[...intervals].sort((a,b)=>a-b),percentile=p=>sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]??0;
   const maxMs=percentile(1),p95Ms=percentile(.95),medianFps=1000/percentile(.5),stallPass=intervals.length>0&&!contextLost&&skipped===0&&maxMs<=200;
   return {longFrames:[...longFrames],frames:intervals.length,contextLost,skipped,maxMs,p95Ms,medianFps,stallPass,pass:stallPass&&p95Ms<=35&&Math.round(medianFps)>=30};
  },
  finish(){active=false;cancelAnimationFrame(raf);clearInterval(timer);memory();return {samples:samples.length,playingPeakBytes:Math.max(0,...samples.filter(row=>row.phase==='playing').map(row=>row.bytes)),
   loadingPeakBytes:Math.max(0,...samples.map(row=>row.bytes)),peakClaims:{loading:loadingPeak,playing:playingPeak},observations:samples};}
 };
}
