import ts from '@typescript/typescript6';
import * as THREE from 'three';
import { vi } from 'vitest';
import { hitDamage } from '#game/shard/manifest';
import { dodgeGuard } from '#shards/driftwood-isle/loot/perks';
import { FakeGame } from './FakeGame';
import { descendants, executeLegacy, legacySource } from './legacySource';

interface Attacker { kind: string; label: string; position: THREE.Vector3 }
export interface LegacyHurt {
  creature: (a: Attacker, raw: number) => void;
  ride: (damage: number) => void;
  lightning: (damage: number, why: string) => void;
  titan: (damage: number, why?: string) => void;
  fall: (hard: boolean) => void;
  tick: (dt: number) => void;
  readonly health: number; readonly lastHurt: number; readonly killer: unknown;
  healthSet: (value: number) => void;
}

/** Execute the actual main.ts hurt, regeneration and death closures in a renderer-free world. No copied rules.
 * The selectors fail loudly if main's closures move; S1.3 replaces this adapter with combat.hit. */
type Spy = ReturnType<typeof vi.fn>;
interface HurtFixture {
  api: LegacyHurt; game: FakeGame; clock: { now: number };
  player: { dodging: boolean; position: THREE.Vector3; yaw: number; shove: Spy };
  hud: { damageFlash: Spy; toast: Spy }; audio: { land: Spy; hurt: Spy; death: Spy };
  music: { combat: Spy }; hurtArc: { hit: Spy }; trauma: Spy;
  deathFade: { active: boolean }; encounter: { onPlayerDeath: ReturnType<typeof vi.fn<() => boolean>> };
  die: Spy; refill: Spy; crossbow: { hasAmmo: boolean; state: { bolts: number }; addBolts: Spy };
}
export function legacyHurtFixture({ cap = 20, tusk = false, guarded = false } = {}): HurtFixture {
  const source = legacySource('src/main.ts');
  const assignments = descendants(source, (n) => ts.isBinaryExpression(n) && n.left.getText(source) === 'animals.onCharge');
  const first = assignments[0], wrapper = assignments[1];
  if (first === undefined || wrapper === undefined) throw new Error('main creature hurt closures moved');
  const hurtIn = (callName: string): string => {
    const call = descendants(source, (n) => ts.isCallExpression(n) && n.expression.getText(source) === callName)[0];
    if (call === undefined || !ts.isCallExpression(call)) throw new Error(`missing ${callName}`);
    const arg = call.arguments[0];
    if (arg === undefined || !ts.isObjectLiteralExpression(arg)) throw new Error('expected bind object');
    for (const property of arg.properties) if (ts.isPropertyAssignment(property) && property.name.getText(source) === 'hurt') return property.initializer.getText(source);
    throw new Error(`${callName} has no hurt`);
  };
  const land = descendants(source, (n) => ts.isBinaryExpression(n) && n.left.getText(source) === 'player.onLand')[0];
  const regen = descendants(source, (n) => ts.isIfStatement(n) && n.expression.getText(source).startsWith('health < maxHealth &&'))[0];
  const death = descendants(source, (n) => ts.isIfStatement(n) && n.expression.getText(source) === 'health <= 0' && n.getText(source).includes('audio.death()'))[0];
  if (land === undefined || !ts.isBinaryExpression(land) || regen === undefined || death === undefined) throw new Error('main health lifecycle moved');
  const game = new FakeGame(), clock = { now: 1000 }, owned = { has: (id: string): boolean => tusk && id === 'boar-tusk' };
  const player = { dodging: guarded, position: new THREE.Vector3(), yaw: 0, shove: vi.fn() };
  const hud = { damageFlash: vi.fn(), toast: vi.fn() }, audio = { land: vi.fn(), hurt: vi.fn(), death: vi.fn() };
  const music = { combat: vi.fn() }, hurtArc = { hit: vi.fn() }, trauma = vi.fn();
  const deathFade = { active: false }, encounter = { onPlayerDeath: vi.fn(() => false) }, die = vi.fn();
  const refill = vi.fn(), crossbow = { hasAmmo: true, state: { bolts: 12 }, addBolts: vi.fn() };
  const code = `let health = 100, maxHealth = 100, lastHurt = 0, killer = null;
    const animals = {}; ${first.getText(source)};
    const chargeHit = animals.onCharge; ${wrapper.getText(source)};
    const ride = ${hurtIn('nalatiNow()?.bindPlay')};
    const lightning = ${hurtIn('nalatiNow()?.weather.bind')};
    const titan = ${hurtIn('nalatiNow()?.titan.bind')};
    const fall = ${land.right.getText(source)};
    ({ creature: animals.onCharge, ride, lightning, titan, fall,
      tick(dt) { ${regen.getText(source)}; if (deathFade.active) health = maxHealth; ${death.getText(source)}; },
      get health() { return health; }, get lastHurt() { return lastHurt; }, get killer() { return killer; },
      healthSet(value) { health = value; } });`;
  const api = executeLegacy(code, {
    performance: { now: () => clock.now }, player, hud, audio, music, hurtArc, game, owned, deathFade,
    hitDamage, dodgeGuard, chunk: { fight: { maxHitDamage: cap, capExempt: ['captain'] } },
    meleeShard: () => true, pineFights: encounter, nalati: null, ride: null, die, crossbow,
    nalatiKit: { refill }, pineLoadout: { onPlayerDeath: refill }, CameraFX: { for: () => ({ addTrauma: trauma }) },
  }) as LegacyHurt;
  game.onUpdate((dt) => api.tick(dt));
  return { api, game, clock, player, hud, audio, music, hurtArc, trauma, deathFade, encounter, die, refill, crossbow };
}
