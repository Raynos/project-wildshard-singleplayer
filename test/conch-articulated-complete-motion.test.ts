// oxlint-disable-next-line import/no-nodejs-modules -- Verify full byte-exact authored fixture identities in the commit mirror.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- SHA-256 source identities are exact file contracts.
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { CombatPipeline } from '../src/engine/combat/pipeline';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import rapierUrl from '../public/assets/physics/rapier.wasm?inline';
import { prepareDecisionMemories } from '../src/engine/script/decisionModule';
import { packedCreatureBodies } from '../src/game/plugin/geometry';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import type { NativeCreaturePoseRecipe } from '../src/game/plugin/animation';
import { borrowedDecisionAuthority } from '../src/game/shardfile/borrowedDecisions';
import { PracticeNativeActor } from '../src/game/practice/PracticeNativeActor';
import { createConchReadablePreviewSource } from '../src/shards/driftwood-isle/generators/conchReadablePreview';
import { DRIFTWOOD_REGULAR_MOVES, DRIFTWOOD_REGULAR_STRIKES, DRIFTWOOD_REGULAR_SPECIES } from '../src/shards/driftwood-isle/generators/driftwoodRegularCombat';
import { rigidCorpseSchema } from '../src/format/rigidCorpse';
import type { AnimalRigJoint } from '../src/engine/entities/animalRig';
import { CONTACT_ARITHMETIC_BOUND } from '../src/game/plugin/practiceFootContact';
import metadata from './proof/conch-grounded-source/metadata.json' with { type: 'json' };
import source from './proof/conch-grounded-source/model.json' with { type: 'json' };
import hullInput from './proof/conch-grounded-source/recipe.json' with { type: 'json' };
import contactOnly from './proof/conch-grounded-source/motion.json' with { type: 'json' };
import payloadUrl from './proof/conch-grounded-source/payload.bin?inline';
import motion from './proof/conch-articulated-complete-motion/motion.json' with { type: 'json' };
import shoulder from './proof/conch-articulated-complete-motion/shoulder-authoring.json' with { type: 'json' };
import inputs from './proof/conch-articulated-complete-motion/inputs.json' with { type: 'json' };
import decisionInputs from './proof/conch-articulated-complete-motion/decision-inputs.json' with { type: 'json' };
import decision from './proof/conch-articulated-complete-motion/decision.json' with { type: 'json' };
import decisionUrl from './proof/conch-articulated-complete-motion/decision.wasm?inline';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const decode = (url: string) => Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), c => c.codePointAt(0) ?? 0);
const hulls = v.parse(rigidCorpseSchema, hullInput);
const recipe: NativeCreaturePoseRecipe = { practice: true, custom: true, deathSplay: false, rootFlinch: 'authored-pose',
  joints: source.bones.map(bone => {
    const parent = source.bones.findIndex(row => row.name === bone.parent), p = source.bones[parent]?.pos;
    return { name: bone.name, parent, position: [0, 1, 2].map(i => (bone.pos[i] ?? 0) - (p?.[i] ?? 0)) as [number, number, number], order: 'XYZ', scale: [1, 1, 1] };
  }) };
