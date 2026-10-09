import * as THREE from 'three';
import { describe, expect, it, vi, afterAll } from 'vitest';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { StrikeRunner, type StrikePhase, type StrikeSpec } from '../../src/engine/ai/strikes';
import { fnv1a32 } from '../../src/engine/core/rng';
import { LaneCharge } from '../../src/shards/pine-hollow/combat/ctx';
import { creature } from '../fake/creature';

// a flat, dry world through the terrain port, not a module mock (E422)
const restoreTerrain = overrideTerrain({ heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null });
afterAll(restoreTerrain);
const rows = [
  { id: 'ironhide', width: 2.4, speed: 12.5, overshoot: 7, dmg: 30, skid: 1.1, reach: 1.7, tell: 0.9 },
  { id: 'blackpaw', width: 2.6, speed: 10.5, overshoot: 5, dmg: 28, skid: 1.2, reach: 1.6, tell: 0.75 },
  { id: 'imperial', width: 2.8, speed: 11, overshoot: 8, dmg: 34, skid: 1.3, reach: 1.8, tell: 1 },
  { id: 'rival', width: 2.4, speed: 9.5, overshoot: 6, dmg: 18, skid: 1.4, reach: 1.7, tell: 0.9 },
  { id: 'king', width: 5.2, speed: 13, overshoot: 10, dmg: 32, skid: 1.6, reach: 2, tell: 1.1 },
  { id: 'thrall', width: 2.4, speed: 9, overshoot: 5, dmg: 14, skid: 1.2, reach: 1.7, tell: 0.7 },
] as const;
function spec(row: typeof rows[number]): StrikeSpec {
  return { id: `strike.${row.id}.charge`, shape: { kind: 'lane', length: 0, width: row.width }, windup: row.tell,
    active: 0, recover: row.skid, cooldown: 0, range: row.reach, damage: row.dmg, tags: ['creature.charge'], weight: () => 1,
    motion: { speed: row.speed, track: 'lead', overshoot: row.overshoot, skid: row.skid } };
}
const phase: Record<LaneCharge['state'], StrikePhase> = { none: 'idle', tell: 'windup', run: 'active', skid: 'recover' };
function replay(row: typeof rows[number], runtime: 'legacy' | 'runner'): object {
  const f = creature('crab', 'small'), actor = f.animal, player = new THREE.Vector3(0, 0, 4);
  const runner = new StrikeRunner(), lane = new LaneCharge(f.game.scene, 0xff4400, row);
  const hits: { frame: number; damage: number }[] = [], transitions: { frame: number; state: StrikePhase }[] = [];
  const frames: number[][] = []; let previous = '';
  if (runtime === 'legacy') lane.start(actor, player.x, player.z, row.tell); else runner.start(spec(row), actor, player);
  for (let frame = 1; frame <= 480; frame++) {
    if (runtime === 'legacy') lane.update(actor, 1 / 60, frame / 60, player, (damage) => { hits.push({ frame, damage }); });
    else runner.update(1 / 60, { actor, target: player, canReach: () => true, hit: (strike) => { hits.push({ frame, damage: strike.damage }); } });
    const state = runtime === 'legacy' ? phase[lane.state] : runner.state;
    if (previous !== state) { transitions.push({ frame, state }); previous = state; }
    actor.update(1 / 60, frame / 60, false);
    frames.push([frame, actor.position.x, actor.position.z, actor.speed, actor.desiredYaw]);
  }
  return { transitions, hits, bodyHash: fnv1a32(JSON.stringify(frames)) };
}
describe('S2.3 StrikeRunner replays the current Pine body-clock lanes', () => {
  it('a sphere uses live three-dimensional contact, cover and one-hit recovery', () => {
    const f = creature('crab', 'small'), runner = new StrikeRunner(), hit = vi.fn((): void => undefined);
    const strike: StrikeSpec = { id: 'strike.test.sphere', shape: { kind: 'sphere', radius: 2 }, windup: 0, active: 1, recover: 0.2, cooldown: 1, range: 5, damage: 10, tags: ['creature.charge'], weight: () => 1, units: 'world' };
    const target = { x: 0, y: f.animal.position.y + 6, z: 0 };
    const ctx = { actor: f.animal, target, canReach: () => true, hit };
    expect(runner.pick([strike], ctx)).toBeNull();
    target.y = f.animal.position.y + 3; expect(runner.pick([strike], ctx)).toBe(strike);
    runner.start(strike, f.animal, target); runner.update(0.01, ctx); runner.update(0.01, ctx);
    expect(hit).not.toHaveBeenCalled();
    target.y = f.animal.position.y + 1; ctx.canReach = () => false; runner.update(0.01, ctx); expect(hit).not.toHaveBeenCalled();
    ctx.canReach = () => true; runner.update(0.01, ctx); runner.update(0.01, ctx); expect(hit).toHaveBeenCalledExactlyOnceWith(strike);
    runner.update(1, ctx); runner.update(0.2, ctx); expect(runner.pick([strike], ctx)).toBeNull();
  });
  it.each(rows)('$id retains every body frame, phase boundary and damage', (row) => {
    const legacy = replay(row, 'legacy'); expect(legacy).toMatchSnapshot(); expect(replay(row, 'runner')).toEqual(legacy);
  });
  it('keeps list order for utility ties, ignores range/cooldown, and records ranked scores', () => {
    const runner = new StrikeRunner(), f = creature('crab', 'small'), row = rows[0], first = { ...spec(row), range: 10 },
      second = { ...first, id: 'strike.second.charge' }, far = { ...first, id: 'strike.far.charge', range: 0.5 };
    const ctx = { actor: f.animal, target: f.ctx.player, canReach: () => true, hit: (): void => undefined };
    expect(runner.pick([first, second, far], ctx)).toBe(first);
    expect(runner.lastPick).toEqual([{ id: first.id, score: 1 }, { id: second.id, score: 1 }]);
  });
  it('a blocked lane can connect when cover opens during its active window, then hits only once', () => {
    const f = creature('crab', 'small'), runner = new StrikeRunner(), hit = vi.fn((): void => undefined);
    const row = rows[0], ctx = { actor: f.animal, target: f.ctx.player, canReach: () => false, hit };
    const strike = spec(row); runner.start(strike, f.animal, f.ctx.player); runner.update(row.tell, ctx); runner.update(0.01, ctx);
    expect(hit).not.toHaveBeenCalled(); ctx.canReach = () => true; runner.update(0.01, ctx); runner.update(0.01, ctx);
    expect(hit).toHaveBeenCalledExactlyOnceWith(strike);
  });
  // SF72: a lane with no `motion` is swept, not run (Sky Reach's gale wall): it ended as a charge that never moved,
  // 26 / max(1, 0) + 1.2 = 27.2 s, instead of its declared 0.6 s.
  const wall: StrikeSpec = { id: 'strike.test.wall', shape: { kind: 'lane', length: 26, width: 6 }, windup: 1.5, active: 0.6, recover: 1.4,
    cooldown: 3.5, range: 30, damage: 12, tags: ['creature.charge'], units: 'world', weight: () => 1 };
  function sweep(strike: StrikeSpec, target: { x: number; y: number; z: number }): { active: number; recover: number; hits: number } {
    const f = creature('crab', 'small'), runner = new StrikeRunner(); let hits = 0, active = -1, recover = -1;
    const ctx = { actor: f.animal, target, canReach: () => true, hit: (): void => { hits++; } };
    runner.start(strike, f.animal, { x: f.animal.position.x, y: 0, z: f.animal.position.z + 10 });
    for (let frame = 1; frame <= 60 * 40 && runner.busy; frame++) {
      runner.update(1 / 60, ctx); f.animal.update(1 / 60, frame / 60, false);
      if (active < 0 && runner.state === 'active') active = frame;
      if (recover < 0 && runner.state === 'recover') recover = frame;
    }
    return { active, recover, hits };
  }
  it('a motionless lane ends at its declared active window and keeps its full length for contact', () => {
    const f = creature('crab', 'small'), far = { x: f.animal.position.x, y: f.animal.position.y, z: f.animal.position.z + 20 };
    const run = sweep(wall, far);
    // frames at 60 Hz, within one frame of the float clock
    expect(Math.abs(run.active - 90)).toBeLessThanOrEqual(1); expect(Math.abs(run.recover - run.active - 36)).toBeLessThanOrEqual(1);
    expect(run.hits).toBe(1);
    // off the lane's 6 m strip, no contact
    expect(sweep(wall, { ...far, x: far.x + 4 }).hits).toBe(0);
  });
  it('a lane with motion is still a charge: it runs until the actor reaches its end or the runaway timeout', () => {
    const f = creature('crab', 'small'), held = { ...wall, id: 'strike.test.held', motion: {} };
    const run = sweep(held, { x: f.animal.position.x, y: 0, z: f.animal.position.z + 100 });
    // a charge whose owner never drives the body: 26 / max(1, 0) + 1.2 s
    expect(Math.abs(run.recover - run.active - 27.2 * 60)).toBeLessThanOrEqual(1);
  });
});
