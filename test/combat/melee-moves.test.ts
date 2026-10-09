import { SWORD } from '../../src/game/weapons/starterEquipment';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onFault } from '../../src/engine/core/faults';
import { Sword } from '../../src/game/weapons/Sword';
import { swordRig } from '../../src/shards/driftwood-isle/weapons/swordView';
import type { SwordArms, Move } from '../../src/engine/combat/view/melee';
import { COMBO, HEAVY, REST, CHARGE, SPRINT } from '../../src/game/weapons/starterMoves';
import { SABRE_MOVES, PASS_LEFT, PASS_RIGHT } from '../../src/shards/nalati-grasslands/runtime/weapons/Sabre';
import { setAimTargets } from '../../src/engine/player/AimTargets';
import { setActivePhysics } from '../../src/engine/physics/active';
import { fakeWorld } from '../fake/world';
import { seedRandom } from '../fake/FakeGame';

let restore: () => void = () => undefined;
beforeEach(() => { vi.stubGlobal('document', new EventTarget()); vi.stubGlobal('window', new EventTarget()); restore = seedRandom(); setActivePhysics(null); });
afterEach(() => { restore(); setAimTargets([]); setActivePhysics(null); Reflect.deleteProperty(globalThis, 'document'); Reflect.deleteProperty(globalThis, 'window'); });

const moveSummary = (move: Move) => ({ ...move, keys: move.keys.map((k) => ({ t: k.t, pos: k.pos.toArray(), q: k.q.toArray() })),
  trail: { ...move.trail, color: move.trail.color.toArray() } });

describe('complete move tables and keyframes (09 §1.8)', () => {
  it('sword / iron / jian share the exact sword moves; sabre and mounted passes keep their own keys', () => {
    expect(COMBO.map((m) => [m.windup, m.slashEnd, m.total, m.damage, m.stagger, m.sweep, m.hitStop]))
      .toEqual([[0.07, 0.235, 0.35, 1, 0, 1, 0.06], [0.06, 0.22, 0.34, 1, 0, -1, 0.06], [0.1, 0.28, 0.44, 16 / 12, 0.25, 0.5, 0.09]]);
    expect([HEAVY.windup, HEAVY.slashEnd, HEAVY.total, HEAVY.damage, HEAVY.stagger, HEAVY.hitStop]).toEqual([0.06, 0.3, 0.62, 2, 1, 0.14]);
    expect(SABRE_MOVES.combo.map((m) => [m.windup, m.slashEnd, m.total, m.hitStop]))
      .toEqual([[0.07, 0.24, 0.35, 0.045], [0.06, 0.22, 0.34, 0.045], [0.1, 0.28, 0.44, 0.06]]);
    expect(SABRE_MOVES.heavy.hitStop).toBe(0.08);
    for (const pass of [PASS_LEFT, PASS_RIGHT]) expect([pass.windup, pass.slashEnd, pass.total, pass.reach, pass.hitStop]).toEqual([0.09, 0.3, 0.5, 2.8, 0.05]);
    expect({ sword: [...COMBO, HEAVY].map(moveSummary), sabre: [...SABRE_MOVES.combo, SABRE_MOVES.heavy, PASS_LEFT, PASS_RIGHT].map(moveSummary),
      poses: [REST, CHARGE, SPRINT, SABRE_MOVES.rest, SABRE_MOVES.charge, SABRE_MOVES.sprint].map((k) => ({ pos: k.pos.toArray(), q: k.q.toArray() })) }).toMatchSnapshot();
  });
  it.each([['wood', 12, 1], ['iron', 28, 1], ['jian', 12, 1], ['sabre', 24, 0.9]] as const)('%s applies its effective damage, active windows and hit-stops through real Sword code', (name, damage, scale) => {
      const world = fakeWorld(), hits: { at: number; amount: number }[] = [], stops: number[] = [];
      const arms: SwordArms = { root: new THREE.Group(), engineTrail: false, play: () => undefined, update: () => undefined,
        blade: (base, tip) => { base.set(0, -0.2, -0.5); tip.set(0, 0.5, -1); } };
      const animal = { kind: 'boar', alive: true, position: new THREE.Vector3(0, 0, -1.5), damageFor: () => 0,
        applyDamage: (amount: number) => { hits.push({ at: world.game.clock.elapsedTime, amount }); return false; } };
      setAimTargets([animal]);
      const game = world.game.asGame(); game.hitStop = (seconds) => { stops.push(seconds); };
      const moves = name === 'sabre' ? SABRE_MOVES : { combo: COMBO, heavy: HEAVY, rest: REST, charge: CHARGE, sprint: SPRINT };
      const sword = new Sword({ game, sky: world.sky, player: world.player, forest: world.forest },
        { raycast: () => ({ animal, point: animal.position, distance: 1.5, headshot: false }) },
        { row: SWORD, arms, rig: swordRig(world.sky, name === 'iron' ? 'iron' : 'wood'), damage, moves, blade: name === 'iron' ? 'iron' : 'wood', portraitFov: name === 'jian' ? 78 : 72 });
      const faults: unknown[] = []; const off = onFault((fault) => { faults.push(fault.error); });
      sword.swingScale = scale; world.game.onUpdate((dt, t) => sword.update(dt, t));
      for (const move of [...moves.combo, moves.heavy]) {
        const before = hits.length, started = world.game.clock.elapsedTime;
        expect(sword.strikeMove(move, false)).toBe(true);
        for (let n = 0; n < 60; n++) world.game.advance(1 / 60);
        expect(faults).toEqual([]); const hit = hits[before]; if (hit === undefined) throw new Error('move failed to hit');
        expect(hit.amount).toBe(Math.round(damage * move.damage)); expect(hits.length - before).toBe(1);
        expect(hit.at - started).toBeGreaterThanOrEqual(move.windup * scale - 1e-12);
        expect(hit.at - started).toBeLessThanOrEqual(move.slashEnd * scale + 1 / 60);
        expect(stops.at(-1)).toBeCloseTo(move.hitStop * scale);
      }
      off(); expect(world.game.dead).toBe(false);
    });
});
