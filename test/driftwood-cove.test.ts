import { coveFloorAt as admittedFloor, coveHalfWidth as admittedWidth } from '../src/shards/driftwood-isle/world/Cove';
import { beforeAll, expect, it } from 'vitest';
import { admitDriftwoodFixtureRows } from './fixtures/driftwoodRows';
import { coveColliderDescs, copyCoveGeometry, islandCoveSpec as admittedCoveSpec } from '../src/shards/driftwood-isle/runtime/boot/coveGeometry';
import { coveFloorAt, islandCoveSpec, coveHalfWidth, STEPS } from '../src/shards/driftwood-isle/generators/coveLayout';

beforeAll(admitDriftwoodFixtureRows);

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

it('reads the authored cave and continuous floor law from its admitted data', () => {
  expect(admittedCoveSpec()).toEqual(islandCoveSpec());
  for (let i = -100; i <= 1000; i++) {
    const z = i / 100;
    expect(admittedFloor(z)).toBe(coveFloorAt(z));
    expect(admittedWidth(z)).toBe(coveHalfWidth(z));
  }
  const changed = admittedCoveSpec(); changed.cave.x += 1;
  expect(admittedCoveSpec()).toEqual(islandCoveSpec());
});
