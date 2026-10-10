import { beforeAll, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { restoreSimHost, snapshotSimHost, serializeSimSnapshot, decodeSimSnapshot } from '../src/engine/sim/snapshot';
import { loadRapier } from '../src/engine/physics/rapier';
import { registerHeadlessMode, currentHeadlessMode } from '../src/sdk/playerModes';
import { MOTOR_MODE_MECHANISMS } from '../src/sdk/playerModeData';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const level = { ...SIM_LEVEL, entities: [] };
let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });

it('declares the fixed water and board mechanisms through a pure SDK leaf', () => {
  expect(MOTOR_MODE_MECHANISMS).toEqual(['swim', 'hover']);
});

it('lets grapple claim capsule motion after physics and releases it with the owning scope', () => {
  const host = createSimHost(level, { rapier }), scope = new Scope('grapple');
  try {
    const seen: number[] = [], motion: unknown[] = [];
    host.observePlayerMotion(sample => { motion.push(sample); });
    const mode = registerHeadlessMode(host, { id: 'grapple', hud: 'lock', traverse: dt => {
      seen.push(dt); host.player.motor.move(host.player.position, new Vector3(12 * dt, 0, 0)); return true;
    } }, scope);
    host.playerImpulse.set(2, 0, 0);
    const start = host.player.position.clone();
    host.step({ moveX: -1, moveZ: 1, yaw: 0, jump: true, dodge: true });
    expect(seen).toEqual([1 / 60]); expect(host.state.tick).toBe(1);
    expect(host.player.position.x - start.x).toBeCloseTo(0.2, 6);
    expect(host.player.position.z).toBe(start.z);
    expect(host.playerImpulse.lengthSq()).toBe(0); expect(host.playerJump).toBeNull();
    expect(mode.active).toBe(true); expect(currentHeadlessMode(host)).toBe('grapple'); expect(motion).toEqual([null]);
    scope.dispose(); const x = host.player.position.x;
    host.step({ moveX: -1, moveZ: 0, yaw: 0 });
    expect(host.player.position.x).toBeLessThan(x); expect(seen).toHaveLength(1);
    expect(currentHeadlessMode(host)).toBe('foot');
  } finally { scope.dispose(); host.dispose(); }
});

it('gives an entered driver precedence and honors an earlier traversal answer', () => {
  const host = createSimHost(level, { rapier });
  try {
    let traversals = 0, drives = 0;
    registerHeadlessMode(host, { id: 'grapple', hud: 'lock', traverse: () => { traversals++; return true; } }, host.scope);
    registerHeadlessMode(host, { id: 'ride', hud: 'ride' }, host.scope);
    host.modes.enter('ride', { input: () => true, step: () => { drives++; } });
    host.step(); expect(drives).toBe(1); expect(traversals).toBe(0);
    host.modes.exit('ride');
    host.events.answer('player.traversal', () => true, host.scope, { order: -1 });
    host.step(); expect(traversals).toBe(0);
  } finally { host.dispose(); }
});

it('restores a scoped traversal mid-flight without an installation tick', () => {
  const install = (host: SimHost) => {
    let ticks = 0;
    registerHeadlessMode(host, { id: 'grapple', hud: 'lock', traverse: dt => {
      if (ticks >= 10) return false;
      ticks++; host.player.motor.move(host.player.position, new Vector3(6 * dt, 0, 0)); return true;
    } }, host.scope);
    host.onStep('grapple', () => undefined, { snapshot: () => ticks, restore: saved => {
      if (typeof saved !== 'number' || !Number.isInteger(saved) || saved < 0 || saved > 10) throw new Error('Invalid grapple clock');
      ticks = saved;
    } });
  };
  const host = createSimHost(level, { rapier }); let fresh: SimHost | undefined;
  try {
    install(host); for (let i = 0; i < 4; i++) host.step();
    const saved = decodeSimSnapshot(serializeSimSnapshot(snapshotSimHost(host)));
    fresh = restoreSimHost(level, { rapier }, saved, sim => { install(sim); expect(sim.state.tick).toBe(0); });
    expect(currentHeadlessMode(fresh)).toBe('grapple');
    expect(snapshotSimHost(fresh)).toEqual(saved);
    expect(() => restoreSimHost(level, { rapier }, { ...saved, player: { ...saved.player, traversals: ['climb'] } }, install)).toThrow('traversal mode continuation');
    expect(() => restoreSimHost(level, { rapier }, { ...saved, player: { ...saved.player, traversals: ['grapple', 'grapple'] } }, install)).toThrow('traversal mode continuation');
    for (let i = 0; i < 12; i++) { host.step({ moveX: 0, moveZ: 1, yaw: 0 }); fresh.step({ moveX: 0, moveZ: 1, yaw: 0 }); }
    expect(snapshotSimHost(fresh)).toEqual(snapshotSimHost(host));
    expect(currentHeadlessMode(fresh)).toBe('foot');
  } finally { fresh?.dispose(); host.dispose(); }
});

it('keeps inactive traversal snapshots identical and refuses a page input context headless', () => {
  const plain = createSimHost(level, { rapier }), inactive = createSimHost(level, { rapier });
  try {
    registerHeadlessMode(inactive, { id: 'grapple', hud: 'lock', traverse: () => false }, inactive.scope);
    expect(() => registerHeadlessMode(inactive, { id: 'climb', hud: 'jump', context: { id: 'climb', actions: ['jump'] } }, inactive.scope)).toThrow('needs the input');
    for (let i = 0; i < 12; i++) { const command = { moveX: 1, moveZ: 0, yaw: 0 }; plain.step(command); inactive.step(command); }
    expect(snapshotSimHost(inactive)).toEqual(snapshotSimHost(plain));
  } finally { inactive.dispose(); plain.dispose(); }
});
