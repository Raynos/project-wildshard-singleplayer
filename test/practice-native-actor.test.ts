import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { creatureBodyShape } from '../src/engine/sim/bands';
import { CreatureBodies } from '../src/engine/physics/creatures';
import { borrowedDecisionControl } from '../src/game/shardfile/borrowedDecisions';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { fixture, prepareFixture, removeFixture, transitionRows } from './practice-native-fixture';

let product: Awaited<ReturnType<typeof prepareFixture>>;
beforeAll(async () => { product = await prepareFixture(); }, 60000);
afterAll(removeFixture);

function hit(f: Awaited<ReturnType<typeof fixture>>, amount: number) {
  return f.combat.hit({ source: 'env', sourceTags: ['dmg.melee'], target: f.native.actor.combatActor(), amount,
    point: f.native.actor.position.clone(), dir: new Vector3(1, 0, 0) });
}

test('one real native actor owns the exact page capsule; the bound view owns only query hitboxes', async () => {
  const f = await fixture(product);
  try {
    const a = f.native.actor, motor = a.motor;
    expect(motor).toBeInstanceOf(CharacterMotor);
    if (!(motor instanceof CharacterMotor)) throw new Error('Missing real motor');
    expect(motor.opts).toEqual({ ...creatureBodyShape(a.dims, a.scale), group: 'CREATURE', blockedBy: ['WORLD', 'PLAYER', 'CREATURE'], owner: a });
    expect(f.view.simulationBound).toBe(true); expect(f.view.combatActor()).toBe(a.combatActor());
    const colliders = f.outside.physics.world.colliders.len(), boxes = new CreatureBodies(f.outside.physics);
    boxes.sync([f.view], f.outside.player.position);
    expect(f.outside.physics.world.colliders.len()).toBe(colliders + 2); expect(boxes.bodies).toBe(0); expect(a.motor).toBe(motor);
    const physics = vi.spyOn(f.outside.physics, 'step');
    f.native.fixed(); expect(physics).not.toHaveBeenCalled();
    expect(f.native.host.state.tick).toBe(1); expect(f.native.host.clock.frame).toBe(1);
    expect(() => f.view.update(1 / 30, 500, true)).not.toThrow();
    expect(f.native.host.state.tick).toBe(1); expect(f.native.pose.context.t).toBe(1 / 60);
    boxes.remove(f.view);
    f.native.control.fighting = false; a.setMotion(0, 0);
    f.native.place({ x: 90, y: 0, z: 90 }, 0); f.native.fixed(); expect(a.motor).toBeNull();
    f.native.place({ x: 0, y: 0, z: 3.1 }, Math.PI); f.native.fixed();
    expect(a.motor).toBeInstanceOf(CharacterMotor); expect(a.motor).not.toBe(motor);
  } finally { f.owner.dispose(); }
});

test('same-time real hits latch each prior publication and lethal state is published synchronously', async () => {
  const f = await fixture(product);
  try {
    f.tick(); const n = f.native, before = n.snapshot(), scalar = n.pose.law.snapshot(), clock = n.host.clock.snapshot();
    const x = n.pose.bones['head']?.position.x; if (x === undefined) throw new Error('Missing head');
    const receipts: number[] = []; let deaths = 0;
    f.events.on('damage.dealt', value => { receipts.push(value.dealt); }, f.owner);
    f.events.on('actor.died', () => { deaths++; }, f.owner);
    expect(hit(f, 1)?.dealt).toBeGreaterThan(0); const stamp = n.actor.lastHitT;
    expect(n.pose.context.transition?.ordinal).toBe(1); expect(n.pose.context.transition?.entry['head']?.position.x).toBe(x);
    expect(n.pose.bones['head']?.position.x).toBe(x + 1); expect(receipts).toEqual([]);
    hit(f, 1); expect(n.actor.lastHitT).toBe(stamp);
    expect(n.pose.context.transition?.ordinal).toBe(2); expect(n.pose.context.transition?.entry['head']?.position.x).toBe(x + 1);
    expect(n.pose.bones['head']?.position.x).toBe(x + 2);
    hit(f, 10000);
    expect(n.pose.context.transition?.ordinal).toBe(3); expect(n.pose.context.transition?.kind).toBe(2);
    expect(n.pose.context.transition?.entry['head']?.position.x).toBe(x + 2); expect(n.pose.bones['head']?.position.x).toBe(x + 4);
    expect(n.pose.context.alive).toBe(false); expect(n.pose.context.deathT).toBe(0); expect(n.pose.context.attack).toBe(-1);
    expect(n.pose.law.snapshot()).toBe(scalar); expect(n.host.clock.snapshot()).toEqual(clock); expect(n.control.snapshot()).toBe(before.control);
    f.view.renderPublishedPose(0); expect(f.rig.bones['head']?.position.x).toBe(x + 4);
    hit(f, 1); expect(n.pose.context.transition?.ordinal).toBe(3);
    f.events.flush('update'); f.events.flush('update'); expect(receipts).toHaveLength(3); expect(deaths).toBe(1);
  } finally { f.owner.dispose(); }
});

test('zero, one and one hundred reads do not alter actual actor/control/events/RNG/pose continuation', async () => {
  const f = await fixture(product);
  try {
    f.tick(); hit(f, 1); const before = f.native.snapshot();
    for (const count of [0, 1, 100]) {
      for (let i = 0; i < count; i++) {
        f.native.pose.headWorld(new Vector3()); f.view.bodyCapsule(new Vector3(), new Vector3());
        f.view.renderPublishedPose((i % 3) / 2); expect(f.native.pose.context.transition?.ordinal).toBe(1);
      }
      expect(f.native.snapshot()).toEqual(before);
    }
  } finally { f.owner.dispose(); }
});

