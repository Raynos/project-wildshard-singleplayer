import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { NativeCreaturePose } from '../src/game/plugin/animation';
import { tamingPoses, NALATI_BODY_ROWS } from '../src/shards/nalati-grasslands/generators/bodies';
import { bodyKey } from '../src/shards/nalati-grasslands/generators/bodyKey';
import { bodySpecies } from '../src/shards/nalati-grasslands/generators/speciesRows';
import { speciesLookBook } from '../src/shards/nalati-grasslands/species/presentation';
import { NalatiTamingHorsePose } from './fixtures/nalati-taming-pose';

const HORSE_SPECIES = bodySpecies('horse');
const wind = { x: .6, z: .8, strength: .7 };
function actor(): AnimalSim {
  const variant = HORSE_SPECIES.variants.find(row => row.id === 'tulpar');
  if (variant === undefined) throw new Error('Missing horse variant');
  const body = NALATI_BODY_ROWS.bodies.find(row => row.key === bodyKey('horse', variant));
  if (body === undefined) throw new Error('Missing horse body');
  const result = new AnimalSim({ kind: 'horse', label: 'Tulpar', variant: 'tulpar', rarity: 'rare', hp: 150, aggressive: false,
    dims: body.dims, mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 25, relentless: false } },
  .37, 1.08, 'horse:test', { heightAt: (x, z) => .03 * x + .02 * z, random: () => .5 });
  result.place(11, 7, .8); return result;
}
function native(body: AnimalSim): NativeCreaturePose {
  const recipe = tamingPoses.find(row => row.kind === body.kind && row.variant === body.variant)?.pose;
  if (recipe === undefined) throw new Error('Missing horse pose');
  const pose = new NativeCreaturePose(body, recipe); pose.publish(); return pose;
}
test('numeric horse rows draw finite rear, buck, mane and wind overlays on native joints', () => {
  const body = actor(), pose = native(body), head = new Vector3();
  const baseline = pose.context.bones['body']?.rotation.x ?? 0;
  let changed = false;
  for (let tick = 0; tick < 180; tick++) {
    body.position.x += .02; body.yaw += .003; body.speed = tick < 60 ? 4.5 : 8.5;
    body.mem['rear'] = tick < 30 ? .8 : 0; body.mem['buck'] = tick >= 30 && tick < 60 ? .9 : 0;
    body.mem['turnLead'] = -.7; if (tick === 60) body.mem['kick'] = 1;
    pose.sampleTerrain(); pose.advance(1 / 60, tick / 60, true);
    speciesLookBook().pose('horse', pose.context); pose.publish(); pose.headWorld(head);
    expect([head.x, head.y, head.z].every(Number.isFinite)).toBe(true);
    expect(head.distanceTo(body.position)).toBeLessThan(10);
    changed ||= Math.abs((pose.context.bones['body']?.rotation.x ?? 0) - baseline) > .1;
  }
  expect(changed).toBe(true); expect(body.mem['kick']).toBe(0);
  const wire = pose.snapshot(); pose.restore(wire); expect(pose.snapshot()).toBe(wire);
});

test('legacy transforms refuse missing, reordered and invalid joints without changing the pose', () => {
  const body = actor(), old = new NalatiTamingHorsePose(body, () => wind), pose = native(body);
  old.advance(.1, 1, true); pose.restore(old.snapshot());
  const wire = pose.snapshot();
  const saved = JSON.parse(old.snapshot()) as { pose: string; breath: number; root: object; bones: [string, object][] };
  for (const invalid of [{ ...saved, bones: saved.bones.slice(1) }, { ...saved, bones: [...saved.bones].reverse() },
    { ...saved, breath: -1 }, { ...saved, pose: '{}' }, { ...saved, root: {} }]) {
    expect(() => pose.restore(JSON.stringify(invalid))).toThrow(); expect(pose.snapshot()).toBe(wire);
  }
});
