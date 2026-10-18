import { expect, test, vi } from 'vitest';
import { Scene, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { CombatPipeline } from '../src/engine/combat/pipeline';
import { PlayerHealth } from '../src/engine/combat/health';
import { PracticePlayer } from '../src/game/practice/PracticePlayer';
import { PracticeLoot } from '../src/game/practice/PracticeLoot';

function fixture() {
  const owner = new Scope('practice-test'), events = new Events();
  const combat = new CombatPipeline(events, owner);
  const player = { position: new Vector3(), yaw: 0, dodging: false, shove: vi.fn<(...args: unknown[]) => void>(), impulse: vi.fn<(...args: unknown[]) => void>() };
  const worldEvents = new Events();
  const world = new PlayerHealth(worldEvents, {
    position: () => player.position, now: () => 0, dodging: () => player.dodging, dodgeGuard: () => false,
  });
  return { owner, events, combat, player, world, worldEvents };
}
const enemy = { kind: 'boar', label: 'Boar', position: new Vector3(1, 0, 0) };

test('practice uses real equipment health, incoming cap, dodge guard and hurt feedback without changing the world', () => {
  const f = fixture();
  f.world.attributes.maxHealth = 140; f.world.attributes.health = 37; f.world.attributes.incomingCap = 20;
  f.world.effectTags = ['guard.dodge'];
  const before = f.world.snapshot(), damaged = vi.fn<(...args: unknown[]) => void>(), worldDamage = vi.fn<(...args: unknown[]) => void>();
  f.worldEvents.on('damage.dealt', worldDamage, f.owner);
  const local = new PracticePlayer({ owner: f.owner, events: f.events, combat: f.combat,
    player: f.player, worldHealth: f.world, onDamage: damaged });
  expect(local.health).toBeInstanceOf(PlayerHealth);
  expect(local.health.attributes.health).toBe(140);
  f.player.dodging = true; local.hurt(enemy, 500); local.update(.016);
  expect(local.health.attributes.health).toBe(140); expect(damaged).not.toHaveBeenCalled();
  f.player.dodging = false; local.hurt(enemy, 500); local.update(.016);
  expect(local.health.attributes.health).toBe(120);
  expect(damaged).toHaveBeenCalledWith(20, 120); expect(f.player.shove).toHaveBeenCalledOnce();
  expect(f.world.snapshot()).toEqual(before); expect(worldDamage).not.toHaveBeenCalled();
  f.owner.dispose(); expect(f.world.snapshot()).toEqual(before);
});

test('lethal practice damage produces one local death, holds zero and retry starts fresh', () => {
  const f = fixture(), died = vi.fn<(...args: unknown[]) => void>(), damage = vi.fn<(...args: unknown[]) => void>(), worldDied = vi.fn<(...args: unknown[]) => void>();
  f.worldEvents.on('player.died', worldDied, f.owner);
  const before = f.world.snapshot();
  const options = { owner: f.owner, events: f.events, combat: f.combat, player: f.player,
    worldHealth: f.world, onDeath: died, onDamage: damage };
  const local = new PracticePlayer(options);
  local.hurt(enemy, 150); expect(local.defeated).toBe(true);
  local.update(.016); local.update(10); local.hurt(enemy, 100); local.update(.016);
  expect(died).toHaveBeenCalledOnce(); expect(damage).toHaveBeenCalledWith(150, 0);
  expect(local.health.alive).toBe(false); expect(local.health.attributes.health).toBe(0);
  expect(worldDied).not.toHaveBeenCalled(); expect(f.world.snapshot()).toEqual(before);
  local.dispose();
  const retry = new PracticePlayer(options);
  expect(retry.health.attributes.health).toBe(100); expect(retry.defeated).toBe(false);
  retry.hurt(enemy, 5); retry.update(.016); expect(retry.health.attributes.health).toBe(95);
  expect(died).toHaveBeenCalledOnce(); expect(f.world.snapshot()).toEqual(before);
  f.owner.dispose(); expect(f.events.census()).toEqual({ listeners: 0, answerers: 0 });
});

test('practice ignores invalid damage and dead/disposed bouts cannot hurt the motor', () => {
  const f = fixture(), local = new PracticePlayer({ ...f, worldHealth: f.world });
  for (const amount of [Number.NaN, Infinity, -4, 0]) local.hurt(enemy, amount);
  local.update(.1); expect(local.health.attributes.health).toBe(100);
  local.dispose(); local.hurt(enemy, 40); local.update(.1);
  expect(local.health.attributes.health).toBe(100); expect(f.player.shove).not.toHaveBeenCalled();
  f.owner.dispose();
});

test('authored incoming-cap exemptions survive practice admission', () => {
  const f = fixture(); f.world.attributes.incomingCap = 20;
  const local = new PracticePlayer({ ...f, worldHealth: f.world, capExempt: ['captain'] });
  local.hurt({ ...enemy, kind: 'captain' }, 45); local.update(.016);
  expect(local.health.attributes.health).toBe(55);
  local.hurt(enemy, 45); local.update(.016);
  expect(local.health.attributes.health).toBe(35); f.owner.dispose();
});

test('authored practice coins are visible, collected once and never written to storage', () => {
  const owner = new Scope('practice-loot-test'), scene = new Scene(), onCollect = vi.fn<(...args: unknown[]) => void>();
  const write = vi.spyOn(localStorage, 'setItem');
  const loot = new PracticeLoot({ owner, scene, player: new Vector3(), onCollect });
  expect(loot.drop({ kind: 'captain', position: new Vector3(0, 0, -4) })).toBe(true);
  const mesh = scene.getObjectByName('loot-coins');
  expect(mesh).toBeDefined(); expect(loot.inFlight).toBe(12);
  expect(loot.receipt).toEqual({ scope: 'practice', coins: 0, complete: false });
  expect(loot.drop({ kind: 'captain', position: new Vector3() })).toBe(false);
  for (let i = 0; i < 180; i++) loot.update(1 / 60);
  expect(loot.inFlight).toBe(0);
  expect(loot.receipt).toEqual({ scope: 'practice', coins: 25, complete: true });
  const notifications = onCollect.mock.calls.length;
  loot.update(10); expect(onCollect).toHaveBeenCalledTimes(notifications);
  expect(write).not.toHaveBeenCalled();
  owner.dispose(); expect(scene.getObjectByName('loot-coins')).toBeUndefined();
  expect(loot.drop(enemy)).toBe(false);
});

test('exiting before collection discards unpaid drops; a retry has an empty receipt', () => {
  const owner = new Scope('practice-loot-exit'), scene = new Scene(), onCollect = vi.fn<(...args: unknown[]) => void>();
  const loot = new PracticeLoot({ owner, scene, player: new Vector3(), onCollect });
  loot.drop(enemy); loot.dispose(); loot.update(10);
  expect(onCollect).not.toHaveBeenCalled(); expect(loot.receipt.coins).toBe(0);
  expect(scene.getObjectByName('loot-coins')).toBeUndefined();
  const retry = new PracticeLoot({ owner, scene, player: new Vector3() });
  expect(retry.receipt.coins).toBe(0); expect(retry.drop(enemy)).toBe(true);
  for (let i = 0; i < 180; i++) retry.update(1 / 60);
  expect(retry.receipt.coins).toBe(2); owner.dispose();
});

test('actual hard landing damage stays in the practice health pipeline', () => {
  const f = fixture(), local = new PracticePlayer({ ...f, worldHealth: f.world });
  f.world.attributes.health = 37; const before = f.world.snapshot();
  local.land(false); local.update(.016); expect(local.health.attributes.health).toBe(100);
  local.land(true); local.update(.016); expect(local.health.attributes.health).toBeLessThan(100);
  expect(f.world.snapshot()).toEqual(before);
  const after = local.health.attributes.health; local.dispose(); local.land(true); local.update(.016);
  expect(local.health.attributes.health).toBe(after); expect(f.world.snapshot()).toEqual(before); f.owner.dispose();
});
