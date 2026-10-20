import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { ragdollsFor } from '../src/engine/physics/ragdoll';
import { disposalErrorMessages } from '../src/engine/app/scope';
import { snapshotSimHost } from '../src/engine/sim/snapshot';
import { fixture, prepareFixture, removeFixture } from './practice-native-fixture';

let product: Awaited<ReturnType<typeof prepareFixture>>;
beforeAll(async () => { product = await prepareFixture(); }, 60000);
afterAll(removeFixture);
function hit(f: Awaited<ReturnType<typeof fixture>>, amount: number) {
  return f.combat.hit({ source: 'env', sourceTags: ['dmg.melee'], target: f.native.actor.combatActor(), amount,
    point: f.native.actor.position.clone(), dir: new Vector3(.7, .2, -.5) });
}
function motor(f: Awaited<ReturnType<typeof fixture>>) { const value = f.native.actor.motor; if (!(value instanceof CharacterMotor)) throw new Error('Missing actual native motor'); return value; }
function aggregateFault(run: () => void, messages: readonly string[]): void {
  let failure: unknown; try { run(); } catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(AggregateError);
  const causes = disposalErrorMessages(failure); for (const message of messages) expect(causes).toContain(message);
}
function logicalPose(value: string): object {
  const data: unknown = JSON.parse(value); if (typeof data !== 'object' || data === null) throw new Error('Missing pose');
  const physical: unknown = Reflect.get(data, 'physical'); if (typeof physical !== 'object' || physical === null) throw new Error('Missing physical diagnostic');
  return { ...data, physical: { ...physical, owner: undefined } };
}

test('admitted slot transfers to one real physical root; late lethal publication and retired motor have one owner', async () => {
  const f = await fixture(product, true), system = ragdollsFor(f.outside.physics);
  try {
    const old = motor(f), physics = vi.spyOn(f.outside.physics, 'step');
    expect(system.reserved).toBe(1); expect(system.live).toBe(0); const before = f.native.host.clock.snapshot();
    hit(f, 1); hit(f, 1); const result = hit(f, 10000); expect(result?.killed).toBe(true);
    expect(f.native.host.clock.snapshot()).toEqual(before); expect(f.native.actor.motor).toBeNull();
    expect(old.collider.isValid()).toBe(true); expect(old.collider.isEnabled()).toBe(false); expect(old.snapshot().enabled).toBe(false);
    expect(system.reserved).toBe(0); expect(system.live).toBe(1); expect(system.occupied).toBe(1);
    expect(physics).not.toHaveBeenCalled(); expect(f.native.pose.context.transition?.ordinal).toBe(3); expect(f.native.pose.context.deathT).toBe(0);
    const root = f.native.actor.position.clone(); f.view.renderPublishedPose(0); expect(f.view.mesh.position).toEqual(root);
    expect(() => f.native.pose.restore(f.native.pose.snapshot())).toThrow('pose-only');
    f.native.preFixed(); expect(old.collider.isValid()).toBe(false); expect(physics).not.toHaveBeenCalled();
    f.outside.physics.step(); f.native.fixed();
    expect(physics).toHaveBeenCalledTimes(1); expect(f.native.pose.context.deathT).toBeCloseTo(1 / 48, 12);
    expect(f.native.host.clock.frame).toBe(1); expect(f.native.actor.position.equals(root)).toBe(false);
    let actual: { position: Vector3; rotation: Quaternion } | undefined;
    f.outside.physics.world.forEachRigidBody(body => { if (body.isDynamic()) actual = { position: new Vector3().copy(body.translation()), rotation: new Quaternion().copy(body.rotation()) }; });
    if (actual === undefined) throw new Error('Missing physical corpse');
    f.view.renderPublishedPose(1); expect(f.view.mesh.position).toEqual(actual.position); expect(f.view.mesh.quaternion.toArray()).toEqual(actual.rotation.toArray());
    const head = f.rig.bones['head']; if (head === undefined) throw new Error('Missing head');
    f.view.mesh.updateMatrixWorld(true); expect(f.native.pose.jointPoint('head', [0, 0, 0], new Vector3()).distanceTo(head.getWorldPosition(new Vector3()))).toBeLessThan(1e-9);
    const clock = f.native.host.clock.snapshot(), scalar = f.native.pose.law.snapshot();
    for (let i = 0; i < 100; i++) { f.view.renderPublishedPose((i % 3) / 2); f.native.pose.headWorld(new Vector3()); }
    expect(f.native.host.clock.snapshot()).toEqual(clock); expect(f.native.pose.law.snapshot()).toBe(scalar);
    f.native.dispose(); f.native.dispose(); expect(system.occupied).toBe(0);
  } finally { f.owner.dispose(); }
});

