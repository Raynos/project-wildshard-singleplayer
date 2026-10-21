// oxlint-disable-next-line import/no-nodejs-modules -- Verify full byte-exact authored fixture identities in the commit mirror.
import { readFileSync, writeFileSync } from 'node:fs';
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
import { groups } from '../src/engine/physics/groups';
import { ragdollsFor } from '../src/engine/physics/ragdoll';
import { rigidCorpseBodyDescriptor } from '../src/engine/physics/rigidCorpse';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
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
async function fixture() {
  const scope = new Scope('keelmaw-native-owner1'), events = new Events(), combat = new CombatPipeline(events, scope);
  const outside = createSimHost({ ...SIM_LEVEL, entities: [], quests: [], ground: { size: 100, height: 900 }, player: { at: { x: 0, y: 900, z: 2 }, yaw: 0, speed: 0 } },
    { scope, rapier: await loadRapier(decode(rapierUrl)) });
  outside.player.position.set(0, 900, 2);
  const loader = packedCreatureBodies(metadata, undefined, () => Promise.resolve(Uint8Array.from(readFileSync(`${folder}/payload.bin`))));
  await loader.preload(); const packed = loader.copy('keelmaw', 'keelmaw');
  const hulls = v.parse(rigidCorpseSchema, packed.dims.rigidCorpse);
  // Decode actual packed skin attributes, not an inferred owner by mesh name.
  const skin: { local: Vector3; bone: number }[] = [];
  for (const part of [...packed.hardParts, ...packed.eyeParts, ...packed.furParts]) {
    const positions=part.getAttribute('position'), indices=part.getAttribute('skinIndex'), weights=part.getAttribute('skinWeight');
    for(let i=0;i<positions.count;i++) {
      expect(weights.getX(i)).toBe(1);expect([weights.getY(i),weights.getZ(i),weights.getW(i)]).toEqual([0,0,0]);
      const bone=indices.getX(i), bind=source.bones[bone];if(bind===undefined)throw new Error('Missing packed bind');
      skin.push({local:new Vector3().fromBufferAttribute(positions,i).sub(new Vector3(...bind.pos)),bone});
    }
    part.dispose();
  }
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
    species, recipe, pose: motion, corpse: 'rigid-held',
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
  return { scope, native, outside, damage, render, tick, hit, hulls, skin, events };
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
  return Object.values(frame.bones).flatMap(bone => bone.position.toArray().concat(bone.rotation.x, bone.rotation.y, bone.rotation.z, bone.scale.toArray())).map(value => value === 0 ? 0 : value);
}


