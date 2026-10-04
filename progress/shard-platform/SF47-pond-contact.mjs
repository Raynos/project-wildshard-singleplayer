import { chromium, devices } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { installInit } from '../../scripts/parity/init.mjs';
import { debugSettings } from '../../scripts/debug-settings.mjs';
const ROOT=new URL('../..',import.meta.url).pathname.replace(/\/$/,'');
const [base,sha,out,tier='phone']=process.argv.slice(2);
if(!base||!sha||!out||(tier!=='phone'&&tier!=='desktop'))throw new Error('Usage: SF47-pond-contact.mjs <preview URL> <SHA> <output JSON> [phone|desktop]');
const leg=JSON.parse(readFileSync(`${ROOT}/scripts/physics-route.json`,'utf8'))['pine-hollow'].find(r=>r.name==='pond');
const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--ignore-gpu-blocklist','--mute-audio']});
try {
 const context=await browser.newContext({...devices['iPhone 16 Pro'],serviceWorkers:'block'});
 await installInit(context,{lane:'m5',sha,browser:browser.version(),capture:30,accelerated:true,tier});
 await debugSettings(context,{time:'midday',weather:'clear',memorySaver:'off'});
 const page=await context.newPage();
 await page.goto(`${base}?chunk=pine-hollow&tier=${tier}&touch=1&skipintro=1&nolock=1&mute=1&sw=0`);
 await page.waitForFunction(()=>Boolean(window.__wildshard)&&!document.querySelector('.ws-load'),undefined,{timeout:240000});
 const observed=await page.evaluate(()=>({tier:window.__wildshard.boot.tier,build:window.__wildshard.boot.build}));
 if(observed.tier!==tier)throw new Error(`Tier mismatch: ${observed.tier} != ${tier}`);
 if(!observed.build.startsWith(sha.slice(0,7)))throw new Error(`Build mismatch: ${observed.build} != ${sha}`);
 const report=await page.evaluate(async leg=>{
  const w=window.__wildshard.world, g=w.game, motor=w.player.motor, samples=[], seen=new Set();
  const originalMove=motor.move.bind(motor), originalWatch=g.watchFrames.bind(g);
  motor.move=(feet,want,...rest)=>{
   const before={x:feet.x,y:feet.y,z:feet.z}, result=originalMove(feet,want,...rest);
   if(result.horizontalFreedom<0.25&&before.x>-12&&before.x<-4&&before.z>-40&&before.z<-28) {
    for(let i=0;i<motor.kcc.numComputedCollisions();i++){
     const hit=motor.kcc.computedCollision(i);if(!hit)continue;
     const c=hit.collider,key=c.handle;if(seen.has(key))continue;seen.add(key);
     const position=c.translation(),rotation=c.rotation(), owners=[];
     for(const piece of w.registry.pieceList())for(const d of piece.colliders??[]){
      if(d.kind!=='box')continue;
      let centre={x:d.x,y:d.y,z:d.z};
      if(piece.follows){
       const v=piece.follows.position.clone().set(d.x,d.y,d.z);
       centre=piece.followRotation===false?v.add(piece.follows.getWorldPosition(v.clone().set(0,0,0))):piece.follows.localToWorld(v);
      }
      if(Math.hypot(centre.x-position.x,centre.y-position.y,centre.z-position.z)<0.002)owners.push({id:piece.id,descriptor:d,follows:piece.follows!==undefined});
     }
     samples.push({feet:before,want:{x:want.x,y:want.y,z:want.z},freedom:result.horizontalFreedom,handle:key,position,rotation,normal:hit.normal1,owners});
    }
   }
   return result;
  };
  g.watchFrames=fn=>{const stop=originalWatch(fn);window.__parity.free=true;return stop;};
  try {const walked=await window.__wildshard.walkLeg({...leg,waypoints:leg.waypoints.slice(0,2)});return {walked,samples};}
  finally{motor.move=originalMove;g.watchFrames=originalWatch;window.__parity.free=false;}
 },leg);
 const errors=await page.evaluate(()=>window.__wildshard.fingerprint().errors);
 writeFileSync(out,JSON.stringify({sha,...observed,method:'Observation-only wrapper around the real CharacterMotor; first two authored pond waypoints, unmodified controller and colliders; ordinary parity clock.',errors,...report},null,2)+'\n');
 console.log(JSON.stringify({stuck:report.walked.stuck,contacts:report.samples}));
 await context.close();
} finally {await browser.close();}
