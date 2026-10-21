// oxlint-disable-next-line import/no-nodejs-modules -- Verify full byte-exact authored fixture identities in the commit mirror.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exact fixture provenance, never runtime source loading.
import { createHash } from 'node:crypto';
import { beforeAll, expect, test, vi } from 'vitest';
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
import { createKeelmawNativeOwnerSource } from '../src/shards/driftwood-isle/generators/keelmawNativeOwnerSource';
import { keelmawNativeOwnerClips } from '../src/shards/driftwood-isle/generators/keelmawNativeOwnerClips';
import { KEELMAW_DECISIONS, KEELMAW_STRIKES, KEELMAW_SPECIES } from '../src/shards/driftwood-isle/generators/keelmawCombat';
import type { AnimalRigJoint } from '../src/engine/entities/animalRig';
import { compileDecisionScripts } from '../src/sdk/buildDecisionScripts';
import { buildDecisionRegistries } from '../src/format/decisionBindings';
import { parseDecisionScripts } from '../src/format/decisionScripts';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const folder = 'test/proof/keelmaw-native-owner/refined';
const metadata: unknown = JSON.parse(readFileSync(`${folder}/metadata.json`, 'utf8'));
const source = v.parse(v.object({ bones: v.array(v.object({ name: v.string(), parent: v.nullable(v.string()), pos: v.tuple([v.number(),v.number(),v.number()]) })), parts: v.array(v.object({ name: v.string(), positions: v.array(v.number()) })) }), JSON.parse(readFileSync(`${folder}/native-source.json`, 'utf8')));
const recipe: NativeCreaturePoseRecipe = { practice: true, custom: true, deathSplay: false, rootFlinch: 'authored-pose',
  joints: source.bones.map(bone => {
    const parent = source.bones.findIndex(row => row.name === bone.parent), p = source.bones[parent]?.pos;
    return { name: bone.name, parent, position: [0, 1, 2].map(i => (bone.pos[i] ?? 0) - (p?.[i] ?? 0)) as [number, number, number], order: 'XYZ', scale: [1, 1, 1] };
  }) };