test.each([false, true])('native motor setter failure after effect=%s restores both cache and collider without committing damage', async after => {
  const f = await fixture(product, true);
  try {
    f.tick(); hit(f, 1); const old = motor(f), state = f.native.snapshot(), actor = f.native.actor.snapshot();
    const bodyCount = f.outside.physics.world.bodies.len(), colliders = f.outside.physics.world.colliders.len(), enable = old.collider.setEnabled.bind(old.collider);
    let once = true;
    const fault = vi.spyOn(old.collider, 'setEnabled').mockImplementation(on => { if (!on && once) { once = false; if (after) enable(on); throw new Error('motor fault'); } enable(on); });
    expect(() => hit(f, 10000)).toThrow('motor fault'); fault.mockRestore();
    expect(f.native.snapshot()).toEqual(state); expect(f.native.actor.snapshot()).toEqual(actor); expect(f.native.actor.motor).toBe(old);
    expect(old.snapshot().enabled).toBe(true); expect(old.collider.isEnabled()).toBe(true);
    expect(f.outside.physics.world.bodies.len()).toBe(bodyCount); expect(f.outside.physics.world.colliders.len()).toBe(colliders);
    expect(ragdollsFor(f.outside.physics).reserved).toBe(1); expect(hit(f, 10000)?.killed).toBe(true);
  } finally { f.owner.dispose(); }
});

test.each([false, true])('native corpse activation failure after effect=%s is a recoverable atomic refusal', async after => {
  const f = await fixture(product, true);
  try {
    f.tick(); const old = motor(f), before = f.native.snapshot(), actor = f.native.actor.snapshot(), create = f.outside.physics.world.createRigidBody.bind(f.outside.physics.world);
    const fault = vi.spyOn(f.outside.physics.world, 'createRigidBody').mockImplementation(desc => {
      const body = create(desc), enable = body.setEnabled.bind(body);
      vi.spyOn(body, 'setEnabled').mockImplementation(on => { if (after) enable(on); throw new Error('body activation'); }); return body;
    });
    expect(() => hit(f, 10000)).toThrow('body activation'); fault.mockRestore();
    expect(f.native.snapshot()).toEqual(before); expect(f.native.actor.snapshot()).toEqual(actor); expect(f.native.actor.motor).toBe(old);
    expect(old.snapshot().enabled).toBe(true); expect(old.collider.isEnabled()).toBe(true); expect(ragdollsFor(f.outside.physics).reserved).toBe(1);
    expect(hit(f, 10000)?.killed).toBe(true); f.native.dispose(); expect(ragdollsFor(f.outside.physics).occupied).toBe(0);
  } finally { f.owner.dispose(); }
});


test.each(['beforeBodies', 'afterBodies'] as const)('lethal hit inside fixed.post %s remains at event zero until the next physics pair', async phase => {
  const f = await fixture(product, true);
  try {
    let once = true; f.native.host.onStep('proof.lethal', () => { if (once) { once = false; hit(f, 10000); } }, undefined, phase);
    f.tick(); expect(f.native.pose.context.deathT).toBe(0); expect(f.native.pose.context.transition?.elapsed).toBe(0);
    const root = f.native.actor.position.clone(); f.tick(); expect(f.native.pose.context.deathT).toBeCloseTo(1 / 48, 12);
    expect(f.native.actor.position.equals(root)).toBe(false); expect(f.native.host.clock.frame).toBe(2);
  } finally { f.owner.dispose(); }
});

