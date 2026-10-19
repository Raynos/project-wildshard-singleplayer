// oxlint-disable-next-line import/no-nodejs-modules -- Actual admitted product, native rig and physics fixtures.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import * as v from 'valibot';
import { Bone, BufferGeometry, MeshStandardMaterial, SkinnedMesh, Vector3 } from 'three';
import { Animal } from '../src/engine/entities/AnimalView';
import type { AnimalModel } from '../src/engine/entities/AnimalFactory';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { RigidCorpsePose, registerRigidCorpseAnimation } from '../src/engine/entities/rigidCorpsePose';
import { speciesWithLook } from '../src/engine/entities/species/look';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { bellbackTuckedClips } from '../src/shards/driftwood-isle/generators/bellbackTuckedClips';
import { tidalGiantsLooks } from '../src/shards/driftwood-isle/species/tidalGiants';
import { TIDAL_GIANTS_SPECIES } from '../src/shards/driftwood-isle/generators/tidalGiantsCombat';
import { rigidCorpseSchema } from '../src/format/rigidCorpse';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { ragdollsFor, setRagdollClock } from '../src/engine/physics/ragdoll';
import { app } from '../src/engine/app/runtime';
import { App } from '../src/engine/app/app';
import { Game } from '../src/engine/core/Game';
import type { Scope } from '../src/engine/app/scope';
import { makeSystem } from '../src/engine/core/faults';
import { createSimHost } from '../src/engine/sim';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { borrowedDecisionAuthority } from '../src/game/shardfile/borrowedDecisions';
import { PracticeCreature } from '../src/game/practice/PracticeCreature';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const native = v.parse(v.object({ bones: v.array(v.object({ name: v.string(), parent: v.nullable(v.string()),
  pos: v.tuple([v.number(), v.number(), v.number()]) })) }), JSON.parse(readFileSync(
  'art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/bellback-v6-native.json', 'utf8')));
const recipe = v.parse(v.object({ rigidCorpse: rigidCorpseSchema }), JSON.parse(readFileSync(
  'docs/reviews/bellback-corpse-shape-study/posed-parts-proposal.json', 'utf8'))).rigidCorpse;
const dims = { bodyY: 1.2000000476837158, bodyHalfLen: 1, bodyRadius: .5, headRadius: .2, legLen: 1, feet: [], halfWidth: .5 };
const animate = numericCreaturePose(bellbackTuckedClips());
function rig() {
  const bones: Record<string, Bone> = {};
  for (const row of native.bones) {
    const bone = new Bone(); bone.position.fromArray(row.pos);
    if (row.parent !== null) {
      const parent = bones[row.parent], rest = native.bones.find(b => b.name === row.parent);
      if (parent === undefined || rest === undefined) throw new Error('Missing native parent');
      bone.position.sub(new Vector3(...rest.pos)); parent.add(bone);
    }
    bones[row.name] = bone;
  }
  return bones;
}
function context(stage = 1, clock = .96) {
  const mem = { 'tg-state': stage, 'tg-clock': clock }, position = new Vector3();
  const c: AnimalRigContext & { bones: Record<string, Bone> } = {
    bones: rig(), dims: structuredClone(dims), dt: 0, t: 0, seed: .7, scale: 1, speed: 0, strafe: 0, phase: 0,
    state: 'stalk', alive: false, deathT: 0, flinch: 1, brace: 0, attack: -1, lookTarget: new Vector3(), lookWeight: 0,
    position, yaw: 0, mem, animal: { mem, position, yOffset: 0 },
  };
  return c;
}
function transforms(bones: Record<string, Bone>): number[] {
  return Object.values(bones).flatMap(b => b.position.toArray().concat(b.quaternion.toArray()));
}
test.each([[1, .96], [2, .68], [3, .68]])('actual Bellback strike %s stops leaking after later death input', (stage, clock) => {
  const source = context(stage, clock), expected = context(6, 0);
  const pose = new RigidCorpsePose(source, animate), oracle = new RigidCorpsePose(expected, animate);
  source.mem = { 'tg-state': 6, 'tg-clock': 0 }; // Replacement, not only mutation, must be observed.
  for (let tick = 0; tick < 48; tick++) {
    pose.step(1 / 60); oracle.step(1 / 60); pose.render(1); oracle.render(1);
    expect(transforms(source.bones)).toEqual(transforms(expected.bones));
  }
});

