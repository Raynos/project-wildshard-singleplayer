import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { NativeCreaturePose, type NativeCreaturePoseRecipe } from '../src/game/plugin/animation';

const recipe: NativeCreaturePoseRecipe = { custom: true, joints: [
  { name: 'body', parent: -1, position: [0, 1, 0], order: 'YXZ', scale: [1, 1, 1] },
  { name: 'head', parent: 0, position: [0, 1, 0], order: 'YXZ', scale: [1, 1, 1] },
] };
function actor(): AnimalSim {
  const body = new AnimalSim({ kind: 'hunter', label: 'Hunter', variant: 'common', rarity: 'common', hp: 30, aggressive: true,
    dims: { bodyY: 1, bodyHalfLen: 1, bodyRadius: .4, headRadius: .3, legLen: 1, feet: [], halfWidth: .4 },
    mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 20, relentless: false } },
  1, 1, 'hunter', { heightAt: () => 0, random: () => .5 });
  body.position.set(10, 0, 20); return body;
}
test('native poses keep contact publication separate and restore quietly before publishing current joints', () => {
  const advanceHead: NonNullable<ConstructorParameters<typeof NativeCreaturePose>[2]> = context => {
    const head = context.bones['head'];
    if (head === undefined) throw new Error('Missing test head');
    head.position.x = 2;
  };
  const body = actor(), pose = new NativeCreaturePose(body, recipe, advanceHead);
  pose.publish();
  const initial = new Vector3(); pose.headWorld(initial);
  body.position.x += 5; pose.advance(.1, 1, true);
  const held = new Vector3(); pose.headWorld(held);
  expect(held.equals(initial)).toBe(true);
  const wire = pose.snapshot(), resumedActor = actor(); resumedActor.position.copy(body.position);
  const resumed = new NativeCreaturePose(resumedActor, recipe, advanceHead);
  resumed.restore(wire); resumed.headWorld(held);
  expect(held.equals(initial)).toBe(true);
  const savedHead = resumed.bones['head'];
  if (savedHead === undefined) throw new Error('Missing restored head');
  expect(savedHead.position.x).toBeGreaterThan(0);
  const before = resumed.snapshot();
  const parsed: unknown = JSON.parse(wire);
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Missing saved pose');
  const invalidScalar = JSON.stringify({ ...parsed, scalar: '{}' });
  for (const invalid of ['{}', invalidScalar, wire.replace('"version":1', '"version":99'), wire.replace('"recipe":', '"foreign":')]) {
    expect(() => resumed.restore(invalid)).toThrow();
    expect(resumed.snapshot()).toBe(before);
  }
  resumed.publish(); resumed.headWorld(held);
  expect(held.x).toBeGreaterThan(initial.x);
  const rear = new Vector3(), front = new Vector3(); resumed.bodyCapsule(rear, front);
  expect([rear.x, rear.y, rear.z].every(Number.isFinite)).toBe(true);
  expect(front.distanceTo(rear)).toBeGreaterThan(0);
  expect(() => new NativeCreaturePose(actor(), recipe)).toThrow('custom pose');
  expect(() => new NativeCreaturePose(actor(), { ...recipe, joints: recipe.joints.slice(0, 1) }, advanceHead)).toThrow('volume joint');
});
