import { expect, it } from 'vitest';
import { FlightMotion } from '../../src/engine/ai/flight';
import { StrikeRunner, type StrikeActor, type StrikeContext, type StrikeSpec } from '../../src/engine/ai/strikes';
import { Events } from '../../src/engine/events/events';
import { Scope } from '../../src/engine/app/scope';

it('restores flight floor-sampling and smoothing before replaying its suffix', () => {
  const spec = { altitude: 3, climbRate: 2, diveRate: 4 }, first = new FlightMotion(spec), fresh = new FlightMotion(spec);
  const position = { x: 0, y: 3, z: 0 }, floor = (x: number) => x;
  for (let tick = 0; tick < 13; tick++) { position.x += 0.02; first.step(1 / 60, position, true, floor); }
  const serialized = JSON.stringify(first.snapshot());
  fresh.restore(JSON.parse(serialized) as ReturnType<FlightMotion['snapshot']>);
  const restoredPosition = { ...position };
  for (let tick = 0; tick < 120; tick++) {
    position.x += 0.02; restoredPosition.x += 0.02;
    first.step(1 / 60, position, true, floor); fresh.step(1 / 60, restoredPosition, true, floor);
  }
  expect(restoredPosition).toEqual(position); expect(fresh.snapshot()).toEqual(first.snapshot());
});

it.each([3, 9])('restores a strike at tick %i without losing windup or repeating its hit', (checkpoint) => {
  const spec: StrikeSpec = { id: 'fixture.hit', shape: { kind: 'point', radius: 3 }, windup: 0.1, active: 0.2,
    recover: 0.1, cooldown: 0.3, range: 3, damage: 5, tags: [], weight: () => 1 };
  const actor: StrikeActor = { position: { x: 0, y: 0, z: 0 }, alive: true, scale: 1, yaw: 0,
    startAttack: () => undefined, cancelAttack: () => undefined, setMotion: () => undefined };
  let firstHits = 0, freshHits = 0;
  const ctx: StrikeContext = { actor, target: { x: 0, y: 0, z: 1 }, canReach: () => true, hit: () => { firstHits++; } };
  const first = new StrikeRunner(), fresh = new StrikeRunner(); first.start(spec, actor, ctx.target);
  for (let tick = 0; tick < checkpoint; tick++) first.update(1 / 60, ctx);
  fresh.restore(first.snapshot(), [spec]); freshHits = firstHits;
  for (let tick = checkpoint; tick < 120; tick++) {
    first.update(1 / 60, ctx); fresh.update(1 / 60, { ...ctx, hit: () => { freshHits++; } });
  }
  expect(freshHits).toBe(1); expect(freshHits).toBe(firstHits); expect(fresh.snapshot()).toEqual(first.snapshot());
  expect(fresh.pick([spec], ctx)?.id).toBe(first.pick([spec], ctx)?.id);
});

it('restores pending events in order into fresh listeners and rejects a bad codec atomically', () => {
  const original = new Events(), replay = new Events(), scope = new Scope('snapshot-events'), observed: string[] = [];
  try {
    original.beginFrame(); original.emit('level.loaded', { id: 'one' }); original.emit('level.loaded', { id: 'two' });
    replay.on('level.loaded', ({ id }) => { observed.push(id); }, scope);
    const saved = original.snapshot((value) => structuredClone(value));
    const before = replay.snapshot((value) => value);
    expect(() => replay.restore(saved, () => { throw new Error('invalid actor id'); })).toThrow('invalid actor id');
    expect(replay.snapshot((value) => value)).toEqual(before);
    replay.restore(saved, (value) => value); replay.flush('fixed.post');
    expect(observed).toEqual(['one', 'two']);
    original.flush('fixed.post'); expect(replay.snapshot((value) => value)).toEqual(original.snapshot((value) => value));
  } finally { scope.dispose(); }
});
