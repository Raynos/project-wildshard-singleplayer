// Shardfile vs Legacy Golden (G859): capture the 24 SHARDFILE frames at the goldens' cameras.
// Same entry and settings as art/legacy-goldens/ (G843): muted Chromium, iPhone 16 Pro portrait, phone tier, 2x,
// seed 357, saved midday / clear, fresh context per shard through SHARD SELECT. Cameras come from the CO6 cameras.json
// the goldens README points to. Run it through scripts/browser-lane.sh on a serve-build.sh --head preview (README.md).
//
//   node art/legacy-goldens/compare/capture.mjs --base=http://127.0.0.1:44xx/ --out=tmp/golden-compare/raw [--shards=a,b]
//     [--cameras=art/legacy-goldens/compare/cameras24.json] [--mode=legacy|shardfile] [--cams=1,5,9]
// --cameras: the 24-camera set (G859); its frames hide every element but the canvases (no HUD), at device pixels, named <nn>-<camera>-<mode>.png. A camera
// without an eye takes the player's settled eye plus its lift; receipts-<slug>.json records it, and the LEGACY run's
// eyes are written back into the set (compare.py eyes) so SHARDFILE renders the same camera.
// --mode=legacy enters through the LEGACY button (Debug > Legacy shard buttons) and expects `<slug>-legacy`.
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
const set=arg('cameras','');const mode=arg('mode','shardfile');if(!['legacy','shardfile'].includes(mode))throw Error(`--mode=${mode}`);
const canonical=set?JSON.parse(readFileSync(set,'utf8')).cameras:JSON.parse(readFileSync('art/legacy-vs-shardfile/round-1-2026-10-28/cameras.json','utf8')).pairedCameras;
const only=arg('cams','')?new Set(arg('cams','').split(',').map(Number)):null;
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
  const dual=page.locator('.ws-menu-shardfile');
  if(mode==='legacy'&&!await dual.isVisible())throw Error('No LEGACY button (Legacy shard buttons row off or legacy deleted)');
  const button=mode==='legacy'?page.locator('.ws-menu-play'):await dual.isVisible()?dual:page.locator('.ws-menu-play');
  if(await button.isDisabled())throw Error(`${mode} entry disabled`);await button.click();
  await page.waitForFunction(()=>!!window.__wildshard?.world?.hud?.entered&&!document.querySelector('.ws-load')&&window.__wildshard.world.game.frameGate(),undefined,{timeout:180000});
  if(await page.evaluate(()=>window.__wildshard.world.hud.paused))await pressEscape(endpoint,page.url());
  row.entry=await page.evaluate(()=>({url:location.href,id:window.__wildshard.world.game.level.id}));
  const want=mode==='legacy'?`${slug}-legacy`:slug;if(row.entry.id!==want)throw Error(`Not ${mode}: ${row.entry.id}`);row.mode=mode;
  for(let i=0;i<canonical[slug].length;i++){
   const c=canonical[slug][i];if(only&&!only.has(c.n??i+1))continue;
   const probe=c.probe??{x:c.feet?.[0]??c.eye[0],z:c.feet?.[2]??c.eye[2],yaw:-c.yaw*Math.PI/180,pitch:c.pitch*Math.PI/180,...c.feet?{y:c.feet[1]}:{}};
   if(c.spawnFallback)delete probe.y;
   await page.evaluate(p=>{window.__wildshard.world.game.hold=false;return window.__wildshard.pose(p);},probe);
   await frames(page,FRAMES);const idle=await settle(page,inflight);await frames(page,30);
   const observed=await page.evaluate(c=>{
    const w=window.__wildshard.world,g=w.game;g.hold=true;
    const player=w.player.position.toArray(),settled=g.camera.position.toArray();
    const eye=c.eye??[settled[0],settled[1]+(c.lift??0),settled[2]];g.camera.position.set(...eye);
    g.camera.rotation.set(c.pitch*Math.PI/180,-c.yaw*Math.PI/180,0,'YXZ');g.camera.fov=c.fov;g.camera.updateProjectionMatrix();g.camera.updateMatrixWorld();g.shardFrame();g.composer.render(0);
    return{eye:g.camera.position.toArray(),rotation:g.camera.rotation.toArray(),fov:g.camera.fov,frame:g.frameCount,player,settledEye:settled};
   },c);
   const shot=set?`${dir}/${String(c.n).padStart(2,'0')}-${c.name}-${mode}.png`:`${dir}/${i+1}-${c.name}-shardfile.png`;
   // the 24-camera set hides the HUD (every element but the canvases; a canvas read-back misses Nine's layered composite)
   // and the minimap: a canvas smaller than half the viewport stays hidden
   if(set){await page.evaluate(()=>{for(const el of document.querySelectorAll('canvas')){const r=el.getBoundingClientRect();el.dataset.wsShot=r.width*r.height>=innerWidth*innerHeight/2?'1':'0';}});
    const hide=await page.addStyleTag({content:'body *{visibility:hidden!important}canvas[data-ws-shot="1"]{visibility:visible!important}'});
    await page.screenshot({path:shot,type:'png',scale:'device'});await hide.evaluate(e=>e.remove());}
   else await page.screenshot({path:shot,type:'png',scale:'css'});
   row.poses.push({n:c.n??i+1,name:c.name,idle,...observed,shot});
   writeFileSync(`${root}/receipts-${slug}.json`,JSON.stringify(row,null,1));
  }
  row.status=row.errors.length===0?'complete':'errors';
 }catch(error){row.status='failed';row.failure=String(error);if(page)await page.screenshot({path:`${dir}/failure.jpg`,type:'jpeg',quality:80,scale:'css'}).catch(()=>{});}
 finally{rows.push(row);writeFileSync(`${root}/receipts.json`,JSON.stringify(rows,null,2));await context.close();
  console.log(JSON.stringify({slug,status:row.status,poses:row.poses.length,idle:row.poses.map(p=>p.idle.settled),failure:row.failure,errors:row.errors.slice(0,3)}));}
 if(row.status==='failed')process.exitCode=1;
}}finally{try{await browser.close();}finally{await owner.close();}}
