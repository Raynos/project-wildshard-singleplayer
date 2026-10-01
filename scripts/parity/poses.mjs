import { join } from 'node:path';
import { percentile } from './value.mjs';

/** @type {Record<string, import('../types/wildshard-probe.d.ts').ProbePose[]>} */
export const POSES = {
  'driftwood-isle':[{name:'pier',x:0,z:-194,yaw:Math.PI,pitch:0},{name:'beach',x:-10,z:-150,yaw:4.3,pitch:0},{name:'wreck',x:105,z:0,yaw:-Math.PI/2,pitch:0}],
  'pine-hollow':[{name:'gate',x:0,z:-200,yaw:Math.PI,pitch:0},{name:'cabin',x:-14,z:-62,yaw:Math.PI,pitch:0},{name:'pond',x:-56,z:95,yaw:Math.PI,pitch:0}],
  'nalati-grasslands':[{name:'camp',x:60,z:214,yaw:-Math.PI/2,pitch:0},{name:'bridge',x:0,z:200,yaw:0,pitch:0},{name:'plains',x:65,z:0,yaw:Math.PI,pitch:0}],
  'nine-dragon-stack':[{name:'spawn-rail',x:0.95,z:7.5,y:125,yaw:-12*Math.PI/180,pitch:-4*Math.PI/180},{name:'well-edge',x:-19.5,z:13.3,y:125,yaw:0,pitch:-10*Math.PI/180},{name:'stair-street',x:18,z:6,y:125,yaw:-Math.PI/2,pitch:10*Math.PI/180}],
};
/** @param {import('playwright').Page} page @param {{shard:string,tier:string,out:string}} opts */
export async function poses(page,opts) {
  const result=[];
  for(const pose of POSES[opts.shard] ?? []) {
    await page.evaluate((p)=>window.__wildshard.pose(p),pose);
    await page.waitForTimeout(3000);
    // scorecard's sampler: only frames whose game.frameNo moved are drawn frames.
    const sampled=await page.evaluate(async()=> {
      const g=window.__wildshard.world.game,iv=/** @type {number[]} */ ([]),cpu=/** @type {number[]} */ ([]),calls=/** @type {number[]} */ ([]),tris=/** @type {number[]} */ ([]);
      const instrument=window.__parity; instrument.cpu=0;instrument.on=true;
      const drawnNo=()=>Reflect.get(g,'frameNo');
      let last=performance.now(),lastNo=drawnNo(),first=true; const end=last+5000;
      await new Promise((resolve)=> {const tick=()=> {const now=performance.now();if(drawnNo()!==lastNo){if(!first){iv.push(now-last);cpu.push(instrument.cpu);}first=false;instrument.cpu=0;last=now;lastNo=drawnNo();calls.push(g.lastFrame.calls);tris.push(g.lastFrame.triangles);}if(now>=end)resolve(undefined);else instrument.rawRAF(tick);};instrument.rawRAF(tick);});
      instrument.on=false;
      const p=window.__wildshard.world.player.position;
      return {iv,cpu,calls,tris,pos:[p.x,p.y,p.z]};
    });
    const boxes=await creatureBoxes(page);
    const shot=join(opts.out,`${opts.shard}.${opts.tier}.${pose.name ?? 'spawn'}.jpg`);
    await page.screenshot({path:shot,type:'jpeg',quality:80,scale:'css'});
    const mean=sampled.iv.reduce((sum,v)=>sum+v,0)/Math.max(1,sampled.iv.length);
    result.push({name:pose.name ?? 'spawn',pos:sampled.pos,calls:percentile(sampled.calls),tris:percentile(sampled.tris),fps:1000/mean,frameP95Ms:percentile(sampled.iv,0.95),cpuP50Ms:percentile(sampled.cpu),cpuP95Ms:percentile(sampled.cpu,0.95),creatureBoxes:boxes.length,boxes,shot,ssim:1});
  }
  return result;
}
/** Creature mask projection lifted from scorecard.mjs:576–600.
 * @param {import('playwright').Page} page */
function creatureBoxes(page) {
  return page.evaluate(()=> {
    const w=window.__wildshard.world,cam=w.game.camera,W=innerWidth,H=innerHeight,out=/** @type {number[][]} */ ([]);
    cam.updateMatrixWorld();
    const right=w.player.position.clone().setFromMatrixColumn(cam.matrixWorld,0).normalize();
    for(const a of w.animals.animals){const m=a.mesh;if(!m.geometry.boundingSphere)m.geometry.computeBoundingSphere();const bs=m.geometry.boundingSphere;if(!bs)continue;
      const c=bs.center.clone().applyMatrix4(m.matrixWorld),r=Math.max(bs.radius*m.matrixWorld.getMaxScaleOnAxis(),0.8*a.scale),p=c.clone().project(cam);if(p.z>1 || p.z< -1)continue;
      const q=c.clone().addScaledVector(right,r).project(cam),sx=(p.x+1)/2*W,sy=(1-p.y)/2*H,pr=Math.hypot((q.x-p.x)/2*W,(q.y-p.y)/2*H)*1.25+6;
      const box=[Math.max(0,sx-pr),Math.max(0,sy-pr-34),Math.min(W,sx+pr),Math.min(H,sy+pr)];if(box[2]>box[0] && box[3]>box[1])out.push(box.map(Math.round));
    }
    return out;
  });
}
