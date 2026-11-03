#!/usr/bin/env node
// One command: eight real grid views and the existing scored GOLDEN | NOW board.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {devices} from 'playwright';
import {launchMemoryBrowser} from '../../../scripts/chromium-memory-browser.mjs';
import {developerSettings,saveFixture,harnessPins} from '../../../scripts/debug-settings.mjs';
import {frameFloorSettingsCode} from '../../../scripts/frame-floor-settings.mjs';
import {FLOOR_GRID_ENTER,floorGridBenchmarkUrl} from '../../../scripts/frame-floor-navigation.mjs';
import {gridFloorPlans,gridFloorDeclaredPlan,gridFloorDocumentIdentity,stageFloorGrid,driveFloorGrid,gridFloorWitnessFailures,floorGridEntryRoute} from '../../../scripts/frame-floor-grid.mjs';
import {assertDomeAnchorReady} from '../../../scripts/dome-cameras.mjs';
import {installDomeCamera,sampleDomeFrames,settledCaptureState} from '../../../scripts/capture-plot-domes.mjs';
import {goldenPreviewIdentity} from '../../../scripts/goldens/capture-inputs.mjs';
import {parsePlotGoldens,plotGoldenPlacement,plotGoldenCamera} from '../../../scripts/goldens/plot-inputs.mjs';

const arg=(name,fallback='')=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const plot=arg('plot'),base=arg('base'),out=arg('out');
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(plot)||!base||!out) throw new Error('Requires --plot=<idea> --base=<preview URL> --out=<new run dir> [--sha=<full SHA>] [--python=python3]');
const folder=resolve(out);
if (folder===process.cwd() || !folder.startsWith(`${resolve('tmp')}/`) || existsSync(folder)) throw new Error('--out must be a new directory under ./tmp');
const file=`art/open-plots/golden-2026-11-03/${plot}/cameras.json`,bytes=readFileSync(file),plan=parsePlotGoldens(JSON.parse(bytes.toString('utf8')));
if (plan.slug!==`open-plot-${plot}`) throw new Error('Plot camera identity differs');
const source=goldenPreviewIdentity(await(await fetch(new URL('/version.json',base))).json(),arg('sha'));
// Grid entry reads its template as well as the target; shard-only previews can omit it.
await Promise.all(['_template',plan.slug].map(async slug=>{
  const url=new URL(`/shardfiles/${slug}/shard.json`,base),response=await fetch(url);
  let product;try {product=await response.json();} catch {throw new Error(`Grid golden needs a complete preview: missing JSON product ${url.pathname}; use serve-build.sh --head`);}
  if(!response.ok || !Array.isArray(product?.files) || !Array.isArray(product?.sections))
    throw new Error(`Grid golden needs an admitted product at ${url.pathname}; use serve-build.sh --head`);
}));
// Check Python dependencies before launching or spending a capture lane.
const python=arg('python','python3');execFileSync(python,['-c','from PIL import Image; import numpy'],{stdio:'inherit'});
function noQuiet() {if (existsSync('.git/quiet')) throw new Error('Official Simulator quiet is active; capture refuses');}
noQuiet();mkdirSync(join(folder,'raw',plot),{recursive:true});
const report={source,cameraFile:file,cameraSha256:createHash('sha256').update(bytes).digest('hex'),plan,
  protocol:'iPhone 16 Pro 402x603, phone 2x, seed 357, midday/clear; normal grid route, plot-local golden camera onLate; shipping residency, lens and composer',
  complete:false,errors:[],views:[]};
