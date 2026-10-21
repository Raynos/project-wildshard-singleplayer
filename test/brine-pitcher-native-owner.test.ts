// oxlint-disable-next-line import/no-nodejs-modules -- Verify full byte-exact authored fixture identities in the commit mirror.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- SHA-256 source identities are exact file contracts.
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
import { createBrinePitcherNativePreviewSource } from '../src/shards/driftwood-isle/generators/brinePitcherNativePreview';
import { brinePitcherNativeOwnerClips } from '../src/shards/driftwood-isle/generators/brinePitcherNativeOwnerClips';
import { BRINE_PITCHER_NATIVE_OWNER_DECISIONS as BRINE_PITCHER_DECISIONS, BRINE_PITCHER_NATIVE_OWNER_STRIKES as BRINE_PITCHER_STRIKES, BRINE_PITCHER_NATIVE_OWNER_SPECIES as BRINE_PITCHER_SPECIES } from '../src/shards/driftwood-isle/generators/brinePitcherNativeOwnerCombat';
import { rigidCorpseSchema } from '../src/format/rigidCorpse';
import type { AnimalRigJoint } from '../src/engine/entities/animalRig';
import { compileDecisionScripts } from '../src/sdk/buildDecisionScripts';
import { buildDecisionRegistries } from '../src/format/decisionBindings';
import { readCreatureStrikes } from '../src/format/creatures';
import { parseDecisionScripts } from '../src/format/decisionScripts';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const folder = 'test/proof/brine-pitcher-native-owner/source';
const metadata: unknown = JSON.parse(readFileSync(`${folder}/core-runtime-study/metadata.json`, 'utf8'));
const source = v.parse(v.object({ bones: v.array(v.object({ name: v.string(), parent: v.nullable(v.string()), pos: v.tuple([v.number(),v.number(),v.number()]) })), parts: v.array(v.object({ name: v.string(), positions: v.array(v.number()) })) }), JSON.parse(readFileSync(`${folder}/v3/native-source.json`, 'utf8')));
const recipe: NativeCreaturePoseRecipe = { practice: true, custom: true, deathSplay: false, rootFlinch: 'authored-pose',
  joints: source.bones.map(bone => {
    const parent = source.bones.findIndex(row => row.name === bone.parent), p = source.bones[parent]?.pos;
    return { name: bone.name, parent, position: [0, 1, 2].map(i => (bone.pos[i] ?? 0) - (p?.[i] ?? 0)) as [number, number, number], order: 'XYZ', scale: [1, 1, 1] };
  }) };