function corpseBody(f: Awaited<ReturnType<typeof fixture>>) {
  const bodies: ReturnType<typeof f.outside.physics.world.getRigidBody>[]=[];
  f.outside.physics.world.forEachRigidBody(body=>{if(body.numColliders()===7)bodies.push(body);});
  expect(bodies).toHaveLength(1);const body=bodies[0];if(body===undefined)throw new Error('Missing seven-group body');return body;
}
function packedMinimum(f: Awaited<ReturnType<typeof fixture>>, frame: ReturnType<typeof f.render>) {
  const transforms=matrices(frame);let lowest=Infinity;
  for(const point of f.skin){const transform=transforms[point.bone];if(transform===undefined)throw new Error('Missing packed owner');lowest=Math.min(lowest,point.local.clone().applyMatrix4(transform).y);}
  return lowest;
}
test('WIP source identity and unchanged convex budget are pinned, not an exact occupied-geometry claim',async()=>{
 const f=await fixture();try{
  const pins=v.parse(v.object({ files:v.record(v.string(),v.object({sha256:v.string(),bytes:v.number()})) }),JSON.parse(readFileSync(`${folder}/origin.json`,'utf8')));
  for(const [name,pin] of Object.entries(pins.files)){const bytes=readFileSync(`${folder}/${name}`);expect(bytes.length).toBe(pin.bytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(pin.sha256);}
  expect(f.hulls.parts).toHaveLength(7);expect(f.hulls.parts.reduce((sum,part)=>sum+part.points.length,0)).toBe(459);
  expect(f.hulls.parts.every(part=>part.points.length<=128)).toBe(true);
 }finally{f.scope.dispose();}
});
test('WORLD overlap refuses before health, death, reward or allocation mutation, with no stale broadphase exemption',async()=>{
 const f=await fixture();try{
  const physics=f.outside.physics,obstacle=physics.world.createCollider(physics.R.ColliderDesc.cuboid(.3,.5,.3).setTranslation(8,901,0).setCollisionGroups(groups('WORLD')));
  physics.step();obstacle.setTranslation({x:0,y:901,z:0});
  const before=f.native.snapshot(),motor=f.native.actor.motor,bodies=physics.world.bodies.len(),colliders=physics.world.colliders.len();let hits=0,deaths=0;
  f.events.on('damage.dealt',()=>{hits++;},f.scope);f.events.on('actor.died',()=>{deaths++;},f.scope);
  expect(f.hit(1000)).toBeNull();f.events.flush('update');expect([hits,deaths]).toEqual([0,0]);expect(f.native.snapshot()).toEqual(before);expect(f.native.actor.hp).toBe(180);expect(f.native.actor.motor).toBe(motor);
  expect(physics.world.bodies.len()).toBe(bodies);expect(physics.world.colliders.len()).toBe(colliders);expect(ragdollsFor(physics).reserved).toBe(1);
  obstacle.setTranslation({x:8,y:901,z:0});expect(f.hit(1000)?.killed).toBe(true);
 }finally{f.scope.dispose();}
});
test.each(['body','collider','activation'] as const)('%s fault rolls back without consuming admission or publishing lethal state',async(stage)=>{
 const f=await fixture();try{
  const physics=f.outside.physics,before=f.native.snapshot(),bodies=physics.world.bodies.len(),colliders=physics.world.colliders.len();
  const create=physics.world.createRigidBody.bind(physics.world);
  const fault=stage==='collider'?vi.spyOn(physics.world,'createCollider').mockImplementationOnce(()=>{throw new Error('held fault');}):
   vi.spyOn(physics.world,'createRigidBody').mockImplementationOnce(desc=>{if(stage==='body')throw new Error('held fault');const body=create(desc),enable=body.setEnabled.bind(body);vi.spyOn(body,'setEnabled').mockImplementationOnce(on=>{enable(on);throw new Error('held fault');});return body;});
  expect(()=>f.hit(1000)).toThrow('held fault');fault.mockRestore();expect(f.native.snapshot()).toEqual(before);expect(f.native.actor.hp).toBe(180);
  expect(physics.world.bodies.len()).toBe(bodies);expect(physics.world.colliders.len()).toBe(colliders);expect(ragdollsFor(physics).reserved).toBe(1);expect(f.hit(1000)?.killed).toBe(true);
 }finally{f.scope.dispose();}
});
test('held local ownership survives sleeping and wake with the same reservation until idempotent disposal',async()=>{
 const f=await fixture();try{
  const system=ragdollsFor(f.outside.physics),old=f.native.actor.motor;if(!(old instanceof CharacterMotor))throw new Error('Missing motor');
  const lethal=locals(f.render());expect(f.hit(1000)?.killed).toBe(true);expect(old.collider.isEnabled()).toBe(false);const body=corpseBody(f);
  expect(body.isDynamic()).toBe(true);for(let i=0;i<7;i++){expect(body.collider(i).collisionGroups()).toBe(groups('DEBRIS'));expect(body.collider(i).solverGroups()).toBe(groups('DEBRIS'));}
  const animate=vi.spyOn(f.native.pose,'prepareCorpseStep');body.sleep();
  for(let i=0;i<360;i++){f.tick();expect(locals(f.render(.5))).toEqual(lethal);expect(f.render().root.position.toArray()).toEqual(Object.values(body.translation()));}
  expect(animate).not.toHaveBeenCalled();expect(body.isValid()).toBe(true);expect(body.isSleeping()).toBe(true);expect(system.occupied).toBe(1);expect(system.live).toBe(1);expect(f.native.corpse?.diagnostic().resource).toBe('live');
  body.wakeUp();f.tick();expect(body.isValid()).toBe(true);expect(system.occupied).toBe(1);
  f.native.dispose();f.native.dispose();expect(body.isValid()).toBe(false);expect(system.occupied).toBe(0);
 }finally{f.scope.dispose();}
});
test('one bounded actual Rapier four-phase proof: strict 5mm gate includes activation and first impact',async()=>{
 const trials=[];
 for(const lethalTick of [0,145,165,185]){
  const f=await fixture();try{
   for(let i=0;i<lethalTick;i++)f.tick();const phase=f.native.control.strikeState,lethal=locals(f.render()),root=f.render().root;
   const expected=rigidCorpseBodyDescriptor(f.outside.physics.R,{position:root.position,rotation:new Quaternion().setFromEuler(root.rotation),velocity:root.position.clone().sub(f.render(0).root.position).multiplyScalar(60),dir:new Vector3(.7,.2,-.5),damage:1000,scale:1,dims:f.native.actor.dims});
   expect(f.hit(1000)?.killed).toBe(true);const capturedJoints=f.native.pose.corpseJoints();const body=corpseBody(f);for(const axis of ['x','y','z'] as const){expect(body.linvel()[axis]).toBeCloseTo(expected.linvel[axis],5);expect(body.angvel()[axis]).toBeCloseTo(expected.angvel[axis],5);}
   const initial={linear:body.linvel(),angular:body.angvel(),mass:body.mass(),inertia:body.principalInertia()};const samples=[];let worst=Infinity;
   for(let tick=0;tick<=480;tick++){
    if(tick>0)f.tick();expect(f.native.pose.corpseJoints()).toEqual(capturedJoints);let hull=Infinity;
    for(let i=0;i<body.numColliders();i++){const collider=body.collider(i),vertices=collider.vertices();const q=new Quaternion().copy(collider.rotation()),p=collider.translation();for(let j=0;j<vertices.length;j+=3)hull=Math.min(hull,new Vector3().fromArray(vertices,j).applyQuaternion(q).add(p).y);}
    const renders=[0,.5,1].map(alpha=>{const frame=f.render(alpha);// Euler/quaternion interpolation round-trips within floating precision; numeric owner above stays bit-exact.
     locals(frame).forEach((value,index)=>expect(value).toBeCloseTo(lethal[index] ?? Infinity,12));const packed=packedMinimum(f,frame),original=minimum(frame);expect(Math.abs(packed-original)).toBeLessThan(1e-5);return {alpha,packed,original};});
    expect(f.render().root.position.toArray()).toEqual(Object.values(body.translation()));worst=Math.min(worst,hull,...renders.flatMap(row=>[row.packed,row.original]));
    samples.push({tick,hull,renders,sleeping:body.isSleeping(),root:body.translation()});
   }
   expect(ragdollsFor(f.outside.physics).occupied).toBe(1);f.native.dispose();expect(body.isValid()).toBe(false);expect(ragdollsFor(f.outside.physics).occupied).toBe(0);
   trials.push({lethalTick,phase,initial,worst,passesStrict5mm:worst>=899.995,samples});
   writeFileSync('test/proof/keelmaw-rigid-held-contact.json',`${JSON.stringify({complete:false,runtimeAcceptance:false,trials},null,2)}\n`);
  }finally{f.scope.dispose();}
 }
 writeFileSync('test/proof/keelmaw-rigid-held-contact.json',`${JSON.stringify({runtimeAcceptance:false,visualAcceptance:false,mode:'rigid-held',collision:'DEBRIS WORLD-only; not a player/creature/item obstacle',geometry:'Seven source-derived convex support groups bridge concavities; not exact occupied geometry',method:'Unchanged grounded source, real native attacks and lethal momentum, actual native hull plus original and packed skin vertices, activation through 480 fixed steps and alpha 0/.5/1, strict first-impact 5mm gate. No tuning.',trials},null,2)}\n`);
 console.info('Keelmaw rigid-held strict contact',JSON.stringify(trials.map(({samples:_samples,...trial})=>trial)));
 expect(trials.every(trial=>trial.passesStrict5mm)).toBe(true);
},120000);
