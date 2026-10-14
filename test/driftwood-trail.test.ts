import { expect, it } from 'vitest';
import { trailColliders } from '../src/shards/driftwood-isle/generators/trailColliders';
import { staticColliders } from '../src/shards/driftwood-isle/runtime/boot/staticColliders';
import facts from '../src/shards/driftwood-isle/data/trailsideBake.json';

it('keeps trail treads walkable and rail rotations independent of the generated facts', () => {
  const rows=trailColliders({fences:[],signs:[],steps:[{from:[0,0],to:[0,7]}],flights:[{bottom:[0,0],top:[0,7]}]},(_x,z)=>z*0.2);
  const boxes=rows.filter(row=>row.kind==='box'&&row.rot===undefined);
  expect(boxes.length).toBeGreaterThan(1);
  for(const box of boxes){
    if(box.kind!=='box')throw new Error('Trail tread is not a box');
    expect(box.hz*2).toBeGreaterThanOrEqual(0.354);
    expect(box.hy).toBeGreaterThan(0);
  }
  const flight=rows.find(row=>row.kind==='treads');
  if(flight===undefined)throw new Error('Trail flight absent');
  expect((flight.to.y-flight.from.y)/flight.count).toBeLessThanOrEqual(0.28);
  const first=staticColliders(facts.worldColliders),second=staticColliders(facts.worldColliders);
  const a=first.find(row=>row.kind==='box'&&row.rot!==undefined),b=second.find(row=>row.kind==='box'&&row.rot!==undefined);
  if(a?.kind!=='box'||b?.kind!=='box'||a.rot===undefined||b.rot===undefined)throw new Error('Trail rail absent');
  const x=b.rot.x;a.rot.x+=1;expect(b.rot.x).toBe(x);
});

it('refuses malformed static facts instead of silently changing collision', () => {
  expect(()=>staticColliders([{kind:'capsule'}])).toThrow('shape');
  expect(()=>staticColliders([{kind:'box',surface:'rock'}])).toThrow('surface');
  expect(()=>staticColliders([{kind:'box',x:Number.NaN}])).toThrow('finite');
  expect(()=>staticColliders([{kind:'treads',width:2,count:2}])).toThrow('endpoint');
});
