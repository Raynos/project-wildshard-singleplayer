// oxlint-disable-next-line import/no-nodejs-modules -- Verify full byte-exact authored fixture identities in the commit mirror.
import { readFileSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exact fixture provenance, never runtime source loading.
import { createHash } from 'node:crypto';
import { beforeAll, expect, test } from 'vitest';
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
import { rigidCorpseSchema } from '../src/format/rigidCorpse';
import type { AnimalRigJoint } from '../src/engine/entities/animalRig';
import { compileDecisionScripts } from '../src/sdk/buildDecisionScripts';
import { buildDecisionRegistries } from '../src/format/decisionBindings';
import { parseDecisionScripts } from '../src/format/decisionScripts';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const folder = 'test/proof/keelmaw-native-owner/grounded';
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
async function fixture(corpse = false) {
  const scope = new Scope('keelmaw-native-owner1'), events = new Events(), combat = new CombatPipeline(events, scope);
  const outside = createSimHost({ ...SIM_LEVEL, entities: [], quests: [], ground: { size: 100, height: 900 }, player: { at: { x: 0, y: 900, z: 2 }, yaw: 0, speed: 0 } },
    { scope, rapier: await loadRapier(decode(rapierUrl)) });
  outside.player.position.set(0, 900, 2);
  const loader = packedCreatureBodies(metadata, undefined, () => Promise.resolve(Uint8Array.from(readFileSync(`${folder}/payload.bin`))));
  await loader.preload(); const packed = loader.copy('keelmaw', 'keelmaw');
  const hulls = v.parse(rigidCorpseSchema, packed.dims.rigidCorpse);
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
    species, recipe, pose: motion, ...(corpse ? { corpse: 'rigid' as const } : {}),
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
  return { scope, native, outside, damage, render, tick, hit, hulls };
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


test('complete new payload preserves all bytes from the full source producer', () => {
  const pins=v.parse(v.object({ files:v.record(v.string(),v.object({sha256:v.string(),bytes:v.number()})) }), JSON.parse(readFileSync(`${folder}/origin.json`,'utf8')));
  for(const [name,pin] of Object.entries(pins.files)) {
    const bytes=readFileSync(`${folder}/${name}`); expect(bytes.length).toBe(pin.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(pin.sha256);
  }
});

test('anatomical distal forearm taper clears the real living source without changing root or feet', async () => {
  const f=await fixture();
  try {
    expect(f.render().root.position.y).toBe(900); expect(minimum(f.render())).toBeCloseTo(900.005,6);
    for(let tick=0;tick<420;tick++) {
      f.tick();
      for(const alpha of [0,.5,1]) expect(minimum(f.render(alpha))).toBeGreaterThanOrEqual(899.995);
    }
    expect(f.damage).toContain(18);
  } finally { f.scope.dispose(); }
},60000);

test('real native corpse handoff preserves lethal skeleton and releases the living motor', async () => {
  const f=await fixture(true);
  try {
    for(let tick=0;tick<145;tick++) f.tick();
    const before=locals(f.render()); f.hit(1000); expect(locals(f.render())).toEqual(before);
    expect(f.native.actor.motor).toBeNull(); expect(f.native.corpse?.ownsRoot).toBe(true);
    const snapshot=f.native.snapshot(); for(let i=0;i<20;i++) f.render(i/20);
    expect(f.native.snapshot()).toEqual(snapshot);
    for(let tick=0;tick<480;tick++) f.tick();
    expect(f.native.corpse?.diagnostic().resource).toBe('frozen');
    expect(f.render().bones['jaw']?.rotation.x).toBeCloseTo(-.29,12);
  } finally { f.scope.dispose(); }
},60000);

test('record exact seven-hull physical contact at four lethal phases without assuming admission', async () => {
  const trials=[];
  for(const lethalTick of [0,145,165,185]) {
    const f=await fixture(true);
    try {
      for(let tick=0;tick<lethalTick;tick++) f.tick();
      const lethalPhase=f.native.control.strikeState; f.hit(1000);
      let fixedMinimum=Infinity,renderMinimum=Infinity,hullMinimum=Infinity;
      const samples=[];
      for(let tick=0;tick<480;tick++) {
        f.tick(); const fixed=minimum(f.render()),rendered=minimum(f.render(.5));
        fixedMinimum=Math.min(fixedMinimum,fixed);renderMinimum=Math.min(renderMinimum,rendered);
        const transforms=matrices(f.render());
        for(const part of f.hulls.parts) {
          const matrix=transforms[recipe.joints.findIndex(definition=>definition.name===part.bone)];
          if(matrix===undefined) throw new Error('Missing exact hull owner');
          for(const point of part.points) hullMinimum=Math.min(hullMinimum,new Vector3(...point).applyMatrix4(matrix).y);
        }
        samples.push({tick:tick+1,fixed,rendered,resource:f.native.corpse?.diagnostic().resource});
      }
      trials.push({lethalTick,lethalPhase,fixedMinimum,renderMinimum,hullMinimum,
        passesSampledFlatContact:Math.min(fixedMinimum,renderMinimum,hullMinimum)>=899.995,samples});
      expect(f.native.corpse?.diagnostic().resource).toBe('frozen');
    } finally { f.scope.dispose(); }
  }
  writeFileSync(`${folder}/contact-diagnostic.json`,`${JSON.stringify({runtimeAcceptance:false,visualAcceptance:false,
    method:'Actual PracticeNativeActor and NativeCorpseOwner, real generated grounded 19-bone skin, exact seven source hulls. Four lethal phases, 480 ticks each, fixed and alpha .5 all source vertices and fixed hull vertices. Unchanged solver, root and floor y900. Flat floor only.',
    trials},null,2)}\n`);
  expect(trials).toHaveLength(4);
  console.info('Keelmaw actual grounded contact',JSON.stringify(trials.map(({samples: _samples,...trial})=>trial)));
},60000);

test('grounding changes only the two distal front-forearm meshes and adds exact support, not binds or feet', () => {
  const original=v.parse(v.object({bones:v.array(v.unknown()),parts:v.array(v.object({name:v.string(),positions:v.array(v.number()),colorsLinear:v.array(v.number()),skinIndices:v.array(v.number()),skinWeights:v.array(v.number()),furLen:v.array(v.number())}))}),
    JSON.parse(readFileSync('test/proof/keelmaw-native-owner/refined/native-source.json','utf8')));
  const grounded=v.parse(v.object({bones:v.array(v.unknown()),parts:v.array(v.object({name:v.string(),positions:v.array(v.number()),colorsLinear:v.array(v.number()),skinIndices:v.array(v.number()),skinWeights:v.array(v.number()),furLen:v.array(v.number())}))}),
    JSON.parse(readFileSync(`${folder}/native-source.json`,'utf8')));
  expect(grounded.bones).toEqual(original.bones);
  for(const part of grounded.parts) {
    const prior=original.parts.find(value=>value.name===part.name); if(prior===undefined) throw new Error('Missing preserved source part');
    if(['FL_carpus','FR_carpus'].includes(part.name)) {
      expect(part.positions).not.toEqual(prior.positions);
      expect(part.colorsLinear).toEqual(prior.colorsLinear);expect(part.skinIndices).toEqual(prior.skinIndices);
      expect(part.skinWeights).toEqual(prior.skinWeights);expect(part.furLen).toEqual(prior.furLen);
    } else expect(part).toEqual(prior);
  }
});
