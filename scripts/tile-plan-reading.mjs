#!/usr/bin/env node
// One plan-end cohort, one already-served main SHA; no build, retry, Simulator or quiet marker.
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { createHash } from 'node:crypto';
import { devices } from 'playwright';
import * as v from 'valibot';
import { launchMemoryBrowser } from './chromium-memory-browser.mjs';
import { chromiumProcessPeaks } from './grid-ready-memory.mjs';
import { saveFixture, harnessPins } from './debug-settings.mjs';
import { frameFloorSettingsCode } from './frame-floor-settings.mjs';
import { loadingShardName } from './loading-benchmark/catalogue.mjs';
import { GL_FULL_INIT } from './parity/glbytes.mjs';
import { censusReadSource } from './parity/tile-census-scene.mjs';
import { summarizeTileCensus } from './parity/tile-census.mjs';
import { TilesSchema } from '../src/format/shardSections.ts';
import { TILE_STATE, TILE_PAINT_INIT, TILE_FRAMES, TILE_LEG_START, TILE_LEG_END } from './tile-plan-page.mjs';
import { tilePlanMarkdown } from './tile-plan-report.mjs';
import { floorGridBenchmarkUrl, FLOOR_GRID_ENTER } from './frame-floor-navigation.mjs';
import { gridFloorDocumentIdentity, runFloorGridRoute, gridFloorWitnessFailures, readFloorGridEntryways } from './frame-floor-grid.mjs';
import { tileRetirementRoute, tileRetirementPortalPlans, seedTileRetirementHome } from './tile-retirement-proof.mjs';