const joint = (): AnimalRigJoint => ({ position: new Vector3(), rotation: new Euler(), scale: new Vector3(1, 1, 1) });
async function fixture(corpse = false, declaration = motion) {
  const scope = new Scope('conch-complete1'), events = new Events(), combat = new CombatPipeline(events, scope);
  const outside = createSimHost({ ...SIM_LEVEL, entities: [], quests: [], ground: { size: 100, height: 900 }, player: { at: { x: 0, y: 900, z: 2 }, yaw: 0, speed: 0 } },
    { scope, rapier: await loadRapier(decode(rapierUrl)) });
  outside.player.position.set(0, 900, 2);
  const loader = packedCreatureBodies(metadata, undefined, () => Promise.resolve(decode(payloadUrl)));
  await loader.preload(); const packed = loader.copy('conch-duelist', 'conch-duelist');
  // Retain the loader-owned dims identity; the actual recipe is already declared in metadata.
  expect(packed.dims.rigidCorpse).toEqual(hulls);
  for (const part of [...packed.hardParts, ...packed.eyeParts, ...packed.furParts]) part.dispose();
  await prepareDecisionMemories([1], scope);
  const species = DRIFTWOOD_REGULAR_SPECIES.find(row => row.kind === 'conch-duelist');
  if (species === undefined) throw new Error('Missing real Conch species');
  const sections = new Map<string, unknown>([['sim/scripts', decision],
    ['actors/moves', DRIFTWOOD_REGULAR_MOVES.filter(row => row.id === 'conch-duelist.stalk')],
    ['actors/strikes', DRIFTWOOD_REGULAR_STRIKES.filter(row => row.id.startsWith('strike.conch-duelist.'))]]);
  const damage: number[] = [];
  const native = new PracticeNativeActor({ scope, ports: { physics: outside.physics, player: outside.player, events, combat },
    spawn: { id: 'practice.conch-duelist', seed: 1, scale: 1, at: { x: 0, y: 900, z: 0 }, yaw: 0,
      spec: { kind: 'conch-duelist', label: 'Conch', variant: 'conch-duelist', rarity: 'uncommon', hp: 60, aggressive: true,
        dims: packed.dims, mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 14, relentless: false } } },
    species, recipe, pose: declaration, ...(corpse ? { corpse: 'rigid' as const } : {}),
    contactSurface: { id: 'practice-arena', revision: 1, active: true, y: 900, minX: -49.78, maxX: 49.78, minZ: -49.78, maxZ: 49.78 },
    decision: ports => borrowedDecisionAuthority(createConchReadablePreviewSource(),
      new Map([['2393ffa90be5023cc70b69978b4328579091e171481b06b2ad25c5e63affae02', decode(decisionUrl)]]), sections,
      { ...ports, flags: outside.flags }),
    observation: { calm: false, reach: () => true, claim: () => true, hurt: value => { damage.push(value); } } });
  const render = (alpha = 1) => { const root = joint(), bones = Object.fromEntries(recipe.joints.map(row => [row.name, joint()]));
    native.pose.copyPublished(root, bones, alpha); return { root, bones }; };
  const tick = () => { native.preFixed(); outside.physics.step(); native.fixed(); };
  const hit = (amount: number) => combat.hit({ source: 'env', sourceTags: [], target: native.actor.combatActor(), amount,
    point: native.actor.position.clone().add(new Vector3(0, 1, 0)), dir: new Vector3(.7, .2, -.5) });
  return { scope, native, outside, damage, render, tick, hit };
}
function matrices(frame: ReturnType<Awaited<ReturnType<typeof fixture>>['render']>) {
  const result: Matrix4[] = [], root = new Matrix4().compose(frame.root.position, new Quaternion().setFromEuler(frame.root.rotation), frame.root.scale);
  for (const def of recipe.joints) {
    const local = frame.bones[def.name], parent = def.parent < 0 ? root : result[def.parent];
    if (local === undefined || parent === undefined) throw new Error('Missing actual joint');
    result.push(parent.clone().multiply(new Matrix4().compose(local.position, new Quaternion().setFromEuler(local.rotation), local.scale)));
  }
  return result;
}
function minimum(frame: ReturnType<Awaited<ReturnType<typeof fixture>>['render']>) {
  const transforms = matrices(frame); let lowest = Infinity;
  for (const [index, part] of source.parts.entries()) {
    const owner = hulls.parts[index]?.bone, boneIndex = recipe.joints.findIndex(row => row.name === owner);
    const bind = source.bones[boneIndex], transform = transforms[boneIndex];
    if (bind === undefined || transform === undefined) throw new Error('Missing real geometry owner');
    for (let i = 0; i < part.positions.length; i += 3) {
      const point = new Vector3().fromArray(part.positions, i).sub(new Vector3().fromArray(bind.pos)).applyMatrix4(transform);
      lowest = Math.min(lowest, point.y);
    }
  }
  return lowest;
}
function locals(frame: ReturnType<Awaited<ReturnType<typeof fixture>>['render']>) {
  return Object.values(frame.bones).flatMap(bone => bone.position.toArray().concat(bone.rotation.x, bone.rotation.y, bone.rotation.z, bone.scale.toArray()));
}
test('frozen eight-owner geometry, all eighteen exclusive leg lanes and only shoulder rotation added', () => {
  expect(() => numericCreaturePose(motion)).not.toThrow(); expect(motion.footContact).toEqual(contactOnly.footContact);
  expect(motion.programs.slice(0, 18)).toEqual(contactOnly.programs); expect(motion.programs).toHaveLength(21);
  expect(motion.programs.slice(18).flatMap(p => p.numeric.outputs.map(o => o.target))).toEqual(['joint.rapierArm', 'joint.rapierArm', 'joint.rapierArm']);
  expect(hulls.parts).toHaveLength(8); expect(hulls.parts.reduce((sum, p) => sum + p.points.length, 0)).toBe(333);
  for (const values of Object.values(shoulder.poses)) expect(values).toHaveLength(3);
});
test('real decision/strike owner runs windup, active and recovery with source-wide grounded geometry', async () => {
  const f = await fixture();
  try {
    const phases = new Set<string>();
    for (let tick = 0; tick < 180; tick++) {
      f.tick(); phases.add(f.native.control.strikeState);
      expect(f.native.pose.contactDiagnostic()?.current.failures).toEqual([]);
      for (const alpha of [0, .5, 1]) expect(minimum(f.render(alpha))).toBeGreaterThanOrEqual(900 - CONTACT_ARITHMETIC_BOUND);
    }
    expect([...phases]).toEqual(expect.arrayContaining(['windup', 'active', 'recover']));
    expect(f.damage).toContain(14);
  } finally { f.scope.dispose(); }
}, 60000);
test('real repeated zero-time hits and lethal endpoint preserve all exact locals', async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 20; i++) f.tick();
    const before = locals(f.render()); f.hit(1); expect(locals(f.render())).toEqual(before); f.hit(1); expect(locals(f.render())).toEqual(before);
    f.tick(); const entry = locals(f.render()); f.hit(1000); expect(locals(f.render())).toEqual(entry);
    expect(f.native.pose.contactDiagnostic()?.current.feet.every(foot => foot.mode === 'released')).toBe(true);
    for (let i = 0; i < 65; i++) f.tick();
    const frozen = locals(f.render()); for (let i = 0; i < 20; i++) f.tick(); expect(locals(f.render())).toEqual(frozen);
  } finally { f.scope.dispose(); }
}, 60000);
test('actual eight-owner native physical-root handoff reaches authored endpoint without synthetic geometry', async () => {
  const f = await fixture(true);
  try {
    for (let i = 0; i < 15; i++) f.tick();
    const entry = locals(f.render()); f.hit(1000); expect(locals(f.render())).toEqual(entry);
    expect(f.native.actor.motor).toBeNull(); expect(f.native.corpse?.ownsRoot).toBe(true);
    const samples: { tick: number; skinMinimum: number; hullMinimum: number; root: number[]; resource: string | null | undefined }[] = [];
    for (let i = 0; i < 330; i++) {
      f.tick(); const frame = f.render(), transforms = matrices(frame); let hullMinimum = Infinity;
      for (const part of hulls.parts) {
        const transform = transforms[recipe.joints.findIndex(row => row.name === part.bone)];
        if (transform === undefined) throw new Error('Missing physical hull owner');
        for (const point of part.points) hullMinimum = Math.min(hullMinimum, new Vector3(...point).applyMatrix4(transform).y);
      }
      samples.push({ tick: i + 1, skinMinimum: minimum(frame), hullMinimum, root: frame.root.position.toArray(), resource: f.native.corpse?.diagnostic().resource });
    }
    const frozen = locals(f.render()); for (let i = 0; i < 20; i++) f.tick();
    const result = { scope: 'Actual NativeCorpseOwner plus original eight-owner source, one physics step per fixed pair',
      qualityAcceptance: false, geometrySha256: motion.footContact.source, parts: hulls.parts.length,
      floor: 900, arithmeticBound: CONTACT_ARITHMETIC_BOUND, samples,
      minimumSkin: Math.min(...samples.map(row => row.skinMinimum)), minimumHull: Math.min(...samples.map(row => row.hullMinimum)),
      localEndpointFrozen: JSON.stringify(locals(f.render())) === JSON.stringify(frozen), owner: f.native.corpse?.diagnostic() };
    writeFileSync('test/proof/conch-articulated-complete-motion/physical-diagnostic.json', `${JSON.stringify(result, null, 2)}\n`);
    expect(result.localEndpointFrozen).toBe(true);
    expect(result.owner?.resource).toBe('frozen');
    expect(result.minimumSkin).toBeGreaterThanOrEqual(900 - CONTACT_ARITHMETIC_BOUND);
    expect(result.minimumHull).toBeGreaterThanOrEqual(900 - CONTACT_ARITHMETIC_BOUND);
  } finally { f.scope.dispose(); }
}, 60000);
test('both real strike phase boundaries meet and quiet readers do not advance the owner', async () => {
  const f = await fixture();
  try {
    const saved = v.parse(v.record(v.string(), v.unknown()), JSON.parse(v.parse(v.string(), f.native.control.snapshot())));
    const state = v.parse(v.record(v.string(), v.unknown()), saved['strike']);
    const evaluate = (phase: string, index: number, elapsed: number) => {
      f.native.control.restore(JSON.stringify({ ...saved, strike: { ...state, phase,
        currentId: index === 0 ? null : `strike.conch-duelist.${index === 1 ? 'thrust' : 'counter'}`, elapsed } }));
      // Native pose initialization is the supported zero-time authoring observation boundary.
      f.native.pose.initializePractice(); return locals(f.render());
    };
    const near = (a: number[], b: number[]) => expect(Math.max(...a.map((x, i) => Math.abs(x - (b[i] ?? Infinity))))).toBeLessThan(1e-12);
    for (const [index, windup] of [[1, .6], [2, .45]] as const) {
      near(evaluate('idle', 0, 0), evaluate('windup', index, 0));
      near(evaluate('windup', index, windup), evaluate('active', index, 0));
      near(evaluate('active', index, .1), evaluate('recover', index, 0));
      near(evaluate('recover', index, .9), evaluate('cooldown', index, 0));
      near(evaluate('cooldown', index, 0), evaluate('idle', 0, 0));
    }
    const before = f.native.snapshot(); for (let i = 0; i < 20; i++) f.render(i % 3 / 2); expect(f.native.snapshot()).toEqual(before);
  } finally { f.scope.dispose(); }
}, 60000);

