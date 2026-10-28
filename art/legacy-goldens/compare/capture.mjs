// Shardfile vs Legacy Golden (G859): capture the 24 SHARDFILE frames at the goldens' cameras.
// Same entry and settings as art/legacy-goldens/ (G843): muted Chromium, iPhone 16 Pro portrait, phone tier, 2x,
// seed 357, saved midday / clear, fresh context per shard through SHARD SELECT. Cameras come from the CO6 cameras.json
// the goldens README points to. Run it through scripts/browser-lane.sh on a serve-build.sh --head preview (README.md).
//
//   node art/legacy-goldens/compare/capture.mjs --base=http://127.0.0.1:44xx/ --out=tmp/golden-compare/raw [--shards=a,b]
import {chromium,devices} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {saveFixture,developerSettings,hideDeveloperOverlays} from '../../../scripts/debug-settings.mjs';
import {loadingCardIndex} from '../../../scripts/loading-benchmark/catalogue.mjs';
import {pressEscape} from '../../../scripts/parity/browser-escape.mjs';

const arg=(k,d)=>process.argv.find(x=>x.startsWith(`--${k}=`))?.slice(k.length+3)??d;
const base=arg('base',''),root=arg('out','tmp/golden-compare/raw');
if(!base)throw Error('--base=<preview url> is required');
const head=arg('sha',execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());
const canonical=JSON.parse(readFileSync('art/legacy-vs-shardfile/round-1-2026-10-28/cameras.json','utf8')).pairedCameras;
const slugs=arg('shards',Object.keys(canonical).join(',')).split(',');
const FRAMES=120,SETTLE_MS=30000;
mkdirSync(root,{recursive:true});

const owner=await chromium.launchServer({headless:true,args:['--mute-audio','--use-angle=metal','--ignore-gpu-blocklist','--remote-debugging-port=0']});
const directory=owner.process().spawnargs.find(x=>x.startsWith('--user-data-dir=')).slice('--user-data-dir='.length);
const [port,path]=(await readFile(`${directory}/DevToolsActivePort`,'utf8')).trim().split('\n');
const endpoint=`ws://127.0.0.1:${port}${path}`;
const browser=await chromium.connectOverCDP(endpoint),rows=[];

const frames=(page,n)=>page.evaluate(async n=>{const g=window.__wildshard.world.game,from=g.frameCount;
 await new Promise(r=>{const f=()=>g.frameCount>=from+n?r():requestAnimationFrame(f);requestAnimationFrame(f);});},n);

// Streaming idle: no request in flight for 1.5 s and, when a grid is present, no ring tile in flight or queued.
// A request open for more than 15 s is a long-lived one (it stays open across every pose), not streaming.
async function settle(page,inflight){
 const t0=Date.now();let quietSince=0;
 while(Date.now()-t0<SETTLE_MS){
  for(const [r,at]of inflight)if(Date.now()-at>15000)inflight.delete(r);
  const grid=await page.evaluate(()=>{const s=window.__wildshard?.shard?.grid?.state?.();return s?{inFlight:s.rings?.inFlight??0,queued:s.rings?.queued??0}:null;}).catch(()=>null);
  const quiet=inflight.size===0&&(!grid||(grid.inFlight===0&&grid.queued===0));
  if(quiet){quietSince||=Date.now();if(Date.now()-quietSince>=1500)return{settled:true,ms:Date.now()-t0};}else quietSince=0;
  await frames(page,10);
 }
 return{settled:false,ms:Date.now()-t0,inflight:[...inflight.keys()].slice(0,5).map(r=>r.url())};
}

