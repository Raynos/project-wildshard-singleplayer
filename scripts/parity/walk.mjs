import { join } from 'node:path';
import { readJson } from './serve.mjs';
import { array, object } from './value.mjs';
import { within } from './timeout.mjs';

export const TOUCH={move:'.ws-touch-zone.move',look:'.ws-touch-zone.look',dodge:'.ws-touch-disc.dodge',use:'.ws-touch-use',pause:'.ws-touch-pause',attack:'.ws-touch-attack'};
/** Dispatch actual touch pointers through the controls' existing handlers.
 * @param {import('playwright').Page} page @param {string} selector @param {{dx?:number,dy?:number,hold?:number}} [opts] */
export async function touch(page,selector,opts={}) {
  const bounds=await page.locator(selector).boundingBox();if(!bounds)throw new Error(`touch control absent: ${selector}`);
  const start={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2},end={x:start.x+(opts.dx??0),y:start.y+(opts.dy??0)};
  const session=await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:7}]});
    if(opts.dx || opts.dy)for(let i=1;i<=6;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*i/6,y:start.y+(end.y-start.y)*i/6,id:7}]});await page.waitForTimeout(16);}
    if(opts.hold)await page.waitForTimeout(opts.hold);
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  } finally {await session.detach();}
}
/** @param {import('playwright').Page} page */
export async function touchLeg(page) {
  await page.evaluate(()=>window.__wildshard.pose(window.__wildshard.world.chunk.spawn));
  const before=await page.evaluate(()=>window.__wildshard.state().player);
  await touch(page,TOUCH.move,{dy:-80,hold:2000});
  const moved=await page.evaluate((b)=>{const p=window.__wildshard.world.player.position;return Math.hypot(p.x-b.pos.x,p.z-b.pos.z);},before);
  await touch(page,TOUCH.look,{dx:120});
  const yawDelta=await page.evaluate((yaw)=>window.__wildshard.world.player.yaw-yaw,before.yaw);
  await touch(page,TOUCH.dodge);
  const dodged=await page.evaluate(()=>window.__wildshard.world.player.dodgeCooldown>0);
  // The runtime handle exposes the prompt list today; F8's app keeps this through the probe.
  const nearest=await page.evaluate(()=> {
    const w=window.__wildshard.world;
    const list=/** @type {readonly {label:string,position:{x:number,y:number,z:number}}[]} */ (w.interactables);
    const spawn=w.chunk.spawn;
    const sorted=[...list].sort((a,b)=>Math.hypot(a.position.x-spawn.x,a.position.z-spawn.z)-Math.hypot(b.position.x-spawn.x,b.position.z-spawn.z));
    return sorted.length>0?sorted[0]:null;
  });
  let used=/** @type {boolean|'n/a'} */ ('n/a');
  if(nearest){await page.evaluate((at)=>window.__wildshard.pose({x:at.x,z:at.z+1,y:at.y,yaw:0}),nearest.position);await page.waitForTimeout(200);await page.evaluate(()=>window.__wildshard.used());await touch(page,TOUCH.use);used=await page.evaluate((label)=>window.__wildshard.used().includes(label),nearest.label);}
  return {moved,yawDelta,dodged,used};
}
/** @param {import('playwright').Page} page @param {{shard:string,tier:string,full:boolean,root:string}} opts */
export async function walk(page,opts) {
  await page.evaluate(()=>window.__wildshard.sounds());
  const routes=object(readJson(join(opts.root,'scripts/physics-route.json'))), legs=[];
  for(const v of array(routes[opts.shard])) {
    if(!opts.full && object(v).gate!==true)continue;
    const raw=/** @type {unknown} */ (v);
    const route=/** @type {import('../types/wildshard-probe.d.ts').WalkLeg} */ (raw);
    console.error(`parity: ${opts.shard}.${opts.tier} walk ${route.name}`);
    legs.push(await within(page.evaluate((leg)=>window.__wildshard.walkLeg(leg),route),240000,`walk ${route.name}`));
  }
  if(opts.full) {
    const trails=await page.evaluate(()=> {
      const w=/** @type {Window & {__hf?:{TRAILS:{x:number,z:number}[][]}}} */ (window);
      return w.__hf?.TRAILS.slice(4) ?? [];
    });
    for(const [i,path] of trails.entries())for(const reverse of [false,true]) {
      const waypoints=[];const pts=reverse?[...path].reverse():path;
      for(let n=1;n<pts.length;n++){const a=pts[n-1],b=pts[n];const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/3));for(let k=1;k<=count;k++)waypoints.push({x:a.x+(b.x-a.x)*k/count,z:a.z+(b.z-a.z)*k/count});}
      if(pts.length>0)legs.push(await page.evaluate((leg)=>window.__wildshard.walkLeg(leg),{name:`trail-${i}-${reverse?'back':'forward'}`,start:{...pts[0],yaw:0},waypoints,timeout:240}));
    }
  }
  const touchResult=opts.tier==='phone' ? await touchLeg(page) : undefined;
  const sounds=await page.evaluate(()=>window.__wildshard.sounds());
  return {legs,stuck:legs.reduce((sum,l)=>sum+l.stuck.length,0),sounds,...touchResult?{touch:touchResult}:{}};
}
