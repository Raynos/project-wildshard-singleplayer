import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { CombatPipeline } from '../src/engine/combat/pipeline';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import { prepareDecisionMemories } from '../src/engine/script/decisionModule';
import { packedCreatureBodies } from '../src/game/plugin/geometry';
import { PracticeNativeActor } from '../src/game/practice/PracticeNativeActor';
import { borrowedDecisionAuthority } from '../src/game/shardfile/borrowedDecisions';
import { createConchReadablePreviewSource } from '../src/shards/driftwood-isle/generators/conchReadablePreview';
import { DRIFTWOOD_REGULAR_SPECIES, DRIFTWOOD_REGULAR_MOVES, DRIFTWOOD_REGULAR_STRIKES } from '../src/shards/driftwood-isle/generators/driftwoodRegularCombat';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import rapierUrl from '../public/assets/physics/rapier.wasm?inline';
import metadata from './proof/conch-grounded-source/metadata.json' with { type: 'json' };
import source from './proof/conch-grounded-source/model.json' with { type: 'json' };
import payloadUrl from './proof/conch-grounded-source/payload.bin?inline';
import motion from './proof/conch-articulated-complete-motion/motion.json' with { type: 'json' };
import decision from './proof/conch-articulated-complete-motion/decision.json' with { type: 'json' };
import decisionUrl from './proof/conch-articulated-complete-motion/decision.wasm?inline';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { NativeCreaturePose, type NativeCreaturePoseRecipe } from '../src/game/plugin/animation';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import type { ClientChannelProgram } from '../src/format/clientChannels';

