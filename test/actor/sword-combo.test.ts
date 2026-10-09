import { SWORD } from '../../src/game/weapons/starterEquipment';
// @vitest-environment happy-dom
// S1.2: these contracts move from Sword's viewmodel-owning class to the renderer-free Melee family.
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Sword } from '../../src/game/weapons/Sword';
import { swordRig } from '../../src/shards/driftwood-isle/weapons/swordView';
import type { SwordArms, Move } from '../../src/engine/combat/view/melee';
import { COMBO } from '../../src/game/weapons/starterMoves';
import { setAimTargets } from '../../src/engine/player/AimTargets';
import type { TargetAnimal, Targets } from '../../src/engine/combat/types';
import { setActivePhysics } from '../../src/engine/physics/active';
import { fakeWorld } from '../fake/world';
import { seedRandom } from '../fake/FakeGame';

let restoreRandom: () => void = () => undefined;
beforeEach(() => { restoreRandom = seedRandom(); setActivePhysics(null); });
afterEach(() => { restoreRandom(); setAimTargets([]); setActivePhysics(null); });

function swordFixture(contact: boolean): {
  world: ReturnType<typeof fakeWorld>; sword: Sword;
  starts: { move: string; at: number }[]; hits: { move: string; at: number; damage: number }[];
  queries: number[]; stops: number[];
} {
  const world = fakeWorld(), starts: { move: string; at: number }[] = [], hits: { move: string; at: number; damage: number }[] = [];
  const queries: number[] = [], stops: number[] = [];
  let pendingDamage = 0;
  const target: TargetAnimal = {
    kind: 'boar', alive: true, position: new THREE.Vector3(0, 0, -1.5),
    damageFor: (): number => 0,
    applyDamage: (damage): boolean => { pendingDamage = damage; return false; },
  };
  setAimTargets([target]);
  const arms: SwordArms = {
    root: new THREE.Group(), engineTrail: false,
    play: (move): void => { starts.push({ move, at: world.game.clock.elapsedTime }); },
    update: (): void => undefined,
    blade: (base, tip): void => { base.set(0, -0.2, -0.5); tip.set(0, 0.5, -1); },
  };
  const targets: Targets = { raycast: (): ReturnType<Targets['raycast']> => {
    queries.push(world.game.clock.elapsedTime);
    return contact ? { animal: target, point: new THREE.Vector3(0, 0.5, -1.5), distance: 1.5, headshot: false } : null;
  } };
  const legacyGame = world.game.asGame();
  // Record contact stops separately so window measurements use an unscaled clock; loop.test proves the slowdown.
  legacyGame.hitStop = (seconds): void => { stops.push(seconds); };
  const sword = new Sword({ game: legacyGame, player: world.player, sky: world.sky, forest: world.forest }, targets, { row: SWORD, arms, rig: swordRig(world.sky, 'wood'), allowUnlocked: true });
  sword.onMoveHitEvent = (move: Move): void => { hits.push({ move: move.name, at: world.game.clock.elapsedTime, damage: pendingDamage }); };
  world.game.onUpdate((dt, t) => { sword.update(dt, t); });
  // The fake rig's clip is the observation surface, rather than Sword's private combo state.
  return { world, sword, starts, hits, queries, stops };
}

describe('Sword three-press combo contract', () => {
  it('presses 150ms apart chain slash/backhand/finisher, applying 12/12/16 damage once per swing', () => {
    const { world, sword, starts, hits, stops } = swordFixture(true);
    sword.tryFire();
    for (let frame = 1; frame <= 90; frame++) {
      if (frame === 10 || frame === 19) sword.tryFire(); // real-time 0.15s and 0.30s, before the next frame
      world.game.advance(1 / 60);
    }
    expect(starts.map((s) => s.move)).toEqual(['slash', 'backhand', 'finisher']);
    expect(starts.map((s) => Math.round(s.at * 60))).toEqual([0, 16, 31]);
    expect(hits.map((h) => h.damage)).toEqual([12, 12, 16]);
    expect(hits.map((h) => Math.round(h.at * 60))).toEqual([5, 20, 38]);
    expect(stops).toEqual([0.06, 0.06, 0.09]);
    for (const [i, hit] of hits.entries()) {
      const start = starts[i], move = COMBO[i];
      if (start === undefined || move === undefined) throw new Error('missing combo step');
      expect(hit.at - start.at).toBeGreaterThanOrEqual(move.windup);
      expect(hit.at - start.at).toBeLessThanOrEqual(move.slashEnd);
    }
    expect(world.game.dead).toBe(false);
  });

  it('opens and closes each active window at the move timings; no ray queries during windup or recovery', () => {
    for (const [i, move] of COMBO.entries()) {
      const { world, sword, queries } = swordFixture(false);
      expect(sword.strikeMove(move, false)).toBe(true);
      for (let frame = 0; frame < 60; frame++) world.game.advance(1 / 60);
      expect(queries.length).toBeGreaterThan(0);
      expect(queries[0]).toBeCloseTo(([5, 4, 7][i] ?? 0) / 60, 12);
      expect(queries.at(-1)).toBeCloseTo(Math.floor(move.slashEnd * 60) / 60, 12);
      expect(world.game.dead).toBe(false);
    }
  });

  it('mid-swing presses queue only one successor; queue starts after the active window and combo restarts after a gap', () => {
    const { world, sword, starts } = swordFixture(false);
    sword.tryFire();
    for (let i = 0; i < 5; i++) world.game.advance(1 / 60);
    sword.tryFire(); sword.tryFire(); sword.tryFire();
    expect(starts.map((s) => s.move)).toEqual(['slash']);
    for (let i = 0; i < 10; i++) world.game.advance(1 / 60);
    expect(starts).toHaveLength(1);
    for (let i = 0; i < 75; i++) world.game.advance(1 / 60);
    expect(starts.map((s) => s.move)).toEqual(['slash', 'backhand']);
    sword.tryFire();
    expect(starts.map((s) => s.move)).toEqual(['slash', 'backhand', 'slash']);
    expect(world.game.dead).toBe(false);
  });
});
