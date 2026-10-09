// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the shipping native physics in plain Node.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { createSimHost, type SimCommand, type SimHost } from '../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { SIM_LEVEL, fightCommand } from '../fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const LEVEL = { ...SIM_LEVEL, id: 'player-driver', entities: [], quests: [] };

it('delegates input before the one physics step and motion after it, before systems and health', () => {
  const host = createSimHost(LEVEL, { rapier }), order: string[] = [];
  const step = host.physics.step.bind(host.physics);
  const physics = vi.spyOn(host.physics, 'step').mockImplementation(() => { order.push('physics'); step(); });
  const health = vi.spyOn(host.player.health, 'update');
  const move = new Vector3(0.05, 0, 0);
  host.usePlayerDriver({
    input: (command, dt, active) => {
      order.push('input'); expect(dt).toBe(1 / 60); expect(active).toBe(host); expect(command?.jump).toBe(true);
      expect(active.clock.now).toBe(1 / 60); return true;
    },
    step: (dt, active) => {
      order.push('motion'); expect(dt).toBe(1 / 60); expect(active).toBe(host);
      active.player.motor.move(active.player.position, move);
    },
  });
  host.onStep('fixture.system', () => { order.push('systems'); });
  try {
    const x = host.player.position.x;
    host.step({ moveX: -1, moveZ: 0, yaw: 2, hover: true, jump: true, dodge: true });
    expect(order).toEqual(['input', 'physics', 'motion', 'systems']);
    expect(physics).toHaveBeenCalledTimes(1); expect(health).toHaveBeenCalledExactlyOnceWith(1 / 60);
    expect(host.player.position.x).toBeCloseTo(x + move.x); expect(host.player.yaw).toBe(LEVEL.player.yaw);
    expect(host.playerBoard.on).toBe(false); expect(host.playerJump).toBeNull(); expect(host.playerDodge.cd).toBe(0);
    expect(host.state.tick).toBe(1);
  } finally { host.dispose(); }
  expect(Object.values(host.scope.census).every(n => n === 0)).toBe(true);
});

it('preserves exact ordinary motion and snapshot bytes while input does not delegate or after removal', () => {
  const control = createSimHost(SIM_LEVEL, { rapier }), observed = createSimHost(SIM_LEVEL, { rapier });
  const wrongStep = vi.fn(() => undefined), input = vi.fn(() => false);
  const remove = observed.usePlayerDriver({ input, step: wrongStep });
  try {
    for (let tick = 0; tick < 150; tick++) {
      const command = { ...fightCommand(tick), ...(tick === 10 ? { jump: true as const } : {}), ...(tick === 40 ? { dodge: true as const } : {}),
        ...(tick === 80 || tick === 100 ? { hover: true as const } : {}) };
      control.step(command); observed.step(command);
      if (tick === 74) { remove(); remove(); }
      expect(serializeSimSnapshot(snapshotSimHost(observed))).toBe(serializeSimSnapshot(snapshotSimHost(control)));
    }
    expect(input).toHaveBeenCalledTimes(75); expect(wrongStep).not.toHaveBeenCalled();
  } finally { observed.dispose(); control.dispose(); }
});

it('keeps targeted combat and its actual contact pipeline while movement is delegated', () => {
  const host = createSimHost(SIM_LEVEL, { rapier });
  host.usePlayerDriver({ input: () => true, step: () => undefined });
  try {
    const target = host.entities.get('boar:1');
    if (target === undefined) throw new Error('Missing real combat fixture');
    const hp = target.hp;
    for (let tick = 0; tick < 30; tick++) host.step(fightCommand(tick));
    expect(target.hp).toBe(hp - SIM_LEVEL.weapon.damage);
    expect(host.state.tick).toBe(30);
  } finally { host.dispose(); }
});

it('restores a real delegated motor and controller continuation with an exact native suffix', () => {
  const original = createSimHost(LEVEL, { rapier });
  let restored: SimHost | undefined;
  const install = (host: SimHost): void => {
    let phase = 0;
    const motion = new Vector3();
    host.onStep('fixture.motion-state', () => undefined, { snapshot: () => ({ phase }), restore: value => {
      if (value === null || Array.isArray(value) || typeof value !== 'object' || typeof value['phase'] !== 'number' || !Number.isInteger(value['phase'])) throw new RangeError('Invalid driver phase');
      phase = value['phase'];
    } });
    host.usePlayerDriver({ input: (command: Readonly<SimCommand> | undefined, dt) => {
      motion.set((command?.moveX ?? 0) * dt, 0, (command?.moveZ ?? 0) * dt); return true;
    }, step: (_dt, active) => {
      phase++; active.player.yaw = phase / 60;
      active.player.motor.move(active.player.position, motion);
    } });
  };
  install(original);
  try {
    for (let tick = 0; tick < 27; tick++) original.step({ moveX: 1, moveZ: 0.5, yaw: 0 });
    const saved = decodeSimSnapshot(serializeSimSnapshot(snapshotSimHost(original)));
    restored = restoreSimHost(LEVEL, { rapier }, saved, install);
    expect(serializeSimSnapshot(snapshotSimHost(restored))).toBe(serializeSimSnapshot(saved));
    for (let tick = 0; tick < 90; tick++) {
      const command = { moveX: Math.sin(tick / 10), moveZ: Math.cos(tick / 10), yaw: 0 };
      original.step(command); restored.step(command);
      expect(serializeSimSnapshot(snapshotSimHost(restored))).toBe(serializeSimSnapshot(snapshotSimHost(original)));
    }
  } finally { restored?.dispose(); original.dispose(); }
});

it('refuses borrowed, frozen, disposed or duplicate driver bindings and releases early bindings', () => {
  const owner = createSimHost(LEVEL, { rapier }), frozen = createSimHost(LEVEL, { rapier, playerBody: false });
  const borrowed = createSimHost(LEVEL, { rapier, physics: owner.physics, player: owner.player, clock: owner.clock, combat: owner.combat, events: owner.events });
  const driver = { input: () => false, step: () => undefined };
  try {
    expect(() => borrowed.usePlayerDriver(driver)).toThrow('owned active');
    expect(() => frozen.usePlayerDriver(driver)).toThrow('owned active');
    const before = owner.scope.census.disposers, remove = owner.usePlayerDriver(driver);
    expect(owner.scope.census.disposers).toBe(before + 1);
    expect(() => owner.usePlayerDriver(driver)).toThrow('owned active');
    remove(); expect(owner.scope.census.disposers).toBe(before);
    owner.usePlayerDriver(driver);
  } finally { borrowed.dispose(); frozen.dispose(); owner.dispose(); }
  expect(() => owner.usePlayerDriver(driver)).toThrow('owned active');
  expect(Object.values(owner.scope.census).every(n => n === 0)).toBe(true);
});
