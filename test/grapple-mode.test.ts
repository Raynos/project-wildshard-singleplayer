// oxlint-disable-next-line import/no-nodejs-modules -- Authenticate the shipping native law and load real Rapier bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- A source hash fences the independent native oracle.
import { createHash } from 'node:crypto';
import { beforeAll, expect, it } from 'vitest';
import { Vector3, PerspectiveCamera } from 'three';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { groups } from '../src/engine/physics/groups';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { GrappleSim, type GrappleCourse, type GrappleBody, type GrappleView } from '../src/game/plugin/mover';
import { Grapple } from '../src/sdk/modes';
import { parseModes } from '../src/format/modes';
import source from '../src/shards/nine-dragon-stack/shard.config';
import { shardfileRules } from '../src/game/shardfile/schema';
import { withoutRuntimeRows } from '../src/game/plugin/headless';
import { NINE_GRAPPLE } from '../src/shards/nine-dragon-stack/data/modes';
import { NativeGrappleSim } from './fixtures/modes/nativeGrapple';
import oracle from './fixtures/modes/nativeGrapple.json' with { type: 'json' };

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
function boot(Law: typeof GrappleSim | typeof NativeGrappleSim) {
  const physics = new Physics(rapier);
  physics.world.createCollider(physics.R.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0).setCollisionGroups(groups('WORLD')));
  const motor = new CharacterMotor(physics, { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'] });
  const body: GrappleBody = { position: new Vector3(0, 0.03, 0), velocity: new Vector3(), onGround: true, motor };
  const course: GrappleCourse = { name: 'oracle', mode: NINE_GRAPPLE, hooks: [new Vector3(0, 2.5, 14), new Vector3(0, 2.5, 19)] };
  const events: string[] = [], law = new Law({ physics, body }, course, { fire: () => { events.push('fire'); }, bite: () => { events.push('bite'); }, zip: () => { events.push('zip'); },
    miss: () => { events.push('miss'); }, reel: () => { events.push('reel'); }, dock: () => { events.push('dock'); }, release: active => { events.push(active ? 'bail' : 'release'); } });
  const camera = new PerspectiveCamera(78, 402 / 874, 0.1, 100);
  const view: GrappleView = { eye: camera.position, update: () => { camera.position.copy(body.position); camera.position.y += 1.68; camera.lookAt(0, 2.5, 14); camera.updateMatrixWorld(true); },
    project: (point, out) => out.copy(point).project(camera), forward: out => camera.getWorldDirection(out) };
  physics.step();
  return { physics, motor, body, law, view, events, dispose: () => { motor.dispose(); physics.dispose(); } };
}
it('retains the real native landing/selection, phase, motor, cues and restore law for 10k steps', () => {
  expect(createHash('sha256').update(readFileSync('test/fixtures/modes/nativeGrapple.txt')).digest('hex')).toBe(oracle.sourceSha256);
  expect(createHash('sha256').update(readFileSync('test/fixtures/modes/nativeGrapple.ts')).digest('hex')).toBe(oracle.adapterSha256);
  const actual = boot(GrappleSim), native = boot(NativeGrappleSim);
  let crossings = 0, misses = 0;
  try {
    for (let tick = 0; tick < 10000; tick++) {
      for (const value of [actual, native]) {
        if (tick % 200 === 0) {
          value.law.release(); value.body.position.set(tick % 600 === 0 ? 70 : 0, 0.03, 0);
          value.view.update?.(); value.law.lock(value.view, () => null, () => false); value.law.fire(value.view);
        }
        value.physics.step(); value.law.traverse(1 / 60);
        if (tick % 97 === 0) value.law.restore(value.law.snapshot());
      }
      expect(actual.law.snapshot()).toEqual(native.law.snapshot());
      expect(actual.body.position).toEqual(native.body.position); expect(actual.body.velocity).toEqual(native.body.velocity);
      expect(actual.motor.snapshot()).toEqual(native.motor.snapshot()); expect(actual.events).toEqual(native.events);
      if (actual.law.phase === 'zip') crossings++; if (actual.law.phase === 'miss') misses++;
    }
    expect(crossings).toBeGreaterThan(100); expect(misses).toBeGreaterThan(20);
  } finally { actual.dispose(); native.dispose(); }
});
it('authors bounded native profiles with independent clone parameters and refuses unsafe declarations', () => {
  const grapple = new Grapple(); expect(grapple.toModeData()).toEqual(NINE_GRAPPLE);
  const copy = grapple.clone(); expect(copy.toModeData()).toEqual(NINE_GRAPPLE); expect(copy.options).not.toBe(grapple.options);
  expect(parseModes({ grapple: [grapple.toModeData()] }).grapple).toEqual([NINE_GRAPPLE]);
  for (const row of [{ ...NINE_GRAPPLE, zipSpeed: Infinity }, { ...NINE_GRAPPLE, minRange: 40 }, { ...NINE_GRAPPLE, biteTime: 0 },
    { ...NINE_GRAPPLE, windowX: 2 }, { ...NINE_GRAPPLE, hooks: [] }]) expect(() => parseModes({ grapple: [row] })).toThrow();
  expect(() => parseModes({ grapple: [NINE_GRAPPLE, NINE_GRAPPLE] })).toThrow();
});

it('requires the declared native mode owner and leaves the data host without synthetic traversal', () => {
  expect(source.modes?.grapple).toEqual([NINE_GRAPPLE]);
  expect(withoutRuntimeRows(source).modes?.grapple).toBeUndefined();
  expect(shardfileRules({ ...source, runtime: null })).toContain('traverse modes require runtime.binds modes until the data client owns their player phase');
  const runtime = source.runtime;
  if (runtime === null) throw new Error('Missing declared native owner');
  expect(shardfileRules({ ...source, runtime: { ...runtime, binds: runtime.binds?.filter(bind => bind !== 'modes') } })).toContain('traverse modes require runtime.binds modes until the data client owns their player phase');
});
