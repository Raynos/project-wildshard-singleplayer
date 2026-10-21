// oxlint-disable-next-line import/no-nodejs-modules -- Actual retained source and native physics fixture.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test, vi } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import * as v from 'valibot';
import { CharacterMotor, PLAYER_BODY, type MotorOptions } from '../src/engine/physics/CharacterMotor';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { tagCollider } from '../src/engine/physics/surface';
import { groups } from '../src/engine/physics/groups';
import { prepareNumericRigidCorpse, numericCorpseTransforms } from '../src/engine/physics/rigidCorpse';
import { rigidCorpseSchema } from '../src/format/rigidCorpse';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { NativeCreaturePose, type NativeCreaturePoseRecipe } from '../src/game/plugin/animation';
import { practiceConvexBody } from '../src/game/practice/practiceConvexBody';
import { brinePitcherNativeOwnerClips } from '../src/shards/driftwood-isle/generators/brinePitcherNativeOwnerClips';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const xyz = (p: Vector3) => ({ x: p.x, y: p.y, z: p.z });
const folder = 'test/proof/brine-pitcher-native-owner/source';
const source = v.parse(v.object({ bones: v.array(v.object({ name: v.string(), parent: v.nullable(v.string()), pos: v.tuple([v.number(),v.number(),v.number()]) })) }), JSON.parse(readFileSync(`${folder}/v3/native-source.json`, 'utf8')));
const metadata = v.parse(v.object({ bodies: v.array(v.object({ dims: v.object({ rigidCorpse: rigidCorpseSchema }) })) }), JSON.parse(readFileSync(`${folder}/core-runtime-study/metadata.json`, 'utf8')));
const hulls = (() => { const value = metadata.bodies[0]?.dims.rigidCorpse; if (value === undefined) throw new Error('Missing retained source'); return value; })();
const recipe: NativeCreaturePoseRecipe = { practice: true, custom: true, deathSplay: false, rootFlinch: 'authored-pose',
  joints: source.bones.map(bone => {
    const parent = source.bones.findIndex(row => row.name === bone.parent), p = source.bones[parent]?.pos;
    return { name: bone.name, parent, position: [0, 1, 2].map(i => (bone.pos[i] ?? 0) - (p?.[i] ?? 0)) as [number, number, number], order: 'XYZ', scale: [1, 1, 1] };
  }) };
