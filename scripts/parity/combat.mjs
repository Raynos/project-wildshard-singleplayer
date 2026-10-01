import { equal, flatten, object } from './value.mjs';
import { touch, TOUCH } from './walk.mjs';

/** @typedef {{step:string,weapon:string,target:string,near:{x:number,z:number},distance:number,hit:number,kill:number|null}} Step */
/** @type {Record<string,Step[]>} */
export const STEPS={
  'driftwood-isle':[{step:'swing',weapon:'sword',target:'crab',near:{x:-7,z:-143},distance:1.8,hit:3,kill:15}],
  'pine-hollow':[{step:'shot',weapon:'crossbow',target:'boar',near:{x:0,z:-200},distance:12,hit:20,kill:20},{step:'shot2',weapon:'bow',target:'boar',near:{x:0,z:-200},distance:12,hit:20,kill:20}],
  'nalati-grasslands':[{step:'swing',weapon:'sabre',target:'wolf',near:{x:0,z:232},distance:1.8,hit:3,kill:15},{step:'shot',weapon:'bow',target:'wolf',near:{x:0,z:232},distance:12,hit:20,kill:20}],
  'nine-dragon-stack':[{step:'swing',weapon:'sword',target:'training-dummy',near:{x:0,z:0},distance:1.8,hit:3,kill:null}],
};
/** @param {import('playwright').Page} page @param {{shard:string,tier:string,lane:string}} opts */
export async function combat(page,opts) {
  if(opts.shard==='nine-dragon-stack')await page.evaluate(()=>window.__wildshard.arena());
  await page.evaluate(()=>window.__wildshard.sounds());
  /** @type {import('./value.mjs').RecordValue} */const result={swing:'n/a',shot:'n/a',shot2:'n/a',hitsToKill:{},kills:[],loot:{written:[]}};
  /** @type {string[]} */ const written=[];
  for(const step of STEPS[opts.shard] ?? []) {
    const limits=await page.evaluate((s)=> {
      const probe=window.__wildshard,p=probe.world.player;probe.combat.equip(s.weapon);
      const target=probe.combat.target(s.target,s.near),at=target.position;
      let dx=p.position.x-at.x,dz=p.position.z-at.z;const len=Math.hypot(dx,dz);if(len<0.01){dx=0;dz=1;}else{dx/=len;dz/=len;}
      p.spawn(at.x+dx*s.distance,at.z+dz*s.distance,Math.atan2(dx,dz));
      const mesh='mesh' in target ? target.mesh : null;let cy=at.y+1;
      if(mesh){if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();const b=mesh.geometry.boundingSphere;if(b)cy=b.center.clone().applyMatrix4(mesh.matrixWorld).y;}
      const head=p.position.y+1.68;p.pitch=Math.atan2(cy-head,s.distance);p.velocity.set(0,0,0);p.keys.clear();
      return {hits:probe.combat.hits.length,kills:probe.combat.kills.length,saves:probe.saves.written.length,clock:probe.state().clockNow,capture:window.__wildshardHarness?.capture!==null && window.__wildshardHarness?.capture!==undefined};
    },step);
    const multiplier=opts.lane==='gh-macos15' && !limits.capture ? 2 : 1,hitLimit=step.hit*multiplier,killLimit=step.kill===null?null:step.kill*multiplier;
    let hits=0,killed=false,hitWithinS=Number.POSITIVE_INFINITY,killWithinS=Number.POSITIVE_INFINITY;
    const wall=Date.now(),deadline=Math.max(hitLimit,killLimit??0);
    while((Date.now()-wall)/1000 < deadline*(limits.capture?10:1)) {
      if(opts.tier==='phone')await touch(page,TOUCH.attack,{hold:100});
      else {const v=page.viewportSize();await page.mouse.move((v?.width??1600)/2,(v?.height??900)/2);await page.mouse.down();await page.waitForTimeout(100);await page.mouse.up();}
      await page.waitForTimeout(500);
      const state=await page.evaluate((b)=>{const p=window.__wildshard;return {hits:p.combat.hits.length-b.hits,killed:p.combat.kills.length>b.kills,clock:p.state().clockNow-b.clock};},limits);
      const elapsed=limits.capture?state.clock:(Date.now()-wall)/1000;
      hits=state.hits;killed=state.killed;if(hits>0 && !Number.isFinite(hitWithinS))hitWithinS=elapsed;if(killed)killWithinS=elapsed;
      if(killed || (step.kill===null && hits>0) || elapsed>=deadline)break;
    }
    result[step.step]={weapon:step.weapon,target:step.target,hits,hitWithinS:Number.isFinite(hitWithinS)?hitWithinS:null,killed,killWithinS:Number.isFinite(killWithinS)?killWithinS:null,hitLimit,killLimit};
    object(result.hitsToKill)[step.step]=hits;
    if(killed){await page.waitForTimeout(2000);written.push(...await page.evaluate((n)=>window.__wildshard.saves.written.slice(n),limits.saves));}
  }
  result.kills=await page.evaluate(()=>[...window.__wildshard.combat.kills]);result.loot={written:[...new Set(written)].sort()};result.sounds=object(await page.evaluate(()=>window.__wildshard.sounds()));
  return result;
}
/** @param {import('playwright').Page} page @param {string} tier */
export async function pauseResume(page,tier) {
  const returnState=await page.evaluate(()=>window.__wildshard.state().appState);
  await (tier==='phone'?touch(page,TOUCH.pause):page.keyboard.press('Escape'));
  await page.locator('#menu').waitFor({state:'visible'});
  const before=await page.evaluate(()=>window.__wildshard.state());await page.waitForTimeout(2000);
  // Arm before input, but never await the callback before clicking RESUME.
  await page.evaluate(()=>{const w=/** @type {Window & {__parityResumed?:unknown}} */ (window);w.__parityResumed=null;window.__wildshard.onResume(()=>{w.__parityResumed=window.__wildshard.state();});});
  await (tier==='phone'?touch(page,'.ws-gmenu-close'):page.locator('.ws-gmenu-close').click());
  await page.waitForFunction(()=>Boolean(/** @type {Window & {__parityResumed?:unknown}} */ (window).__parityResumed));
  const after=await page.evaluate(()=>/** @type {Window & {__parityResumed?:unknown}} */ (window).__parityResumed);
  const a=flatten(before),b=flatten(after),diff=[...new Set([...Object.keys(a),...Object.keys(b)])].filter((p)=>p!=='appState' && !equal(a[p],b[p]));
  return {before,after,diff,appStates:[before.appState,object(after).appState],returnState};
}