test.each(['body', 'collider'])('resource %s allocation refusal preserves prior hit and exact actor publication', async stage => {
  const f = await fixture(product, true);
  try {
    f.tick(); hit(f, 1); const before = f.native.snapshot(), actor = f.native.actor.snapshot(), old = motor(f);
    const fault = stage === 'body' ? vi.spyOn(f.outside.physics.world, 'createRigidBody').mockImplementation(() => { throw new Error('allocate'); })
      : vi.spyOn(f.outside.physics.world, 'createCollider').mockImplementation(() => { throw new Error('allocate'); });
    expect(() => hit(f, 10000)).toThrow('allocate'); fault.mockRestore();
    expect(f.native.snapshot()).toEqual(before); expect(f.native.actor.snapshot()).toEqual(actor); expect(f.native.actor.motor).toBe(old);
    expect(ragdollsFor(f.outside.physics).reserved).toBe(1); expect(hit(f, 10000)?.killed).toBe(true);
  } finally { f.owner.dispose(); }
});

test('later real legacy occupancy cannot steal the admitted actor lethal slot', async () => {
  const f = await fixture(product, true), system = ragdollsFor(f.outside.physics), legacy = [];
  try {
    while (system.occupied < system.cap) {
      const resource = system.spawn({ root: f.rig.mesh, bones: f.rig.bones, dims: f.model.dims, scale: f.native.actor.scale,
        build: 'rigid', lite: false, velocity: { x: 0, y: 0, z: 0 }, hitPoint: { x: 0, y: 0, z: 0 }, dir: { x: 1, y: 0, z: 0 }, damage: 20,
        corpsePose: { complete: false, step: () => undefined, render: () => undefined } });
      if (resource === null) throw new Error('Missing remaining legacy capacity'); legacy.push(resource);
    }
    expect(system.reserved).toBe(1); expect(hit(f, 10000)?.killed).toBe(true);
    expect(system.live).toBe(system.cap); expect(system.reserved).toBe(0); expect(system.occupied).toBe(system.cap);
  } finally { for (const resource of legacy) resource.dispose(); f.owner.dispose(); }
});

test('refused native corpse pre keeps locals but post publishes the actual physical root', async () => {
  const f = await fixture(product, true);
  try {
    hit(f, 10000); const before = f.native.pose.snapshot(), diagnostic = f.native.corpse?.diagnostic(), root = f.native.actor.position.clone(), scalar = f.native.pose.law.snapshot();
    const fault = vi.spyOn(f.native.pose, 'prepareCorpseStep').mockImplementationOnce(() => { throw new Error('pose pre refused'); });
    expect(() => f.native.preFixed()).toThrow('pose pre refused'); fault.mockRestore();
    expect(logicalPose(f.native.pose.snapshot())).toEqual(logicalPose(before));
    expect(f.native.corpse?.diagnostic()).toEqual({ ...diagnostic, preTick: 1 }); f.outside.physics.step(); f.native.fixed();
    expect(f.native.actor.position.equals(root)).toBe(false); expect(f.native.pose.law.snapshot()).toBe(scalar);
    expect(f.native.pose.context.deathT).toBe(0); expect(f.native.pose.context.transition?.elapsed).toBe(0);
    f.tick(); expect(f.native.pose.context.deathT).toBeCloseTo(1 / 48, 12);
  } finally { f.owner.dispose(); }
});