test('actual numeric invalid memory refuses atomically and retries with the corrected snapshot', () => {
  const source = context(6, 0), pose = new RigidCorpsePose(source, animate);
  pose.step(1 / 60); pose.render(1);
  const before = transforms(source.bones), death = pose.deathT, flinch = pose.flinch;
  source.mem['tg-clock'] = Number.NaN;
  expect(() => pose.step(1 / 60)).toThrow('scalar observation');
  expect(transforms(source.bones)).toEqual(before); expect(pose.deathT).toBe(death); expect(pose.flinch).toBe(flinch);
  source.mem['tg-clock'] = 0; pose.step(1 / 60);
  expect(pose.deathT).toBeCloseTo(2 / 48);
});

test('fresh immutable observations retain structural bind inputs and commit clocks only on success', () => {
  const source = context(), seen: AnimalRigContext[] = [];
  let fail = true;
  const pose = new RigidCorpsePose(source, registerRigidCorpseAnimation(c => {
    seen.push(c);
    const body = c.bones['body']; if (body === undefined) throw new Error('Missing body');
    body.position.y = c.phase;
    if (fail) throw new Error('retry');
  }));
  const before = transforms(source.bones);
  source.mem = { 'tg-state': 6, 'tg-clock': 0 }; source.phase = .8; source.state = 'alert'; source.yaw = 2;
  source.scale = 7; source.dims.bodyY = 100; source.t = 100; source.deathT = 1; source.flinch = 0;
  expect(() => pose.step(1 / 60)).toThrow('retry');
  expect(transforms(source.bones)).toEqual(before); expect(pose.deathT).toBe(0); expect(pose.flinch).toBe(1);
  fail = false; pose.step(1 / 60); pose.render(1);
  const c = seen[1]; if (c === undefined) throw new Error('Missing copied inputs');
  expect(c).toMatchObject({ phase: .8, state: 'alert', yaw: 2, scale: 1, t: 1 / 60, deathT: 1 / 48 });
  expect(c.dims.bodyY).toBe(dims.bodyY); expect(c.flinch).toBeCloseTo(Math.exp(-5.5 / 60));
  expect(Object.isFrozen(c)).toBe(true); expect(Object.isFrozen(c.mem)).toBe(true);
  expect(c.mem).not.toBe(source.mem); expect(c.animal.mem).toBe(c.mem);
  source.mem['tg-state'] = 3; source.phase = .3;
  for (let i = 0; i < 100; i++) pose.render(.5);
  expect(seen).toHaveLength(2); expect(c.mem['tg-state']).toBe(6); expect(c.phase).toBe(.8);
  pose.step(1 / 60); expect(seen[2]?.mem['tg-state']).toBe(3); expect(seen[2]?.phase).toBe(.3);
});

let R: Rapier;
beforeAll(async () => { R = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))); });
/** Invoke the actual Game scheduler/phase methods without allocating a browser renderer. */
function driver(scope: Scope) {
  const owner = new App(); owner.setState('practice');
  const faults: string[] = []; owner.events.on('fault', event => { faults.push(event.message); }, scope);
  const candidate: unknown = Object.create(Game.prototype);
  if (!(candidate instanceof Game)) throw new Error('Missing scheduler prototype');
  const game = candidate;
  Object.assign(game, { app: owner, clock: { elapsedTime: 0 }, fixedAcc: 0, firstFixedStep: true, alpha: 0,
    fixedSteps: 0, frameNo: 0, fixed: { pre: 'fixed.pre', step: 'fixed.step', post: 'fixed.post' },
    faultSystems: new WeakMap(), eventSystem: makeSystem(null, 'engine.events', false, 'engine.events') });
  const run: unknown = Reflect.get(game, 'runFixed');
  if (typeof run !== 'function') throw new Error('Missing actual fixed scheduler');
  return { owner, game, add: (phase: 'fixed.pre' | 'fixed.step' | 'fixed.post', id: string, fn: (dt: number) => void) => {
    owner.addSystem({ id, phase, run: fn }, scope);
  }, step: (dt: number) => { run.call(game, dt); expect(faults).toEqual([]); } };
}