try{for(const slug of slugs){
 const dir=`${root}/${slug}`;mkdirSync(dir,{recursive:true});
 const row={slug,head,device:'iPhone 16 Pro',tier:'phone',dpr:2,seed:357,errors:[],poses:[]};
 const context=await browser.newContext({...devices['iPhone 16 Pro']});let page;
 try{
  await developerSettings(context,{tier:'phone',volume:0,time:'midday',weather:'clear'});
  await saveFixture(context,{scope:'global',key:'gfx',data:{dpr:'2',aa:'auto'}});
  await saveFixture(context,{scope:'device',key:'debug.global.legacyShardButtons',data:'on'});
  await saveFixture(context,{scope:'device',key:'debug.global.holdLoading',data:'off'});
  await context.addInitScript(hideDeveloperOverlays);
  await context.addInitScript(()=>{window.__wildshardHarness={seed:357,capture:null};});
  page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>row.errors.push(e.message));
  const inflight=new Map();page.on('request',r=>inflight.set(r,Date.now()));page.on('requestfinished',r=>inflight.delete(r));page.on('requestfailed',r=>inflight.delete(r));
  const version=await(await page.request.get(new URL('/version.json',base).href)).json();
  if(!version.build.startsWith(head.slice(0,7)))throw Error(`Preview ${version.build} is not ${head.slice(0,10)}`);row.build=version.build;
  await page.goto(base,{waitUntil:'load'});await page.locator('.ws-main-select').click();
  const names=await page.locator('.ws-menu-card b').allTextContents();
  await page.locator(`.ws-menu-dots i[data-i="${loadingCardIndex(names,slug)}"]`).click();
  // SHARDFILE button while the legacy buttons exist; ENTER WORLD (the shardfile, G531) once they are gone
  const dual=page.locator('.ws-menu-shardfile');const button=await dual.isVisible()?dual:page.locator('.ws-menu-play');
  if(await button.isDisabled())throw Error('SHARDFILE entry disabled');await button.click();
  await page.waitForFunction(()=>!!window.__wildshard?.world?.hud?.entered&&!document.querySelector('.ws-load')&&window.__wildshard.world.game.frameGate(),undefined,{timeout:180000});
  if(await page.evaluate(()=>window.__wildshard.world.hud.paused))await pressEscape(endpoint,page.url());
  row.entry=await page.evaluate(()=>({url:location.href,id:window.__wildshard.world.game.level.id}));
  if(row.entry.id!==slug)throw Error(`Not SHARDFILE: ${row.entry.id}`);
  for(let i=0;i<canonical[slug].length;i++){
   const c=canonical[slug][i];
   const probe=c.probe??{x:c.feet?.[0]??c.eye[0],z:c.feet?.[2]??c.eye[2],yaw:-c.yaw*Math.PI/180,pitch:c.pitch*Math.PI/180,...c.feet?{y:c.feet[1]}:{}};
   if(c.spawnFallback)delete probe.y;
   await page.evaluate(p=>{window.__wildshard.world.game.hold=false;return window.__wildshard.pose(p);},probe);
   await frames(page,FRAMES);const idle=await settle(page,inflight);await frames(page,30);
   const observed=await page.evaluate(c=>{
    const w=window.__wildshard.world,g=w.game;g.hold=true;g.camera.position.set(...c.eye);
    g.camera.rotation.set(c.pitch*Math.PI/180,-c.yaw*Math.PI/180,0,'YXZ');g.camera.fov=c.fov;g.camera.updateProjectionMatrix();g.camera.updateMatrixWorld();g.shardFrame();g.composer.render(0);
    return{eye:g.camera.position.toArray(),rotation:g.camera.rotation.toArray(),fov:g.camera.fov,frame:g.frameCount};
   },c);
   const shot=`${dir}/${i+1}-${c.name}-shardfile.png`;await page.screenshot({path:shot,type:'png',scale:'css'});
   row.poses.push({name:c.name,idle,...observed,shot});
  }
  row.status=row.errors.length===0?'complete':'errors';
 }catch(error){row.status='failed';row.failure=String(error);if(page)await page.screenshot({path:`${dir}/failure.jpg`,type:'jpeg',quality:80,scale:'css'}).catch(()=>{});}
 finally{rows.push(row);writeFileSync(`${root}/receipts.json`,JSON.stringify(rows,null,2));await context.close();
  console.log(JSON.stringify({slug,status:row.status,poses:row.poses.length,idle:row.poses.map(p=>p.idle.settled),failure:row.failure,errors:row.errors.slice(0,3)}));}
 if(row.status==='failed')process.exitCode=1;
}}finally{try{await browser.close();}finally{await owner.close();}}
