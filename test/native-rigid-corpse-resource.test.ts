// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the installed native physics binary without a browser or download.
import { readFileSync } from 'node:fs';
import { Bone, Group, Quaternion, Vector3 } from 'three';
import { beforeAll, expect, test, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { FIXED_STEP } from '../src/engine/core/fixedStep';
import { groups } from '../src/engine/physics/groups';
import { NativeRigidCorpse, type NativeRigidCorpseInput } from '../src/engine/physics/nativeRigidCorpse';
import { Ragdolls, type RagdollSpec } from '../src/engine/physics/ragdoll';
import { numericCorpseTransforms, prepareNumericRigidCorpse, prepareRigidCorpse, type NumericCorpseJoint, type RigidCorpseRecipe } from '../src/engine/physics/rigidCorpse';

let R: Rapier;
beforeAll(async () => { R = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))); });
const points = [[0, 0, 0], [.3, 0, 0], [0, .4, 0], [0, 0, .5]] as const;
const recipe: RigidCorpseRecipe = { parts: [{ bone: 'body', points }, { bone: 'limb', points }] };
function specimen(scale = 1): { native: NativeRigidCorpseInput; legacy: RagdollSpec; joints: NumericCorpseJoint[] } {
  const root = new Group(), body = new Bone(), limb = new Bone();
  root.position.set(.25, 12, -.4); root.rotation.set(.12, .37, -.08); root.scale.setScalar(scale);
  body.position.set(0, 1, 0); body.rotation.set(.1, .2, -.3); limb.position.set(.4, .3, -.2); limb.rotation.set(-.2, .15, .3);
  root.add(body); body.add(limb); root.updateMatrixWorld(true);
  const joints = [body, limb].map((bone, i) => ({ name: i === 0 ? 'body' : 'limb', parent: i - 1,
    position: { x: bone.position.x, y: bone.position.y, z: bone.position.z },
    rotation: { x: bone.quaternion.x, y: bone.quaternion.y, z: bone.quaternion.z, w: bone.quaternion.w }, scale: { x: 1, y: 1, z: 1 } }));
  const dims = { bodyY: 2, bodyHalfLen: 1, bodyRadius: .5, headRadius: .3, halfWidth: .5, rigidCorpse: recipe };
  const shared = { dims, scale, velocity: { x: .7, y: .3, z: -.4 }, dir: { x: .8, y: .2, z: -.6 }, damage: 42 };
  return { joints, native: { ...shared, position: root.position, rotation: root.quaternion, recipe, joints },
    legacy: { ...shared, root, bones: { body, limb }, build: 'rigid', lite: false, hitPoint: { x: 0, y: 0, z: 0 },
      corpsePose: { complete: false, step: () => undefined, render: () => undefined } } };
}
function fixture(cap = 2) {
  const physics = new Physics(R), scope = new Scope('native-corpse-resource'), system = new Ragdolls(physics, cap);
  const lease = system.reserveNative(scope); if (lease === null) throw new Error('Missing admission slot');
  return { physics, scope, system, lease, dispose: () => { scope.dispose(); physics.dispose(); } };
}
function physicalBody(physics: Physics, resource: NativeRigidCorpse) { return physics.world.getRigidBody(resource.bodyHandle); }
function counts(f: ReturnType<typeof fixture>) { return { live: f.system.live, reserved: f.system.reserved, occupied: f.system.occupied,
  bodies: f.physics.world.bodies.len(), colliders: f.physics.world.colliders.len(), joints: f.physics.world.impulseJoints.len() }; }

test.each([.5, 1, 2])('numeric and Three hull preparation agree with rotated ancestry at scale %s', scale => {
  const s = specimen(scale), a = prepareNumericRigidCorpse(R, recipe, s.joints, scale),
    b = prepareRigidCorpse(R, recipe, s.legacy.root, s.legacy.bones, scale, 'rigid');
  for (const [i, part] of a.entries()) {
    const other = b[i]; if (other === undefined) throw new Error('Missing comparison hull');
    expect(part.desc.shape).toEqual(other.desc.shape);
    for (const key of ['x', 'y', 'z'] as const) expect(part.desc.translation[key]).toBeCloseTo(other.desc.translation[key], 12);
    for (const key of ['x', 'y', 'z', 'w'] as const) expect(part.desc.rotation[key]).toBeCloseTo(other.desc.rotation[key], 12);
  }
  const parent = new Group(); parent.position.x = 1; parent.add(s.legacy.root);
  expect(() => prepareRigidCorpse(R, recipe, s.legacy.root, s.legacy.bones, scale, 'rigid')).toThrow('identity parent');
});