test('frozen physical publication holds the exact final root, quaternion and locals at every render alpha', async () => {
  const f = await fixture(product, true), system = ragdollsFor(f.outside.physics);
  try {
    let final: { position: number[]; rotation: number[] } | undefined;
    const remove = f.outside.physics.world.removeRigidBody.bind(f.outside.physics.world);
    vi.spyOn(f.outside.physics.world, 'removeRigidBody').mockImplementation(body => {
      const p = body.translation(), q = body.rotation(); final = { position: [p.x, p.y, p.z], rotation: [q.x, q.y, q.z, q.w] }; remove(body);
    });
    hit(f, 10000); for (let i = 0; i < 310 && system.occupied > 0; i++) f.tick();
    expect(system.occupied).toBe(0); f.view.renderPublishedPose(1);
    const read = () => ({ position: f.view.mesh.position.toArray(), rotation: f.view.mesh.quaternion.toArray(),
      bones: f.rig.mesh.skeleton.bones.map(bone => ({ p: bone.position.toArray(), r: bone.rotation.toArray(), s: bone.scale.toArray() })) });
    const frozen = read(); expect(frozen.position).toEqual(final?.position); expect(frozen.rotation).toEqual(final?.rotation);
    const scalar = f.native.pose.law.snapshot();
    for (let frame = 0; frame < 4; frame++) {
      f.tick(); for (const alpha of [0, .5, 1]) { f.view.renderPublishedPose(alpha); expect(read()).toEqual(frozen); }
    }
    expect(f.native.pose.law.snapshot()).toBe(scalar); expect(f.native.actor.motor).toBeNull();
  } finally { f.owner.dispose(); }
});

test.each([false, true])('post publication failure at final freeze=%s closes the physical owner instead of silently stranding its endpoint', async frozen => {
  const f = await fixture(product, true), system = ragdollsFor(f.outside.physics);
  try {
    hit(f, 10000);
    if (frozen) for (let i = 0; i < 300; i++) f.tick();
    expect(system.live).toBe(1);
    const fault = vi.spyOn(f.native.pose, 'publishCorpseRoot').mockImplementationOnce(() => { throw new Error('publication fault'); });
    f.native.preFixed(); f.outside.physics.step(); expect(() => f.native.fixed()).toThrow('publication fault');
    expect(fault.mock.calls[0]?.[2]).toBe(frozen); fault.mockRestore();
    expect(f.native.corpse?.scope.disposed).toBe(true); expect(system.occupied).toBe(0);
    expect(() => f.native.snapshot()).toThrow('disposed');
    const clock = f.native.host.clock.snapshot(); f.native.preFixed(); f.native.fixed(); expect(f.native.host.clock.snapshot()).toEqual(clock);
    f.native.dispose(); f.native.dispose(); expect(system.occupied).toBe(0);
  } finally { f.owner.dispose(); }
});

test.each([1, 10000].flatMap(amount => ['amount', 'point', 'direction'].flatMap(field => [Number.NaN, Infinity].map(value => ({ amount, field, value })))))(
  'nonfinite native contact $field=$value refuses nominal damage $amount before damage, publication or allocation', async ({ amount, field, value }) => {
  const f = await fixture(product, true);
  try {
    f.tick(); hit(f, 1); const state = f.native.snapshot(), actor = f.native.actor.snapshot(), old = motor(f);
    const point = f.native.actor.position.clone(), dir = new Vector3(.7, .2, -.5);
    if (field === 'point') point.x = value; else if (field === 'direction') dir.y = value;
    const allocate = vi.spyOn(f.outside.physics.world, 'createRigidBody');
    expect(() => f.combat.hit({ source: 'env', sourceTags: ['dmg.melee'], target: f.native.actor.combatActor(),
      amount: field === 'amount' ? value : amount, point, dir })).toThrow('Invalid native contact');
    expect(f.native.snapshot()).toEqual(state); expect(f.native.actor.snapshot()).toEqual(actor); expect(f.native.actor.motor).toBe(old);
    expect(old.collider.isEnabled()).toBe(true); expect(old.snapshot().enabled).toBe(true); expect(allocate).not.toHaveBeenCalled();
    expect(ragdollsFor(f.outside.physics).reserved).toBe(1); expect(hit(f, 10000)?.killed).toBe(true);
  } finally { f.owner.dispose(); }
});

