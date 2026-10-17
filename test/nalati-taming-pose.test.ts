import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { NativeCreaturePose } from '../src/game/plugin/animation';
import { tamingPoses } from '../src/shards/nalati-grasslands/generators/bodies';
import { NALATI_BODY_ROWS } from '../src/shards/nalati-grasslands/species/bodies';
import { bodyKey } from '../src/shards/nalati-grasslands/species/bodyKey';
import { HORSE_SPECIES, poseNalatiHorse } from '../src/shards/nalati-grasslands/species/horse';
import { NalatiTamingHorsePose } from './fixtures/nalati-taming-pose';

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
test('taming pose retains the old head, overlays and far-LOD joints through legacy and native saves', () => {
  const before = actor(), after = actor(), old = new NalatiTamingHorsePose(before, () => wind), pose = native(after);
  const left = new Vector3(), right = new Vector3();
  const heads = (tick = -1): void => { old.headWorld(left); pose.headWorld(right); expect(right.distanceTo(left), `tick ${tick}`).toBeLessThan(1e-12); };
  heads();
  for (let tick = 0; tick < 180; tick++) {
    const near = tick < 70 || tick >= 120;
    for (const body of [before, after]) {
      body.position.x += .02; body.yaw += .003; body.speed = tick < 60 ? 4.5 : 8.5;
      body.mem['rear'] = tick < 30 ? .8 : 0; body.mem['buck'] = tick >= 30 && tick < 60 ? .9 : 0;
      body.mem['turnLead'] = -.7; body.mem['kick'] = tick === 60 ? 1 : body.mem['kick'] ?? 0;
      if (tick === 90) body.scale = 1.3;
    }
    old.sampleTerrain(); pose.sampleTerrain();
    old.advance(1 / 60, tick / 60, near); pose.advance(1 / 60, tick / 60, near);
    if (near) poseNalatiHorse(pose.context, wind); pose.publish();
    heads(tick); expect(after.mem).toEqual(before.mem);
    expect(pose.snapshot('local')).toBe(old.snapshot());
    if (tick === 95) { pose.restore(old.snapshot()); heads(); }
    if (tick === 125) { const wire = pose.snapshot(); pose.restore(wire); heads(tick); }
  }
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