const arg = (/** @type {string} */ name) => process.argv.find(s => s.startsWith(`--${name}=`))?.slice(name.length + 3);
if (process.argv.includes('--help')) {
  console.info('browser-lane.sh --max 45 node --experimental-transform-types --import ./scripts/shard-platform-format.mjs scripts/tile-plan-reading.mjs --base=URL --pin=FULL_SHA --out=FRESH_DIR');
  console.info('8 families x 3x3/5x5 spawn; one resident-road reference and streamed-road DW/Sky handoff cohort. No retry/build/GC/Simulator.');
  console.info('--report=READING_JSON renders the retained cohort offline, without opening a browser.');
  process.exit(0);
}
const report=arg('report');
if(report!==undefined){console.info(tilePlanMarkdown(JSON.parse(readFileSync(report,'utf8'))));process.exit(0);}
const base = v.parse(v.pipe(v.string(),v.url()),arg('base'));
const pin = v.parse(v.pipe(v.string(),v.regex(/^[a-f0-9]{40}$/u)),arg('pin'));
const out = v.parse(v.pipe(v.string(),v.minLength(1)),arg('out'));
if (existsSync(resolvePath(out, 'reading.json'))) throw new Error('Reading exists; never overwrite or repeat a plan cohort');
mkdirSync(out, {recursive: true});
const version = await (await fetch(new URL('/version.json', base))).json();
if (!String(version.build).startsWith(`${pin.slice(0, 7)}-`)) throw new Error('Preview differs from the supplied source pin');
const allShards = ['driftwood-isle', 'nalati-grasslands', 'pine-hollow', 'nine-dragon-stack', 'far-reach', 'sunscar-dunes', '_template', 'open-plot-night-market'];
const shards=arg('shards')?.split(',')??allShards;
if(new Set(shards).size!==shards.length||shards.some(shard=>!allShards.includes(shard)))throw new Error('Unknown or duplicate requested shard');
const spawnOnly=process.argv.includes('--spawn-only');
/** @type {{protocol:string,pin:string,version:unknown,complete:boolean,rows:object[],grid:object[],errors:string[],limits:object}} */
const result = {protocol:'tile-plan-chromium/1',pin,version,complete:false,rows:[],grid:[],errors:[],limits:{
  tools:Object.fromEntries(['tile-plan-reading.mjs','tile-plan-page.mjs','tile-retirement-proof.mjs','frame-floor-grid.mjs'].map(path=>
    [path,createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex')])),
  shards,spawnOnly,sourceRepairOf:arg('source-repair-of')??null,
  device:'iPhone 16 Pro',tier:'phone',cpu:4,renderScale:2,spawnSettleFrames:120,frameSampleMs:8000,
  whole:'Declared unique fine-file dependency closure, not a restored whole-cell renderer or measured native RAM.',
  memory:'GL capacities, scene backing/ledger capacities, allocator claims and process footprints remain separate.',
  overlay:'Actual clipped minimap paint evidence; offscreen borders/labels are not assumed visible.',
  T0:'Same-source spawn census share, not causal savings versus a historical source.',
  S3:'Resident road reference then streamed road; one browser reused, no forced GC; process deltas are descriptive.',
  retries:0,simulator:false,inspectorResponseBodyBytes:0}};
const write = () => { writeFileSync(resolvePath(out,'reading.json'),`${JSON.stringify(result,null,2)}\n`); };
const fileSchema = v.object({hash:v.string(),dependencies:v.array(v.string()),compressed:v.number(),decoded:v.number(),gpu:v.number()});
/** @param {string} slug */
async function declaration(slug) {
  const root = new URL(`/shardfiles/${slug}/`,base), response = await fetch(new URL('shard.json',root));
  if (!response.ok) throw new Error(`Missing ${slug} product: HTTP${response.status}`);
  const index = v.parse(v.looseObject({identity:v.object({slug:v.string()}),files:v.array(fileSchema),
    sections:v.array(v.looseObject({name:v.string(),path:v.string(),hash:v.string(),bytes:v.number()}))}),await response.json());
  const section = index.sections.find(s=>s.name==='world/tiles');
  if (!section) throw new Error('Missing tile section');
  const payload = await fetch(new URL(section.path,root));
  if (!payload.ok) throw new Error('Tile section fetch refused');
  const bytes = new Uint8Array(await payload.arrayBuffer());
  if (bytes.length!==section.bytes||createHash('sha256').update(bytes).digest('hex')!==section.hash) throw new Error('Tile section hash/size differs');
  const tiles = v.parse(v.object({tiles:TilesSchema}),JSON.parse(new TextDecoder().decode(bytes))).tiles;
  const inventory=new Map(index.files.map(f=>[f.hash,f]));
  /** @param {readonly string[]} roots */
  const closure=roots=>{
    const seen=new Set(),pending=[...roots];let resident=0,wire=0;
    while(pending.length>0){const hash=pending.pop();if(hash===undefined||seen.has(hash))continue;
      const file=inventory.get(hash);if(!file)throw new Error(`Missing tile dependency ${hash}`);
      seen.add(hash);resident+=file.decoded+file.gpu;wire+=file.compressed;pending.push(...file.dependencies);}
    return {resident,wire,files:seen.size};
  };
  return {tiles,wholeFine:closure(tiles.filter(t=>t.lod===0).flatMap(t=>t.files)),closure};
}
const memoryBrowser=await launchMemoryBrowser(['--mute-audio','--use-angle=metal','--ignore-gpu-blocklist','--enable-precise-memory-info']);
const browser=memoryBrowser.browser;
const browserSession=await browser.newBrowserCDPSession();
/** @param {string} label */
async function processMemory(label){
  /** @type {unknown[]} */const events=[];
  const receive=(/** @type {{value:unknown[]}} */ e)=>{events.push(...e.value);};
  browserSession.on('Tracing.dataCollected',receive);
  try{
    await browserSession.send('Tracing.start',{transferMode:'ReportEvents',categories:'disabled-by-default-memory-infra'});
    const dump=await browserSession.send('Tracing.requestMemoryDump',{levelOfDetail:'detailed',deterministic:false});
    const done=new Promise(resolve=>{browserSession.once('Tracing.tracingComplete',resolve);});await browserSession.send('Tracing.end');await done;
    if(!dump.success)throw new Error('Process dump unavailable');
    writeFileSync(resolvePath(out,`${label}-process.json`),JSON.stringify(events));return chromiumProcessPeaks(events);
  }finally{browserSession.off('Tracing.dataCollected',receive);}
}
/** @param {'3x3'|'5x5'} ring @param {'resident'|'tiles'} road */
async function open(ring,road){
  const context=await browser.newContext({...devices['iPhone 16 Pro'],serviceWorkers:'block'}),page=await context.newPage();
  page.setDefaultTimeout(120000);
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await context.addInitScript({content:frameFloorSettingsCode({tier:'phone',fps:'auto',volume:'0'})});
  await saveFixture(context,{scope:'global',key:'gfx',data:{dpr:'2',aa:'auto'}});
  await saveFixture(context,{scope:'device',key:'devMode',data:true});
  await saveFixture(context,{scope:'device',key:'debug.global.legacyShardButtons',data:'on'});
  await saveFixture(context,{scope:'device',key:'debug.tileResidency',data:ring});
  await saveFixture(context,{scope:'device',key:'debug.roadResidency',data:road});
  await harnessPins(context,{seed:357,browser:'Chromium / iPhone 16 Pro',lane:'tile-plan-end'});
  await context.addInitScript({content:GL_FULL_INIT});await context.addInitScript({content:TILE_PAINT_INIT});
  /** @type {string[]} */const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('crash',()=>errors.push('Page crashed'));
  page.on('response',r=>{if(r.status()>=400&&!new URL(r.url()).pathname.startsWith('/api/'))errors.push(`HTTP${r.status()} ${r.url()}`);});
  return {context,page,cdp,errors};
}
/** @param {import('playwright').Page} page */
async function ready(page){
  await page.waitForFunction(()=>Boolean(document.querySelector('#wserr .msg')?.textContent)||Boolean(window.__wildshard?.world?.game)&&!document.querySelector('.ws-load'),undefined,{timeout:120000});
  const error=await page.locator('#wserr .msg').textContent({timeout:100}).catch(()=>null);if(error)throw new Error(error);
  await page.evaluate(FLOOR_GRID_ENTER);
  await page.waitForFunction(()=>window.__wildshard.world?.hud.entered&&!window.__wildshard.world.hud.paused&&window.__wildshard.world.game.frameGate());
  const controlsAt=Date.now();
  await page.evaluate(`new Promise((resolve,reject)=>{const game=window.__wildshard.world.game,start=game.frameCount,until=performance.now()+30000;const tick=()=>{if(game.frameCount-start>=120)resolve(true);else if(performance.now()>until)reject(Error('Spawn frames did not advance'));else requestAnimationFrame(tick);};requestAnimationFrame(tick);})`);
  return controlsAt;
}
/** @param {import('playwright').Page} page @param {string} label */
async function sample(page,label){
  const frames=await page.evaluate(TILE_FRAMES),state=await page.evaluate(TILE_STATE);
  const census=await page.evaluate(censusReadSource(true));
  writeFileSync(resolvePath(out,`${label}-census.json`),JSON.stringify(census));
  const share=summarizeTileCensus({...census.tile,observed:census.observed});
  const overlay=await page.evaluate('window.__tilePlanPaint()');
  const process=await processMemory(label);
  return {frames,state,share,overlay,process};
}
try{
  for(const shard of shards)for(const ring of /** @type {const} */(['3x3','5x5'])){
    const visit=await open(ring,'resident'),label=`${shard}-${ring}`;
    try{
      const source=await declaration(shard);
      let tapAt=Date.now(),entry='observed SHARDFILE button';
      if(shard==='open-plot-night-market'){
        // This declared compiled-only manifest is intentionally absent from SHARD SELECT.
        entry='declared compiled-only chunk route (hidden selector card)';
        await visit.page.goto(new URL('/?chunk=open-plot-night-market&mute=1&nolock=1&sw=0',base).href,{waitUntil:'load'});
      }else{
        await visit.page.goto(base,{waitUntil:'load'});
        await visit.page.locator('.ws-main-select').click();
        const name=loadingShardName(shard);
        await visit.page.locator('.ws-menu-card b').first().waitFor();
        const titles=await visit.page.locator('.ws-menu-card b').allTextContents();
        const matches=titles.flatMap((title,index)=>title.toLowerCase().includes(name.toLowerCase())?[index]:[]);
        const selected=matches[0];if(matches.length!==1||selected===undefined)throw new Error(`Missing or ambiguous card ${name}`);
        await visit.page.locator(`.ws-menu-dots i[data-i="${selected}"]`).click();
        await visit.page.locator(`.ws-menu-card.selected[data-i="${selected}"]`).waitFor();
        const compiled=visit.page.locator('.ws-menu-shardfile');
        if(!await compiled.isVisible()||!await compiled.isEnabled())throw new Error(`Missing compiled entry ${name}`);
        tapAt=Date.now();await compiled.click();
      }
      const controlsAt=await ready(visit.page);const reading=await sample(visit.page,label),state=reading.state;
      if(!state||state.lost||state.tier!=='phone'||state.scale!==2||state.clock!=='live'||!state.controls)throw new Error('Invalid phone/controls/context profile');
      const expected=shard==='_template'?'template':shard;
      if(state.level.replace(/^_/u,'')!==expected.replace(/^_/u,''))throw new Error(`Wrong world identity ${state.level}`);
      if(state.product!==null&&state.product!==expected)throw new Error('Compiled product identity differs');
      const actual=state.render,rows=source.tiles.filter(t=>t.lod===0&&actual.includes(t.z*8+t.x));
      const resident=source.closure(rows.flatMap(t=>t.files));
      await visit.page.screenshot({path:resolvePath(out,`${label}.jpg`),type:'jpeg',quality:65});
      const failures=[...visit.errors];if(actual.length===0)failures.push('No observed render-tile ownership');
      // The engine probe lists level rows only on some builds. Absence is
      // unavailable evidence, not an observed mismatch of a global row.
      const effectiveRing=state.settings.find((/** @type {{id:string,value:string}} */ pick)=>pick.id==='tileResidency')?.value??null;
      if(effectiveRing!==null&&effectiveRing!==ring)failures.push('Effective ring Debug choice differs');
      if(actual.length>(ring==='3x3'?9:25))failures.push('Render tile ring exceeds selected limit');
      if(reading.overlay.rects.length===0||reading.overlay.labels.length===0)failures.push('No actual T5 border/MB paint');
      result.rows.push({shard,ring,effectiveRing,observedTapToControlsMs:controlsAt-tapAt,entry,...reading,declared:{resident,wholeFine:source.wholeFine,rowResident:rows.reduce((n,t)=>n+t.decoded+t.gpu,0)},failures});
    }catch(error){result.rows.push({shard,ring,failures:[String(error),...visit.errors]});result.errors.push(`${label}: ${String(error)}`);}
    finally{await visit.context.close();write();}
  }
  // The same road source/setting, one resident reference then one streamed cohort.
  for(const road of spawnOnly?[]:/** @type {const} */(['resident','tiles'])){
    const visit=await open('5x5',road);
    try{
      await visit.page.goto(floorGridBenchmarkUrl(base),{waitUntil:'load'});await visit.page.locator('.ws-main-grid').click();
      await visit.page.waitForFunction('window.__wildshard?.shard?.grid?.state().live?.live?.gameplayReady',undefined,{timeout:240000});
      await ready(visit.page);
      const gridState=await visit.page.evaluate('window.__wildshard.shard.grid.state()');
      const identity=await visit.page.evaluate(gridFloorDocumentIdentity),route=tileRetirementRoute(gridState);
      await visit.page.evaluate(`(${seedTileRetirementHome.toString()})(${JSON.stringify(route.reference)},${JSON.stringify(identity)},(${gridFloorDocumentIdentity.toString()}))`);
      const before=await sample(visit.page,`road-${road}-before`);
      /** @type {object[]} */const crossings=[];
      if(road==='tiles'){
        const entries=new Map();for(const cell of gridState.cells.filter((/** @type {{slug:string}} */ c)=>['driftwood-isle','far-reach'].includes(c.slug)))
          entries.set(cell.slug,await visit.page.evaluate(`(${readFloorGridEntryways.toString()})(${JSON.stringify(`/shardfiles/${cell.slug}/shard.json`)})`));
        const plans=tileRetirementPortalPlans(gridState,entries);
        for(let round=0;round<5;round++)for(const plan of plans){
          const startedAt=await visit.page.evaluate(TILE_LEG_START);
          const witness=await runFloorGridRoute(visit.page,plan,identity),routeFailures=gridFloorWitnessFailures(witness),failures=[...routeFailures];
          const frames=await visit.page.evaluate(TILE_LEG_END),state=await visit.page.evaluate(TILE_STATE);
          const timings=state.grid.timing.filter((/** @type {{requestedAt:number}} */ t)=>t.requestedAt>=startedAt);
          const limitMs=round===0?8000:5000;
          if(frames.maxMs>100)failures.push(`Crossing frame ${frames.maxMs}ms exceeds100ms`);
          for(const t of timings)if(t.to!==null&&t.end-t.requestedAt>=limitMs)failures.push(`Entry wall exceeds ${limitMs}ms`);
          if(state.grid.tileGhosts!==0||state.grid.regionGhosts!==0)failures.push('Retired tile/region ghosts');
          crossings.push({round:round+1,witness,frames,state,timings,limitMs,failures});writeFileSync(resolvePath(out,'crossings.json'),JSON.stringify(crossings,null,2));
          if(routeFailures.length>0)throw new Error(`Crossing route: ${routeFailures.join('; ')}`);
        }
      }
      const after=await sample(visit.page,`road-${road}-after`);
      if(road==='tiles'&&after.state.grid.roadTiles?.ready!==true)throw new Error('S3 road archive/stream did not become ready');
      result.grid.push({road,before,after,crossings,errors:visit.errors});
    }catch(error){result.grid.push({road,error:String(error),errors:visit.errors});result.errors.push(`road-${road}: ${String(error)}`);}
    finally{await visit.context.close();write();}
  }
  result.complete=true;
}finally{await memoryBrowser.close();write();}
const failures=[...result.rows.flatMap(row=>Reflect.get(row,'failures')??[]),...result.grid.flatMap(row=>{
  const crossings=Reflect.get(row,'crossings');return Array.isArray(crossings)?crossings.flatMap(c=>Reflect.get(c,'failures')??[]):[];
})];
if(result.errors.length>0||failures.length>0)process.exitCode=2;
console.info(JSON.stringify({complete:result.complete,rows:result.rows.length,grid:result.grid.length,errors:result.errors,failures}));
writeFileSync(resolvePath(out,'report.md'),tilePlanMarkdown(result));
