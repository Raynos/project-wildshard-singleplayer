import { snapshotSimHost, snapshotSimHostBytes } from '../src/engine/sim/snapshot';
import { practiceConvexBody } from '../src/game/practice/practiceConvexBody';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify full byte-exact authored fixture identities in the commit mirror.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test, vi } from 'vitest';
import { Euler, Matrix4, Quaternion, Vector3, Scene } from 'three';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { CombatPipeline } from '../src/engine/combat/pipeline';
import { makeSystem, systemFault, FAULT_BURST } from '../src/engine/core/faults';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import rapierUrl from '../public/assets/physics/rapier.wasm?inline';
import { prepareDecisionMemories } from '../src/engine/script/decisionModule';
import { packedCreatureBodies } from '../src/game/plugin/geometry';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { ragdollsFor } from '../src/engine/physics/ragdoll';
import { groups } from '../src/engine/physics/groups';
import { PracticeLoot } from '../src/game/practice/PracticeLoot';
import { app } from '../src/engine/app/runtime';
import { readLootTables, registerLootTable } from '../src/game/loot/tables';
import { BRINE_PITCHER_ROOTED_NATIVE_SELECTION } from '../src/shards/driftwood-isle/generators/brinePitcherRootedNativeOwner';
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
const decode = (url: string) => Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), c => c.codePointAt(0) ?? 0);
let compiled: Awaited<ReturnType<typeof compileDecisionScripts>>;
beforeAll(async () => {
  const catalogue = createBrinePitcherNativePreviewSource();
  compiled = await compileDecisionScripts(BRINE_PITCHER_DECISIONS,
    buildDecisionRegistries(catalogue, [], undefined, readCreatureStrikes(BRINE_PITCHER_STRIKES), parseDecisionScripts(BRINE_PITCHER_DECISIONS)),
    new Map(BRINE_PITCHER_DECISIONS.map(row => [row.source, readFileSync(`src/shards/driftwood-isle/${row.source}`, 'utf8')])), { asLineCeiling: 100 });
});
const joint = (): AnimalRigJoint => ({ position: new Vector3(), rotation: new Euler(), scale: new Vector3(1, 1, 1) });
async function fixture(declaration = motion, livingBodyBone?: string, withCorpse = true) {
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
  const damage: number[] = []; const initialBodies=outside.physics.world.bodies.len(), initialColliders=outside.physics.world.colliders.len();
  const native = new PracticeNativeActor({ scope, ports: { physics: outside.physics, player: outside.player, events, combat },
    spawn: { id: 'practice.brine-pitcher-matriarch', seed: 1, scale: 1, at: { x: 0, y: 900, z: 0 }, yaw: 0,
      spec: { kind: 'brine-pitcher-matriarch', label: 'Pitcher', variant: 'brine-pitcher-matriarch', rarity: 'rare', hp: 150, aggressive: true,
        dims: packed.dims, mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 14, relentless: false } } },
    species, recipe, pose: declaration, ...(livingBodyBone === undefined ? {} : { livingBodyBone }), ...(withCorpse ? { corpse: BRINE_PITCHER_ROOTED_NATIVE_SELECTION.corpse } : {}),
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
  return { scope, native, outside, damage, render, tick, hit, hulls, events, initialBodies, initialColliders };
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
test.each([0,145,280,420])('held rooted death at tick %s preserves every source vertex, one fixed obstacle and its occupied slot',async(lethalTick)=>{
 const f=await fixture(); const system=ragdollsFor(f.outside.physics);
 try {
  for(let i=0;i<lethalTick;i++) f.tick();
  const before=locals(f.render()),root=f.render().root.position.clone(),damage=f.damage.length;
  const body=f.native.actor.motor;if(!(body instanceof CharacterMotor))throw new Error('Missing native motor');
  f.hit(1000); expect(locals(f.render())).toEqual(before); expect(f.native.actor.motor).toBeNull();
  expect(body.collider.isEnabled()).toBe(false); expect(system.occupied).toBe(1);
  for(let tick=0;tick<360;tick++){
   f.tick(); for(const alpha of [0,.5,1]){
    const frame=f.render(alpha);expect(locals(frame)).toEqual(before);expect(frame.root.position).toEqual(root);
    expect(minimum(frame)).toBeGreaterThanOrEqual(899.995);
    for(const matrix of matrices(frame)) expect(matrix.elements.every(Number.isFinite)).toBe(true);
   }
  }
  expect(f.native.corpse?.diagnostic().resource).toBe('frozen');expect(system.occupied).toBe(1);
  expect(f.outside.physics.world.bodies.len()).toBe(f.initialBodies+1);
  expect(f.outside.physics.world.colliders.len()).toBe(f.initialColliders+7);
  let actual=0;f.outside.physics.world.forEachRigidBody(candidate=>{if(candidate.numColliders()===7){actual++;expect(candidate.isFixed()).toBe(true);}});expect(actual).toBe(1);
  expect(f.damage).toHaveLength(damage); f.hit(1000);f.tick();expect(f.damage).toHaveLength(damage);
  f.native.dispose();f.native.dispose();expect(system.occupied).toBe(0);
  expect(f.outside.physics.world.bodies.len()).toBe(f.initialBodies);
  expect(f.outside.physics.world.colliders.len()).toBe(f.initialColliders);
 }finally{f.scope.dispose();}
},60000);
test.each(['WORLD','PLAYER','CREATURE','ITEM'] as const)('current-pose foreign %s obstruction refuses atomically without a physics step',async(group)=>{
 const f=await fixture();
 try{
  const physics=f.outside.physics, R=physics.R;
  const obstacle=physics.world.createCollider(R.ColliderDesc.cuboid(.2,.5,.2).setTranslation(8,901,0).setCollisionGroups(groups(group)));
  physics.step();
  // Move after broadphase synchronization: preparation must inspect the current transform.
  obstacle.setTranslation({x:0,y:901,z:0});
  const before=f.native.snapshot(),body=f.native.actor.motor,colliders=physics.world.colliders.len(),bodies=physics.world.bodies.len();
  let hits=0,deaths=0;
  f.events.on('damage.dealt',()=>{hits++;},f.scope);f.events.on('actor.died',()=>{deaths++;},f.scope);
  const weapon=makeSystem(()=>f.hit(1000),'test.weapon',false,'weapon');
  for(let frame=0;frame<FAULT_BURST+2;frame++){
   let result: ReturnType<typeof f.hit> | undefined;try{result=weapon.fn();}catch(error){systemFault(weapon,error,frame,frame*16);}
   expect(result).toBeNull();f.events.flush('update');
   expect(f.native.snapshot()).toEqual(before);
   expect(physics.world.colliders.len()).toBe(colliders);expect(physics.world.bodies.len()).toBe(bodies);
  }
  expect(weapon.on).toBe(true);expect(weapon.faults).toBe(0);expect([hits,deaths]).toEqual([0,0]);
  expect(f.native.actor.alive).toBe(true);expect(f.native.actor.hp).toBe(150);expect(f.native.actor.motor).toBe(body);
  if(!(body instanceof CharacterMotor))throw new Error('Missing live motor');expect(body.collider.isEnabled()).toBe(true);
  expect(physics.world.colliders.len()).toBe(colliders);expect(physics.world.bodies.len()).toBe(bodies);
  expect(ragdollsFor(physics).reserved).toBe(1);expect(ragdollsFor(physics).occupied).toBe(1);
  obstacle.setTranslation({x:8,y:901,z:0});
  // The old broadphase location must not create a false refusal either.
  expect(f.hit(1000)?.killed).toBe(true);f.tick();f.events.flush('update');expect([hits,deaths]).toEqual([1,1]);
  expect(f.native.actor.alive).toBe(false);expect(f.native.corpse?.diagnostic().resource).toBe('frozen');
 }finally{f.scope.dispose();}
});
test('current real player motor overlap refuses, then its current clear pose allows lethal handoff',async()=>{
 const f=await fixture();
 try{
  f.outside.physics.step();
  f.outside.player.position.set(0,900,0);f.outside.player.motor.resetAt(f.outside.player.position);
  expect(f.hit(1000)).toBeNull();expect(f.native.actor.hp).toBe(150);
  expect(ragdollsFor(f.outside.physics).reserved).toBe(1);
  f.outside.player.position.set(0,900,3);f.outside.player.motor.resetAt(f.outside.player.position);
  expect(()=>f.hit(1000)).not.toThrow();f.tick();expect(f.native.corpse?.diagnostic().resource).toBe('frozen');
 }finally{f.scope.dispose();}
});
test('preflight ignores sensors, disabled colliders and non-interacting groups but only excludes its own live motor',async()=>{
 const f=await fixture();
 try{
  const physics=f.outside.physics,R=physics.R;
  physics.world.createCollider(R.ColliderDesc.cuboid(.2,.5,.2).setTranslation(0,901,0).setCollisionGroups(groups('WORLD')).setSensor(true));
  physics.world.createCollider(R.ColliderDesc.cuboid(.2,.5,.2).setTranslation(0,901,0).setCollisionGroups(groups('WORLD')).setEnabled(false));
  physics.world.createCollider(R.ColliderDesc.cuboid(.2,.5,.2).setTranslation(0,901,0).setCollisionGroups(groups('HITBOX')));
  expect(()=>f.hit(1000)).not.toThrow();f.tick();expect(f.native.corpse?.diagnostic().resource).toBe('frozen');
 }finally{f.scope.dispose();}
});
test('real player motor is blocked by held source hulls, can walk around, and crosses after disposal',async()=>{
 const f=await fixture();
 try{
  f.outside.player.position.set(0,900,3);f.outside.player.motor.resetAt(f.outside.player.position);f.outside.physics.step();
  f.hit(1000);f.tick();const player=f.outside.player,walk=(x:number,z:number,count:number)=>{for(let i=0;i<count;i++){player.motor.move(player.position,{x,y:0,z});f.tick();}};
  walk(0,-.05,100);expect(player.position.z).toBeGreaterThan(.6);
  walk(.05,0,65);walk(0,-.05,100);expect(player.position.x).toBeGreaterThan(2);expect(player.position.z).toBeLessThan(-1);
  f.native.dispose();player.position.set(0,900,3);player.motor.resetAt(player.position);f.outside.physics.step();
  walk(0,-.05,100);expect(player.position.z).toBeLessThan(-1);
 }finally{f.scope.dispose();}
});
test('actual death event pays one authored practice receipt; disposal and a fresh bout reset loot and health',async()=>{
 const previous=app.levelScope; const write=vi.spyOn(localStorage,'setItem');
 try{
  for(let bout=0;bout<2;bout++){
   const f=await fixture(),scene=new Scene();
   try{
    app.levelScope=f.scope;
    const catalogue=createBrinePitcherNativePreviewSource(),economy=catalogue.rows.loot[0]?.economy;
    if(economy===undefined)throw new Error('Missing authored loot');for(const row of readLootTables(economy.tables))registerLootTable(row,f.scope);
    const loot=new PracticeLoot({owner:f.scope,scene,player:f.outside.player.position});let deaths=0;
    const actor=f.native.actor.combatActor();f.events.on('actor.died',({actor:dead})=>{if(dead===actor){deaths++;loot.drop({kind:f.native.actor.kind,position:f.native.actor.position});}},f.scope);
    expect(f.native.actor.hp).toBe(150);expect(loot.receipt.coins).toBe(0);
    f.hit(1000);f.tick();f.hit(1000);f.tick();expect(deaths).toBe(1);expect(loot.inFlight).toBeGreaterThan(0);
    for(let i=0;i<180;i++){f.tick();loot.update(1/60);}expect(loot.receipt).toEqual({scope:'practice',coins:10,complete:true});
    f.scope.dispose();expect(scene.getObjectByName('loot-coins')).toBeUndefined();
   }finally{f.scope.dispose();}
  }
  expect(write).not.toHaveBeenCalled();
 }finally{app.levelScope=previous;write.mockRestore();}
});
test('a world wall exactly touching the actual source extremum is not treated as penetration',async()=>{
 const f=await fixture();
 try{
  const transforms=matrices(f.render());let maximum=-Infinity;
  for(const part of source.parts){
   const index=recipe.joints.findIndex(row=>row.name===part.name),bind=source.bones[index],matrix=transforms[index];
   if(bind===undefined||matrix===undefined)throw new Error('Missing exact source owner');
   for(let i=0;i<part.positions.length;i+=3)maximum=Math.max(maximum,new Vector3().fromArray(part.positions,i).sub(new Vector3(...bind.pos)).applyMatrix4(matrix).x);
  }
  const physics=f.outside.physics;
  physics.world.createCollider(physics.R.ColliderDesc.cuboid(.1,4,4).setTranslation(maximum+.1,902,0).setCollisionGroups(groups('WORLD')));physics.step();
  expect(()=>f.hit(1000)).not.toThrow();f.tick();expect(f.native.corpse?.diagnostic().resource).toBe('frozen');
 }finally{f.scope.dispose();}
});

test('a real corpse allocation error propagates through combat and remains retryable after rollback',async()=>{
 const f=await fixture();
 try{
  const physics=f.outside.physics,bodies=physics.world.bodies.len(),colliders=physics.world.colliders.len();
  const error=new Error('injected corpse allocation failure');
  const allocation=vi.spyOn(physics.world,'createRigidBody').mockImplementationOnce(()=>{throw error;});
  expect(()=>f.hit(1000)).toThrow(error);allocation.mockRestore();
  expect(f.native.actor.hp).toBe(150);expect(f.native.actor.alive).toBe(true);
  expect(physics.world.bodies.len()).toBe(bodies);expect(physics.world.colliders.len()).toBe(colliders);
  expect(ragdollsFor(physics).reserved).toBe(1);
  expect(f.hit(1000)?.killed).toBe(true);
 }finally{f.scope.dispose();}
});

test('nonfinite native contact data is a genuine fault rather than a recoverable overlap',async()=>{
 const f=await fixture();
 try{
  const physics=f.outside.physics;
  const obstacle=physics.world.createCollider(physics.R.ColliderDesc.cuboid(.2,.5,.2).setTranslation(0,901,0).setCollisionGroups(groups('WORLD')));
  const contactShape=obstacle.contactShape.bind(obstacle);
  vi.spyOn(obstacle,'contactShape').mockImplementation((...args)=>{
   const contact=contactShape(...args);if(contact!==null)contact.distance=Number.NaN;return contact;
  });
  expect(()=>f.hit(1000)).toThrow('Unsafe anchored corpse contact');
  expect(f.native.actor.hp).toBe(150);expect(f.native.actor.alive).toBe(true);
  expect(ragdollsFor(physics).reserved).toBe(1);
 }finally{f.scope.dispose();}
});

test('bounded living source body survives actual pose/flinch/yaw/reset and host motor recreation', async () => {
  const f = await fixture(motion, 'body');
  try {
    const actor = f.native.actor;
    const original = actor.motor; if (!(original instanceof CharacterMotor)) throw new Error('Missing convex motor');
    expect(original.opts.convexBody?.points).toHaveLength(68);
    expect(() => snapshotSimHost(f.native.host)).toThrow('Borrowed simulation snapshots');
    expect(() => snapshotSimHostBytes(f.native.host)).toThrow('Borrowed simulation snapshots');
    expect(f.outside.physics.colliderTag(original.collider)?.owner).toBe(actor);
    const locals0 = f.native.pose.corpseJoints().find(row => row.name === 'body');
    for (let i = 0; i < 90; i++) f.tick();
    f.hit(1);
    for (let i = 0; i < 30; i++) {
      f.tick();
      expect(f.native.pose.corpseJoints().find(row => row.name === 'body')).toEqual(locals0);
      expect(original.collider.translation().x).toBeCloseTo(actor.position.x, 5);
      expect(original.collider.translation().y).toBeCloseTo(actor.position.y, 5);
      expect(original.collider.translation().z).toBeCloseTo(actor.position.z, 5);
      expect(original.collider.rotation().y).toBeCloseTo(Math.sin(actor.yaw / 2), 6);
    }
    f.native.place({ x: 5, y: 900, z: -4 }, 1.1);
    expect(original.collider.translation()).toEqual({ x: 5, y: 900, z: -4 });
    expect(original.collider.rotation().y).toBeCloseTo(Math.sin(.55), 6);
    original.dispose(); actor.motor = null; f.outside.player.position.copy(actor.position).add(new Vector3(0, 0, 6));
    f.tick();
    const recreated = f.native.host.entities.get(actor.entityId)?.motor; if (!(recreated instanceof CharacterMotor)) throw new Error('Missing recreated motor');
    expect(recreated.opts.convexBody).toEqual(original.opts.convexBody);
    expect(f.outside.physics.colliderTag(recreated.collider)?.owner).toBe(actor);
    expect(recreated.collider).not.toBe(original.collider);
    expect(f.native.host.creatureMotorOptions(actor).convexBody).toEqual(original.opts.convexBody);
  } finally { f.scope.dispose(); }
});

test('convex install activation fault preserves the exact old motor and retires the failed allocation', async () => {
  const f = await fixture(motion, undefined, false);
  try {
    const actor = f.native.actor, old = actor.motor;
    if (!(old instanceof CharacterMotor)) throw new Error('Missing old motor');
    const counts = [f.outside.physics.world.colliders.len(), f.outside.physics.world.characterControllers.size];
    const recipeBody = practiceConvexBody(actor, recipe, numericCreaturePose(motion), f.native.pose.corpseJoints(), 'body');
    const create = f.outside.physics.world.createCollider.bind(f.outside.physics.world);
    vi.spyOn(f.outside.physics.world, 'createCollider').mockImplementationOnce((...args) => {
      const collider = create(...args), enable = collider.setEnabled.bind(collider);
      vi.spyOn(collider, 'setEnabled').mockImplementation(on => { enable(on); if (on) throw new Error('after activation'); });
      return collider;
    });
    expect(() => f.native.host.bindConvexBody(actor, recipeBody)).toThrow('Convex body installation failed');
    expect(actor.motor).toBe(old); expect(old.collider.isEnabled()).toBe(true);
    expect(f.outside.physics.colliderTag(old.collider)?.owner).toBe(actor);
    expect([f.outside.physics.world.colliders.len(), f.outside.physics.world.characterControllers.size]).toEqual(counts);
    expect(f.native.host.creatureMotorOptions(actor).convexBody).toBeUndefined();
  } finally { f.scope.dispose(); }
});