const save=()=>writeFileSync(join(folder,'capture.json'),JSON.stringify(report,null,2));save();
const owner=await launchMemoryBrowser(['--mute-audio','--use-angle=metal','--ignore-gpu-blocklist']);
try {
  const context=await owner.browser.newContext({...devices['iPhone 16 Pro'],viewport:{width:402,height:603}});
  let page;
  try {
    await context.addInitScript({content:frameFloorSettingsCode({tier:'phone',fps:'auto',volume:0,time:'midday',weather:'clear'})});
    await developerSettings(context,{tier:'phone',volume:0,time:'midday',weather:'clear'});
    await saveFixture(context,{scope:'global',key:'gfx',data:{dpr:'2',aa:'auto'}});
    await harnessPins(context,{seed:357,browser:'Chromium / iPhone 16 Pro',lane:'open-plot-goldens'});
    page=await context.newPage();page.setDefaultTimeout(180000);
    page.on('pageerror',error=>{report.errors.push(error.message);});
    await page.goto(floorGridBenchmarkUrl(base),{waitUntil:'load'});await page.locator('.ws-main-grid').click();
    const ready=await page.waitForFunction(()=>{
      const failure=document.querySelector('.ws-load-error,.ws-error-modal');
      if(failure!==null)return {failure:failure.textContent};
      return window.__wildshard?.shard?.grid?.state().live.live.gameplayReady?{ready:true}:false;
    },undefined,{timeout:240000});
    const admission=await ready.jsonValue();await ready.dispose();
    if(admission.failure)throw new Error(`Grid entry refused: ${admission.failure}`);
    await page.evaluate(FLOOR_GRID_ENTER);
    await page.waitForFunction(()=>!document.querySelector('#hud')?.classList.contains('ws-grid-revealing'));
    const initial=await page.evaluate(()=>window.__wildshard.shard.grid.state()),placement=plotGoldenPlacement(plan,initial);
    report.placement=placement;
    const identity=await page.evaluate(gridFloorDocumentIdentity);
    const route=floorGridEntryRoute(gridFloorPlans(initial,'cell',{cell:placement.instance,roadApproach:true}),placement.instance);
    report.route=[];
    for (const candidate of [...route.setup,route.entry]) {
      const current=await page.evaluate(()=>window.__wildshard.shard.grid.state());
      const entry=await gridFloorDeclaredPlan(page,current,candidate);
      await page.evaluate(`(${stageFloorGrid.toString()})(${JSON.stringify(entry)},${JSON.stringify(identity)},(${driveFloorGrid.toString()}))`);
      const witness=await page.evaluate(`(${driveFloorGrid.toString()})(${JSON.stringify(entry)},${JSON.stringify(identity)})`);
      report.route.push(witness);save();
      const failures=gridFloorWitnessFailures(witness);if (failures.length) throw new Error(failures.join('; '));
    }
    await page.evaluate(installDomeCamera);
    await page.addStyleTag({content:'body *{visibility:hidden!important}canvas[data-dome-canvas]{visibility:visible!important}'});
    for (const view of plan.views) {
      noQuiet();
      const anchor={x:placement.origin.x+view.player[0],z:placement.origin.z+view.player[1],instance:placement.instance};
      assertDomeAnchorReady((await settledCaptureState(page,(_arg,grid)=>grid,null)).state,anchor);
      await page.evaluate(async at=>{const api=window.__wildshard,w=api.requireWorld(),live=api.shard.grid.state().live.live;
        await api.pose({x:at.x-(live.worldFeet.x-w.player.position.x),z:at.z-(live.worldFeet.z-w.player.position.z),yaw:0,pitch:0});},anchor);
      const camera=plotGoldenCamera(view,placement.origin);
      await page.evaluate(pose=>{window.__plotDome=pose;},camera);
      const sample=await page.evaluate(sampleDomeFrames);
      const {state,wait}=await settledCaptureState(page,(_arg,grid)=>{
        const api=window.__wildshard,w=api.requireWorld(),g=w.game,cam=g.camera,origin=grid.live.renderOrigin,live=grid.live.live;
        const dx=live.worldFeet.x-w.player.position.x-origin.x,dz=live.worldFeet.z-w.player.position.z-origin.z;
        return {grid,frame:g.frameCount,tier:api.boot.tier,dpr:g.renderer.getPixelRatio(),lost:g.renderer.getContext().isContextLost(),
          camera:{eye:[cam.position.x+dx,cam.position.y,cam.position.z+dz],fov:cam.fov,aspect:cam.aspect,far:cam.far}};
      },null);
      assertDomeAnchorReady(state.grid,anchor);
      if (report.errors.length || state.lost || state.tier!=='phone'||state.dpr!==2
        || (await page.evaluate(gridFloorDocumentIdentity)).token!==identity.token
        || Math.hypot(state.grid.live.live.worldFeet.x-anchor.x,state.grid.live.live.worldFeet.z-anchor.z)>0.5
        || state.camera.eye.some((word,i)=>Math.abs(word-camera.eye[i])>1e-4)
        || Math.abs(state.camera.fov-camera.fov)>1e-4 || Math.abs(state.camera.aspect-2/3)>1e-6) throw new Error('Golden document, anchor or camera changed');
      const actual=goldenPreviewIdentity(await(await page.request.get(new URL('/version.json',base).href)).json(),arg('sha'));
      if (actual.build!==source.build) throw new Error('Preview changed during capture');
      const image=join(folder,'raw',plot,`${view.n}-${view.name}.png`);
      await page.screenshot({path:image,type:'png',scale:'device'});
      report.views.push({n:view.n,name:view.name,anchor,camera,sample,state,wait,imageSha256:createHash('sha256').update(readFileSync(image)).digest('hex')});save();
    }
    report.framesComplete=true;save();
  } catch(error) {
    report.errors.push(String(error));
    if(page!==undefined) {
      report.failure=await page.evaluate(()=>({url:location.href,body:document.body.innerText.slice(0,6000),grid:window.__wildshard?.shard?.grid?.state?.()})).catch(()=>null);
      await page.screenshot({path:join(folder,'failure.jpg'),type:'jpeg',quality:74,scale:'css'}).catch(()=>{});
    }
    save();throw error;
  }
  finally {await context.close();}
} finally {await owner.close();}
try {
  execFileSync(python,['.claude/skills/goldens/board.py','--plot',plot,'--now',join(folder,'raw'),'--out',join(folder,'board'),'--label',`NOW ${source.build} UNREVIEWED`],{stdio:'inherit'});
  report.board={file:join('board',`board-${plot}.jpg`),sha256:createHash('sha256').update(readFileSync(join(folder,'board',`board-${plot}.jpg`))).digest('hex'),verdict:'unreviewed'};
  report.complete=true;save();
} catch(error) {report.errors.push(String(error));save();throw error;}
console.info(`Eight views captured; read every row in ${join(folder,'board')} before a look verdict.`);
