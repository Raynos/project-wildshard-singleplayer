import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { ragdollsFor } from '../src/engine/physics/ragdoll';
import { fixture, prepareFixture, removeFixture } from './practice-native-fixture';

let product: Awaited<ReturnType<typeof prepareFixture>>;
beforeAll(async () => { product = await prepareFixture(); }, 60000);
afterAll(removeFixture);
function hit(f: Awaited<ReturnType<typeof fixture>>, amount: number) {
  return f.combat.hit({ source: 'env', sourceTags: ['dmg.melee'], target: f.native.actor.combatActor(), amount,
    point: f.native.actor.position.clone(), dir: new Vector3(.7, .2, -.5) });
}
function motor(f: Awaited<ReturnType<typeof fixture>>) { const value = f.native.actor.motor; if (!(value instanceof CharacterMotor)) throw new Error('Missing actual native motor'); return value; }

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
    hit(f, 10000); const before = f.native.pose.snapshot(), root = f.native.actor.position.clone(), scalar = f.native.pose.law.snapshot();
    const fault = vi.spyOn(f.native.pose, 'prepareCorpseStep').mockImplementationOnce(() => { throw new Error('pose pre refused'); });
    expect(() => f.native.preFixed()).toThrow('pose pre refused'); fault.mockRestore();
    expect(f.native.pose.snapshot()).toBe(before); f.outside.physics.step(); f.native.fixed();
    expect(f.native.actor.position.equals(root)).toBe(false); expect(f.native.pose.law.snapshot()).toBe(scalar);
    expect(f.native.pose.context.deathT).toBe(0); expect(f.native.pose.context.transition?.elapsed).toBe(0);
    f.tick(); expect(f.native.pose.context.deathT).toBeCloseTo(1 / 48, 12);
  } finally { f.owner.dispose(); }
});