const motion = brinePitcherNativeOwnerClips();
test('native pose compiles under unchanged expression caps', () => { expect(() => numericCreaturePose(motion)).not.toThrow(); });
const decode = (url: string) => Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), c => c.codePointAt(0) ?? 0);
let compiled: Awaited<ReturnType<typeof compileDecisionScripts>>;
beforeAll(async () => {
  const catalogue = createBrinePitcherNativePreviewSource();
  compiled = await compileDecisionScripts(BRINE_PITCHER_DECISIONS,
    buildDecisionRegistries(catalogue, [], undefined, readCreatureStrikes(BRINE_PITCHER_STRIKES), parseDecisionScripts(BRINE_PITCHER_DECISIONS)),
    new Map(BRINE_PITCHER_DECISIONS.map(row => [row.source, readFileSync(`src/shards/driftwood-isle/${row.source}`, 'utf8')])), { asLineCeiling: 100 });
});
const joint = (): AnimalRigJoint => ({ position: new Vector3(), rotation: new Euler(), scale: new Vector3(1, 1, 1) });
async function fixture(corpse = false, declaration = motion) {
  const scope = new Scope('pitcher-native-owner1'), events = new Events(), combat = new CombatPipeline(events, scope);
  const outside = createSimHost({ ...SIM_LEVEL, entities: [], quests: [], ground: { size: 100, height: 900 }, player: { at: { x: 0, y: 900, z: 2 }, yaw: 0, speed: 0 } },
    { scope, rapier: await loadRapier(decode(rapierUrl)) });
  outside.player.position.set(0, 900, 2);
  const loader = packedCreatureBodies(metadata, undefined, () => Promise.resolve(Uint8Array.from(readFileSync(`${folder}/v3/payload.bin`))));
  await loader.preload(); const packed = loader.copy('brine-pitcher-matriarch', 'brine-pitcher-matriarch');
  // Retain the loader-owned dims identity; the actual recipe is already declared in metadata.
  const hulls = v.parse(rigidCorpseSchema, packed.dims.rigidCorpse); expect(hulls.parts).toHaveLength(7);
  for (const part of [...packed.hardParts, ...packed.eyeParts, ...packed.furParts]) part.dispose();
  await prepareDecisionMemories([1], scope);
  const species = BRINE_PITCHER_SPECIES.find(row => row.kind === 'brine-pitcher-matriarch');
  if (species === undefined) throw new Error('Missing real Pitcher species');
  const sections = new Map<string, unknown>([['sim/scripts', compiled.rows],
    ['actors/moves', []],
    ['actors/strikes', BRINE_PITCHER_STRIKES]]);
  const damage: number[] = [];
  const native = new PracticeNativeActor({ scope, ports: { physics: outside.physics, player: outside.player, events, combat },
    spawn: { id: 'practice.brine-pitcher-matriarch', seed: 1, scale: 1, at: { x: 0, y: 900, z: 0 }, yaw: 0,
      spec: { kind: 'brine-pitcher-matriarch', label: 'Pitcher', variant: 'brine-pitcher-matriarch', rarity: 'rare', hp: 150, aggressive: true,
        dims: packed.dims, mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 14, relentless: false } } },
    species, recipe, pose: declaration, ...(corpse ? { corpse: 'rigid' as const } : {}),
    contactSurface: { id: 'practice-arena', revision: 1, active: true, y: 900, minX: -49.78, maxX: 49.78, minZ: -49.78, maxZ: 49.78 },
    decision: ports => borrowedDecisionAuthority(createBrinePitcherNativePreviewSource(),
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
function minimumDetail(frame: ReturnType<Awaited<ReturnType<typeof fixture>>['render']>) {
  const transforms = matrices(frame); let lowest = Infinity, owner = '';
  for (const part of source.parts) {
    const boneIndex = recipe.joints.findIndex(row => row.name === part.name);
    const bind = source.bones[boneIndex], transform = transforms[boneIndex];
    if (bind === undefined || transform === undefined) throw new Error('Missing real geometry owner');
    for (let i = 0; i < part.positions.length; i += 3) {
      const point = new Vector3().fromArray(part.positions, i).sub(new Vector3().fromArray(bind.pos)).applyMatrix4(transform);
      if(point.y < lowest) { lowest=point.y; owner=part.name; }
    }
  }
  return { y: lowest, owner };
}
function minimum(frame: ReturnType<Awaited<ReturnType<typeof fixture>>['render']>) { return minimumDetail(frame).y; }
function locals(frame: ReturnType<Awaited<ReturnType<typeof fixture>>['render']>) {
  return Object.values(frame.bones).flatMap(bone => bone.position.toArray().concat(bone.rotation.x, bone.rotation.y, bone.rotation.z, bone.scale.toArray()));
}
test('real Pitcher decision executes both native attacks on the actual native owner', async () => {
 const f = await fixture();
 try {
  const steps = new Set<number>(); const phases = new Set<string>(); let damageCount = 0;
  for (let tick = 0; tick < 1100; tick++) {
   f.tick(); steps.add(f.native.actor.mem['pitcher-step'] ?? 0); phases.add(f.native.control.strikeState);
   expect(f.damage.length-damageCount).toBeLessThanOrEqual(1); damageCount=f.damage.length;
   for (const alpha of [0,.5,1]) expect(minimum(f.render(alpha))).toBeGreaterThanOrEqual(899.995);
  }
  expect([...steps]).toEqual(expect.arrayContaining([1,2]));
  expect([...phases]).toEqual(expect.arrayContaining(['windup','active','recover']));
  expect(f.damage).toEqual(expect.arrayContaining([16,11]));
 } finally { f.scope.dispose(); }
}, 60000);
test('zero-time hits and lethal handoff preserve the entire real skeleton; readers are quiet', async () => {
 const f = await fixture(true);
 try {
  for (let i=0;i<145;i++) f.tick();
  const before=locals(f.render()); f.hit(1); expect(locals(f.render())).toEqual(before); f.hit(1); expect(locals(f.render())).toEqual(before);
  f.tick(); const entry=locals(f.render()); f.hit(1000); expect(locals(f.render())).toEqual(entry);
  expect(f.native.actor.motor).toBeNull(); expect(f.native.corpse?.ownsRoot).toBe(true);
  const snapshot=f.native.snapshot(); for(let i=0;i<20;i++) { f.render(i/20); expect(f.native.snapshot()).toEqual(snapshot); }
  for(let i=0;i<330;i++) f.tick();
  const frozen=locals(f.render()); for(let i=0;i<20;i++) f.tick(); expect(locals(f.render())).toEqual(frozen);
  expect(f.native.corpse?.diagnostic().resource).toBe('frozen');
  expect(f.render().bones['head']?.rotation.x).toBeCloseTo(.4,12);
  expect(f.render().bones['headLid']?.rotation.x).toBeCloseTo(.85,12);
 } finally { f.scope.dispose(); }
},60000);
test('record actual seven-part physical contact at four lethal phases without promoting failed contact', async () => {
 const trials=[];
 for (const lethalTick of [0,145,280,420]) {
  const f=await fixture(true);
  try {
   for(let i=0;i<lethalTick;i++) f.tick();
   const step=f.native.actor.mem['pitcher-step']; f.hit(1000);
   let fixedMinimum=Infinity,renderMinimum=Infinity,hullMinimum=Infinity;
   const samples=[];
   for(let tick=0;tick<480;tick++) {
    f.tick(); const frame=f.render(), detail=minimumDetail(frame), fixed=detail.y,rendered=minimum(f.render(.5));
    fixedMinimum=Math.min(fixedMinimum,fixed); renderMinimum=Math.min(renderMinimum,rendered);
    const transforms=matrices(f.render());
    for(const part of f.hulls.parts) {
     const matrix=transforms[recipe.joints.findIndex(row=>row.name===part.bone)]; if(matrix===undefined) throw new Error('Missing hull');
     for(const point of part.points) hullMinimum=Math.min(hullMinimum,new Vector3(...point).applyMatrix4(matrix).y);
    }
    samples.push({tick:tick+1,fixed,rendered,lowestOwner:detail.owner,root:frame.root.position.toArray(),headRotation:frame.bones['head']?.rotation.x,lidRotation:frame.bones['headLid']?.rotation.x,resource:f.native.corpse?.diagnostic().resource});
   }
   trials.push({lethalTick,step,fixedMinimum,renderMinimum,hullMinimum,passesSampledFlatContact:Math.min(fixedMinimum,renderMinimum,hullMinimum)>=899.995,samples});
   expect(f.native.corpse?.diagnostic().resource).toBe('frozen');
  } finally { f.scope.dispose(); }
 }
 const pins=Object.fromEntries(['v3/native-source.json','v3/payload.bin','core-runtime-study/metadata.json'].map(path=>[path,createHash('sha256').update(readFileSync(`${folder}/${path}`)).digest('hex')]));
 mkdirSync('test/proof/brine-pitcher-native-owner',{recursive:true});
 writeFileSync('test/proof/brine-pitcher-native-owner/contact-diagnostic.json',`${JSON.stringify({runtimeAcceptance:false,visualAcceptance:false,method:'Actual PracticeNativeActor and NativeCorpseOwner. Unchanged seven exact source hulls. Four lethal phases, 480 fixed ticks each, fixed and alpha .5 full source vertices. Flat floor y900 only.',pins,trials},null,2)}\n`);
 expect(trials).toHaveLength(4);
},60000);
test('crown and bilateral tells match actual strike phase boundaries without a guest-memory clock',async()=>{
 const f=await fixture();
 try {
  const saved=v.parse(v.record(v.string(),v.unknown()),JSON.parse(v.parse(v.string(),f.native.control.snapshot())));
  const state=v.parse(v.record(v.string(),v.unknown()),saved['strike']);
  const evaluate=(id:string,phase:string,elapsed:number)=>{
   f.native.control.restore(JSON.stringify({...saved,strike:{...state,phase,currentId:id,elapsed}}));
   f.native.pose.initializePractice(); return f.render();
  };
  for(const row of BRINE_PITCHER_STRIKES){
   const endTell=locals(evaluate(row.id,'windup',row.windup));
   const startActive=locals(evaluate(row.id,'active',0));
   const endActive=locals(evaluate(row.id,'active',row.active));
   const startRecovery=locals(evaluate(row.id,'recover',0));
   expect(startActive).toEqual(endTell); expect(startRecovery).toEqual(endActive);
  }
  const crown=evaluate('strike.pitcher.crown','windup',1);
  expect(crown.bones['head']?.rotation.x).toBeLessThan(-.09);
  expect(Math.abs(crown.bones['leftHead']?.rotation.x ?? Infinity)).toBeLessThan(.03);
  expect(Math.abs(crown.bones['rightHead']?.rotation.x ?? Infinity)).toBeLessThan(.03);
  const sides=evaluate('strike.pitcher.bilateral','windup',.9);
  expect(sides.bones['leftHead']?.rotation.x).toBeLessThan(-.09);
  expect(sides.bones['rightHead']?.rotation.x).toBeLessThan(-.09);
  expect(Math.abs(sides.bones['head']?.rotation.x ?? Infinity)).toBeLessThan(.03);
  expect(BRINE_PITCHER_STRIKES.map(row=>row.damage)).toEqual([16,11]);
 }finally{f.scope.dispose();}
});
test('complete mirror fixtures retain exact origin hashes and compare originals when present',()=>{
 const origins=v.parse(v.array(v.object({file:v.string(),origin:v.string(),sha256:v.string(),bytes:v.number()})),JSON.parse(readFileSync(`${folder}/origins.json`,'utf8')));
 for(const row of origins){
  const bytes=readFileSync(`${folder}/${row.file}`); expect(bytes.length).toBe(row.bytes);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(row.sha256);
  if(existsSync(row.origin)) expect(readFileSync(row.origin)).toEqual(bytes);
 }
});
