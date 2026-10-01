import { describe, expect, it } from 'vitest';
import { TickScheduler } from '#engine/app/scheduler';
import { Scope } from '#engine/app/scope';
import type { SystemSpec } from '#engine/app/systems';

const player = { x: 0, y: 0, z: 0 };
const actorAt = (z: number) => ({ position: { x: 0, y: 0, z } });

describe('per-subject tick scheduler', () => {
  it.each([30, 60])('at %i fps preserves elapsed time at the 60m/160m boundaries', (fps) => {
    const scheduler = new TickScheduler(), actors = [59.99, 60, 159.99, 160].map(actorAt);
    const brains = actors.map(() => [] as number[]), bodies = actors.map(() => [] as number[]);
    for (let frame = 0; frame < fps * 2; frame++) {
      scheduler.beginFrame(1 / fps, player);
      actors.forEach((actor, i) => {
        const brain = scheduler.takeBrainDt('ai', actor), body = scheduler.bodyDt('ai', actor);
        if (brain) brains[i]?.push(brain);
        if (body) bodies[i]?.push(body);
      });
    }
    expect(brains.map((ticks) => ticks.length)).toEqual([40, 20, 20, 0]);
    expect(bodies.map((ticks) => ticks.length)).toEqual([fps * 2, fps, fps, 0]);
    for (const ticks of [...brains.slice(0, 3), ...bodies.slice(0, 3)]) expect(ticks.reduce((a, b) => a + b, 0)).toBeCloseTo(2, 9);
  });
  it('distance uses the player including height, and subjects have independent clocks', () => {
    const scheduler = new TickScheduler(), a = actorAt(10), b = actorAt(100);
    scheduler.beginFrame(0.05, player);
    expect(scheduler.brainDue('ai', a)).toBe(true); expect(scheduler.brainDt('ai', a)).toBeCloseTo(0.05);
    expect(scheduler.brainDue('ai', b)).toBe(false);
    a.position.y = 200; scheduler.beginFrame(0.05, player);
    expect(scheduler.brainDt('ai', a)).toBe(0); expect(scheduler.brainDt('ai', b)).toBeCloseTo(0.1);
  });
  it('does not replay paused time when a far actor returns', () => {
    const scheduler = new TickScheduler(), a = actorAt(200);
    for (let n = 0; n < 100; n++) { scheduler.beginFrame(0.1, player); expect(scheduler.brainDt('ai', a)).toBe(0); expect(scheduler.bodyDt('ai', a)).toBe(0); }
    a.position.z = 20; scheduler.beginFrame(0.025, player);
    expect(scheduler.brainDt('ai', a)).toBe(0); expect(scheduler.bodyDt('ai', a)).toBeCloseTo(0.025);
    scheduler.beginFrame(0.025, player); expect(scheduler.brainDt('ai', a)).toBeCloseTo(0.05);
  });
  it.each(['hit', 'target.attack', 'target.dodge', 'lost.sight', 'ally.died'] as const)('%s wakes every band on the same frame and is consumed once', (why) => {
    for (const distance of [20, 100, 200]) {
      const scheduler = new TickScheduler(), actor = actorAt(distance);
      scheduler.beginFrame(1 / 60, player); expect(scheduler.takeBrainDt('ai', actor)).toBe(0);
      scheduler.interrupt(actor, why); expect(scheduler.takeBrainDt('ai', actor)).toBeGreaterThan(0);
      expect(scheduler.takeBrainDt('ai', actor)).toBe(0);
      if (distance === 200) expect(scheduler.bodyDue('ai', actor)).toBe(false);
    }
  });
  it('pins retain the near cadence at any distance and release by owner scope', () => {
    const scheduler = new TickScheduler(), actor = actorAt(1000), a = new Scope('boss'), b = new Scope('quest');
    scheduler.pin(actor, a); scheduler.pin(actor, b);
    scheduler.beginFrame(0.05, player); expect(scheduler.brainDt('npc', actor)).toBeCloseTo(0.05); expect(scheduler.bodyDt('npc', actor)).toBeCloseTo(0.05);
    a.dispose(); scheduler.beginFrame(0.05, player); expect(scheduler.brainDue('npc', actor)).toBe(true);
    b.dispose(); scheduler.beginFrame(0.05, player); expect(scheduler.brainDue('npc', actor)).toBe(false); expect(scheduler.bodyDue('npc', actor)).toBe(false);
    scheduler.pin(actor, b); expect(scheduler.brainHz('npc', actor)).toBe(0);
  });
  it('schedules weather at 10Hz with accumulated dt and FX at 30Hz below 120m', () => {
    const scheduler = new TickScheduler(), a = actorAt(119), b = actorAt(120), ticks: number[] = [];
    const system: SystemSpec = { id: 'weather', phase: 'update', tick: 'weather', run: () => undefined };
    let fx = 0;
    for (let frame = 0; frame < 60; frame++) {
      scheduler.beginFrame(1 / 60, player);
      const dt = scheduler.systemDt(system, 1 / 60); if (dt) ticks.push(dt);
      if (scheduler.takeBrainDt('fx', a)) fx++;
      expect(scheduler.brainDue('fx', b)).toBe(false);
    }
    expect(ticks).toHaveLength(10); expect(fx).toBe(30);
    expect(ticks.reduce((sum, dt) => sum + dt, 0)).toBeCloseTo(1);
  });
  it('validates declared rates and isolates subjects when forgotten', () => {
    const scheduler = new TickScheduler(), actor = actorAt(0);
    expect(() => scheduler.rate('bad', { bands: [] })).toThrow();
    expect(() => scheduler.rate('bad', { bands: [{ upTo: 10, brainHz: 0, body: 'frame' }] })).toThrow();
    expect(() => scheduler.brainDue('missing', actor)).toThrow();
    scheduler.rate('slow', { bands: [{ upTo: Infinity, brainHz: 5, body: 'frame' }] });
    scheduler.beginFrame(0.1, player); expect(scheduler.brainDue('slow', actor)).toBe(false);
    scheduler.forget(actor); scheduler.beginFrame(0.1, player); expect(scheduler.brainDue('slow', actor)).toBe(false);
  });
});