test('numeric preparation rejects unsafe hierarchy, scale, quaternion, names and hulls before world allocation', () => {
  const f = fixture(), s = specimen();
  try {
    const original = counts(f);
    for (const joints of [[], [...s.joints, ...s.joints], s.joints.map(j => ({ ...j, parent: 9 })),
      s.joints.map(j => ({ ...j, scale: { x: 1, y: 2, z: 1 } })),
      s.joints.map(j => ({ ...j, rotation: { x: 0, y: 0, z: 0, w: 2 } })),
      s.joints.map(j => ({ ...j, position: { x: Number.NaN, y: 0, z: 0 } }))]) {
      expect(() => NativeRigidCorpse.prepare(f.lease, { ...s.native, joints })).toThrow(); expect(counts(f)).toEqual(original);
    }
    expect(() => numericCorpseTransforms(s.joints, 0)).toThrow();
    expect(() => NativeRigidCorpse.prepare(f.lease, { ...s.native, dims: { ...s.native.dims, halfWidth: 1e30 } })).toThrow('descriptor');
    expect(counts(f)).toEqual(original);
    for (const bad of [{ parts: [{ bone: 'missing', points }] }, { parts: [{ bone: 'body', points: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]] }] },
      { ...recipe, posePolicy: 'captured' }, { parts: Array.from({ length: 9 }, (_, i) => ({ bone: String(i), points })) }]) {
      expect(() => NativeRigidCorpse.prepare(f.lease, { ...s.native, recipe: bad })).toThrow(); expect(counts(f)).toEqual(original);
    }
  } finally { f.dispose(); }
});

test('admission reserves the shared slot, mixed legacy occupancy cannot steal it, scope disposal releases once', () => {
  const f = fixture(), s = specimen(), other = new Scope('other');
  try {
    expect(counts(f)).toEqual({ live: 0, reserved: 1, occupied: 1, bodies: 0, colliders: 0, joints: 0 });
    const legacy = f.system.spawn(s.legacy); expect(legacy).not.toBeNull();
    expect(f.system.reserveNative(other)).toBeNull(); expect(f.system.spawn(s.legacy)).toBeNull();
    const resource = NativeRigidCorpse.prepare(f.lease, s.native);
    expect(physicalBody(f.physics, resource).isEnabled()).toBe(false);
    expect(f.physics.scopedCensus(f.scope)).toEqual({ bodies: 1, colliders: 2 });
    expect(resource.endpoints().current).toEqual({ position: physicalBody(f.physics, resource).translation(), rotation: physicalBody(f.physics, resource).rotation() }); expect(f.system.occupied).toBe(2);
    resource.activate(); expect(f.system.live).toBe(2); expect(f.system.reserved).toBe(0); expect(f.system.occupied).toBe(2);
    expect(f.physics.world.impulseJoints.len()).toBe(0);
    f.scope.dispose(); f.scope.dispose(); resource.dispose(); expect(f.system.live).toBe(1); expect(f.system.occupied).toBe(1);
    legacy?.dispose(); expect(f.system.live).toBe(0); expect(f.system.occupied).toBe(0);
    const fresh = f.system.reserveNative(other); expect(fresh).not.toBeNull(); other.dispose(); expect(f.system.occupied).toBe(0);
  } finally { other.dispose(); f.dispose(); }
});

test.each([-1, 0, 1].flatMap(failure => [false, true].map(after => ({ failure, after }))))('allocation failure at stage $failure after native side effect=$after retains admission', ({ failure, after }) => {
  const f = fixture(), s = specimen();
  try {
    let calls = 0;
    const createBody = f.physics.world.createRigidBody.bind(f.physics.world), createCollider = f.physics.world.createCollider.bind(f.physics.world);
    const a = vi.spyOn(f.physics.world, 'createRigidBody').mockImplementation(desc => { if (failure === -1 && !after) throw new Error('body allocation'); const result = createBody(desc); if (failure === -1) throw new Error('body allocation'); return result; });
    const b = vi.spyOn(f.physics.world, 'createCollider').mockImplementation((desc, parent) => { const fail = calls++ === failure; if (fail && !after) throw new Error('collider allocation'); const result = createCollider(desc, parent); if (fail) throw new Error('collider allocation'); return result; });
    expect(() => NativeRigidCorpse.prepare(f.lease, s.native)).toThrow('allocation');
    expect(f.lease.state).toBe('reserved'); expect(counts(f)).toEqual({ live: 0, reserved: 1, occupied: 1, bodies: 0, colliders: 0, joints: 0 });
    a.mockRestore(); b.mockRestore();
    const resource = NativeRigidCorpse.prepare(f.lease, s.native); resource.activate(); expect(f.system.live).toBe(1);
    resource.dispose(); expect(f.system.occupied).toBe(0);
  } finally { f.dispose(); }
});