const recipe: NativeCreaturePoseRecipe = { custom: true, joints: [
  { name: 'body', parent: -1, position: [0, 1, 0], order: 'XYZ', scale: [1, 1, 1] },
  { name: 'head', parent: 0, position: [0, 1, 0], order: 'XYZ', scale: [1, 1, 1] },
] };
function actor() {
  return new AnimalSim({ kind: 'probe', label: 'Probe', variant: 'common', rarity: 'common', hp: 30, aggressive: true,
    dims: { bodyY: 1, bodyHalfLen: 1, bodyRadius: .4, headRadius: .3, legLen: 1, feet: [], halfWidth: .4 },
    mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 20, relentless: false } },
  1, 1, 'probe', { heightAt: () => 0, random: () => .5 });
}
function declaration() {
  const programs: ClientChannelProgram[] = [{ id: 'probe.head', reads: ['speed'],
    nodes: [{ op: 'constant', value: .6 }, { op: 'constant', value: .2 }, { op: 'add', a: 0, b: 1 }],
    channels: [{ property: 'x', value: 2 }],
    numeric: { group: 'probe', inputs: [{ input: 'speed', owner: 'frame', path: ['speed'] }], restoreOnly: [], outputs: [{ property: 'x', target: 'joint.head', path: ['rotation', 'x'] }] } }];
  return { group: 'probe', programs, states: ['idle'], scalars: [{ name: 'speed', path: ['speed'], fallback: 0 }] };
}
function pose(input: unknown, practice = false) {
  const native = new NativeCreaturePose(actor(), { ...recipe, ...(practice ? { practice: true } : {}) }, numericCreaturePose(input));
  if (practice) native.initializePractice();
  else { native.advance(.1, .1, true); native.publish(); }
  return native;
}
test.each([false, true])('identical detached numeric definitions restore across fresh evaluators, practice=%s', practice => {
  const input = { ...declaration(), ...(practice ? { practiceTransition: { owner: 'isolated-practice', joints: ['body', 'head'] } } : {}) };
  const a = pose(input, practice), b = pose(structuredClone(input), practice);
  b.restore(a.snapshot()); expect(b.snapshot()).toBe(a.snapshot());
  a.advance(.1, .2, true); b.advance(.1, .2, true); a.publish(); b.publish();
  expect(b.snapshot()).toBe(a.snapshot());
});
test.each(['constant', 'operation', 'channel', 'output', 'input', 'states', 'scalar'] as const)('changed %s refuses before any continuation mutation', change => {
  const input = declaration(), program = input.programs[0];
  if (program?.numeric === undefined) throw new Error('Missing program');
  if (change === 'constant') program.nodes[0] = { op: 'constant', value: .61 };
  if (change === 'operation') program.nodes[2] = { op: 'sub', a: 0, b: 1 };
  if (change === 'channel') program.channels[0] = { property: 'x', value: 1 };
  if (change === 'output') program.numeric.outputs[0] = { property: 'x', target: 'joint.head', path: ['rotation', 'y'] };
  if (change === 'input') program.numeric.inputs[0] = { input: 'speed', owner: 'frame', path: ['t'] };
  if (change === 'states') input.states.push('walk');
  if (change === 'scalar') input.scalars[0] = { name: 'speed', path: ['speed'], fallback: 1 };
  const a = pose(declaration()), b = pose(input), before = b.snapshot(), context = structuredClone(b.context.transition);
  expect(() => b.restore(a.snapshot())).toThrow('Incompatible native creature pose continuation');
  expect(b.snapshot()).toBe(before); expect(b.context.transition).toEqual(context);
});
test('caller mutations before first evaluation cannot change compiled behavior or identity', () => {
  const input = declaration(), animate = numericCreaturePose(input), program = input.programs[0];
  if (program === undefined) throw new Error('Missing program');
  program.nodes[0] = { op: 'constant', value: 99 }; input.states.push('walk'); input.scalars.length = 0;
  const a = new NativeCreaturePose(actor(), recipe, animate), b = pose(declaration());
  a.advance(.1, .1, true); a.publish(); expect(a.snapshot()).toBe(b.snapshot());
  a.restore(b.snapshot()); expect(a.bones['head']?.rotation.x).toBe(.8);
});
test('numeric v1 definitions refuse old unbound recipes while callback-only continuations remain unchanged', () => {
  const numeric = pose(declaration()), state = v.parse(v.record(v.string(), v.unknown()), JSON.parse(numeric.snapshot()));
  const identity = v.parse(v.record(v.string(), v.unknown()), JSON.parse(v.parse(v.string(), state['recipe'])));
  expect(identity['numericDefinition']).toMatch(/^numeric-creature-pose:v1:sha256:[a-f0-9]{64}$/u);
  delete identity['numericDefinition'];
  const before = numeric.snapshot();
  expect(() => numeric.restore(JSON.stringify({ ...state, recipe: JSON.stringify(identity) }))).toThrow('Incompatible');
  expect(numeric.snapshot()).toBe(before);
  const legacy = new NativeCreaturePose(actor(), recipe, () => undefined), fresh = new NativeCreaturePose(actor(), recipe, () => undefined);
  expect(legacy.snapshot()).not.toContain('numericDefinition'); fresh.restore(legacy.snapshot());
  expect(fresh.snapshot()).toBe(legacy.snapshot());
});

test('signed zero definitions remain distinct and object insertion order is immaterial', () => {
  const positive = declaration(), negative = declaration();
  const a = positive.programs[0], b = negative.programs[0];
  if (a === undefined || b === undefined) throw new Error('Missing programs');
  a.nodes[0] = { op: 'constant', value: 0 }; b.nodes[0] = { op: 'constant', value: -0 };
  const target = pose(negative), before = target.snapshot();
  expect(() => target.restore(pose(positive).snapshot())).toThrow('Incompatible');
  expect(target.snapshot()).toBe(before);
  const reordered = { scalars: positive.scalars, states: positive.states, programs: positive.programs, group: positive.group };
  expect(pose(reordered).snapshot()).toBe(pose(positive).snapshot());
});