test('terminal post failure retains the exact occupied body after owner closure until explicit cleanup retry', async () => {
  const f = await fixture(product, true), system = ragdollsFor(f.outside.physics);
  try {
    hit(f, 10000); f.native.preFixed(); f.outside.physics.step();
    const handles = () => { const result: number[] = []; f.outside.physics.world.forEachRigidBody(body => { result.push(body.handle); }); return result; };
    const retained = handles(); expect(retained).toHaveLength(1);
    const remove = vi.spyOn(f.outside.physics.world, 'removeRigidBody').mockImplementation(() => { throw new Error('retained body'); });
    const publish = vi.spyOn(f.native.pose, 'publishCorpseRoot').mockImplementationOnce(() => { throw new Error('post failed'); });
    aggregateFault(() => { f.native.fixed(); }, ['post failed', 'retained body']); expect(publish).toHaveBeenCalledOnce(); publish.mockRestore();
    expect(f.native.corpse?.scope.disposed).toBe(true); expect(f.native.actor.alive).toBe(false);
    expect(handles()).toEqual(retained); expect(system.occupied).toBe(1); expect(system.live).toBe(1);
    aggregateFault(() => { f.native.dispose(); }, ['retained body']); expect(handles()).toEqual(retained); expect(system.occupied).toBe(1);
    for (let i = 1; i < system.cap; i++) expect(system.reserveNative(f.owner.child(`other-reservation-${String(i)}`))).not.toBeNull();
    expect(system.occupied).toBe(system.cap); expect(system.reserveNative(f.owner.child('overbook-refused'))).toBeNull();
    remove.mockRestore(); f.native.dispose(); f.native.dispose();
    expect(handles()).toEqual([]); expect(system.occupied).toBe(system.cap - 1); expect(system.live).toBe(0);
  } finally { f.owner.dispose(); }
});

test.each([false, true])('terminal motor rollback failure after native effect=%s closes admission rather than continuing without its slot', async after => {
  const f = await fixture(product, true), system = ragdollsFor(f.outside.physics);
  try {
    const old = motor(f), hp = f.native.actor.hp, before = f.native.pose.snapshot(), enable = old.collider.setEnabled.bind(old.collider);
    const events = f.events.snapshot(payload => JSON.stringify(payload));
    const failure = vi.spyOn(old.collider, 'setEnabled').mockImplementation(on => { if (after) enable(on); throw new Error('motor rollback fault'); });
    expect(() => hit(f, 10000)).toThrow('failed terminally'); failure.mockRestore();
    expect(f.native.corpse?.scope.disposed).toBe(true); expect(f.native.actor.alive).toBe(false); expect(f.native.actor.hp).toBe(hp);
    // Logical pose was never committed; only the diagnostic records terminal resource closure.
    const pose: unknown = JSON.parse(f.native.pose.snapshot()), previous: unknown = JSON.parse(before);
    if (typeof pose !== 'object' || pose === null || typeof previous !== 'object' || previous === null) throw new Error('Missing diagnostic');
    expect(Reflect.get(pose, 'published')).toEqual(Reflect.get(previous, 'published')); expect(Reflect.get(pose, 'history')).toEqual(Reflect.get(previous, 'history'));
    expect(f.events.snapshot(payload => JSON.stringify(payload))).toEqual(events);
    expect(old.collider.isValid()).toBe(false); expect(system.occupied).toBe(0); f.native.dispose();
  } finally { f.owner.dispose(); }
});

test.each([false, true])('retired controller removal failure after effect=%s stays explicitly retryable after terminal closure', async after => {
  const f = await fixture(product, true), system = ragdollsFor(f.outside.physics);
  try {
    const old = motor(f), controllers = f.outside.physics.world.characterControllers.size;
    hit(f, 10000);
    const remove = f.outside.physics.world.removeCharacterController.bind(f.outside.physics.world);
    const fault = vi.spyOn(f.outside.physics.world, 'removeCharacterController').mockImplementation(controller => {
      if (after) remove(controller); throw new Error('controller retirement fault');
    });
    aggregateFault(() => { f.native.preFixed(); }, ['controller retirement fault']); expect(fault).toHaveBeenCalled(); expect(f.native.corpse?.scope.disposed).toBe(true);
    expect(old.collider.isValid()).toBe(false); expect(system.occupied).toBe(0);
    expect(f.outside.physics.world.characterControllers.size).toBe(after ? controllers - 1 : controllers);
    fault.mockRestore(); f.native.dispose(); f.native.dispose(); expect(f.outside.physics.world.characterControllers.size).toBe(controllers - 1);
  } finally { f.owner.dispose(); }
});

