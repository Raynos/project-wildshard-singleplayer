import { installPlayerDeath } from '#engine/ui/playerDeath';
import * as THREE from 'three';
import { vi } from 'vitest';
import { Events } from '#engine/events/events';
import { Scope } from '#engine/app/scope';
import { CombatPipeline, type DeathCause } from '#engine/combat/pipeline';
import { PlayerHealth } from '#engine/combat/health';
import { PlayerHurt } from '#engine/ui/playerHurt';
import { FakeGame } from './FakeGame';

interface Attacker { kind: string; label: string; position: THREE.Vector3 }
export interface LegacyHurt {
  creature: (a: Attacker, raw: number) => void;
  ride: (damage: number) => void;
  lightning: (damage: number, why: string) => void;
  titan: (damage: number, why?: string) => void;
  fall: (hard: boolean) => void;
  tick: (dt: number) => void;
  readonly health: number; readonly lastHurt: number; readonly killer: DeathCause | null;
  healthSet: (value: number) => void;
}

type Spy = ReturnType<typeof vi.fn>;
interface HurtFixture {
  api: LegacyHurt; game: FakeGame; clock: { now: number };
  player: { dodging: boolean; position: THREE.Vector3; yaw: number; shove: Spy };
  hud: { damageFlash: Spy; toast: Spy }; audio: { land: Spy; hurt: Spy; death: Spy };
  music: { combat: Spy }; hurtArc: { hit: Spy }; trauma: Spy;
  deathFade: { active: boolean }; encounter: { onPlayerDeath: ReturnType<typeof vi.fn<() => boolean>> };
  die: Spy; refill: Spy; crossbow: { hasAmmo: boolean; state: { bolts: number }; addBolts: Spy };
  combat: CombatPipeline; health: PlayerHealth; events: Events; scope: Scope;
}
/** Renderer-free production pipeline/health/feel, replacing C1's temporary main.ts AST adapter. */
export function legacyHurtFixture({ cap = 20, tusk = false, guarded = false, bossGod = false } = {}): HurtFixture {
  const game = new FakeGame(), clock = { now: 1000 }, events = new Events(), scope = new Scope('hurt-test');
  const combat = new CombatPipeline(events, scope);
  const player = { dodging: guarded, position: new THREE.Vector3(), yaw: 0, shove: vi.fn() };
  const hud = { damageFlash: vi.fn(), toast: vi.fn() }, audio = { land: vi.fn(), hurt: vi.fn(), death: vi.fn() };
  const music = { combat: vi.fn() }, hurtArc = { hit: vi.fn() }, trauma = vi.fn();
  const deathFade = { active: false }, encounter = { onPlayerDeath: vi.fn(() => false) }, die = vi.fn();
  const refill = vi.fn(), crossbow = { hasAmmo: true, state: { bolts: 12 }, addBolts: vi.fn() };
  const health = new PlayerHealth(events, { now: () => clock.now, position: () => player.position,
    dodging: () => player.dodging, dodgeGuard: () => tusk });
  health.bindLifecycle({ fading: () => deathFade.active, updateFade: () => undefined });
  installPlayerDeath(events, scope, health, { position: () => player.position, died: (cause, checkpoint) => {
    audio.death(); hud.damageFlash(); if (!checkpoint) die(cause);
  } });
  health.attributes.incomingCap = cap;
  health.checkpoint(scope, () => encounter.onPlayerDeath());
  combat.playerRules(scope, { target: health, bossGod, capExempt: ['captain'] });
  events.on('player.respawned', () => { crossbow.addBolts(30 - crossbow.state.bolts); refill(); refill(); }, scope);
  const hurt = new PlayerHurt(events, scope, combat, health, {
    player, directional: () => true, flash: () => { hud.damageFlash(); }, toast: (text) => { hud.toast(text); },
    combat: (value) => { music.combat(value); }, hurt: (strength, pan) => { audio.hurt(strength, pan); }, land: (hard) => { audio.land(hard); },
    arc: (x, z, at, yaw, damage) => { hurtArc.hit(x, z, at, yaw, damage); }, trauma: (value) => { trauma(value); },
  });
  const flush = () => events.flush('update');
  const api: LegacyHurt = {
    creature: (a, raw) => { hurt.creature(a, raw); flush(); },
    ride: (amount) => { hurt.jolt('env.ride', amount, { kind: 'env.ride', label: 'Thrown from the saddle', text: 'Thrown from the saddle' }); flush(); },
    lightning: (amount, why) => { hurt.jolt('env.lightning', amount, { kind: 'env.lightning', label: 'Struck by lightning', text: 'Struck by lightning' }, why); flush(); },
    titan: (amount, why) => { hurt.jolt('boss.storm-titan', amount, { kind: 'storm-titan', label: 'the Storm Titan' }, why, true); flush(); },
    fall: (hard) => { hurt.fall(hard); flush(); },
    tick: (dt) => { health.update(dt); flush(); },
    get health() { return health.attributes.health; }, get lastHurt() { return health.lastHurt; }, get killer() { return health.cause ?? null; },
    healthSet: (value) => { health.attributes.health = value; },
  };
  game.onUpdate((dt) => api.tick(dt));
  return { api, game, clock, player, hud, audio, music, hurtArc, trauma, deathFade, encounter, die, refill, crossbow, combat, health, events, scope };
}