// Reuses the already-built, reviewed numeric candidate. This test never enables the product recipe.
const productRoot = 'tmp/bellback-tucked-preview/motion3-build1/product';
async function composition(mode: 'practice-update' | 'retained-fixed-post') {
  const product = await loadHeadlessProduct(productRoot), descriptor = outputDescriptor(product.shardfile);
  if (descriptor === undefined) throw new Error('Missing admitted product descriptor');
  const assets = new Map(descriptor.index.files.map(file => [file.hash, Uint8Array.from(readFileSync(`${productRoot}/${file.path}`))]));
  const row = TIDAL_GIANTS_SPECIES.find(s => s.kind === 'bellback');
  const look = tidalGiantsLooks(bellbackTuckedClips(), bellbackTuckedClips())[0], variant = row?.variants[0];
  if (row?.brain === undefined || look === undefined || variant === undefined) throw new Error('Missing Bellback species');
  const host = createSimHost({ ...SIM_LEVEL, quests: [], entities: [] }, { rapier: R });
  const savedPhysics = app.physics; app.physics = host.physics;
  const scope = host.scope.child('corpse-bout'), fixed = new Set<() => void>();
  const bones = rig(), geometry = new BufferGeometry(), material = new MeshStandardMaterial(), mesh = new SkinnedMesh(geometry, material);
  const root = bones['body']; if (root === undefined) throw new Error('Missing body'); mesh.add(root);
  const model: AnimalModel = { kind: row.kind, variant: variant.id, style: 'toon', species: speciesWithLook(row, look), variantDef: variant,
    render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
    geometry, bones: [], dims: { ...dims, rigidCorpse: recipe }, fur: material, hard: material, eye: material, shells: [] };
  const actor = new Animal({ mesh, bones, materials: [material] }, model, .7, 1, 'practice.bellback', {
    heightAt: () => 0, floorBelow: () => 0, random: () => .5, now: () => 0, hit: req => host.combat.hit(req),
  });
  actor.place(0, 0, 0, 15); actor.state = 'stalk';
  const clock = driver(scope), system = ragdollsFor(host.physics), expected = context();
  let ticks = 0, lastInput = -1;
  clock.add('fixed.pre', 'physics.corpse.pre', dt => {
    const memory = { ...actor.mem }; system.fixedPre(dt);
    ticks++;
    if (!actor.alive) {
      expected.mem = memory; expected.t = ticks / 60; expected.deathT = Math.min(1, ticks / 48);
      expected.flinch = Math.exp(-5.5 * ticks / 60); expected.phase = actor.gaitPhase;
      animate(expected); lastInput = memory['tg-state'] ?? -1;
      const actual = transforms(bones);
      transforms(expected.bones).forEach((n, i) => expect(actual[i]).toBeCloseTo(n, 10));
      mesh.updateMatrixWorld(true);
      const body = host.physics.world.getRigidBody(0);
      // SimHost already owns other bodies: locate this compound by its collider count.
      let compound = body;
      host.physics.world.forEachRigidBody(candidate => { if (candidate.numColliders() === recipe.parts.length) compound = candidate; });
      expect(compound.numColliders()).toBe(recipe.parts.length);
      for (const [i, part] of recipe.parts.entries()) {
        const bone = bones[part.bone]; if (bone === undefined) throw new Error('Missing hull joint');
        const point = mesh.worldToLocal(bone.getWorldPosition(new Vector3())), actualPoint = compound.collider(i).translationWrtParent();
        expect(actualPoint?.x).toBeCloseTo(point.x, 5); expect(actualPoint?.y).toBeCloseTo(point.y, 5); expect(actualPoint?.z).toBeCloseTo(point.z, 5);
      }
    }
  });
  clock.add('fixed.step', 'physics.step', () => { host.physics.step(); });
  clock.add('fixed.post', 'physics.corpse.post', dt => { system.fixedPost(dt); });
  const authority = borrowedDecisionAuthority(product.shardfile, assets, descriptor.sections, { scope, events: host.events,
    flags: host.flags, physics: host.physics, player: host.player, groundHeightAt: () => 0,
    live: body => body === actor && !scope.disposed,
    fixed: (id, run, child) => {
      fixed.add(run); child.onDispose(() => { fixed.delete(run); });
      if (mode === 'retained-fixed-post') clock.owner.addSystem({ id, phase: 'fixed.post', run }, child);
    } });
  const control = authority.bind(actor, row.brain.data, row.body);
  control.observe({ calm: false, reach: () => true, claim: () => true, hurt: () => undefined }); control.fighting = true;
  for (let i = 0; i < 6; i++) for (const run of fixed) run(); // Establish the actual 10 Hz guest before its lethal event.
  // Exercise the real practice update method with its existing owners, without loading a renderer/model factory.
  const practice: unknown = Object.create(PracticeCreature.prototype);
  if (!(practice instanceof PracticeCreature)) throw new Error('Missing practice prototype');
  Object.assign(practice, { targets: [actor], context: { t: 0, dt: 0, playerSpeed: 0, calm: false }, bout: scope,
    elapsed: 0, decisionTime: 0, fixedTime: 0, previousPlayer: host.player.position.clone(), options: { player: host.player },
    callbacks: { act: () => { throw new Error('Dead actor must not act'); } }, decision: authority, fixed, events: host.events,
    bodies: null, practicePlayer: null, loot: null });
  const flushDecision = () => { practice.update(.1); practice.update(1 / 60); };
  actor.mem['tg-state'] = 1; actor.mem['tg-clock'] = .96;
  scope.onDispose(() => { actor.retireBody(); });
  const kill = () => { expect(actor.applyDamage(1000, new Vector3(), new Vector3(1, 0, 0))).toBe(true); };
  return { actor, bones, clock, system, fixed, host, scope, kill, flushDecision,
    ticks: () => ticks, lastInput: () => lastInput,
    dispose: () => { scope.dispose(); host.dispose(); app.physics = savedPhysics; geometry.dispose(); material.dispose(); } };
}

