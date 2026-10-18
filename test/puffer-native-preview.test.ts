// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the preserved real native source; no Blender execution.
import { readFileSync } from 'node:fs';
import { Bone, Vector3 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { pufferNativeClips, type PufferPreviewPose } from '../src/shards/driftwood-isle/generators/pufferNativeClips';
import { createPufferPreviewOutput, createPufferPreviewSource, PUFFER_PREVIEW_DECISION_MEMORY } from '../src/shards/driftwood-isle/generators/pufferNativePreview';

const native = v.parse(v.looseObject({ bones: v.array(v.strictObject({ name: v.string(), parent: v.nullable(v.string()),
  pos: v.tuple([v.number(), v.number(), v.number()]) })) }), JSON.parse(readFileSync('art/driftwood-isle/approved-puffer/unaccepted-native-v23.json', 'utf8')));
function rig(): { context: AnimalRigContext; bones: Record<string, Bone> } {
  const bones: Record<string, Bone> = {};
  for (const def of native.bones) {
    const bone = new Bone(); bone.name = def.name; bone.position.fromArray(def.pos);
    if (def.parent !== null) {
      const parent = bones[def.parent], rest = native.bones.find(row => row.name === def.parent);
      if (parent === undefined || rest === undefined) throw new Error('Missing native parent');
      bone.position.sub(new Vector3(...rest.pos)); parent.add(bone);
    }
    bones[def.name] = bone;
  }
  const mem = {}, position = new Vector3();
  return { bones, context: { bones,
    // Schema-only context numbers. No collision is constructed or approved by these pose tests.
    dims: { bodyY: native.bones[0]?.pos[1] ?? 0, bodyHalfLen: 0, bodyRadius: 0, headRadius: 0, legLen: 0, feet: [], halfWidth: 0 },
    dt: 1 / 60, t: 0, seed: .7, scale: 1, speed: 0, strafe: 0, phase: 0, state: 'attack', alive: true,
    deathT: -1, flinch: 0, brace: 0, attack: -1, lookTarget: new Vector3(), lookWeight: 0,
    position, yaw: 0, mem, animal: { mem, position, yOffset: 0 } } };
}

test.each<[PufferPreviewPose, number]>([['rest', 1], ['inflate-105', 1.05], ['inflate-110', 1.1]])('%s preserves actual head bind-local while inheriting belly scale', (mode, scale) => {
  const { context, bones } = rig();
  const head = bones['head'], belly = bones['belly'];
  if (head === undefined || belly === undefined) throw new Error('Missing native sockets');
  const local = head.position.clone();
  expect(native.bones.findIndex(row => row.name === 'head')).toBe(7);
  const pose = pufferNativeClips(mode);
  expect(pose.programs.flatMap(row => row.numeric?.outputs.map(output => output.target) ?? [])).toEqual(['joint.belly', 'joint.belly', 'joint.belly']);
  numericCreaturePose(pose)(context);
  expect(head.position.toArray()).toEqual(local.toArray());
  expect(head.scale.toArray()).toEqual([1, 1, 1]); expect(head.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
  expect(belly.scale.toArray()).toEqual([scale, scale, scale]);
  const anchor = belly.getWorldPosition(new Vector3());
  expect(head.getWorldPosition(new Vector3()).distanceTo(anchor.clone().addScaledVector(local, scale))).toBeLessThan(1e-7);
  expect(bones['body']?.position.y).toBeCloseTo(.7, 6);
});

test('attack diagnostics retain the full strike clock with at most ten percent swell and no legacy head motion', () => {
  const { context, bones } = rig(), animate = numericCreaturePose(pufferNativeClips('attack'));
  context.mem['puffer-st'] = 1;
  for (const clock of [0, .4, .85, .9, 1.1, 1.4, 2.1]) {
    context.mem['regular-clock'] = clock; animate(context);
    const scale = bones['belly']?.scale.x ?? Number.NaN;
    expect(scale).toBeGreaterThanOrEqual(1); expect(scale).toBeLessThanOrEqual(1.1);
    if (clock === .85 || clock === .9) expect(scale).toBeCloseTo(1.1);
    if (clock === 0 || clock >= 1.4) expect(scale).toBeCloseTo(1);
  }
  context.mem['puffer-st'] = 2; context.mem['regular-clock'] = .85; animate(context);
  expect(bones['belly']?.scale.x).toBe(1);
});

test('isolated source contains only the Puffer guest and named native pose without importing the old body bake', () => {
  const source = createPufferPreviewSource();
  expect(source.runtime?.spawns?.actors?.map(row => row.kind)).toEqual(['brine-puffer']);
  expect(source.state.shared.map(row => row.name)).toEqual(['puffer-st', 'regular-clock']);
  expect(PUFFER_PREVIEW_DECISION_MEMORY).toBe(131072);
  const output = createPufferPreviewOutput({ diagnosticOnly: true }, 'rest');
  expect(output.namedFiles?.map(row => row.name)).toEqual(['poses/brine-puffer.json', 'practice/bodies.json', 'practice/looks.json', 'practice/pickups.json']);
  expect(output.platform?.sections.map(row => row.name).sort()).toEqual(['actors/moves', 'actors/species-programs', 'actors/strikes', 'held/arms', 'sim/scripts']);
});