// Actual packed eight-owner source and authored shoulder DAG, not a synthetic geometry identity.
test('actual Conch same-definition reload succeeds and changed shoulder denominator refuses atomically', async () => {
  const decode = (url: string) => Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), c => c.codePointAt(0) ?? 0);
  const conchRecipe: NativeCreaturePoseRecipe = { practice: true, custom: true, deathSplay: false, rootFlinch: 'authored-pose',
    joints: source.bones.map(bone => {
      const parent = source.bones.findIndex(row => row.name === bone.parent), p = source.bones[parent]?.pos;
      return { name: bone.name, parent, position: [(bone.pos[0] ?? 0) - (p?.[0] ?? 0), (bone.pos[1] ?? 0) - (p?.[1] ?? 0),
        (bone.pos[2] ?? 0) - (p?.[2] ?? 0)], order: 'XYZ', scale: [1, 1, 1] };
    }) };
  const scopes: InstanceType<typeof Scope>[] = [];
  const fixture = async (definition: typeof motion) => {
    const scope = new Scope('numeric-identity-conch'); scopes.push(scope);
    const events = new Events(), combat = new CombatPipeline(events, scope);
    const outside = createSimHost({ ...SIM_LEVEL, entities: [], quests: [], ground: { size: 100, height: 900 },
      player: { at: { x: 0, y: 900, z: 2 }, yaw: 0, speed: 0 } }, { scope, rapier: await loadRapier(decode(rapierUrl)) });
    outside.player.position.set(0, 900, 2);
    const loader = packedCreatureBodies(metadata, undefined, () => Promise.resolve(decode(payloadUrl)));
    await loader.preload(); const packed = loader.copy('conch-duelist', 'conch-duelist');
    for (const part of [...packed.hardParts, ...packed.eyeParts, ...packed.furParts]) part.dispose();
    await prepareDecisionMemories([1], scope);
    const species = DRIFTWOOD_REGULAR_SPECIES.find(row => row.kind === 'conch-duelist');
    if (species === undefined) throw new Error('Missing actual species');
    const sections = new Map<string, unknown>([['sim/scripts', decision],
      ['actors/moves', DRIFTWOOD_REGULAR_MOVES.filter(row => row.id === 'conch-duelist.stalk')],
      ['actors/strikes', DRIFTWOOD_REGULAR_STRIKES.filter(row => row.id.startsWith('strike.conch-duelist.'))]]);
    return new PracticeNativeActor({ scope, ports: { physics: outside.physics, player: outside.player, events, combat },
      spawn: { id: 'practice.conch-duelist', seed: 1, scale: 1, at: { x: 0, y: 900, z: 0 }, yaw: 0,
        spec: { kind: 'conch-duelist', label: 'Conch', variant: 'conch-duelist', rarity: 'uncommon', hp: 60, aggressive: true,
          dims: packed.dims, mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 14, relentless: false } } },
      species, recipe: conchRecipe, pose: definition,
      contactSurface: { id: 'practice-arena', revision: 1, active: true, y: 900, minX: -49.78, maxX: 49.78, minZ: -49.78, maxZ: 49.78 },
      decision: ports => borrowedDecisionAuthority(createConchReadablePreviewSource(),
        new Map([['2393ffa90be5023cc70b69978b4328579091e171481b06b2ad25c5e63affae02', decode(decisionUrl)]]), sections,
        { ...ports, flags: outside.flags }),
      observation: { calm: false, reach: () => true, claim: () => true, hurt: () => undefined } });
  };
  try {
    const changed = structuredClone(motion), constant = changed.programs[18]?.nodes.find(node => node.op === 'constant' && node.value === .6);
    if (constant === undefined) throw new Error('Missing actual thrust denominator'); constant.value = .61;
    const a = await fixture(motion), b = await fixture(structuredClone(motion)), c = await fixture(changed);
    const wire = a.pose.snapshot(), before = c.snapshot();
    expect(wire.length).toBeLessThan(65536); b.pose.restore(wire); expect(b.pose.snapshot()).toBe(wire);
    expect(() => c.pose.restore(wire)).toThrow('Incompatible native creature pose continuation');
    expect(c.snapshot()).toEqual(before);
  } finally { for (const scope of scopes) scope.dispose(); }
}, 60000);

test('unversioned restore and direct adoption cannot bypass numeric definition admission', () => {
  const numeric = pose(declaration()), before = numeric.snapshot();
  const local = numeric.snapshot('local');
  expect(() => numeric.restore(local)).toThrow('definition-bound');
  expect(() => numeric.adopt(JSON.parse(local))).toThrow('definition-bound');
  expect(numeric.snapshot()).toBe(before);
  const legacy = new NativeCreaturePose(actor(), recipe, () => undefined), fresh = new NativeCreaturePose(actor(), recipe, () => undefined);
  fresh.restore(legacy.snapshot('local')); expect(fresh.snapshot()).toBe(legacy.snapshot());
});