let R: Rapier;
beforeAll(async () => { R = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))); });
function fixture(scale = 1) {
  const spec = SIM_LEVEL.entities[0]?.spec; if (spec === undefined) throw new Error('Missing base spec');
  const actor = new AnimalSim({ ...spec, dims: { ...spec.dims, rigidCorpse: hulls } }, 1, scale, 'convex-test', { heightAt: () => 0, random: () => .5 });
  actor.levelGround = true; actor.place(0, 0, 0, 0);
  const animate = numericCreaturePose(brinePitcherNativeOwnerClips());
  const pose = new NativeCreaturePose(actor, recipe, animate); actor.bindVolumes(pose); pose.sampleTerrain();
  const body = practiceConvexBody(actor, recipe, animate, pose.corpseJoints(), 'body');
  const physics = new Physics(R);
  const opts: MotorOptions = { radius: .35, height: 1.8, step: .3, snap: .2, maxClimbDeg: 45, group: 'CREATURE', blockedBy: ['WORLD', 'PLAYER', 'CREATURE'], owner: actor, convexBody: body };
  const motor = new CharacterMotor(physics, opts, undefined, { feet: actor.position, yaw: actor.yaw, enabled: true }); actor.motor = motor;
  return { actor, animate, pose, body, motor, physics, opts };
}
test.each([.85, 1, 1.25])('exact 68-point source body remains equivalent through yaw, move and reset at scale %s', scale => {
  const f = fixture(scale);
  try {
    expect(f.body.points).toHaveLength(68);
    for (const [x, z, yaw, flinch] of [[2, 3, .7, 0], [-4, 2, -1.2, 1], [0, 0, Math.PI, .4]]) {
      if (x === undefined || z === undefined || yaw === undefined || flinch === undefined) throw new Error('Missing trial');
      f.actor.place(x, z, yaw, 0); f.motor.resetAt(f.actor.position, yaw);
      f.pose.publish();
      const part = prepareNumericRigidCorpse(R, hulls, f.pose.corpseJoints(), scale).find(row => row.bone === 'body');
      if (part === undefined) throw new Error('Missing corpse body');
      const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw);
      const expected = new Vector3().copy(part.pose.position).applyQuaternion(q).add(f.actor.position);
      const sourcePart = hulls.parts.find(row => row.bone === 'body'); if (sourcePart === undefined) throw new Error('Missing part');
      for (const [index, point] of sourcePart.points.entries()) {
        const actual = f.body.points[index]; if (actual === undefined) throw new Error('Missing body point');
        const corpseWorld = new Vector3(...point).multiplyScalar(scale).applyQuaternion(part.pose.rotation).add(part.pose.position).applyQuaternion(q).add(f.actor.position);
        const livingWorld = new Vector3(...actual).applyQuaternion(f.motor.collider.rotation()).add(f.motor.collider.translation());
        expect(livingWorld.distanceTo(corpseWorld)).toBeLessThan(2e-6);
      }
      expect(expected.y).toBeCloseTo(part.pose.position.y, 6);
      expect(f.motor.collider.translation()).toEqual({ x, y: 0, z });
      f.motor.move(f.actor.position, { x: .07, y: 0, z: -.09 });
      expect(f.motor.collider.translation().y).toBe(f.actor.position.y);
    }
  } finally { f.motor.dispose(); f.physics.dispose(); }
});
test.each([.85, 1, 1.25].flatMap(scale => [0, Math.PI / 2, Math.PI, -Math.PI / 2].map(yaw => [scale, yaw] as const)))('real player KCC lunge on the Arena stops outside scale %s source hull from %s', (scale, yaw) => {
  const f = fixture(scale);
  f.actor.place(0, 0, 0, 900); f.actor.groundHeight = () => 900; f.motor.resetAt(f.actor.position);
  const floor = f.physics.world.createCollider(R.ColliderDesc.cuboid(50, 2, 50).setTranslation(0, 898, 0).setCollisionGroups(groups('WORLD')));
  tagCollider(floor, 'metal', null); f.physics.step();
  f.actor.strafe = 6; f.actor.setStrafe(6); f.actor.step(1 / 60);
  const p = new Vector3(f.actor.position.x + Math.sin(yaw) * 5, 900, f.actor.position.z + Math.cos(yaw) * 5);
  const player = new CharacterMotor(f.physics, { radius: .35, height: 1.8, step: .3, snap: .2, maxClimbDeg: 45, ...PLAYER_BODY });
  try {
    player.resetAt(p); f.physics.step();
    for (let i = 0; i < 8; i++) { player.move(p, { x: -Math.sin(yaw) * .8, y: 0, z: -Math.cos(yaw) * .8 }); f.physics.step(); }
    const contact = player.collider.contactCollider(f.motor.collider, .1);
    expect(contact).not.toBeNull(); expect(contact?.distance).toBeGreaterThanOrEqual(-1e-6);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThan(1);
  } finally { player.dispose(); f.motor.dispose(); f.physics.dispose(); }
});
test('stationary actor refuses an obstructed yaw using current direct transforms and no relocation', () => {
  const f = fixture();
  try {
    const wall = f.physics.world.createCollider(R.ColliderDesc.ball(.1).setTranslation(20, 1, 20).setCollisionGroups(groups('WORLD')));
    f.physics.step();
    // Find a point occupied after a quarter turn but not before it, without a broadphase update.
    let found = false;
    for (let x = -.8; x < 1.6 && !found; x += .05) for (let z = -.8; z < 1.6 && !found; z += .05) {
      wall.setTranslation({ x, y: 1.8, z });
      if (wall.contactCollider(f.motor.collider, 0) !== null) continue;
      const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
      if ((wall.contactShape(f.motor.collider.shape, f.actor.position, q, 0)?.distance ?? 0) >= -.01) continue;
      const before = f.actor.position.clone(); f.actor.turnRate = 100; f.actor.setMotion(Math.PI / 2, 0, 100);
      f.actor.step(1 / 60); expect(f.actor.yaw).toBe(0); expect(f.actor.position).toEqual(before); found = true;
    }
    expect(found).toBe(true);
  } finally { f.motor.dispose(); f.physics.dispose(); }
});
test('convex transfer/reset preserves root pivot and yaw; default capsule retains its offset', () => {
  const f = fixture(), other = new Physics(R);
  try {
    f.motor.resetAt(f.actor.position, 1.2); const feet = new Vector3(4, 7, 9);
    const transferred = f.motor.transferTo(other, feet);
    expect(transferred.collider.translation()).toEqual({ x: 4, y: 7, z: 9 });
    expect(transferred.collider.rotation().y).toBeCloseTo(Math.sin(.6), 6); transferred.dispose(); transferred.dispose();
    const { convexBody: _convexBody, ...opts } = f.opts;
    const capsule = new CharacterMotor(other, opts); capsule.resetAt(feet);
    expect(capsule.collider.translation().y).toBeCloseTo(7.905, 5); expect(capsule.acceptTurn(feet, 2)).toBe(true); capsule.dispose();
  } finally { f.motor.dispose(); f.physics.dispose(); other.dispose(); }
});
test('allocation and activation failures clean newly allocated resources', () => {
  const f = fixture();
  try {
    const colliders = f.physics.world.colliders.len(), controllers = f.physics.world.characterControllers.size;
    const create = f.physics.world.createCollider.bind(f.physics.world);
    vi.spyOn(f.physics.world, 'createCollider').mockImplementationOnce((...args) => { create(...args); throw new Error('after allocation'); });
    expect(() => new CharacterMotor(f.physics, f.opts, undefined, { feet: f.actor.position, yaw: 0, enabled: false })).toThrow('after allocation');
    expect(f.physics.world.colliders.len()).toBe(colliders); expect(f.physics.world.characterControllers.size).toBe(controllers);
    const createController = f.physics.world.createCharacterController.bind(f.physics.world);
    vi.spyOn(f.physics.world, 'createCharacterController').mockImplementationOnce((...args) => {
      const c = createController(...args); vi.spyOn(c, 'setUp').mockImplementationOnce(() => { throw new Error('initialization'); }); return c;
    });
    expect(() => new CharacterMotor(f.physics, f.opts, undefined, { feet: f.actor.position, yaw: 0, enabled: true })).toThrow('initialization');
    expect(f.physics.world.colliders.len()).toBe(colliders); expect(f.physics.world.characterControllers.size).toBe(controllers);
  } finally { f.motor.dispose(); f.physics.dispose(); }
});
test('moving ancestry, root tilt and invalid hulls refuse before allocation', () => {
  const f = fixture();
  try {
    expect(() => practiceConvexBody(f.actor, recipe, f.animate, f.pose.corpseJoints(), 'head')).toThrow('moving channels');
    f.actor.levelGround = false;
    expect(() => practiceConvexBody(f.actor, recipe, f.animate, f.pose.corpseJoints(), 'body')).toThrow('flat yaw-only');
    expect(() => new CharacterMotor(f.physics, { ...f.opts, convexBody: { points: [[0,0,0], [1,0,0], [0,1,0], [1,1,0]] } }, undefined,
      { feet: f.actor.position, yaw: 0, enabled: true })).toThrow('Degenerate');
    expect(numericCorpseTransforms(f.pose.corpseJoints(), 1)).toHaveLength(7);
  } finally { f.motor.dispose(); f.physics.dispose(); }
});
test('exact convex touch distance sees non-capsule contacts and kinematic decks explicitly refuse', () => {
  const f = fixture();
  try {
    const obstacle = f.physics.world.createCollider(R.ColliderDesc.ball(.05).setTranslation(30, 2, 30).setCollisionGroups(groups('WORLD')));
    f.physics.step(); obstacle.setTranslation({ x: 1, y: 2, z: 0 });
    const touched: number[] = [];
    f.motor.touching(.2, ['WORLD'], c => { touched.push(c.handle); return true; });
    const expected = obstacle.contactShape(f.motor.collider.shape, f.motor.collider.translation(), f.motor.collider.rotation(), .2);
    expect(touched.includes(obstacle.handle)).toBe(expected !== null && expected.distance <= .2);
    expect(touched).toHaveLength(1);
    f.physics.world.removeCollider(obstacle, false);
    const deck = f.physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
    f.physics.world.createCollider(R.ColliderDesc.cuboid(4, .05, 4).setTranslation(0, -.05, 0).setCollisionGroups(groups('WORLD')), deck);
    const before = f.actor.position.clone();
    expect(() => f.motor.move(f.actor.position, { x: .1, y: 0, z: 0 })).toThrow('kinematic decks');
    expect(f.actor.position).toEqual(before);
  } finally { f.motor.dispose(); f.physics.dispose(); }
});

