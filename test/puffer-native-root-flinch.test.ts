// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the exact V70 source in an offline candidate proof.
import { readFileSync } from 'node:fs';
import { Bone, Group, Vector3 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { applyAnimalRoot, type AnimalRigContext } from '../src/engine/entities/animalRig';
import { numericCreaturePose } from '../src/pufferGaitContinuityPreview';
import { pufferNativeGait4Clips, PUFFER_GAIT4_LEG_LEN } from '../src/shards/driftwood-isle/generators/pufferNativeGait4Clips';

const native = v.parse(v.looseObject({
  bones: v.array(v.strictObject({ name: v.string(), parent: v.nullable(v.string()), pos: v.tuple([v.number(), v.number(), v.number()]) })),
  parts: v.array(v.looseObject({ name: v.string(), positions: v.array(v.number()), skinIndices: v.array(v.number()), skinWeights: v.array(v.number()) })),
}), JSON.parse(readFileSync('art/driftwood-isle/approved-puffer/unaccepted-v70-motion-rig1-native.json', 'utf8')));

function rig(): { context: AnimalRigContext; bones: Record<string, Bone>; root: Bone; world: Group } {
  const bones: Record<string, Bone> = {};
  for (const definition of native.bones) {
    const bone = new Bone(); bone.name = definition.name; bone.position.fromArray(definition.pos);
    if (definition.parent !== null) {
      const parent = bones[definition.parent], bind = native.bones.find(row => row.name === definition.parent);
      if (parent === undefined || bind === undefined) throw new Error('Missing V70 parent');
      bone.position.sub(new Vector3(...bind.pos)); parent.add(bone);
    }
    bones[definition.name] = bone;
  }
  const root = bones['body']; if (root === undefined) throw new Error('Missing V70 root');
  const mem = {}, position = new Vector3(2, 900, -3), world = new Group(); world.add(root);
  return { bones, root, world, context: { bones,
    dims: { bodyY: root.position.y, bodyHalfLen: .4590948820114136, bodyRadius: .8693322053090293,
      headRadius: .5321923664959826, legLen: PUFFER_GAIT4_LEG_LEN, feet: [], halfWidth: .9789999723434448 },
    dt: 1 / 60, t: 0, seed: .7, scale: 1, speed: 0, strafe: 0, phase: 0, state: 'stalk', alive: true,
    deathT: -1, flinch: 0, brace: 0, attack: -1, lookTarget: new Vector3(), lookWeight: 0,
    position, yaw: 0, mem, animal: { mem, position, yOffset: 0 } } };
}

function auditFins(bones: Record<string, Bone>): { floor: number; rootError: number; areaRatio: number } {
  let floor = Number.POSITIVE_INFINITY, rootError = 0, areaRatio = Number.POSITIVE_INFINITY;
  const bellyDefinition = native.bones.find(row => row.name === 'belly'), belly = bones['belly'];
  if (bellyDefinition === undefined || belly === undefined) throw new Error('Missing V70 belly');
  for (const part of native.parts) {
    if (!part.name.startsWith('Volumetric connected ')) continue;
    const shown: Vector3[] = [];
    for (let i = 0; i < part.positions.length / 3; i++) {
      const point = new Vector3().fromArray(part.positions, i * 3), displayed = new Vector3();
      for (let lane = 0; lane < 4; lane++) {
        const weight = part.skinWeights[i * 4 + lane];
        if (weight === undefined || weight === 0) continue;
        const index = part.skinIndices[i * 4 + lane];
        if (index === undefined) throw new Error('Missing V70 weight index');
        const definition = native.bones[index];
        if (definition === undefined) throw new Error('Unknown V70 weight index');
        const bone = bones[definition.name];
        if (bone === undefined) throw new Error('Missing V70 bone');
        displayed.addScaledVector(point.clone().sub(new Vector3(...definition.pos)).applyMatrix4(bone.matrixWorld), weight);
      }
      floor = Math.min(floor, displayed.y - 900); shown.push(displayed);
      if (point.y > .4) {
        const attached = point.clone().sub(new Vector3(...bellyDefinition.pos)).applyMatrix4(belly.matrixWorld);
        rootError = Math.max(rootError, displayed.distanceTo(attached));
      }
    }
    for (let i = 0; i < shown.length; i += 3) {
      const a = shown[i], b = shown[i + 1], c = shown[i + 2];
      if (a === undefined || b === undefined || c === undefined) throw new Error('Incomplete V70 triangle');
      const originalA = new Vector3().fromArray(part.positions, i * 3);
      const originalB = new Vector3().fromArray(part.positions, (i + 1) * 3);
      const originalC = new Vector3().fromArray(part.positions, (i + 2) * 3);
      const originalArea = originalB.sub(originalA).cross(originalC.sub(originalA)).length();
      if (!(originalArea > 1e-10)) throw new Error('Degenerate V70 reference triangle');
      areaRatio = Math.min(areaRatio, b.clone().sub(a).cross(c.clone().sub(a)).length() / originalArea);
    }
  }
  return { floor, rootError, areaRatio };
}

test('actual opted-in world roots preserve weighted V70 clearance across yaw, hits, stop/resume and death poses', () => {
  let floor = Number.POSITIVE_INFINITY, rootError = 0, areaRatio = Number.POSITIVE_INFINITY, frames = 0;
  for (const dt of [1 / 60, 1 / 30, .1, .2]) for (const yaw of [-1.7, .9]) {
    for (const scenario of ['stop-resume', 'attack', 'hit', 'death']) {
      const { context: c, bones, world } = rig(), animate = numericCreaturePose(pufferNativeGait4Clips());
      c.dt = dt; c.yaw = yaw;
      for (let i = 0; i <= Math.ceil(2.5 / dt); i++) {
        c.t = i * dt; c.phase = (c.phase + .7 * .62 / .24 * dt) % 1;
        c.speed = c.t < .6 || scenario === 'stop-resume' && c.t >= 1.2 ? .7 : 0;
        c.mem['puffer-st'] = scenario === 'stop-resume' || c.t < .6 ? 0 : 1;
        c.mem['regular-clock'] = Math.max(0, c.t - .6);
        c.flinch = scenario === 'hit' && c.t >= .7 ? Math.exp(-5.5 * (c.t - .7)) : 0;
        c.deathT = scenario === 'death' && c.t >= .9 ? Math.min(1, (c.t - .9) / .8) : -1;
        c.alive = c.deathT < 0;
        animate(c);
        applyAnimalRoot(world, c.position, yaw, 0, 0, true, c.alive, c.flinch, -.15, .25, 'authored-pose');
        world.updateMatrixWorld(true);
        const audit = auditFins(bones);
        floor = Math.min(floor, audit.floor); rootError = Math.max(rootError, audit.rootError);
        areaRatio = Math.min(areaRatio, audit.areaRatio); frames++;
      }
    }
  }
  expect(floor).toBeGreaterThanOrEqual(.00399);
  expect(rootError).toBeLessThan(1e-9);
  expect(areaRatio).toBeGreaterThan(1e-6);
  console.info(JSON.stringify({ candidate: 'V70 rig1 gait5 authored-pose root recoil', frames,
    minimumWorldFinClearance: floor, maximumCapToBellyError: rootError, minimumTriangleAreaRatio: areaRatio,
    scope: 'Actual numeric pose plus actual root policy and world matrices; flat y900 floor, not terrain or world ragdoll contact' }));
});

test('world-root regression witness fails with default tilt while authored local hit recoil remains visible', () => {
  const { context: c, bones, world } = rig(), animate = numericCreaturePose(pufferNativeGait4Clips());
  c.t = .8; c.dt = .1; c.mem['puffer-st'] = 2; c.flinch = .6;
  animate(c);
  expect(bones['body']?.rotation.x).toBeLessThan(-.04);
  expect(bones['body']?.position.y).toBeGreaterThan(.66);
  applyAnimalRoot(world, c.position, .4, 0, 0, true, true, c.flinch, -.15, .25);
  world.updateMatrixWorld(true); expect(auditFins(bones).floor).toBeLessThan(-.05);
  const before = bones['body']?.rotation.toArray();
  applyAnimalRoot(world, c.position, .4, 0, 0, true, true, c.flinch, -.15, .25, 'authored-pose');
  world.updateMatrixWorld(true); expect(auditFins(bones).floor).toBeGreaterThan(.004);
  expect(bones['body']?.rotation.toArray()).toEqual(before);
  expect(c.flinch).toBe(.6); expect(c.position.toArray()).toEqual([2, 900, -3]);
});
