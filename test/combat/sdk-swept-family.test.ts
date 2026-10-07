// @vitest-environment happy-dom
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { withOwner } from '../../src/engine/app/ownership';
import { SweptMelee, type MeleeEvents, type SweptMeleeDefaults } from '../../src/engine/combat/view/SweptMelee';
import type { Move } from '../../src/engine/combat/view/melee';
import type { Targets, TargetAnimal } from '../../src/engine/combat/types';
import { fnv1a32 } from '../../src/engine/core/rng';
import { Impacts } from '../../src/engine/fx/Impacts';
import { setAimTargets } from '../../src/engine/player/AimTargets';
import { setActivePhysics } from '../../src/engine/physics/active';
import { Sword, swordEvents } from '../../src/kit/weapons/melee/SweptMelee';
import { REST, CHARGE, SPRINT, COMBO, SLASH, FINISHER, HEAVY } from '../../src/kit/weapons/melee/moves';
import { SWORD_WOOD, SWORD_IRON } from '../../src/kit/weapons/melee/profiles';
import { SWORD } from '../../src/kit/weapons/equipment';
import { swordRig } from '../../src/shards/driftwood-isle/weapons/swordView';
import { SweptMelee as TrustedSwept } from '../../src/sdk/runtime/weapons/SweptMelee';
import { Sword as StarterSword, swordEvents as starterSwordEvents } from '../../src/sdk/runtime/weapons/Sword';
import { fakeWorld } from '../fake/world';
import { seedRandom } from '../fake/FakeGame';

const shell = { surface: 'shell', count: 9, atFeet: false, sparks: true } as const;
const timber = { surface: 'wood', count: 8, atFeet: false, sparks: true } as const;
const sand = { surface: 'sand', count: 10, atFeet: true, sparks: false } as const;
function copyMove(move: Move): Move { return { ...move }; }
function defaults(events: MeleeEvents): SweptMeleeDefaults {
  return { moves: { rest: REST, charge: CHARGE, sprint: SPRINT, combo: COMBO, heavy: HEAVY },
    slash: SLASH, finisher: FINISHER, heavy: HEAVY, events,
    debris: (kind) => kind === 'crab' ? shell : kind === 'sailor' ? timber : sand };
}