test.each([false, true])('activation failure after native side effect=%s removes only the provisional body and retains admission', after => {
  const f = fixture(), s = specimen();
  try {
    const resource = NativeRigidCorpse.prepare(f.lease, s.native), physical = physicalBody(f.physics, resource), enable = physical.setEnabled.bind(physical);
    vi.spyOn(physical, 'setEnabled').mockImplementation(on => { if (after) enable(on); throw new Error('activation fault'); });
    expect(() => resource.activate()).toThrow('activation fault'); expect(resource.state).toBe('disposed');
    expect(f.lease.state).toBe('reserved'); expect(counts(f)).toEqual({ live: 0, reserved: 1, occupied: 1, bodies: 0, colliders: 0, joints: 0 });
    const retry = NativeRigidCorpse.prepare(f.lease, s.native); retry.activate(); expect(f.system.live).toBe(1); retry.dispose();
  } finally { f.dispose(); }
});

test.each([.5, 1, 2])('real one-root dynamics match existing rigid compound at scale %s', scale => {
  const f = fixture(), old = new Physics(R), system = new Ragdolls(old), s = specimen(scale);
  try {
    old.world.gravity.y = 0; f.physics.world.gravity.y = 0;
    const legacy = system.spawn(s.legacy), resource = NativeRigidCorpse.prepare(f.lease, s.native); resource.activate();
    if (legacy === null) throw new Error('Missing comparison corpse');
    const a = old.world.getRigidBody(0), b = physicalBody(f.physics, resource);
    expect(b.linvel()).toEqual(a.linvel()); expect(b.angvel()).toEqual(a.angvel());
    expect(b.linearDamping()).toBe(a.linearDamping()); expect(b.angularDamping()).toBe(a.angularDamping());
    for (let i = 0; i < 120; i++) {
      system.fixedPre(FIXED_STEP); old.step(); f.physics.step(); system.fixedPost(FIXED_STEP); resource.capture(FIXED_STEP);
      expect(b.translation()).toEqual(a.translation()); expect(b.rotation()).toEqual(a.rotation());
      expect(resource.endpoints().current).toEqual({ position: b.translation(), rotation: b.rotation() });
    }
    expect(b.mass()).toBe(a.mass()); expect(b.localCom()).toEqual(a.localCom()); expect(b.effectiveAngularInertia()).toEqual(a.effectiveAngularInertia());
    expect(b.numColliders()).toBe(2); expect(f.physics.world.impulseJoints.len()).toBe(0);
    for (let i = 0; i < b.numColliders(); i++) {
      expect(b.collider(i).mass()).toBe(0); expect(b.collider(i).collisionGroups()).toBe(groups('DEBRIS'));
      expect(b.collider(i).rotationWrtParent()).toEqual(a.collider(i).rotationWrtParent());
      expect(b.collider(i).solverGroups()).toBe(groups('DEBRIS')); expect(b.collider(i).friction()).toBe(a.collider(i).friction());
    }
    legacy.dispose(); resource.dispose(); expect(f.system.occupied).toBe(0);
  } finally { f.dispose(); old.dispose(); }
});

test('local hull updates validate as a set and roll back a setter that throws after writing', () => {
  const f = fixture(), s = specimen();
  try {
    const resource = NativeRigidCorpse.prepare(f.lease, s.native); resource.activate(); const physical = physicalBody(f.physics, resource);
    const snapshot = () => Array.from({ length: physical.numColliders() }, (_, i) => ({ p: physical.collider(i).translationWrtParent(), q: physical.collider(i).rotationWrtParent() }));
    const before = snapshot(), target = physical.collider(1), write = target.setRotationWrtParent.bind(target); let once = true;
    vi.spyOn(target, 'setRotationWrtParent').mockImplementation(q => { write(q); if (once) { once = false; throw new Error('local fault'); } });
    const changed = s.joints.map(j => ({ name: j.name, parent: j.parent, scale: j.scale, position: { x: j.position.x + .1, y: j.position.y, z: j.position.z }, rotation: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), .3) }));
    expect(() => resource.updateLocal(changed, false)).toThrow('local fault'); expect(snapshot()).toEqual(before);
    resource.updateLocal(changed, false); expect(snapshot()).not.toEqual(before);
    const good = snapshot(); expect(() => resource.updateLocal(changed.map(j => ({ name: j.name, parent: j.parent, position: j.position, rotation: j.rotation, scale: { x: 2, y: 1, z: 1 } })), true)).toThrow(); expect(snapshot()).toEqual(good);
  } finally { f.dispose(); }
});