test('real decision and strike owner progresses once per fixed tick independently of render cadence', async () => {
  const run = async (reads: readonly number[]) => {
    const f = await fixture(product), phases = new Set<string>(), endpoints: string[] = [];
    try {
      for (let tick = 0; tick < 180; tick++) {
        f.tick(); phases.add(f.native.control.strikeState);
        for (let i = 0; i < (reads[tick % reads.length] ?? 0); i++) f.view.update(1 / 120, 999, true);
        endpoints.push(JSON.stringify(f.native.snapshot()));
      }
      return { endpoints, phases: [...phases], health: f.player.health.attributes.health };
    } finally { f.owner.dispose(); }
  };
  const baseline = await run([0]); expect(baseline.phases).toContain('windup'); expect(baseline.phases).toContain('active');
  expect(baseline.health).toBeLessThan(100);
  for (const cadence of [[1, 0], [1], [2], [0, 0, 17, 0, 100]]) expect(await run(cadence)).toEqual(baseline);
}, 30000);

test('actual stagger displacement is measured and explicit placement resets history without a hidden clock', async () => {
  const f = await fixture(product);
  try {
    f.native.control.fighting = false;
    f.native.actor.setMotion(0, 0); f.tick(); f.native.actor.stagger(new Vector3(1, 0, 0));
    let moved = 0;
    for (let i = 0; i < 20; i++) { f.tick(); moved += f.native.pose.context.transition?.displacement.distance ?? 0; }
    expect(moved).toBeGreaterThan(.5); expect(f.native.actor.speed).toBe(0);
    const clock = f.native.host.clock.snapshot(); f.native.place({ x: 10, y: 0, z: 10 }, 1);
    expect(f.native.host.clock.snapshot()).toEqual(clock); expect(f.native.pose.context.transition?.displacement.total).toBe(0);
    f.tick(); expect(f.native.pose.context.transition?.displacement.distance).toBeLessThan(.01);
  } finally { f.owner.dispose(); }
});

test('scoped disposal detaches the decision and motor, and retry/reload creates fresh exact owners', async () => {
  const f = await fixture(product), initial = f.native.snapshot(), id = f.native.actor.entityId;
  const native = f.native, motor = native.actor.motor;
  for (let i = 0; i < 20; i++) f.tick(); hit(f, 1);
  native.dispose(); const closed = native.actor.snapshot(); native.fixed(); expect(native.actor.snapshot()).toEqual(closed);
  expect(() => native.snapshot()).toThrow('disposed');
  expect(() => borrowedDecisionControl(native.actor)).toThrow();
  if (!(motor instanceof CharacterMotor)) throw new Error('Missing motor');
  expect(f.outside.physics.world.colliders.contains(motor.collider.handle)).toBe(false);
  f.owner.dispose(); expect(f.events.census()).toEqual({ listeners: 0, answerers: 0 });
  for (let retry = 0; retry < 2; retry++) {
    const fresh = await fixture(product);
    try { expect(fresh.native.actor.entityId).toBe(id); expect(fresh.native.snapshot()).toEqual(initial); }
    finally { fresh.owner.dispose(); }
  }
});

test('practice declaration rejects callbacks, unknown joints, mutable recurrence and missing native ownership', () => {
  const row = transitionRows();
  expect(() => numericCreaturePose({ ...row, practiceTransition: { ...row.practiceTransition, callback: () => undefined } })).toThrow();
  expect(() => numericCreaturePose({ ...row, practiceTransition: { ...row.practiceTransition, joints: ['body'] } })).toThrow();
  const first = row.programs[0], binding = first?.numeric; if (first === undefined || binding === undefined) throw new Error('Missing programme');
  const inputs = structuredClone(binding.inputs);
  for (const value of inputs) if (value.input === 'entry') value.owner = 'read.head';
  expect(() => numericCreaturePose({ ...row, programs: [{ ...first, numeric: { ...binding, inputs } }] })).toThrow();
});

test('versioned native transition pose round-trips quietly at every hit/death boundary and refuses invalid state atomically', async () => {
  const f = await fixture(product);
  try {
    for (const amount of [0, 1, 1, 10000]) {
      f.tick(); if (amount > 0) hit(f, amount);
      const before = f.native.snapshot(); f.native.pose.restore(before.pose);
      expect(f.native.snapshot()).toEqual(before);
      const parsed: unknown = JSON.parse(before.pose);
      if (typeof parsed !== 'object' || parsed === null || !('history' in parsed)
        || typeof parsed.history !== 'object' || parsed.history === null) throw new Error('Missing transition continuation');
      for (const invalid of [JSON.stringify({ ...parsed, version: 99 }),
        JSON.stringify({ ...parsed, history: { ...parsed.history, ordinal: -1 } }),
        JSON.stringify({ ...parsed, history: { ...parsed.history, entry: [] } })]) {
        expect(() => f.native.pose.restore(invalid)).toThrow(); expect(f.native.snapshot()).toEqual(before);
      }
    }
    // This is only the owned pose envelope. It deliberately does not promise a borrowed-world rollback.
    expect(() => f.native.host.advance(1 / 60)).toThrow('existing fixed-step driver');
  } finally { f.owner.dispose(); }
});
