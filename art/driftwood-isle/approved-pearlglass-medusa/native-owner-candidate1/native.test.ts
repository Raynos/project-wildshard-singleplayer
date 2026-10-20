import { readFileSync } from 'node:fs';
import { Bone, MeshBasicMaterial, Skeleton, SkinnedMesh, Vector3 } from 'three';
import { expect, test } from 'vitest';
import type { AnimalSim } from '../../../../src/engine/entities/AnimalSim';
import { numericCreaturePose } from '../../../../src/game/plugin/channelPrograms';
import { medusaClips } from '../medusaClips';
import { MEDUSA_FLIGHT, MEDUSA_SCALE, MEDUSA_STRIKE } from '../medusaBehavior';
import { createMedusaNativeSource, loadMedusaNativeSource, medusaWeightedVertices } from './medusaNativeSource';
const source = 'art/driftwood-isle/approved-pearlglass-medusa/complete-character-next/';
async function specimen() {
  const metadata: unknown = JSON.parse(readFileSync(source + 'metadata.json', 'utf8'));
  const parts = await loadMedusaNativeSource(metadata, new Uint8Array(readFileSync(source + 'payload.bin')));
  const native = createMedusaNativeSource(parts, { heightAt: () => 0, random: () => .5 });
  return { parts, ...native, dispose: () => { for (const geometry of [...parts.furParts, ...parts.hardParts, ...parts.eyeParts]) geometry.dispose(); } };
}
const local = (f: Awaited<ReturnType<typeof specimen>>) => f.pose.corpseJoints();
function tick(f: Awaited<ReturnType<typeof specimen>>, frame: number) {
  f.actor.step(1 / 60); f.pose.advance(1 / 60, frame / 60, true); f.pose.publish();
}

test('actual selected source retains 27 joints, vertical capsule, zero pivot, flight and real burst policy', async () => {
  const f = await specimen();
  try {
    expect(f.recipe.joints).toHaveLength(27); expect(f.parts.hardParts).toHaveLength(10);
    expect(f.actor.dims).toBe(f.parts.dims); expect(f.actor.dims.bodyY).toBe(0);
    expect(f.actor.dims.capsuleAxis).toBe('y'); expect(f.actor.scale).toBe(MEDUSA_SCALE);
    expect(f.actor.flying).toBe(true); expect(f.actor.snapshot().flight?.altitude).toBe(MEDUSA_FLIGHT.altitude);
    expect(f.brain.state).toBe('drift'); expect(f.actor.dims.rigidCorpse).toBeUndefined();
    const saved = f.brain.snapshot(); f.brain.restore(saved); expect(f.brain.snapshot()).toEqual(saved);
    f.actor.fly(0, .65, 1.2, 2.5); tick(f, 1);
    expect(f.actor.position.y).toBeCloseTo(1.6 - MEDUSA_FLIGHT.diveRate / 60, 12);
    expect(f.actor.position.z).toBeGreaterThan(0);
  } finally { f.dispose(); }
});

test('live native channels agree with unchanged selected Medusa animation across burst and hit phases', async () => {
  const f = await specimen(), original = numericCreaturePose(medusaClips());
  try {
    for (let i = 1; i <= 60; i++) {
      f.actor.startAttack(2.6); const saved = f.actor.snapshot(); saved.motion.attackT = i / 60 * 2.6; saved.motion.flinch = i % 7 === 0 ? .7 : 0; f.actor.restore(saved);
      tick(f, i); const before = local(f);
      original(f.pose.context); expect(local(f)).toEqual(before);
    }
  } finally { f.dispose(); }
});

test('real lethal publication retains every local endpoint, settles to original authored fold and stays finite', async () => {
  for (const phase of [0, .28, .4, .9]) {
    const f = await specimen();
    try {
      f.actor.startAttack(2.6); const saved = f.actor.snapshot(); saved.motion.attackT = phase * 2.6; f.actor.restore(saved); tick(f, 1);
      const entry = local(f), position = f.actor.position.clone();
      expect(f.actor.applyFinalDamage(1000, position, new Vector3(1, 0, 0))).toBe(true);
      expect(f.pose.context.transition?.kind).toBe(2); expect(local(f)).toEqual(entry);
      expect(f.actor.position).toEqual(position); expect(f.actor.alive).toBe(false);
      for (let i = 2; i <= 121; i++) { tick(f, i); expect(local(f).flatMap(j => [...Object.values(j.position), ...Object.values(j.rotation)]).every(Number.isFinite)).toBe(true); }
      const settled = local(f); numericCreaturePose(medusaClips())(f.pose.context);
      local(f).forEach((joint, index) => { const other = settled[index]; if (other === undefined) throw new Error('Missing terminal joint'); for (const key of ['x', 'y', 'z', 'w'] as const) expect(joint.rotation[key]).toBeCloseTo(other.rotation[key], 12); });
      // Retain the real unsafe fallback: this source adapter is not a physical corpse admission.
      const lowest = Math.min(...medusaWeightedVertices(f.parts, f.pose).flat().map(p => f.actor.position.y + p.y * MEDUSA_SCALE));
      expect(f.actor.position.y).toBe(0); expect(lowest).toBeLessThan(-1);
    } finally { f.dispose(); }
  }
});