test('convex snapshot reconnects only the exact canonical source hull, rejecting capsule and wrong convex handles', () => {
  const f = fixture();
  try {
    const bytes = f.physics.world.takeSnapshot(), restored = new Physics(R, bytes);
    try {
      const motor = new CharacterMotor(restored, f.opts, f.motor.snapshot());
      expect(motor.collider.translation()).toEqual(f.motor.collider.translation()); motor.dispose();
    } finally { restored.dispose(); }
    const { convexBody: _convexBody, ...capsuleOpts } = f.opts;
    expect(() => new CharacterMotor(f.physics, capsuleOpts, f.motor.snapshot())).toThrow('requires its recipe');
    const capsule = new CharacterMotor(f.physics, capsuleOpts);
    const controllers = f.physics.world.characterControllers.size;
    expect(() => new CharacterMotor(f.physics, f.opts, capsule.snapshot())).toThrow('differs from its recipe');
    expect(f.physics.world.characterControllers.size).toBe(controllers); capsule.dispose();
    const other = new CharacterMotor(f.physics, { ...f.opts, convexBody: { points: f.body.points.map(p => [p[0] * .8, p[1], p[2]]) } },
      undefined, { feet: f.actor.position, yaw: 0, enabled: true });
    expect(() => new CharacterMotor(f.physics, f.opts, other.snapshot())).toThrow('differs from its recipe'); other.dispose();
    f.motor.collider.setRotation(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), .2));
    expect(() => new CharacterMotor(f.physics, f.opts, f.motor.snapshot())).toThrow('pose differs');
  } finally { f.motor.dispose(); f.physics.dispose(); }
});

