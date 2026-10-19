// oxlint-disable-next-line import/no-nodejs-modules -- Exact authored rig fixture, no renderer or browser.
import { readFileSync } from 'node:fs';
import { Bone, Vector3 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { mantisPhaseClips, MANTIS_NATIVE_JOINTS } from '../src/shards/driftwood-isle/generators/mantisPhaseClips';
import { createMantisPhasePreviewOutput, createMantisPhasePreviewSource, MANTIS_PHASE_PREVIEW_DECISION_MEMORY } from '../src/shards/driftwood-isle/generators/mantisPhasePreview';

const native = v.parse(v.object({ bones: v.array(v.strictObject({ name: v.string(), parent: v.nullable(v.string()),
  pos: v.tuple([v.number(), v.number(), v.number()]) })) }), JSON.parse(readFileSync('art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/mantis-v7-native.json', 'utf8')));
function rig(): { context: AnimalRigContext; bones: Record<string, Bone> } {
  const bones: Record<string, Bone> = {};
  for (const def of native.bones) {
    const joint = new Bone(); joint.name = def.name; joint.position.fromArray(def.pos);
    if (def.parent !== null) {
      const parent = bones[def.parent], rest = native.bones.find(row => row.name === def.parent);
      if (parent === undefined || rest === undefined) throw new Error('Missing native parent');
      joint.position.sub(new Vector3(...rest.pos)); parent.add(joint);
    }
    bones[def.name] = joint;
  }
  const mem = {}, position = new Vector3();
  return { bones, context: { bones,
    dims: { bodyY: native.bones[0]?.pos[1] ?? 0, bodyHalfLen: 0, bodyRadius: 0, headRadius: 0, legLen: 0, feet: [], halfWidth: 0 },
    dt: 1 / 60, t: 0, seed: .7, scale: 1, speed: 0, strafe: 0, phase: 0, state: 'attack', alive: true,
    deathT: -1, flinch: 0, brace: 0, attack: -1, lookTarget: new Vector3(), lookWeight: 0,
    position, yaw: 0, mem, animal: { mem, position, yOffset: 0 } } };
}
function bone(bones: Record<string, Bone>, name: string): Bone {
  const result = bones[name]; if (result === undefined) throw new Error(`Missing ${name}`); return result;
}

test('all authored 22 joints are addressed with exact normalized names and bind geometry is untouched at rest', () => {
  expect(MANTIS_NATIVE_JOINTS).toEqual(native.bones.map(row => row.name));
  const clips = mantisPhaseClips(), { context, bones } = rig();
  expect(new Set(clips.programs.flatMap(row => row.numeric?.outputs.map(out => out.target) ?? [])))
    .toEqual(new Set(native.bones.map(row => `joint.${row.name.replaceAll('_', '.')}`)));
  const binds = Object.fromEntries(Object.entries(bones).map(([name, value]) => [name, value.position.toArray()]));
  numericCreaturePose(clips)(context);
  for (const [name, value] of Object.entries(bones)) {
    expect(value.position.toArray()).toEqual(binds[name]);
    expect(value.rotation.x).toBeCloseTo(0); expect(value.rotation.y).toBeCloseTo(0); expect(value.rotation.z).toBeCloseTo(0);
    expect(value.scale.toArray()).toEqual([1, 1, 1]);
  }
});

test('idle and diagonal four-leg gait are real nonzero native joint transforms', () => {
  const { context, bones } = rig(), animate = numericCreaturePose(mantisPhaseClips());
  context.t = .5; animate(context); expect(bone(bones, 'neck').rotation.x).toBeGreaterThan(0);
  context.speed = 1; context.phase = .25; animate(context);
  expect(bone(bones, 'leg-1_0').rotation.x).toBeCloseTo(.08);
  expect(bone(bones, 'leg1_1').rotation.x).toBeCloseTo(.08);
  expect(bone(bones, 'leg-1_1').rotation.x).toBeCloseTo(-.08);
  expect(bone(bones, 'leg1_0').rotation.x).toBeCloseTo(-.08);
  expect(bone(bones, 'leg-1_0_knee').rotation.z).toBeCloseTo(-.09);
  expect(bone(bones, 'leg1_1_knee').rotation.z).toBeCloseTo(.09);
});

test.each([[1, -1, .75, .12], [3, 1, .45, 1.1]])('stage %s uses authoritative phases and holds cut throughout variable-duration active lane', (stage, side, windup, recover) => {
  const { context, bones } = rig(), animate = numericCreaturePose(mantisPhaseClips());
  context.mem['mantis-st'] = stage; context.mem['mantis-pose-phase'] = 1; context.mem['mantis-pose-clock'] = windup * .9;
  animate(context); expect(bone(bones, `raptor${side}`).rotation.x).toBeCloseTo(-.45);
  expect(bone(bones, `raptor${-side}`).rotation.x).toBeCloseTo(0);
  context.mem['mantis-pose-phase'] = 2; context.mem['mantis-pose-clock'] = .12; animate(context);
  expect(bone(bones, `raptor${side}`).rotation.x).toBeCloseTo(.65);
  expect(bone(bones, `raptor${side}_elbow`).rotation.x).toBeCloseTo(-.65);
  context.mem['mantis-pose-clock'] = 10; animate(context);
  expect(bone(bones, `raptor${side}`).rotation.x).toBeCloseTo(.65);
  context.mem['mantis-pose-phase'] = 3; context.mem['mantis-pose-clock'] = recover; animate(context);
  expect(bone(bones, `raptor${side}`).rotation.x).toBeCloseTo(0);
});

test('interruption drops strike pose, flinch remains bounded, death settles and no clock can restart it', () => {
  const { context, bones } = rig(), animate = numericCreaturePose(mantisPhaseClips());
  context.mem['mantis-st'] = 2; context.mem['regular-clock'] = .85; context.flinch = 1; animate(context);
  expect(bone(bones, 'raptor-1').rotation.x).toBeCloseTo(-.1);
  expect(bone(bones, 'body').rotation.x).toBeCloseTo(-.12);
  context.alive = false; context.deathT = 1; context.mem['mantis-st'] = 5; animate(context);
  const final = Object.values(bones).map(value => value.rotation.toArray());
  expect(bone(bones, 'body').position.y).toBeCloseTo(context.dims.bodyY - .80);
  expect(bone(bones, 'body').rotation.z).toBeCloseTo(.60);
  context.t = 99; context.phase = .8; context.speed = 1; context.mem['mantis-st'] = 1; context.mem['regular-clock'] = .85;
  animate(context); expect(Object.values(bones).map(value => value.rotation.toArray())).toEqual(final);
});

test('pose sweep is finite and preserves all non-root bind translations and unit scale', () => {
  const { context, bones } = rig(), animate = numericCreaturePose(mantisPhaseClips());
  const binds = Object.fromEntries(Object.entries(bones).map(([name, value]) => [name, value.position.toArray()]));
  for (const stage of [0, 1, 2, 3, 5]) for (let i = 0; i <= 50; i++) {
    context.mem['mantis-st'] = stage; context.mem['regular-clock'] = i / 20;
    context.phase = i / 50; context.speed = .8; context.t = i / 20;
    context.deathT = stage === 5 ? i / 50 : -1; animate(context);
    for (const [name, value] of Object.entries(bones)) {
      expect([...value.position, ...value.rotation.toArray().slice(0, 3)].every(x => typeof x === 'number' && Number.isFinite(x))).toBe(true);
      if (name !== 'body') expect(value.position.toArray()).toEqual(binds[name]);
      expect(value.scale.toArray()).toEqual([1, 1, 1]);
    }
  }
});

test('isolated source keeps only Mantis, both real strikes and one decision, with no world progress', () => {
  const source = createMantisPhasePreviewSource();
  expect(source.runtime?.spawns?.actors?.map(row => row.kind)).toEqual(['splinter-mantis']);
  expect(source.runtime?.spawns?.homes).toEqual([]); expect(source.runtime?.spawns?.bosses).toEqual([]);
  expect(source.state.shared.map(row => row.name)).toEqual(['mantis-st', 'mantis-beat', 'regular-clock', 'mantis-pose-phase', 'mantis-pose-clock']);
  expect(MANTIS_PHASE_PREVIEW_DECISION_MEMORY).toBe(131072);
  const output = createMantisPhasePreviewOutput({ diagnosticOnly: true });
  expect(output.namedFiles?.map(row => row.name)).toEqual(['poses/splinter-mantis.json', 'practice/bodies.json', 'practice/looks.json', 'practice/pickups.json']);
  expect(output.platform?.sections.map(row => row.name).sort()).toEqual(['actors/moves', 'actors/species-programs', 'actors/strikes', 'held/arms', 'sim/scripts']);
  expect(source.quests).toEqual({ flags: [], quests: [], triggers: [], dialogue: [] });
  expect(source.encounters).toEqual([]); expect(source.ledger).toEqual([]);
});
