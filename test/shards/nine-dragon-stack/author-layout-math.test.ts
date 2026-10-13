import { expect, it } from 'vitest';
import { Rng } from '@wildshard/sdk/random';
import { NINE_LAYOUT_PLAN } from '../../../src/shards/nine-dragon-stack/data/layoutPlan';
import { centred as authorCentred, walkable as authorWalkable } from '../../../src/shards/nine-dragon-stack/generators/layoutMath';
import { centred } from '../../../src/shards/nine-dragon-stack/world/specimenDims';
import { walkable } from '../../../src/shards/nine-dragon-stack/layout';

it('keeps authored stall centring exactly equal to the runtime for every footprint', () => {
  const rng = new Rng(0x9d2a);
  const footprints = [NINE_LAYOUT_PLAN.STALL, NINE_LAYOUT_PLAN.HAWKER,
    { x0: 0, x1: 0, z0: 0, z1: 0 }, { x0: -Number.MIN_VALUE, x1: Number.MIN_VALUE, z0: -1e-12, z1: 1e-12 }];
  for (let i = 0; i < 2048; i++) footprints.push({ x0: rng.range(-250, 250), x1: rng.range(-250, 250), z0: rng.range(-250, 250), z1: rng.range(-250, 250) });
  for (const rect of footprints) expect(authorCentred(rect)).toEqual(centred(rect));
});

it('keeps authored walkability exactly equal at street, obstacle and cell boundaries', () => {
  const { PLAZA, STREET, STAIR, BANYAN, STALL, HAWKER, GATE } = NINE_LAYOUT_PLAN;
  const xs = [PLAZA.x0 + 0.6, PLAZA.x1 - 0.8, STREET.x0 + 1.4, STREET.x1 - 0.6, STAIR.x0 + 6,
    BANYAN.x - 4.2, BANYAN.x - 2.2, BANYAN.x - 4.3, BANYAN.x - 3.1,
    STALL.x0 - 0.5, STALL.x1 + 0.5, STALL.x0 + 0.6, STALL.x0 + 4.8, HAWKER.x0 - 0.3, HAWKER.x1 + 0.5,
    ...GATE.posts.flatMap(x => [x - 0.9, x + 0.9])];
  const zs = [PLAZA.z0 + 0.8, PLAZA.z1 - 0.8, -120, STAIR.z0 + 0.6, STAIR.z1 - 0.6,
    BANYAN.z + 1.6, BANYAN.z + 2.9, BANYAN.z - 1.6, BANYAN.z - 0.6,
    STALL.z0 - 0.5, STALL.z1 + 1.4, STALL.z1 + 1.8, STALL.z1 + 3.1, HAWKER.z0 - 0.3, HAWKER.z1 + 0.8,
    GATE.z - 2, GATE.z + 2];
  const offsets = [-1e-10, 0, 1e-10];
  for (const x of xs) for (const z of zs) for (const dx of offsets) for (const dz of offsets) {
    expect(authorWalkable(x + dx, z + dz)).toBe(walkable(x + dx, z + dz));
  }
  for (let x = -250; x <= 250; x += 5) for (let z = -250; z <= 250; z += 5) expect(authorWalkable(x, z)).toBe(walkable(x, z));
  for (let i = 0; i < 360; i++) {
    const angle = i * Math.PI / 180;
    for (const offset of offsets) {
      const radius = BANYAN.r + 0.6 + offset, x = BANYAN.x + radius * Math.cos(angle), z = BANYAN.z + radius * Math.sin(angle);
      expect(authorWalkable(x, z)).toBe(walkable(x, z));
    }
  }
});