test('physical version3 diagnostics are quiet observations and whole-world/pose restoration remains refused', async () => {
  const f = await fixture(product, true);
  try {
    const living: unknown = JSON.parse(f.native.pose.snapshot());
    expect(living).toMatchObject({ version: 3, physical: { active: false, frozen: false, owner: { lease: 'reserved', resource: null } } });
    hit(f, 10000); f.tick(); const state = f.native.snapshot(), diagnostic: unknown = JSON.parse(state.pose);
    expect(diagnostic).toMatchObject({ version: 3, physical: { active: true, frozen: false,
      owner: { lease: 'live', resource: 'live', birthFrame: 0, preTick: 1, postTick: 1, prepared: false, terminal: false } } });
    for (let i = 0; i < 100; i++) { f.native.corpse?.diagnostic(); f.native.pose.snapshot(); }
    expect(f.native.snapshot()).toEqual(state); expect(() => f.native.pose.restore(state.pose)).toThrow('pose-only');
    expect(() => snapshotSimHost(f.native.host)).toThrow('Borrowed simulation snapshots'); expect(f.native.snapshot()).toEqual(state);
    f.outside.dispose(); f.native.dispose(); f.native.dispose(); expect(ragdollsFor(f.outside.physics).occupied).toBe(0);
  } finally { f.owner.dispose(); }
});

test('failed activation cleanup quarantines the provisional body and exposes its real diagnostic state', async () => {
  const f = await fixture(product, true), system = ragdollsFor(f.outside.physics);
  try {
    const hp = f.native.actor.hp, before = logicalPose(f.native.pose.snapshot()), create = f.outside.physics.world.createRigidBody.bind(f.outside.physics.world);
    const allocation = vi.spyOn(f.outside.physics.world, 'createRigidBody').mockImplementation(desc => {
      const body = create(desc); vi.spyOn(body, 'setEnabled').mockImplementation(() => { throw new Error('activation fault'); }); return body;
    });
    const removal = vi.spyOn(f.outside.physics.world, 'removeRigidBody').mockImplementation(() => { throw new Error('cleanup fault'); });
    aggregateFault(() => { hit(f, 10000); }, ['activation fault', 'cleanup fault']); expect(allocation).toHaveBeenCalledOnce(); expect(removal).toHaveBeenCalled(); allocation.mockRestore();
    expect(f.native.actor.hp).toBe(hp); expect(f.native.actor.alive).toBe(false); expect(logicalPose(f.native.pose.snapshot())).toEqual(before);
    expect(f.native.corpse?.diagnostic()).toMatchObject({ terminal: true, lease: 'prepared', resource: 'failed' });
    expect(f.native.corpse?.scope.disposed).toBe(true); expect(system.occupied).toBe(1); expect(f.outside.physics.world.bodies.len()).toBe(1);
    aggregateFault(() => { f.native.dispose(); }, ['cleanup fault']); removal.mockRestore(); f.native.dispose(); f.native.dispose();
    expect(system.occupied).toBe(0); expect(f.outside.physics.world.bodies.len()).toBe(0);
  } finally { f.owner.dispose(); }
});

test('duplicate and mismatched owning phase identities refuse without advancing pose or resource state', async () => {
  const f = await fixture(product, true);
  try {
    hit(f, 10000); const owner = f.native.corpse; if (owner === undefined) throw new Error('Missing corpse owner');
    const initial = f.native.snapshot(); expect(() => owner.pre(2, 1 / 60)).toThrow('mismatched'); expect(() => owner.post(99)).toThrow('mismatched');
    expect(f.native.snapshot()).toEqual(initial); f.native.preFixed(); const prepared = f.native.snapshot();
    expect(() => f.native.preFixed()).toThrow('Duplicate'); expect(f.native.snapshot()).toEqual(prepared);
    f.outside.physics.step(); f.native.fixed(); const published = f.native.snapshot(); expect(() => owner.post(1)).toThrow('Duplicate');
    expect(f.native.snapshot()).toEqual(published); f.tick(); expect(f.native.pose.context.deathT).toBeCloseTo(2 / 48, 12);
  } finally { f.owner.dispose(); }
});

