import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type * as Heightfield from '#engine/world/Heightfield';
import { StrikeRunner, type StrikePhase, type StrikeSpec } from '#engine/ai/strikes';
import { fnv1a32 } from '#engine/core/rng';
import { LaneCharge } from '#shards/pine-hollow/combat/ctx';
import { creature } from '../fake/creature';

vi.mock('#engine/world/Heightfield', async (original) => ({ ...await original<typeof Heightfield>(),
  heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null }));
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
});