function trace(platform: boolean | 'starter', portrait: boolean, blade: 'wood' | 'iron', kind: string, customMoves = false) {
  const scope = new Scope('swept-parity'), f = fakeWorld(), rng = app.rng.snapshot(), restoreRandom = seedRandom();
  const savedEvents = { ...swordEvents }, savedStarterEvents = { ...starterSwordEvents };
  setActivePhysics(null); app.input.consume('attack');
  f.game.camera.aspect = portrait ? 402 / 874 : 16 / 9;
  const hits: unknown[] = [], events: unknown[] = [], stops: number[] = [], debris: unknown[] = [];
  const target: TargetAnimal = { kind, alive: true, position: new THREE.Vector3(0, 0, -1.5), damageFor: () => 0,
    applyDamage: (damage, point, direction) => { hits.push([Math.round(f.game.clock.elapsedTime * 60), damage, [...point], [...direction]]); return false; },
    stagger: (direction, strength) => { events.push(['stagger', [...direction], strength]); } };
  setAimTargets([target]);
  const targets: Targets = { raycast: () => ({ animal: target, point: new THREE.Vector3(0, 0.5, -1.5), distance: 1.5, headshot: false }) };
  const reactions: MeleeEvents = {
    onSwing: (speed, heavy, direction) => { events.push(['swing', speed, heavy, direction]); },
    onStrike: (species, point, strength, killed) => { events.push(['strike', species, [...point], strength, killed]); },
    onClang: (point, strength, material) => { events.push(['clang', [...point], strength, material]); },
  };
  Object.assign(swordEvents, reactions); Object.assign(starterSwordEvents, reactions);
  const game = f.game.asGame(); game.hitStop = (seconds) => { stops.push(seconds); };
  const world = { game, player: f.player, sky: f.sky, forest: f.forest };
  const opts = { row: SWORD, rig: swordRig(f.sky, blade), allowUnlocked: true, blade,
    ...(customMoves ? { moves: { rest: REST, charge: CHARGE, sprint: SPRINT,
      combo: COMBO.map(copyMove), heavy: { ...HEAVY } } } : {}) };
  const weapon = withOwner(scope, () => platform === true
    ? new SweptMelee(world, targets, { ...opts, profile: blade === 'iron' ? SWORD_IRON : SWORD_WOOD, inputContext: 'weapon.melee' }, defaults(reactions))
    : platform === 'starter' ? new StarterSword(world, targets, opts) : new Sword(world, targets, opts));
  weapon.install({ scope });
  const impact = vi.spyOn(Impacts.for(game), 'burst').mockImplementation((surface, point, direction, count) => {
    debris.push([surface, [...point], [...direction], count]);
  });
  let hash = 0;
  try {
    weapon.tryFire();
    for (let tick = 1; tick <= 600; tick++) {
      if (tick === 10 || tick === 19 || tick === 170) weapon.tryFire();
      weapon.adsHeld = tick >= 100 && tick < 135;
      f.player.yaw = Math.sin(tick / 50) * 0.12; f.player.pitch = Math.sin(tick / 37) * 0.06;
      f.player.sprinting = tick >= 240 && tick < 290;
      f.player.speedFactor = tick % 120 / 120; f.player.bobTime = tick / 5;
      weapon.holster = tick >= 350 && tick < 370 ? 0.5 : 0;
      weapon.inspect = tick >= 450 && tick < 480 ? 1 : 0;
      f.game.advance(1 / 60); weapon.update(1 / 60, f.game.clock.elapsedTime);
      f.game.scene.updateMatrixWorld(true);
      const frame: unknown[] = [weapon.swingName, weapon.charge, weapon.comboStep, weapon.state.ads, f.game.camera.fov];
      f.game.scene.traverse((object) => {
        frame.push([object.type, object.visible, object.matrix.toArray()]);
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          const geometry: unknown = object.geometry;
          if (!(geometry instanceof THREE.BufferGeometry)) throw new Error('Expected buffer geometry');
          frame.push(geometry.drawRange);
          const attributes: unknown = geometry.attributes;
          if (typeof attributes !== 'object' || attributes === null) throw new Error('Expected geometry attributes');
          for (const [name, attribute] of Object.entries(attributes)) {
            if (attribute instanceof THREE.BufferAttribute && attribute.usage === THREE.DynamicDrawUsage) frame.push([name, Array.from(attribute.array)]);
          }
        }
      });
      hash = fnv1a32(`${hash}:${JSON.stringify(frame)}`);
    }
    expect(f.game.dead).toBe(false);
    expect(hits.length).toBeGreaterThanOrEqual(4);
    expect(stops).toContain(HEAVY.hitStop);
    return { hash, frames: 600, hits, events, stops, debris, context: weapon.row.ui.inputContext };
  } finally {
    impact.mockRestore(); scope.dispose(); app.rng.restore(rng); restoreRandom();
    Object.assign(swordEvents, savedEvents);
    for (const key of ['onSwing', 'onStrike', 'onClang'] as const) if (savedEvents[key] === undefined) delete swordEvents[key];
    Object.assign(starterSwordEvents, savedStarterEvents);
    for (const key of ['onSwing', 'onStrike', 'onClang'] as const) if (savedStarterEvents[key] === undefined) delete starterSwordEvents[key];
    app.input.consume('attack'); setAimTargets([]); setActivePhysics(null);
  }
}

describe('trusted SDK swept contact family', () => {
  it('publishes the exact platform constructor and delegates the kit wrapper', () => {
    expect(TrustedSwept).toBe(SweptMelee); expect(Sword.prototype).toBeInstanceOf(SweptMelee);
  });
  it.each([false, true])('preserves supplied rigs, every dynamic view buffer, combo/heavy timing and debris (portrait=%s)', (portrait) => {
    for (const blade of ['wood', 'iron'] as const) for (const kind of ['crab', 'sailor', 'boar']) {
      const original = trace(false, portrait, blade, kind);
      expect(trace(true, portrait, blade, kind)).toEqual(original);
      expect(trace('starter', portrait, blade, kind)).toEqual(original);
      // Independent kit oracle captured in 8aa9502ce before delegation; never refresh from the wrapper.
      expect(original).toMatchSnapshot(`${blade}:${kind}`);
    }
  });
  it.each([false, true])('preserves starter identity checks when a profile supplies equivalent custom moves (portrait=%s)', (portrait) => {
    const original = trace(false, portrait, 'iron', 'sailor', true);
    expect(trace(true, portrait, 'iron', 'sailor', true)).toEqual(original);
    expect(trace('starter', portrait, 'iron', 'sailor', true)).toEqual(original);
    expect(original).toMatchSnapshot();
  });
});