const motion = keelmawNativeOwnerClips();
test('native pose compiles under unchanged expression caps', () => { expect(() => numericCreaturePose(motion)).not.toThrow(); });
const decode = (url: string) => Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), c => c.codePointAt(0) ?? 0);
let compiled: Awaited<ReturnType<typeof compileDecisionScripts>>;
beforeAll(async () => {
  const catalogue = createKeelmawNativeOwnerSource();
  compiled = await compileDecisionScripts(KEELMAW_DECISIONS,
    buildDecisionRegistries(catalogue, [], undefined, KEELMAW_STRIKES, parseDecisionScripts(KEELMAW_DECISIONS)),
    new Map(KEELMAW_DECISIONS.map(row => [row.source, readFileSync(`src/shards/driftwood-isle/${row.source}`, 'utf8')])), { asLineCeiling: 100 });
});
const joint = (): AnimalRigJoint => ({ position: new Vector3(), rotation: new Euler(), scale: new Vector3(1, 1, 1) });
async function fixture(declaration = motion) {
  const scope = new Scope('keelmaw-native-owner1'), events = new Events(), combat = new CombatPipeline(events, scope);
  const outside = createSimHost({ ...SIM_LEVEL, entities: [], quests: [], ground: { size: 100, height: 900 }, player: { at: { x: 0, y: 900, z: 2 }, yaw: 0, speed: 0 } },
    { scope, rapier: await loadRapier(decode(rapierUrl)) });
  outside.player.position.set(0, 900, 2);
  const loader = packedCreatureBodies(metadata, undefined, () => Promise.resolve(Uint8Array.from(readFileSync(`${folder}/payload.bin`))));
  await loader.preload(); const packed = loader.copy('keelmaw', 'keelmaw');
  for (const part of [...packed.hardParts, ...packed.eyeParts, ...packed.furParts]) part.dispose();
  await prepareDecisionMemories([1], scope);
  const species = KEELMAW_SPECIES.find(row => row.kind === 'keelmaw');
  if (species === undefined) throw new Error('Missing real Keelmaw species');
  const sections = new Map<string, unknown>([['sim/scripts', compiled.rows],
    ['actors/moves', []],
    ['actors/strikes', KEELMAW_STRIKES]]);
  const damage: number[] = [];
  const native = new PracticeNativeActor({ scope, ports: { physics: outside.physics, player: outside.player, events, combat },
    spawn: { id: 'practice.keelmaw', seed: 1, scale: 1, at: { x: 0, y: 900, z: 0 }, yaw: 0,
      spec: { kind: 'keelmaw', label: 'Keelmaw', variant: 'keelmaw', rarity: 'uncommon', hp: 180, aggressive: true,
        dims: packed.dims, mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 18, relentless: false } } },
    species, recipe, pose: declaration,
    contactSurface: { id: 'practice-arena', revision: 1, active: true, y: 900, minX: -49.78, maxX: 49.78, minZ: -49.78, maxZ: 49.78 },
    decision: ports => borrowedDecisionAuthority(createKeelmawNativeOwnerSource(),
      new Map(compiled.blobs.map(blob => [blob.file.hash, blob.bytes])), sections,
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
  for (const part of source.parts) {
    const boneIndex = recipe.joints.findIndex(row => row.name === part.name);
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

test('real refined 19-bone source runs a damaging native bite with one arena physics step', async () => {
  const f = await fixture();
  try {
    expect(recipe.joints).toHaveLength(19);
    const phases = new Set<string>(), steps = new Set<number>();
    const spy = vi.spyOn(f.outside.physics, 'step');
    f.native.fixed(); expect(spy).not.toHaveBeenCalled();
    for (let tick=0;tick<420;tick++) {
      f.tick(); phases.add(f.native.control.strikeState); steps.add(f.native.actor.mem['keelmaw-step'] ?? 0);
      for (const alpha of [0,.5,1]) expect(Number.isFinite(minimum(f.render(alpha)))).toBe(true);
    }
    expect([...phases]).toEqual(expect.arrayContaining(['windup','active','recover']));
    expect([...steps]).toEqual(expect.arrayContaining([0,1]));
    expect(f.damage.length).toBeGreaterThan(0); expect(f.damage.every(value => value === 18)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(420);
    expect(f.native.corpse).toBeUndefined();
  } finally { f.scope.dispose(); }
},60000);

test('out-of-range player is not hit and moving into real range starts the bite', async () => {
  const f = await fixture();
  try {
    f.outside.player.position.set(0,900,12);
    for (let i=0;i<240;i++) f.tick();
    expect(f.damage).toEqual([]); expect(f.native.control.strikeState).toBe('idle');
    f.outside.player.position.set(0,900,2);
    for (let i=0;i<180;i++) f.tick();
    expect(f.damage).toContain(18);
  } finally { f.scope.dispose(); }
},60000);

test('same-time repeated hits and death preserve all published joints without a reset idle frame', async () => {
  const f = await fixture();
  try {
    for (let i=0;i<145;i++) f.tick();
    const before = locals(f.render());
    f.hit(1); expect(locals(f.render())).toEqual(before);
    f.hit(1); expect(locals(f.render())).toEqual(before);
    f.tick(); const lethal = locals(f.render());
    f.hit(1000); expect(locals(f.render())).toEqual(lethal);
    expect(f.native.pose.context.transition?.ordinal).toBe(3);
    expect(f.native.pose.context.alive).toBe(false);
    const count = f.damage.length;
    for(let i=0;i<90;i++) f.tick();
    expect(f.damage).toHaveLength(count);
    expect(f.render().bones['jaw']?.rotation.x).toBeCloseTo(-.29,12);
    // No geometry-derived corpse exists in this refined source. Never substitute the rejected v1 hulls.
    expect(f.native.corpse).toBeUndefined();
  } finally { f.scope.dispose(); }
},60000);

test('render cadence never advances decision, damage, pose, RNG or owner clock', async () => {
  const run = async (reads: number) => {
    const f=await fixture(); const endpoints: string[]=[];
    try {
      for(let tick=0;tick<210;tick++) {
        f.tick();
        const snapshot=f.native.snapshot();
        for(let i=0;i<reads;i++) f.render((i%3)/2);
        expect(f.native.snapshot()).toEqual(snapshot);
        endpoints.push(JSON.stringify(snapshot));
      }
      return { endpoints, damage:f.damage };
    } finally { f.scope.dispose(); }
  };
  expect(await run(7)).toEqual(await run(0));
},60000);

test('native pose restore refuses a changed motion definition before mutating the live owner', async () => {
  const f=await fixture(); const changed=keelmawNativeOwnerClips();
  const node=changed.programs[0]?.nodes.find(value=>value.op==='constant' && value.value===.06);
  if(node?.op!=='constant') throw new Error('Missing actual bite amplitude');
  node.value=.061;
  const other=await fixture(changed);
  try {
    for(let tick=0;tick<140;tick++) f.tick();
    const before=other.native.snapshot();
    expect(()=>other.native.pose.restore(f.native.pose.snapshot())).toThrow();
    expect(other.native.snapshot()).toEqual(before);
  } finally { f.scope.dispose(); other.scope.dispose(); }
},60000);

test('disposed native owner releases its collider and does not advance on late callbacks', async () => {
  const f=await fixture();
  try {
    f.tick(); const tick=f.native.host.state.tick;
    const count=f.outside.physics.world.colliders.len();
    f.native.dispose();
    expect(f.outside.physics.world.colliders.len()).toBeLessThan(count);
    f.native.preFixed(); f.native.fixed();
    expect(f.native.host.state.tick).toBe(tick);
    expect(()=>f.native.snapshot()).toThrow('disposed');
  } finally { f.scope.dispose(); }
});

// A negative result is preserved as a blocker, not converted into contact admission.
test('refined retained source fails floor admission at rest without an invented root lift', async () => {
  const f=await fixture();
  try {
    expect(f.render().root.position.y).toBe(900);
    const restMinimum=minimum(f.render());
    expect(restMinimum).toBeCloseTo(899.918386,6);
    expect(restMinimum>=899.995).toBe(false);
    expect(f.native.actor.dims.rigidCorpse).toBeUndefined();
  } finally { f.scope.dispose(); }
});

test('complete retained refined fixtures preserve exact source identities', () => {
  const pins = v.parse(v.object({ files: v.record(v.string(),v.object({origin:v.string(),sha256:v.string(),bytes:v.number()})) }),
    JSON.parse(readFileSync(`${folder}/origin.json`,'utf8')));
  expect(Object.keys(pins.files).sort()).toEqual(['metadata.json','native-source.json','payload.bin']);
  for (const [name,pin] of Object.entries(pins.files)) {
    expect(pin.origin).toBe(`art/driftwood-isle/approved-keelmaw/complete-character-refined/model/${name}`);
    const bytes=readFileSync(`${folder}/${name}`);
    expect(bytes.length).toBe(pin.bytes); expect(createHash('sha256').update(bytes).digest('hex')).toBe(pin.sha256);
  }
});