test('normal-tree fixtures preserve complete source bytes and available origin pins', () => {
  const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
  for (const [name, row] of Object.entries(inputs.files)) {
    const fixturePath = name.startsWith('source/') ? `${inputs.sharedSourceFixture}/${name.slice(7)}` : `test/proof/conch-articulated-complete-motion/${name}`;
    expect(hash(name === 'source/contract.json' ? 'test/proof/conch-articulated-complete-motion/contract.json' : fixturePath)).toBe(row.sha256);
    if (existsSync(row.origin)) expect(hash(row.origin)).toBe(row.sha256);
  }
  for (const row of decisionInputs) expect(hash(`test/proof/conch-articulated-complete-motion/${row.file}`)).toBe(row.sha256);
});

test('continuation refuses a different authored program even with the same packed geometry', async () => {
  const changed = structuredClone(motion);
  const program = changed.programs[18]; if (program === undefined) throw new Error('Missing shoulder program');
  const constant = program.nodes.find(node => node.op === 'constant' && node.value === .6);
  if (constant === undefined) throw new Error('Missing actual thrust windup constant');
  constant.value = .61;
  const a = await fixture(), b = await fixture(false, changed);
  try {
    const wire = a.native.pose.snapshot(), before = b.native.pose.snapshot();
    let refused = false;
    try { b.native.pose.restore(wire); } catch { refused = true; }
    writeFileSync('test/proof/conch-articulated-complete-motion/program-identity-diagnostic.json', `${JSON.stringify({
      source: motion.footContact.source, change: 'Actual thrust windup denominator .6 -> .61; packed source and contact declaration identical',
      refused, targetUnchanged: b.native.pose.snapshot() === before, qualityAcceptance: false }, null, 2)}\n`);
    expect(refused, 'Packed geometry provenance does not establish motion program identity').toBe(true);
    expect(b.native.pose.snapshot()).toBe(before);
  } finally { a.scope.dispose(); b.scope.dispose(); }
}, 60000);