test('collision-owned XYZ refuses terrain filtering, disabled movement and flight sync', () => {
  const f = fixture();
  try {
    expect(f.motor.rootAuthority).toBe('collision');
    const before = f.actor.position.clone();
    expect(() => f.motor.move(f.actor.position, { x: .1, y: 0, z: 0 }, true)).toThrow('collision-owned XYZ');
    expect(() => f.motor.syncFlightPose(f.actor.position)).toThrow('living flight');
    f.motor.setEnabled(false);
    expect(() => f.motor.move(f.actor.position, { x: .1, y: 0, z: 0 })).toThrow('collision-owned XYZ');
    expect(f.actor.position).toEqual(before);
  } finally { f.motor.dispose(); f.physics.dispose(); }
});

test.each(['step', 'slope'])('real convex KCC accepts the WORLD %s correction with one XYZ publication', kind => {
  const f = fixture();
  try {
    const desc = kind === 'step' ? R.ColliderDesc.cuboid(.25, .1, 2).setTranslation(2, .1, 0)
      : R.ColliderDesc.cuboid(2, .1, 2).setTranslation(4, .3, 0).setRotation(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), .1));
    f.physics.world.createCollider(desc.setCollisionGroups(groups('WORLD'))); f.physics.step();
    const controller = [...f.physics.world.characterControllers][0]; if (controller === undefined) throw new Error('Missing KCC');
    const compute = vi.spyOn(controller, 'computeColliderMovement');
    f.motor.move(f.actor.position, { x: .8, y: 0, z: 0 });
    expect(compute).toHaveBeenCalledTimes(1);
    console.info('CONVEX_ROOT_EVIDENCE', JSON.stringify({ kind, correction: controller.computedMovement(), accepted: f.motor.collider.translation() }));
    expect(f.actor.position.y).toBeGreaterThan(0); expect(f.actor.position.x).toBeGreaterThan(0);
    expect(f.motor.collider.translation()).toEqual(xyz(f.actor.position));
  } finally { f.motor.dispose(); f.physics.dispose(); }
});