test.each([false, true])('freeze releases once: max age with incomplete fold, or completed sleeping fold=%s', complete => {
  const f = fixture(), s = specimen();
  try {
    f.physics.world.gravity.y = 0;
    const resource = NativeRigidCorpse.prepare(f.lease, s.native); resource.activate(); const physical = physicalBody(f.physics, resource);
    physical.setLinvel({ x: 0, y: 0, z: 0 }, true); physical.setAngvel({ x: 0, y: 0, z: 0 }, true); physical.sleep();
    const before = resource.endpoints(); for (let i = 0; i < 100; i++) expect(resource.endpoints()).toEqual(before);
    for (let i = 0; i < 60; i++) { f.physics.step(); resource.capture(FIXED_STEP); }
    expect(resource.state).toBe('live'); expect(f.system.occupied).toBe(1);
    resource.updateLocal(s.joints, complete); if (complete) physical.sleep();
    for (let i = 0; i < (complete ? 1 : 241); i++) { f.physics.step(); resource.capture(FIXED_STEP); }
    expect(resource.state).toBe('frozen'); expect(counts(f)).toEqual({ live: 0, reserved: 0, occupied: 0, bodies: 0, colliders: 0, joints: 0 });
    const frozen = resource.endpoints(); resource.capture(FIXED_STEP); expect(resource.endpoints()).toEqual(frozen);
    f.scope.dispose(); resource.dispose(); expect(f.system.occupied).toBe(0);
  } finally { f.dispose(); }
});

test('world teardown before owner disposal never touches freed native handles', () => {
  const f = fixture(), resource = NativeRigidCorpse.prepare(f.lease, specimen().native); resource.activate(); f.physics.dispose();
  expect(() => { resource.capture(FIXED_STEP); f.scope.dispose(); resource.dispose(); }).not.toThrow();
  expect(f.system.live).toBe(0); expect(f.system.occupied).toBe(0);
});

test('abort after whole-world teardown releases rather than reviving an admission', () => {
  const f = fixture(), resource = NativeRigidCorpse.prepare(f.lease, specimen().native); f.physics.dispose();
  expect(() => { resource.abort(); f.scope.dispose(); }).not.toThrow(); expect(f.system.occupied).toBe(0);
});


test.each([false, true])('terminal removal failure after effect=%s never frees capacity while a body remains', after => {
  const f = fixture(), resource = NativeRigidCorpse.prepare(f.lease, specimen().native); resource.activate();
  const remove = f.physics.world.removeRigidBody.bind(f.physics.world);
  const fault = vi.spyOn(f.physics.world, 'removeRigidBody').mockImplementation(value => { if (after) remove(value); throw new Error('removal fault'); });
  try {
    expect(() => f.scope.dispose()).toThrow('removal fault'); expect(f.scope.disposed).toBe(true);
    expect(f.physics.world.bodies.len()).toBe(after ? 0 : 1);
    expect(f.system.occupied).toBe(after ? 0 : 1);
    expect(resource.state).toBe(after ? 'disposed' : 'failed');
    fault.mockRestore();
    // Scope is already closed. The attached concrete lease still owns retry.
    f.lease.dispose(); resource.dispose();
    expect(f.system.occupied).toBe(0); expect(f.system.live).toBe(0); expect(f.physics.world.bodies.len()).toBe(0);
  } finally { fault.mockRestore(); f.lease.dispose(); f.dispose(); }
});


