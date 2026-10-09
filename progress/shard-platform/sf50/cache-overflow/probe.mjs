import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url)).replace(/\/$/u,'');
const {browserPool}=await import(`${root}/scripts/parity/pool.mjs`);
const {installInit}=await import(`${root}/scripts/parity/init.mjs`);
const {GL_INIT}=await import(`${root}/scripts/parity/glbytes.mjs`);
const {installResources}=await import(`${root}/scripts/parity/resources.mjs`);
const {saveFixture}=await import(`${root}/scripts/debug-settings.mjs`);
const {gridFloorPlans,runFloorGridRoute,gridFloorDocumentIdentity,gridFloorWitnessFailures}=await import(`${root}/scripts/frame-floor-grid.mjs`);
const [base,out,only]=process.argv.slice(2),pool=browserPool(root,1,'metal');
const report={version:await(await fetch(`${base}/version.json`)).json(),rows:[]};
function census(){
 const api=window.__wildshard, w=api.requireWorld(), g=w.game, grid=api.shard?.grid;
 const memory=api.memory(), horse=memory.allocations.filter(row=>row.asset.includes('/horse-hd/'));
 const meshes=[];(g.rootScene??g.scene).traverse(o=>{if(o.isMesh&&o.material){const materials=Array.isArray(o.material)?o.material:[o.material];for(const material of materials)if(material.map?.image){const image=material.map.image;meshes.push({name:o.name,geometry:o.geometry.uuid,vertices:o.geometry.attributes.position?.count,texture:material.map.uuid,width:image.width,height:image.height});}}});
 const contexts=window.__sc_gl().map(({gl,...rest})=>rest),horses=contexts.flatMap(c=>c.resources).filter(row=>JSON.stringify(row).includes('/horse-hd/'));
 return {grid:grid?.state(),residency:grid?.residency(),horse,horseBytes:horse.reduce((s,r)=>s+r.bytes,0),horseGl:horses,meshes,contexts:contexts.map(c=>({id:c.id,totalBytes:c.totalBytes,reconciled:c.reconciled})),colliders:w.physics.world.colliders.len(),caravan:g.app.registry.pieceList().filter(p=>p.id==='sunscar.caravan').map(p=>({id:p.id,colliders:p.colliders?.length,horseColliders:p.colliders?.filter(c=>c.surface==='flesh')})),memoryTotals:memory.totals,accounted:memory.accountedBytes};
}
try{
 const browser=await pool.browser(0);
 for(const mode of (only?[only]:['standalone','grid'])){
  const context=await browser.newContext({viewport:{width:402,height:874},deviceScaleFactor:3,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  if(mode==='standalone')await installInit(context,{lane:'m5',sha:report.version.build??report.version.sha,browser:browser.version(),capture:30,accelerated:true,tier:'phone'});
  else {await context.addInitScript(GL_INIT);await context.addInitScript(installResources);await context.addInitScript(()=>{window.__wildshardHarness={seed:357,capture:null};});}
  await saveFixture(context,{scope:'device',key:'devMode',data:true});
  await saveFixture(context,{scope:'global',key:'settings',data:{tier:'phone',fps:'auto',tex:'auto'},merge:true});
  const page=await context.newPage(),row={mode,errors:[],warnings:[]};report.rows.push(row);
  page.on('pageerror',e=>row.errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))row.warnings.push(m.text());});
  if(mode==='standalone'){
   await page.goto(`${base}/?chunk=sunscar-dunes&tier=phone&touch=1&skipintro=1&nolock=1&mute=1&sw=0`,{waitUntil:'commit',timeout:240000});
   await page.waitForFunction(()=>window.__wildshard?.world&&!document.querySelector('.ws-load'),null,{timeout:240000});
   await page.evaluate(()=>{window.__parity.free=true;});
  }else{
   await page.goto(`${base}/?mute=1&nolock=1&sw=0`,{waitUntil:'commit',timeout:180000});
   await page.locator('.ws-main-grid').click({timeout:120000});
   await page.waitForFunction(()=>!document.querySelector('.ws-load')&&window.__wildshard?.shard?.grid?.state().live?.live,null,{timeout:240000});
   await page.evaluate(()=>window.__wildshard.requireWorld().hud.enterNow());
   await page.waitForFunction(()=>window.__wsReveal?.endedMs!=null,null,{timeout:45000});
   const state=await page.evaluate(()=>window.__wildshard.shard.grid.state()),plans=gridFloorPlans(state,'sun-entry');
   // Match native.mjs: one initial road seed, then all entry legs use held input.
   await page.evaluate(async start=>{const api=window.__wildshard,live=api.shard.grid.state().live.live,player=api.requireWorld().player;
    await api.pose({x:start.x-(live.worldFeet.x-player.position.x),y:.55,z:start.z-(live.worldFeet.z-player.position.z),yaw:0,pitch:-.08});},plans[0].start);
   await page.waitForFunction(()=>{const s=window.__wildshard.shard.grid.state();return s.live.live.current===null&&s.inside===null&&s.live.live.gameplayReady;},null,{timeout:120000});
   const identity=await page.evaluate(gridFloorDocumentIdentity);
   row.routes=[];for(const plan of plans.slice(0,2)){try{const result=await runFloorGridRoute(page,plan,identity);row.routes.push(result);const failures=gridFloorWitnessFailures(result);if(failures.length)throw Error(failures.join('; '));}catch(error){row.failedState=await page.evaluate(()=>({state:window.__wildshard.shard.grid.state(),stop:window.__frameFloorGridStop,player:window.__wildshard.requireWorld().player.position}));throw error;}}
  }
  // Entry above is real held-input traversal. This interior inspection pose faces the pack horse;
  // uploaded-GL evidence must not mistake an off-screen model for a failed load.
  await page.evaluate(()=>window.__wildshard.pose({x:-74,z:15,yaw:Math.PI,pitch:0}));
  await page.waitForTimeout(3000);row.census=await page.evaluate(census);
  await page.screenshot({path:out.replace(/\.json$/u,`-${mode}.jpg`),type:'jpeg',quality:80});
  writeFileSync(out,JSON.stringify(report,null,2));
  if(row.census.horse.length===0||row.census.horseGl.length===0||!row.census.caravan.some(p=>p.horseColliders.length===1))throw Error(`${mode}: horse allocation/collider absent`);
  if(row.errors.length||row.warnings.some(x=>/cache coverage|not loaded/u.test(x)))throw Error(`${mode}: load error`);
  console.log(mode,row.census.horseBytes,row.census.residency?.cost.playing);
  await context.close();
 }
} catch(e){report.failure=String(e);throw e;}finally{writeFileSync(out,JSON.stringify(report,null,2));await pool.close();}