test.each(['practice-update', 'retained-fixed-post'] as const)('real borrowed Bellback death input reaches corpse boundary in %s order', async mode => {
  const f = await composition(mode);
  setRagdollClock(() => 1);
  try {
    f.kill(); expect(f.actor.mem['tg-state']).toBe(1); // Constructor precedes queued applied-hit/death delivery.
    f.host.events.flush('update');
    if (mode === 'practice-update') f.flushDecision();
    const deliverySteps = mode === 'practice-update' ? 1 : 7;
    for (let i = 0; i < deliverySteps; i++) f.clock.step(1 / 60);
    expect(f.actor.mem['tg-state']).toBe(6); expect(f.lastInput()).toBe(mode === 'practice-update' ? 6 : 1);
    f.clock.step(1 / 60); expect(f.lastInput()).toBe(6);
    const priorMemory = f.actor.mem;
    f.actor.mem = { ...priorMemory, 'tg-state': 3, 'tg-clock': .68 };
    f.clock.step(1 / 60); expect(f.lastInput()).toBe(3); expect(priorMemory['tg-state']).toBe(6);
    f.actor.mem = { ...priorMemory };
    f.clock.step(1 / 60); expect(f.lastInput()).toBe(6);
    const before = f.ticks(); f.clock.owner.setState('paused');
    f.clock.step(10); f.actor.update(1 / 60, 1, true); f.actor.update(1 / 60, 2, false);
    expect(f.ticks()).toBe(before);
    f.clock.owner.setState('practice'); f.clock.step(1 / 6);
    expect(f.clock.game.fixedSteps).toBe(3); expect(f.ticks()).toBe(before + 3);
    f.clock.step(0); expect(f.clock.game.fixedSteps).toBe(0); // Dropped backlog cannot replay.
    while (f.ticks() < 48) f.clock.step(1 / 60);
    f.actor.update(0, 0, true); expect(f.actor.snapshot().motion.deathT).toBe(1);
    expect(f.actor.snapshot().motion.flinch).toBeCloseTo(Math.exp(-5.5 * 48 / 60), 10);
    f.scope.dispose(); expect(f.system.live).toBe(0); expect(f.fixed.size).toBe(0);
    Object.defineProperty(f.actor, 'mem', { get: () => { throw new Error('retired input read'); } });
    expect(() => { f.clock.step(1); f.system.fixedPre(1 / 60); }).not.toThrow();
  } finally { setRagdollClock(null); f.dispose(); }
});

test('repeated bout retirement creates fresh corpse inputs without touching retired owners', async () => {
  for (let bout = 0; bout < 3; bout++) {
    const f = await composition('practice-update');
    try {
      f.kill(); f.flushDecision(); f.clock.step(1 / 60);
      expect(f.lastInput()).toBe(6); expect(f.ticks()).toBe(1); expect(f.system.live).toBe(1);
      f.actor.update(0, 0, true); expect(f.actor.snapshot().motion.deathT).toBeCloseTo(1 / 48);
      f.scope.dispose(); expect(f.system.live).toBe(0); expect(f.fixed.size).toBe(0);
      Object.defineProperty(f.actor, 'mem', { get: () => { throw new Error('retired input read'); } });
      expect(() => { f.system.fixedPre(1 / 60); f.system.fixedPost(1 / 60); f.actor.retireBody(); }).not.toThrow();
    } finally { f.dispose(); }
  }
});
