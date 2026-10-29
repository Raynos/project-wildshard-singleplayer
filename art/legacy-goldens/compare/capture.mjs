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
// The eye is the game's own camera (NR10 / NR12, sp-o5): a late hook sets it on every frame, so what the game culls and
// streams in its update (instanced dressing, the tile ring, coarse masks) follows the eye. A free camera (its eye more than
// FREE m from the probe's) poses the player under the eye, hovering, so the ring and colliders stand round the camera as
// they would round a player there (its board, on the camera and under it, is hidden for the shot); an eye-height camera
// keeps its probe. LIVE frames run at the eye before the shot.
import {chromium,webkit,devices} from 'playwright';
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
const exp=arg('exp','')?readFileSync(arg('exp',''),'utf8'):'';// --exp=<file.js>: diagnostics only, run in the page before the held shot (its return value lands in the receipt)
const only=arg('cams','')?new Set(arg('cams','').split(',').map(Number)):null;
const slugs=arg('shards',Object.keys(canonical).join(',')).split(',');
const FRAMES=120,SETTLE_MS=30000,LIVE=60,FREE=4,EYE=1.7;
mkdirSync(root,{recursive:true});

// --engine=webkit: Playwright's WebKit (muted by the game's volume 0; its Escape is a plain key press)
const engine=arg('engine','chromium');if(!['chromium','webkit'].includes(engine))throw Error(`--engine=${engine}`);
const owner=engine==='webkit'?null:await chromium.launchServer({headless:true,args:['--mute-audio','--use-angle=metal','--ignore-gpu-blocklist','--remote-debugging-port=0']});
const directory=owner?.process().spawnargs.find(x=>x.startsWith('--user-data-dir=')).slice('--user-data-dir='.length);
const [port,path]=owner?(await readFile(`${directory}/DevToolsActivePort`,'utf8')).trim().split('\n'):[];
const endpoint=owner?`ws://127.0.0.1:${port}${path}`:'';
const browser=owner?await chromium.connectOverCDP(endpoint):await webkit.launch({headless:true}),rows=[];

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
 const row={slug,head,engine,device:'iPhone 16 Pro',tier:'phone',dpr:2,seed:357,errors:[],warnings:{},poses:[]};
 const context=await browser.newContext({...devices['iPhone 16 Pro']});let page;
 try{
  await developerSettings(context,{tier:'phone',volume:0,time:'midday',weather:'clear'});
  await saveFixture(context,{scope:'global',key:'gfx',data:{dpr:'2',aa:'auto'}});
  await saveFixture(context,{scope:'device',key:'debug.global.legacyShardButtons',data:'on'});
  await saveFixture(context,{scope:'device',key:'debug.global.holdLoading',data:'off'});
  await context.addInitScript(hideDeveloperOverlays);
  await context.addInitScript(()=>{window.__wildshardHarness={seed:357,capture:null};});
  page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>row.errors.push(e.message));
  // console warnings, each text once with its count (NR4: AttributeNode missing-channel warnings)
  page.on('console',m=>{if(m.type()!=='warning')return;const t=m.text().slice(0,300);row.warnings[t]=(row.warnings[t]??0)+1;});
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
  if(await page.evaluate(()=>window.__wildshard.world.hud.paused))await(owner?pressEscape(endpoint,page.url()):page.keyboard.press('Escape'));
  row.entry=await page.evaluate(()=>({url:location.href,id:window.__wildshard.world.game.level.id}));
  const want=mode==='legacy'?`${slug}-legacy`:slug;if(row.entry.id!==want)throw Error(`Not ${mode}: ${row.entry.id}`);row.mode=mode;
  // the golden camera is a spectator: its player takes no damage (Pine's bear-den elite killed it, and the death fade put it
  // back at spawn with the ring and the grass field)
  await page.evaluate(()=>{const hp=window.__wildshard.world.game.app.player;if(hp)hp.attributes.incomingCap=0;});
  for(let i=0;i<canonical[slug].length;i++){
   const c=canonical[slug][i];if(only&&!only.has(c.n??i+1))continue;
   const probe=c.probe??{x:c.feet?.[0]??c.eye[0],z:c.feet?.[2]??c.eye[2],yaw:-c.yaw*Math.PI/180,pitch:c.pitch*Math.PI/180,...c.feet?{y:c.feet[1]}:{}};
   if(c.spawnFallback)delete probe.y;
   // a free camera: the player hovers under the eye (its x / z, an eye height below), so ring and culling are the eye's
   const free=c.eye!==undefined&&Math.hypot(c.eye[0]-probe.x,c.eye[2]-probe.z,probe.y===undefined?0:c.eye[1]-EYE-probe.y)>FREE;
   const at=free?{...probe,x:c.eye[0],y:c.eye[1]-EYE,z:c.eye[2]}:probe;
   await page.evaluate(([p,free])=>{const w=window.__wildshard.world;w.game.hold=false;window.__wsEye=null;w.player.setHover?.(false);
    // what hangs off the camera before any hover (the held weapon, the hands): the shot keeps only these visible. Taken
    // once per entry: a board stepped off a moment ago still shows while it fades
    window.__wsCamOff??=new Set(w.game.camera.children.filter(o=>o.visible));
    return window.__wildshard.pose(p).then(()=>{if(free)w.player.setHover?.(true);});},[at,free]);
   await frames(page,FRAMES);const idle=await settle(page,inflight);await frames(page,30);
   // a player on a slope slides off its pose while streaming settles (Pine's bear den slid into the lake and respawned at
   // spawn, so its eye became spawn's): an eye-height camera puts it back before its eye is read
   const drifted=!free&&await page.evaluate(p=>{const q=window.__wildshard.world.player.position;return Math.hypot(q.x-p.x,q.z-p.z)>2;},at);
   if(drifted){await page.evaluate(p=>window.__wildshard.pose(p),at);await frames(page,30);}
   // the eye becomes the game camera: set in the late phase of every frame, so the next update culls and streams for it
   await page.evaluate(c=>{const w=window.__wildshard.world,g=w.game,cam=g.camera,settled=cam.position.toArray();
    window.__wsEye={eye:c.eye??[settled[0],settled[1]+(c.lift??0),settled[2]],pitch:c.pitch*Math.PI/180,yaw:-c.yaw*Math.PI/180,fov:c.fov,settled};
    if(window.__wsEyeHook!==g){window.__wsEyeHook=g;g.onLate(()=>{const e=window.__wsEye;if(e===null||e===undefined)return;
     cam.position.set(...e.eye);cam.rotation.set(e.pitch,e.yaw,0,'YXZ');cam.fov=e.fov;cam.updateProjectionMatrix();cam.updateMatrixWorld();},'golden.eye');}},c);
   // the eye is read: a sliding player now hovers where it stands, so it cannot slide off (and respawn) during the live frames
   if(drifted)await page.evaluate(()=>window.__wildshard.world.player.setHover?.(true));
   await frames(page,LIVE);const live=await settle(page,inflight);await frames(page,LIVE);
   const expResult=exp?await page.evaluate(code=>(new Function('w','g','return (async()=>{'+code+'})()'))(window.__wildshard.world,window.__wildshard.world.game),exp):undefined;
   const observed=await page.evaluate(()=>{
    const w=window.__wildshard.world,g=w.game,e=window.__wsEye;g.hold=true;
    const player=w.player.position.toArray(),cam=g.camera;
    // a free camera's hovering player is not in the golden: what the board brought onto the camera (its first-person
    // deck) and the board model stay out of the shot, and are shown again after it
    const off=window.__wsCamOff??new Set();window.__wsBoards=[];
    for(const o of cam.children)if(o.visible&&!off.has(o)){o.visible=false;window.__wsBoards.push(o);}
    g.scene.traverse(o=>{if(o.name==='hoverboard'&&o.visible){o.visible=false;window.__wsBoards.push(o);}});
    cam.position.set(...e.eye);cam.rotation.set(e.pitch,e.yaw,0,'YXZ');cam.fov=e.fov;cam.updateProjectionMatrix();cam.updateMatrixWorld();// QF20: two frames at the held camera; one left SHARDFILE's shadow-layer casters (the body shadow) out
    g.shardFrame();g.composer.render(0);g.shardFrame();g.composer.render(0);
    return{eye:cam.position.toArray(),rotation:cam.rotation.toArray(),fov:cam.fov,frame:g.frameCount,player,settledEye:e.settled};
   });
   const shot=set?`${dir}/${String(c.n).padStart(2,'0')}-${c.name}-${mode}.png`:`${dir}/${i+1}-${c.name}-shardfile.png`;
   // the 24-camera set hides the HUD (every element but the canvases; a canvas read-back misses Nine's layered composite)
   // and the minimap: a canvas smaller than half the viewport stays hidden
   if(set){await page.evaluate(()=>{for(const el of document.querySelectorAll('canvas')){const r=el.getBoundingClientRect();el.dataset.wsShot=r.width*r.height>=innerWidth*innerHeight/2?'1':'0';}});
    const hide=await page.addStyleTag({content:'body *{visibility:hidden!important}canvas[data-ws-shot="1"]{visibility:visible!important}'});
    await page.screenshot({path:shot,type:'png',scale:'device'});await hide.evaluate(e=>e.remove());}
   else await page.screenshot({path:shot,type:'png',scale:'css'});
   await page.evaluate(()=>{for(const o of window.__wsBoards??[])o.visible=true;window.__wsBoards=[];});
   row.poses.push({n:c.n??i+1,name:c.name,free,drifted,idle,live,...observed,...(exp?{exp:expResult}:{}),shot});
   writeFileSync(`${root}/receipts-${slug}.json`,JSON.stringify(row,null,1));
  }
  row.status=row.errors.length===0?'complete':'errors';
 }catch(error){row.status='failed';row.failure=String(error);if(page)await page.screenshot({path:`${dir}/failure.jpg`,type:'jpeg',quality:80,scale:'css'}).catch(()=>{});}
 finally{rows.push(row);writeFileSync(`${root}/receipts.json`,JSON.stringify(rows,null,2));await context.close();
  console.log(JSON.stringify({slug,status:row.status,poses:row.poses.length,idle:row.poses.map(p=>p.idle.settled),failure:row.failure,errors:row.errors.slice(0,3),warnings:Object.values(row.warnings).reduce((n,c)=>n+c,0)}));}
 if(row.status==='failed')process.exitCode=1;
}}finally{try{await browser.close();}finally{await owner?.close();}}
