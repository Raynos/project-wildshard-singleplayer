import { floorAtRects } from '../src/engine/physics/box';
import { yawLocal } from '../src/engine/world/yawFrame';
import { beforeAll, expect, it } from 'vitest';
import { admitDriftwoodFixtureRows } from './fixtures/driftwoodRows';
import { coveColliderDescs, coveFloors, islandCoveSpec as admittedCoveSpec } from '../src/shards/driftwood-isle/runtime/boot/coveGeometry';
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

it('lends independent collider facts', () => {
  const first=coveColliderDescs(),second=coveColliderDescs();
  const a=first.find(row=>row.kind==='box'),b=second.find(row=>row.kind==='box');
  if(a===undefined||b===undefined)throw new Error('Cave lacks a wall');
  const x=b.x;a.x+=1;expect(b.x).toBe(x);
});

it('reads the authored cave and its baked floor rects, which keep the floor law', () => {
  expect(admittedCoveSpec()).toEqual(islandCoveSpec());
  const cave = islandCoveSpec().cave, floors = coveFloors();
  // off the strips' seams (a seam is a line: the law's strict bounds there are a measure-zero difference)
  for (let i = -60; i <= 60; i++) for (let j = -80; j <= 1000; j++) {
    const x = cave.x + i / 20 + 0.0013, z = cave.z + j / 100 + 0.0017, [lx, lz] = yawLocal(cave, x, z);
    const law = lz < -0.3 || lz > cave.depth || Math.abs(lx) > coveHalfWidth(lz) + 0.1 ? undefined : coveFloorAt(lz);
    const got = floorAtRects(floors, x, z, 'first');
    if (law === undefined) expect(got).toBeUndefined();
    else expect(got).toBeCloseTo(law, 12);
  }
  const changed = admittedCoveSpec(); changed.cave.x += 1;
  expect(admittedCoveSpec()).toEqual(islandCoveSpec());
});