test('source geometry oracle agrees with real THREE weighted skin at live and lethal/dead endpoints', async () => {
  const f = await specimen(), material = new MeshBasicMaterial(), bones: Bone[] = [];
  for (const row of f.recipe.joints) {
    const bone = new Bone(); bone.name = row.name; bone.position.fromArray(row.position);
    const parent = bones[row.parent]; if (parent !== undefined) parent.add(bone); bones.push(bone);
  }
  const root = bones[0]; if (root === undefined) throw new Error('Missing actual root');
  root.updateMatrixWorld(true); const skeleton = new Skeleton(bones);
  const meshes = f.parts.hardParts.map(geometry => { const mesh = new SkinnedMesh(geometry, material); mesh.bind(skeleton); return mesh; });
  try {
    for (let i = 1; i <= 121; i++) {
      tick(f, i);
      if (i === 2) f.actor.applyFinalDamage(1000, f.actor.position.clone(), new Vector3(1, 0, 0));
      if (![1, 2, 30, 61, 121].includes(i)) continue;
      for (const bone of bones) {
        const joint = f.pose.bones[bone.name]; if (joint === undefined) throw new Error('Missing native joint');
        bone.position.copy(joint.position); bone.rotation.copy(joint.rotation); bone.scale.copy(joint.scale);
      }
      root.updateMatrixWorld(true); skeleton.update(); const actual = medusaWeightedVertices(f.parts, f.pose);
      let maximumError = 0, count = 0;
      meshes.forEach((mesh, part) => {
        const points = actual[part]; if (points === undefined) throw new Error('Missing geometry oracle part');
        const positions = mesh.geometry.getAttribute('position');
        points.forEach((point, vertex) => {
          const expected = mesh.applyBoneTransform(vertex, new Vector3().fromBufferAttribute(positions, vertex));
          maximumError = Math.max(maximumError, expected.distanceTo(point)); count++;
        });
      });
      expect(count).toBe(17226); expect(maximumError).toBeLessThan(1e-6);
    }
  } finally { skeleton.dispose(); material.dispose(); f.dispose(); }
});


test('real burst brain executes windup, one pulse/shove and recovery with unchanged flight steering', async () => {
  const f = await specimen();
  try {
    const hits: number[] = [], shoves: number[][] = [], phases = new Set<string>(); let claims = 0;
    const ports = { dt: 1 / 60, player: new Vector3(0, 0, 0), calm: false,
      reach: () => true, claim: () => ++claims === 1,
      hurt: (damage: number) => { hits.push(damage); },
      shove: (yaw: number, speed: number, lift: number) => { shoves.push([yaw, speed, lift]); },
      flight: { steer: (actor: AnimalSim, yaw: number, speed: number, altitude: number, turn: number) => { actor.fly(yaw, speed, altitude, turn); } } };
    const frames = Math.ceil((MEDUSA_STRIKE.windup + MEDUSA_STRIKE.active + MEDUSA_STRIKE.recover + MEDUSA_STRIKE.cooldown + 1) * 60);
    for (let i = 1; i <= frames; i++) {
      f.brain.think(ports); f.brain.act(ports); phases.add(f.brain.state); tick(f, i);
    }
    expect(phases).toEqual(new Set(['dart', 'drift'])); expect(hits).toEqual([6]);
    expect(shoves).toHaveLength(1); expect(shoves[0]?.slice(1)).toEqual([1.2, 0]);
    expect(f.actor.flying).toBe(true); expect(f.actor.position.y).toBeGreaterThan(0);
    const before = f.brain.snapshot(); f.actor.applyFinalDamage(1000, f.actor.position.clone(), new Vector3(1, 0, 0));
    f.brain.think(ports); f.brain.act(ports); expect(f.brain.snapshot()).toEqual(before); expect(hits).toEqual([6]);
  } finally { f.dispose(); }
});

test('actual flight, burst and native pose continuation survive quiet reads and fresh source restoration', async () => {
  const f = await specimen(), restored = await specimen();
  try {
    f.actor.fly(.7, .65, 1.2, 2.5);
    for (let frame = 1; frame <= 40; frame++) tick(f, frame);
    const actor = f.actor.snapshot(), pose = f.pose.snapshot(), brain = f.brain.snapshot();
    for (let count = 0; count < 100; count++) {
      f.pose.headWorld(new Vector3()); f.pose.bodyCapsule(new Vector3(), new Vector3()); f.pose.corpseJoints();
    }
    expect(f.actor.snapshot()).toEqual(actor); expect(f.pose.snapshot()).toBe(pose); expect(f.brain.snapshot()).toEqual(brain);
    restored.actor.restore(actor); restored.pose.restore(pose); restored.brain.restore(brain);
    for (let frame = 41; frame <= 70; frame++) {
      tick(f, frame); tick(restored, frame);
      expect(restored.actor.snapshot()).toEqual(f.actor.snapshot());
      expect(restored.pose.snapshot()).toBe(f.pose.snapshot());
      expect(restored.brain.snapshot()).toEqual(f.brain.snapshot());
    }
  } finally { f.dispose(); restored.dispose(); }
});
