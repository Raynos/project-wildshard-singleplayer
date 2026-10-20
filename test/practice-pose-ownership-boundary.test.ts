import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { NativeCreaturePose, type NativeCreaturePoseRecipe } from '../src/game/plugin/animation';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { CombatPipeline } from '../src/engine/combat/pipeline';

// Characterization of the actual existing owners, NOT a native practice adapter or
// an authored animation acceptance test. These expose boundaries a migration must fix.
const recipe: NativeCreaturePoseRecipe = { custom: true, joints: [
  { name: 'body', parent: -1, position: [0, 1, 0], order: 'YXZ', scale: [1, 1, 1] },
  { name: 'head', parent: 0, position: [0, .5, 0], order: 'YXZ', scale: [1, 1, 1] },
] };
function owners() {
  const actor = new AnimalSim({ kind: 'probe', label: 'Probe', variant: 'common', rarity: 'common', hp: 30,
    aggressive: true, dims: { bodyY: 1, bodyHalfLen: 1, bodyRadius: .4, headRadius: .3, legLen: 1, feet: [], halfWidth: .4 },
    mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 20, relentless: false },
  }, 1, 1, 'practice.probe', { heightAt: () => 0, now: () => 1000, random: () => .5 });
  const pose = new NativeCreaturePose(actor, recipe, context => {
    const head = context.bones['head'];
    if (head === undefined) throw new Error('Missing characterization joint');
    head.position.x = context.alive ? context.t : -1;
  });
  pose.advance(1 / 60, 1 / 60, true); pose.publish();
  return { actor, pose };
}

test('existing native publication reads are quiet, detached queries across 0, 1 and 100 reads', () => {
  for (const reads of [0, 1, 100]) {
    const { actor, pose } = owners(), actorBefore = actor.snapshot(), poseBefore = pose.snapshot();
    for (let i = 0; i < reads; i++) {
      const head = new Vector3(), rear = new Vector3(), front = new Vector3();
      pose.headWorld(head); pose.bodyCapsule(rear, front);
      head.set(999, 999, 999); rear.set(999, 999, 999);
    }
    expect(actor.snapshot()).toEqual(actorBefore); expect(pose.snapshot()).toBe(poseBefore);
  }
});

test('render-read cadence cannot change a fixed sequence of existing native endpoints', () => {
  const run = (reads: readonly number[]) => {
    const { actor, pose } = owners(), endpoints: string[] = [];
    actor.setMotion(.3, 2, 2.5);
    for (let tick = 1; tick <= 120; tick++) {
      if (tick === 30) actor.stagger(new Vector3(1, 0, 0));
      actor.step(1 / 60); pose.advance(1 / 60, tick / 60, true); pose.publish();
      endpoints.push(pose.snapshot());
      for (let i = 0; i < (reads[tick % reads.length] ?? 0); i++) pose.headWorld(new Vector3());
    }
    return { endpoints, actor: actor.snapshot() };
  };
  const baseline = run([0]);
  for (const cadence of [[1, 0], [1], [2], [0, 0, 17, 0, 100]]) expect(run(cadence)).toEqual(baseline);
});

test('same timestamp damage is distinct in the real pipeline but lastHitT cannot identify it', () => {
  const { actor } = owners(), scope = new Scope('pose-boundary'), events = new Events();
  const combat = new CombatPipeline(events, scope), amounts: number[] = [];
  events.on('damage.dealt', hit => { amounts.push(hit.dealt); }, scope);
  const hit = () => combat.hit({ source: 'env', sourceTags: [], target: actor.combatActor(), amount: 2,
    point: new Vector3(), dir: new Vector3(1, 0, 0) });
  hit(); const firstTime = actor.lastHitT; hit(); events.flush('update');
  expect(amounts).toEqual([2, 2]); expect(actor.hp).toBe(26); expect(actor.lastHitT).toBe(firstTime);
  scope.dispose();
});

test('late lethal damage leaves the existing published living pose until explicitly evaluated', () => {
  const { actor, pose } = owners(), before = pose.snapshot(), headBefore = new Vector3(), headAfter = new Vector3();
  pose.headWorld(headBefore);
  actor.applyFinalDamage(30, new Vector3(), new Vector3(1, 0, 0));
  expect(actor.alive).toBe(false); expect(pose.context.alive).toBe(true);
  pose.headWorld(headAfter); expect(headAfter).toEqual(headBefore); expect(pose.snapshot()).toBe(before);
  // This is the observed gap, not an acceptable publication contract.
});

test('advance with zero delta is not a quiet substitute for a late-hit publication API', () => {
  const { actor, pose } = owners();
  actor.setMotion(0, 3); actor.speed = 3;
  pose.advance(1 / 60, 1, true); pose.publish();
  actor.applyFinalDamage(30, new Vector3(), new Vector3(1, 0, 0));
  const actorBefore = actor.snapshot(), lawBefore = pose.law.snapshot();
  pose.advance(0, 1, true); pose.publish();
  expect(actor.snapshot()).toEqual(actorBefore);
  expect(pose.context.alive).toBe(false);
  // Gait target/normalization is evaluated even at dt=0. A new API must select
  // transition locals without silently reevaluating this unrelated continuation.
  expect(pose.law.snapshot()).not.toBe(lawBefore);
});

test('minimum stagger travels the real 0.6m while speed remains zero and pose phase holds', () => {
  const { actor, pose } = owners(), start = actor.position.clone(), phase = pose.law.phase;
  actor.stagger(new Vector3(1, 0, 0), 0);
  let measured = 0;
  for (let tick = 1; tick <= 15; tick++) {
    const previous = actor.position.clone(); actor.step(1 / 60);
    measured += actor.position.distanceTo(previous); pose.advance(1 / 60, tick / 60, true); pose.publish();
    expect(actor.speed).toBe(0);
  }
  expect(measured).toBeCloseTo(.6, 12); expect(actor.position.distanceTo(start)).toBeCloseTo(.6, 12);
  expect(pose.law.phase).toBe(phase);
});

test('native saved publications resume exactly but have no transition entry envelope', () => {
  const original = owners();
  original.actor.stagger(new Vector3(1, 0, 0));
  original.actor.step(1 / 60); original.pose.advance(1 / 60, .1, true); original.pose.publish();
  const resumed = owners(); resumed.actor.restore(original.actor.snapshot()); resumed.pose.restore(original.pose.snapshot());
  for (let tick = 1; tick <= 30; tick++) {
    for (const owner of [original, resumed]) { owner.actor.step(1 / 60); owner.pose.advance(1 / 60, .1 + tick / 60, true); owner.pose.publish(); }
    expect(resumed.actor.snapshot()).toEqual(original.actor.snapshot()); expect(resumed.pose.snapshot()).toBe(original.pose.snapshot());
  }
  const before = resumed.pose.snapshot();
  expect(() => resumed.pose.restore(before.replace('"version":1', '"version":2'))).toThrow();
  expect(resumed.pose.snapshot()).toBe(before);
});
