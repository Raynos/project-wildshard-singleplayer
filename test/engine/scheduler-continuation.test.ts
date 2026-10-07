import { describe, expect, it } from 'vitest';
import { TickScheduler } from '../../src/engine/app/scheduler';
import { Scope } from '../../src/engine/app/scope';

const player = { x: 0, y: 0, z: 0 };
function step(clock: TickScheduler, actor: { position: { x: number; y: number; z: number } }, tick: number): number[] {
  actor.position.z = tick % 600 < 200 ? 30 : tick % 600 < 400 ? 100 : 200;
  clock.beginFrame(tick % 70 === 0 ? 1 / 30 : 1 / 60, player);
  return [clock.takeBrainDt('ai', actor), clock.bodyDt('ai', actor)];
}
describe('privately owned single-subject clock continuation', () => {
  it.each([1, 198, 202, 398, 402, 599])('restores the exact 2,000-frame suffix at %i including half-body phase and pause', at => {
    const clock = TickScheduler.isolated(), actor = { position: { ...player } };
    for (let tick = 0; tick < at; tick++) step(clock, actor, tick);
    const saved = clock.captureIsolated(actor), restored = TickScheduler.isolated(), other = { position: { ...actor.position } };
    restored.restoreIsolated(other, saved);
    expect(restored.captureIsolated(other)).toBe(saved);
    for (let tick = at; tick < at + 2000; tick++) {
      expect(step(restored, other, tick)).toEqual(step(clock, actor, tick));
    }
  });
  it('retains an unconsumed interrupt and consumes it exactly once after restoring', () => {
    const clock = TickScheduler.isolated(), actor = { position: { ...player } };
    step(clock, actor, 450); clock.interrupt(actor, 'hit');
    const restored = TickScheduler.isolated(), other = { position: { ...actor.position } };
    restored.restoreIsolated(other, clock.captureIsolated(actor));
    expect(restored.takeBrainDt('ai', other)).toBe(clock.takeBrainDt('ai', actor));
    expect(restored.takeBrainDt('ai', other)).toBe(0);
  });
  it('refuses a shared clock, multiple subjects, active pins and wake callbacks', () => {
    const clock = TickScheduler.isolated(), a = { position: { ...player } }, b = { position: { ...player } };
    step(clock, a, 0); const saved = clock.captureIsolated(a);
    expect(() => new TickScheduler().restoreIsolated(a, saved)).toThrow('isolated');
    expect(() => new TickScheduler(clock).restoreIsolated(a, saved)).toThrow('isolated');
    clock.brainDt('ai', b);
    expect(() => clock.captureIsolated(a)).toThrow('isolated');
    clock.reset(); const scope = new Scope('pin'); clock.pin(a, scope);
    expect(() => clock.restoreIsolated(a, saved)).toThrow('isolated'); scope.dispose();
    clock.onInterrupt(a, () => undefined);
    expect(() => clock.restoreIsolated(a, saved)).toThrow('isolated');
  });
  it('fences configured rates and validates all clock fields before mutation', () => {
    const clock = TickScheduler.isolated(), actor = { position: { ...player } };
    step(clock, actor, 1); const saved = clock.captureIsolated(actor);
    const other = TickScheduler.isolated(); other.rate('ai', { bands: [{ upTo: Infinity, brainHz: 5, body: 'frame' }] });
    expect(() => other.restoreIsolated(actor, saved)).toThrow('Incompatible');
    expect(() => clock.restoreIsolated(actor, saved.replace('"credit":', '"unknown":'))).toThrow();
    expect(clock.captureIsolated(actor)).toBe(saved);
  });
});
