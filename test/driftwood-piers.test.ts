import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import type { ColliderDesc } from '../src/engine/world/registry';
import { expect, it } from 'vitest';
import { floorAtRects } from '../src/engine/physics/box';
import { parseWorldScenePlacement } from '../src/format/worldScenePlacement';
import { readColliderRows, placeCollider, poseOf } from '../src/engine/models/colliders';
import { pierDeckAt, pierHalfWidthAt } from '../src/shards/driftwood-isle/generators/pierLayout';
import { pierColliders } from '../src/shards/driftwood-isle/generators/pierColliders';
import type { PierParams } from '../src/shards/driftwood-isle/generators/pierContract';
import { driftwoodPierRows } from '../src/shards/driftwood-isle/generators/fixedFacts';
import { driftwoodPierScenes } from '../src/shards/driftwood-isle/generators/pierScenesBank';

const rows = driftwoodPierRows(), scenes = driftwoodPierScenes();

const plainShape = (shape: ColliderDesc): object => shape.kind === 'hull' ? { ...shape, points: [...shape.points] } : shape;
const plain = (shapes: readonly ColliderDesc[]): object[] => shapes.map(plainShape);

function params(p: typeof rows[number]['params']): PierParams {
  const [x, z] = p.pennantDir;
  if (x === undefined || z === undefined) throw new Error('Missing pennant direction');
  const landing = p.landing;
  const [left, right] = landing?.postGround ?? [0, 0];
  if (left === undefined || right === undefined) throw new Error('Missing pier landing heights');
  return { ...p, pennantDir: [x, z], landing: landing === null ? null : { ...landing, postGround: [left, right] } };
}

it('bakes all seven pier choices and every original local/native contact', () => {
  expect(hashImmutableBytes(new TextEncoder().encode(`${JSON.stringify(rows, null, 2)}\n`))).toBe('eaa61f73bb4d4f6d4e0a5f1006e3d6aa73aacbef09efae936aa8e61b4bee0848');
  expect(scenes.model.choices).toHaveLength(7);
  for (const row of rows) {
    const choice = scenes.model.choices.find(candidate => candidate.id === row.id);
    if (choice === undefined) throw new Error('Missing pier choice');
    expect(choice.params).toEqual(row.params);
    expect(encodeCanonicalJson(choice.colliders)).toBe(encodeCanonicalJson(plain(pierColliders(params(row.params)))));
    if (row.world === null) continue;
    const world = row.world;
    const placement = parseWorldScenePlacement(scenes.placements.find(value => value.id === `piers.${row.id}`));
    const expected = pierColliders(params(row.params)).map(shape => placeCollider(shape, poseOf({ x: world.x, y: world.deckY, z: world.z, ...(world.rot === 0 ? {} : { yaw: world.rot }) })));
    const actual = readColliderRows(placement.colliders ?? [], { kinds: ['box', 'hull'], surfaces: [] });
    expect(encodeCanonicalJson(plain(actual))).toBe(encodeCanonicalJson(plain(expected)));
  }
});

it('baked floor profiles preserve all four flared entries, flat decks and landing ramps', () => {
  for (const row of rows) {
    if (row.world === null) continue;
    const world = row.world, p = params(row.params), placement = parseWorldScenePlacement(scenes.placements.find(value => value.id === `piers.${row.id}`));
    for (let i = 0; i <= 257; i++) {
      const along = -0.19 + (p.length + 0.38) * i / 257, half = pierHalfWidthAt(p, along) + 0.25;
      for (const across of [0, half - 0.001, -half + 0.001, half + 0.001]) {
        const x = world.x + across * Math.cos(world.rot) + along * Math.sin(world.rot), z = world.z - across * Math.sin(world.rot) + along * Math.cos(world.rot);
        const actual = floorAtRects(placement.piece?.floors ?? [], x, z, 'first');
        if (across > half) expect(actual).toBeUndefined();
        else expect(actual).toBeCloseTo(world.deckY + pierDeckAt(p, along), 10);
      }
    }
  }
});