test.each([.85, 1, 1.25])('exact metal WORLD Arena travels with one float32 root at scale %s', scale => {
  const f = fixture(scale);
  try {
    f.actor.place(0, 0, 0, 900); f.actor.groundHeight = () => 900; f.motor.resetAt(f.actor.position, f.actor.yaw);
    const floor = f.physics.world.createCollider(R.ColliderDesc.cuboid(50, 2, 50).setTranslation(0, 898, 0).setCollisionGroups(groups('WORLD')));
    tagCollider(floor, 'metal', null); f.physics.step();
    const controller = [...f.physics.world.characterControllers][0]; if (controller === undefined) throw new Error('Missing KCC');
    const compute = vi.spyOn(controller, 'computeColliderMovement');
    const step = vi.spyOn(f.physics, 'step');
    f.actor.strafe = 6; f.actor.setStrafe(6); f.actor.step(1 / 60);
    expect(compute).toHaveBeenCalledTimes(1); expect(step).not.toHaveBeenCalled();
    console.info('CONVEX_ROOT_EVIDENCE', JSON.stringify({ kind: 'Arena', scale, correction: controller.computedMovement(), accepted: f.motor.collider.translation() }));
    expect(f.actor.position.x).toBeGreaterThan(.09); expect(f.actor.position.y).toBeGreaterThan(900);
    expect(f.motor.collider.translation()).toEqual(xyz(f.actor.position));
    expect(f.actor.snapshot().motion.groundY).toBe(f.actor.position.y);
    for (let i = 0; i < 60; i++) {
      f.physics.step(); f.actor.step(1 / 60); f.pose.publish();
      expect(f.motor.collider.translation()).toEqual(xyz(f.actor.position));
      expect(f.actor.snapshot().motion.groundY).toBe(f.actor.position.y);
    }
    expect(f.actor.position.x).toBeGreaterThan(5);
    f.actor.strafe = 0; f.actor.setStrafe(0);
    f.physics.step(); compute.mockClear(); f.actor.step(1 / 60);
    expect(compute).toHaveBeenCalledTimes(1); expect(f.motor.collider.translation()).toEqual(xyz(f.actor.position));
    f.actor.setMotion(Math.PI / 2 + .1, 0); f.actor.step(1 / 60);
    expect(f.motor.collider.translation()).toEqual(xyz(f.actor.position));
    f.actor.stagger(new Vector3(-1, 0, 0), .5); f.actor.step(1 / 60);
    expect(f.motor.collider.translation()).toEqual(xyz(f.actor.position));
    f.actor.impulse(new Vector3(-3, 0, 0)); f.actor.step(1 / 60);
    expect(f.motor.collider.translation()).toEqual(xyz(f.actor.position));
  } finally { f.motor.dispose(); f.physics.dispose(); }
});

test('grounded convex actor rejects driven, tilted and offset modes before movement', () => {
  const f = fixture();
  try {
    const before = f.actor.position.clone(); f.actor.driven = true;
    expect(() => f.actor.step(1 / 60)).toThrow('grounded yaw-only'); f.actor.driven = false;
    f.actor.levelGround = false; expect(() => f.actor.step(1 / 60)).toThrow('grounded yaw-only'); f.actor.levelGround = true;
    f.actor.yOffset = .1; expect(() => f.actor.step(1 / 60)).toThrow('grounded yaw-only');
    expect(f.actor.position).toEqual(before);
  } finally { f.motor.dispose(); f.physics.dispose(); }
});


test('ordinary capsule retains analytic ground-follow, terrain filtering and driven behavior', () => {
  const f = fixture();
  try {
    f.motor.dispose();
    const { convexBody: _convexBody, ...opts } = f.opts;
    const capsule = new CharacterMotor(f.physics, opts); f.actor.motor = capsule;
    try {
      expect(capsule.rootAuthority).toBeUndefined();
      f.actor.groundHeight = () => 1;
      const move = vi.spyOn(capsule, 'move');
      f.actor.speed = 3; f.actor.setMotion(0, 3); f.actor.step(1 / 60);
      expect(move).toHaveBeenCalledTimes(1); expect(move.mock.calls[0]?.[2]).toBe(true);
      expect(f.actor.position.y).toBe(.2);
      f.actor.driven = true; f.actor.position.y = 4; f.actor.step(1 / 60);
      expect(f.actor.position.y).toBe(4); expect(f.actor.snapshot().motion.groundY).toBe(4);
      expect(move).toHaveBeenCalledTimes(1);
      f.actor.driven = false; f.actor.alive = false; f.actor.step(1 / 60);
      expect(f.actor.position.y).toBe(4 - 10 / 3600);
    } finally { capsule.dispose(); }
  } finally { f.motor.dispose(); f.physics.dispose(); }
});