test.each(['body', 'collider'])('failed %s allocation cleanup quarantines only the new body until explicit lease cleanup', stage => {
  const f = fixture(), unrelated = f.physics.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(30, 0, 0));
  const createBody = f.physics.world.createRigidBody.bind(f.physics.world), createCollider = f.physics.world.createCollider.bind(f.physics.world);
  const create = vi.spyOn(f.physics.world, 'createRigidBody').mockImplementation(desc => { const result = createBody(desc); if (stage === 'body') throw new Error('allocation fault'); return result; });
  const collider = vi.spyOn(f.physics.world, 'createCollider').mockImplementation((desc, parent) => { createCollider(desc, parent); throw new Error('allocation fault'); });
  const removal = vi.spyOn(f.physics.world, 'removeRigidBody').mockImplementation(() => { throw new Error('removal fault'); });
  try {
    expect(() => NativeRigidCorpse.prepare(f.lease, specimen().native)).toThrow('allocation cleanup failed');
    expect(f.system.occupied).toBe(1); expect(f.lease.state).toBe('prepared'); expect(f.physics.world.bodies.len()).toBe(2);
    expect(() => f.scope.dispose()).toThrow('removal fault'); expect(f.scope.disposed).toBe(true); expect(f.system.occupied).toBe(1);
    create.mockRestore(); collider.mockRestore(); removal.mockRestore(); f.lease.dispose(); f.lease.dispose();
    expect(f.system.occupied).toBe(0); expect(f.physics.world.bodies.len()).toBe(1); expect(unrelated.isValid()).toBe(true);
    expect(unrelated.translation()).toEqual({ x: 30, y: 0, z: 0 });
  } finally { create.mockRestore(); collider.mockRestore(); removal.mockRestore(); f.lease.dispose(); f.dispose(); }
});


test('native eligibility conservatively refuses a scaled decorative joint even outside hull ancestry', () => {
  const f = fixture(), s = specimen(), decoration = new Bone(); decoration.scale.setScalar(2); s.legacy.root.add(decoration);
  const joints = [...s.joints, { name: 'decoration', parent: -1, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 2, y: 2, z: 2 } }];
  try {
    expect(() => prepareRigidCorpse(R, recipe, s.legacy.root, s.legacy.bones, 1, 'rigid')).not.toThrow();
    expect(() => NativeRigidCorpse.prepare(f.lease, { ...s.native, joints })).toThrow('Unsafe numeric corpse joint');
    expect(counts(f)).toEqual({ live: 0, reserved: 1, occupied: 1, bodies: 0, colliders: 0, joints: 0 });
  } finally { f.dispose(); }
});

/** Coordinate-origin regression only: synthetic hulls are not Medusa contact admission. */
test.each([0, -0.5])('finite pivot %s allocates at the lethal root with positive inertia and cleans up', bodyY => {
  const f = fixture(), s = specimen();
  try {
    const resource = NativeRigidCorpse.prepare(f.lease, { ...s.native, dims: { ...s.native.dims, bodyY } });
    const body = physicalBody(f.physics, resource);
    expect(body.translation().x).toBeCloseTo(s.native.position.x, 6);
    expect(body.translation().y).toBeCloseTo(s.native.position.y, 6);
    expect(body.translation().z).toBeCloseTo(s.native.position.z, 6);
    resource.activate(); f.physics.step(); resource.capture(FIXED_STEP);
    // Rapier applies changed mass properties at its next world step.
    expect(body.localCom().y).toBeCloseTo(bodyY * .6 * s.native.scale, 6);
    expect(Object.values(body.translation()).every(Number.isFinite)).toBe(true);
    expect(body.principalInertia().x).toBeGreaterThan(0);
    expect(body.principalInertia().y).toBeGreaterThan(0);
    expect(body.principalInertia().z).toBeGreaterThan(0);
    resource.dispose();
    expect(counts(f)).toEqual({ live: 0, reserved: 0, occupied: 0, bodies: 0, colliders: 0, joints: 0 });
  } finally { f.dispose(); }
});

test('invalid pivot, extents and underflowed inertia refuse without consuming a reservation', () => {
  const f = fixture(), s = specimen();
  try {
    const before = counts(f);
    for (const patch of [{ bodyY: Number.NaN }, { bodyY: Infinity }, { bodyY: -Infinity },
      ...['halfWidth', 'bodyHalfLen', 'bodyRadius'].flatMap(key => [0, -1, Number.NaN, Infinity].map(value => ({ [key]: value }))),
      { bodyY: 0, halfWidth: 1e-30, bodyHalfLen: 1e-30, bodyRadius: 1e-30 }]) {
      expect(() => NativeRigidCorpse.prepare(f.lease, { ...s.native, dims: { ...s.native.dims, ...patch } })).toThrow();
      expect(counts(f)).toEqual(before); expect(f.lease.state).toBe('reserved');
    }
  } finally { f.dispose(); }
});
