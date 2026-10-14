import { expect, it } from 'vitest';
import { coveColliderDescs, copyCoveGeometry } from '../src/shards/driftwood-isle/boot/coveGeometry';
import { coveFloorAt, islandCoveSpec, STEPS } from '../src/shards/driftwood-isle/world/coveLayout';

it('admits the stair as real ascending treads between the native cave floors', () => {
  const rows=coveColliderDescs(),stairs=rows.find(row=>row.kind==='treads');
  if(stairs===undefined)throw new Error('Cave has no native stair');
  expect(stairs.from.y).toBe(coveFloorAt(STEPS.z0));
  expect(stairs.to.y).toBe(coveFloorAt(STEPS.z1));
  expect(stairs.to.y).toBeGreaterThan(stairs.from.y);
  expect(stairs.width).toBeGreaterThan(0.76);
  expect(rows.every(row=>row.surface==='rock')).toBe(true);
});

it('lends independent collider facts and refuses an unbaked cave layout', () => {
  const first=coveColliderDescs(),second=coveColliderDescs();
  const a=first.find(row=>row.kind==='box'),b=second.find(row=>row.kind==='box');
  if(a===undefined||b===undefined)throw new Error('Cave lacks a wall');
  const x=b.x;a.x+=1;expect(b.x).toBe(x);
  const spec=islandCoveSpec();
  expect(()=>copyCoveGeometry({...spec,cave:{...spec.cave,x:spec.cave.x+1}})).toThrow('layout changed');
});