test('lethal entry between pre and physics publishes the moved physical root without inventing a prepared local step', async () => {
  const f = await fixture(product, true);
  try {
    f.native.preFixed(); hit(f, 10000); const entry = f.native.actor.position.clone(); f.outside.physics.step(); f.native.fixed();
    expect(f.native.actor.position.equals(entry)).toBe(false); expect(f.native.pose.context.deathT).toBe(0);
    expect(f.native.pose.context.transition?.elapsed).toBe(0); f.tick(); expect(f.native.pose.context.deathT).toBeCloseTo(1 / 48, 12);
  } finally { f.owner.dispose(); }
});

test('actual antipodal physical quaternion endpoints interpolate the short arc and remain exact at alpha0/1', async () => {
  const f = await fixture(product, true);
  try {
    hit(f, 10000); f.tick(); let handle: number | undefined;
    f.outside.physics.world.forEachRigidBody(body => { if (body.isDynamic()) handle = body.handle; });
    if (handle === undefined) throw new Error('Missing physical root');
    const body = f.outside.physics.world.getRigidBody(handle), previous = new Quaternion().copy(body.rotation());
    // Same physical orientation, opposite quaternion representation; no solver or motion parameters change.
    body.setRotation({ x: -previous.x, y: -previous.y, z: -previous.z, w: -previous.w }, true); f.tick();
    const current = new Quaternion().copy(body.rotation()); expect(previous.dot(current)).toBeLessThan(0);
    const state = f.native.snapshot();
    f.view.renderPublishedPose(0); expect(f.view.mesh.quaternion.toArray()).toEqual(previous.toArray());
    f.view.renderPublishedPose(1); expect(f.view.mesh.quaternion.toArray()).toEqual(current.toArray());
    f.view.renderPublishedPose(.5); const middle = f.view.mesh.quaternion.clone().normalize(), from = previous.clone().normalize(), to = current.clone().normalize();
    expect(middle.angleTo(from)).toBeCloseTo(from.angleTo(to) / 2, 6); expect(middle.angleTo(to)).toBeCloseTo(from.angleTo(to) / 2, 6);
    expect(f.native.snapshot()).toEqual(state);
  } finally { f.owner.dispose(); }
});

test.each([false, true])('physical live/frozen=%s placement refuses before actor, body, publication or view writes', async frozen => {
  const f = await fixture(product, true), system = ragdollsFor(f.outside.physics);
  try {
    hit(f, 10000); if (frozen) for (let i = 0; i < 310 && system.occupied > 0; i++) f.tick(); else f.tick();
    f.view.renderPublishedPose(1);
    const observe = () => {
      const bodies: { handle: number; position: object; rotation: object }[] = [];
      f.outside.physics.world.forEachRigidBody(body => { bodies.push({ handle: body.handle, position: { ...body.translation() }, rotation: { ...body.rotation() } }); });
      return { native: f.native.snapshot(), actor: f.native.actor.snapshot(), bodies,
        view: { p: f.view.mesh.position.toArray(), q: f.view.mesh.quaternion.toArray(), bones: f.rig.mesh.skeleton.bones.map(bone => bone.matrixWorld.toArray()) } };
    };
    const before = observe(); expect(() => f.native.place({ x: 30, y: 7, z: -20 }, 1)).toThrow('Physical native placement is unsupported'); expect(observe()).toEqual(before);
    expect(() => f.view.place(30, -20, 1, 7)).toThrow('Physical native placement is unsupported'); expect(observe()).toEqual(before);
  } finally { f.owner.dispose(); }
});
