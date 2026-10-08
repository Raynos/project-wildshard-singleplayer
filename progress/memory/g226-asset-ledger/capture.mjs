// E435 / G226: extend the platform-ledger native driver with the actual return and durable home HP.
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
import { installResources } from '../../../scripts/parity/resources.mjs';
import { GL_INIT } from '../../../scripts/parity/glbytes.mjs';
import { driveFloorGrid, gridFloorPlans, stageFloorGrid, gridFloorWitnessFailures } from '../../../scripts/frame-floor-grid.mjs';
const [base, out] = process.argv.slice(2);
const started = Date.now(), report = { version: await (await fetch(new URL('version.json', base))).json(), protocol: 'Developer ON owned shell, real held-input D->P->N->D. No crossing reload. One muted Metal iPhone16Pro portrait browser.', driverHash:createHash('sha256').update(driveFloorGrid.toString()).digest('hex'),snapshots:[],routes:[],damage:[],errors:[],consoleErrors:[],documents:[],assetRequests:[] };
const save=()=>writeFileSync(out,JSON.stringify(report,null,2)+'\n');
const browser=await chromium.launch({args:['--mute-audio','--use-angle=metal','--ignore-gpu-blocklist']});let page;
try {
 const context=await browser.newContext({...devices['iPhone 16 Pro'],serviceWorkers:'block'});
 await saveFixture(context,{scope:'global',key:'settings',data:{tier:'phone',fps:'auto',tex:'auto'},merge:true});
 await saveFixture(context,{scope:'global',key:'gfx',data:{dpr:'2',aa:'auto'}});
 await saveFixture(context,{scope:'device',key:'devMode',data:true});
 await context.addInitScript(installResources);await context.addInitScript(GL_INIT);
 await context.addInitScript(()=>{window.__wildshardHarness={seed:357,capture:null,resources:()=>window.__parityResources()};});
 await context.route('**/api/errors',route=>route.fulfill({status:204,body:''}));
 page=await context.newPage();page.setDefaultTimeout(240000);
 page.on('pageerror',error=>{report.errors.push(String(error));save();});
 page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
 page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())report.documents.push(request.url());if(/\.(glb|gltf|ktx2)(?:[?#]|$)/u.test(request.url()))report.assetRequests.push(request.url());});
 const snapshot=async label=>{
  const row=await page.evaluate(()=>{const api=window.__wildshard,grid=api.shard.grid;return {state:grid.state(),residency:grid.residency(),gl:window.__sc_gl().map(({gl,...r})=>r),assets:api.world.game.app.assets.retained(),rootLevel:api.world.game.level.id,playerHP:api.world.game.app.player.attributes.health};});
  report.stage=label;report.snapshots.push({label,...row});save();console.log(label,row.state.playingMB,row.state.live.live.current);
 };
 const damage=async instance=>{
  const value=await page.evaluate(instance=>{const api=window.__wildshard,app=api.world.game.app;if(api.shard.grid.state().live.live.current!==instance)throw Error('Wrong damage frame');for(const target of [...app.combat.targets()].reverse()) {if(!target.hittable||!target.target.entityId||target.target.hp<=10)continue;if(instance==='pine-hollow'&&(target.target.kind!=='boar'||target.target.maxHp!==100))continue;if(instance==='nalati-grasslands'&&(target.target.kind!=='wolf'||target.target.maxHp>110))continue;const before=target.target.hp;const hit=app.combat.hit({source:app.player,sourceTags:['dmg.melee','cover.checked'],target:target.actor,amount:1,point:target.position,from:api.world.player.position,dir:target.position.clone().set(0,0,1)});if(hit?.dealt>0)return {instance,id:target.target.entityId,kind:target.target.kind,before,after:target.target.hp};}throw Error('No damageable regional creature');},instance);
  report.damage.push(value);save();return value;
 };
 await page.goto(`${base}?mute=1&nolock=1&sw=0`,{waitUntil:'commit'});await page.locator('.ws-main-grid').click();
 await page.waitForFunction(()=>Boolean(document.querySelector('#wserr .msg')?.textContent)||(!document.querySelector('.ws-load')&&Boolean(window.__wildshard?.shard?.grid?.state().live?.live)));
 const failure=await page.evaluate(()=>document.querySelector('#wserr .msg')?.textContent);if(failure)throw Error(failure);
 await page.evaluate(()=>window.__wildshard.world.hud.enterNow());await page.waitForFunction(()=>window.__wsReveal?.endedMs!=null);
 report.documentOrigin=await page.evaluate(()=>performance.timeOrigin);report.bootDocuments=report.documents.length;
 const state=await page.evaluate(()=>window.__wildshard.shard.grid.state()),plans=gridFloorPlans(state,'runtime-travel');
 const home=state.cells.find(c=>c.instance===state.home);if(!home)throw Error('Missing home');
 const h={x:home.cell[0]*555,z:home.cell[1]*555};
 plans.push({name:'driftwood-return',from:plans[1].to,to:home.instance,waypoints:[{x:h.x+277.5,z:h.z},{x:h.x+230,z:h.z}],requiredResidents:[home.instance],retiredResidents:[plans[1].to]});
 const invoke=(fn,plan)=>page.evaluate(`(${fn.toString()})(${JSON.stringify(plan)},${report.documentOrigin})`);
 await invoke(stageFloorGrid,plans[0]);await snapshot('home-first');
 if(report.snapshots[0].rootLevel!=='platform.grid')throw Error('Expected the owned neutral shell, not the borrowed page');
 report.homeDamage=await damage(home.instance);
 for(const plan of plans) {
  report.stage='route:'+plan.name;save();const route=await invoke(driveFloorGrid,plan);const failures=gridFloorWitnessFailures(route);report.routes.push({...route,failures});save();if(failures.length)throw Error(failures.join(';'));
  await page.waitForTimeout(2500);await snapshot(plan.to+'-entered');
  if(plan.to!==home.instance)await damage(plan.to);
 }
 report.homeRestoredHP=await page.evaluate(id=>window.__wildshard.world.game.app.combat.targets().find(target=>target.target.entityId===id)?.target.hp,report.homeDamage.id);
 if(report.homeRestoredHP!==report.homeDamage.after)throw Error('Home creature HP did not survive D->P->N->D');
 report.saved=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('wildshard.save.v2.')).map(([key,value])=>[key,JSON.parse(value)])));
 for(const value of report.damage){const saved=report.saved['wildshard.save.v2.'+value.instance]?.keys?.['platform.runtime-logical']?.data;if(!saved?.actors?.some(actor=>actor.id===value.id&&actor.hp===value.after))throw Error('Durable creature HP missing for '+value.instance);}
 await snapshot('home-returned-durable');await page.evaluate(()=>{window.__retainedLedger=window.__wildshard.shard.grid.residency;});report.leak=await page.evaluate(()=>window.__wildshard.leak());
 report.finalGL=await page.evaluate(()=>window.__sc_gl().map(({gl,...r})=>r));
 report.finalResidency=await page.evaluate(()=>window.__retainedLedger());
 const resources=report.finalGL.flatMap(row=>row.resources), claims=report.finalResidency.claims;
 const rawComposer=resources.filter(row=>row.asset.includes('EffectComposer')).reduce((sum,row)=>sum+row.bytes,0);
 const rawGL=resources.reduce((sum,row)=>sum+row.bytes,0), rawCaches=rawGL-rawComposer;
 const chargedComposer=claims.filter(row=>row.id==='page:composer').reduce((sum,row)=>sum+row.accountedBytes,0);
 const cachedGPU=claims.filter(row=>row.category==='commons'&&row.id.startsWith('commons:retained:')&&row.id.endsWith(':gpu')).reduce((sum,row)=>sum+row.accountedBytes,0);
 const cachedCPU=claims.filter(row=>row.category==='commons'&&row.id.startsWith('commons:retained:')&&row.id.endsWith(':cpu')).reduce((sum,row)=>sum+row.accountedBytes,0);
 report.reconciliation={rawGL,rawComposer,rawCaches,chargedComposer,cachedGPU,cachedCPU,uncoveredGPU:rawCaches-cachedGPU,engineBase:report.finalResidency.cost.input.engineBase,
   noRuntimeClaims:claims.every(row=>row.category!=='sim'),allCachesUncovered:claims.filter(row=>row.id.startsWith('commons:retained:')).every(row=>row.accountedBytes===row.bytes),
   composerMatches:rawComposer===chargedComposer,retainedGPUSafelyCharged:cachedGPU>=rawCaches};
 if(!report.reconciliation.noRuntimeClaims||!report.reconciliation.allCachesUncovered||!report.reconciliation.composerMatches||!report.reconciliation.retainedGPUSafelyCharged)throw Error('Retained GL residency reconciliation failed');
 report.pass=report.errors.length===0&&report.consoleErrors.length===0&&report.leak.disposalErrors.length===0&&report.leak.after.bodies===0&&report.leak.after.colliders===0&&Object.values(report.leak.scope).every(value=>value===0)&&report.routes.every(r=>r.failures.length===0)&&report.documents.length===report.bootDocuments;
 if(!report.pass)throw Error('Final errors/native/scope/document checks failed');
 await context.close();
} catch(error){report.pass=false;report.failure=String(error.stack??error);if(page&&!page.isClosed()){report.lastState=await page.evaluate(()=>window.__wildshard?.shard?.grid?.state()).catch(()=>null);report.failedLeak=await page.evaluate(()=>window.__wildshard?.leak()).catch(error=>String(error));}} finally {await browser.close();report.seconds=(Date.now()-started)/1000;save();console.log(JSON.stringify({pass:report.pass,failure:report.failure,seconds:report.seconds}));}
if(!report.pass)process.exitCode=1;
