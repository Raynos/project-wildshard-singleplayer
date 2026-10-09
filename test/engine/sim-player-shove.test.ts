// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the real Rapier WASM and read the client Player's source in Node.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createSimHost, type SimHost, type SimLevel } from '../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { FIXED_STEP } from '../../src/engine/core/fixedStep';
import { hitShoveSpeed, SHOVE_HOP, SHOVE_TIME, shoveHop, startShove, stepShove, type ShoveState } from '../../src/engine/player/shove';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { expectSameSimSnapshot } from '../fake/simSnapshot';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const LEVEL: SimLevel = { ...SIM_LEVEL, entities: [], quests: [] };
const boot = (): SimHost => createSimHost(LEVEL, { rapier });
/** A creature's blow filed the way PlayerHurt.creature / Sky's flock brains file it: env source, `feel.blow`, from the creature. */
const blow = (host: SimHost, x: number, z: number, amount: number, tags: `${string}.${string}`[] = ['creature.boar', 'feel.blow', 'cover.checked']) =>
  host.combat.hit({ source: 'env', sourceTags: tags, target: host.player.health, amount, point: new Vector3(x, 0, z), dir: new Vector3(), cause: { kind: 'boar', label: 'Boar' } });

it('is the client Player\'s knockback law, and Player.ts / PlayerHurt route through it', () => {
  expect([SHOVE_TIME, SHOVE_HOP]).toEqual([0.18, 1.6]);
  expect([hitShoveSpeed(0), hitShoveSpeed(20), hitShoveSpeed(100)]).toEqual([5, 8, 9]);
  expect([shoveHop(-3), shoveHop(4)]).toEqual([1.6, 4]);
  const shove: ShoveState = { t: 0, vx: 0, vz: 0 };
  startShove(shove, 1, 2, 1, 0, 0.3, 6); expect(shove).toEqual({ t: 0.18, vx: 0, vz: 6 });
  startShove(shove, 1, 2, 1, 2, 0.3, 6); expect(shove).toEqual({ t: 0.18, vx: Math.sin(0.3) * 6, vz: Math.cos(0.3) * 6 }); // on top: straight back
  // the fade the client Player carried inline: t = max(0, t - dt), k = t / SHOVE_TIME
  let t = 0.18, steps = 0;
  while (shove.t > 0) { t = Math.max(0, t - FIXED_STEP); expect(stepShove(shove, FIXED_STEP)).toBe(t / 0.18); steps++; }
  expect(steps).toBe(11);
  const player = readFileSync('src/engine/player/Player.ts', 'utf8');
  expect(player).toContain('startShove(this.shoveState, this.position.x, this.position.z, fromX, fromZ, this.yaw, speed)');
  expect(player).toContain('this.velocity.y = shoveHop(this.velocity.y)');
  expect(player).toContain('const k2 = stepShove(shove, dt)');
  expect(player).not.toMatch(/const SHOVE_TIME|shoveT\b/u);
  expect(readFileSync('src/engine/ui/playerHurt.ts', 'utf8')).toContain('p.shove(at.x, at.z, hitShoveSpeed(dealt))');
});

it('knocks the headless player back from a creature\'s blow, hops it and lands it, and ignores other damage', () => {
  const host = boot();
  try {
    blow(host, 0, 0.5, 30, ['env.trap', 'cover.checked']); host.step();
    expect(host.playerShove.t).toBe(0); expect(host.player.position.toArray()).toEqual([0, 0, 0]);
    blow(host, 0, 0.5, 20); host.step(); // the event lands at the step's flush, as the client's PlayerHurt does
    expect(host.playerShove).toEqual({ t: SHOVE_TIME, vx: 0, vz: -hitShoveSpeed(20) });
    expect(host.playerFall).toEqual({ vy: SHOVE_HOP, grounded: false });
    expect(host.player.health.attributes.health).toBe(100 - 30 - 20);
    let travelled = 0, peak = 0; const shove: ShoveState = { t: SHOVE_TIME, vx: 0, vz: -8 };
    for (let tick = 0; tick < 120; tick++) {
      if (shove.t > 0) travelled += shove.vz * stepShove(shove, FIXED_STEP) * FIXED_STEP;
      host.step({ moveX: 0, moveZ: 1, yaw: 0 }); // the walk input is overridden while the knockback runs
      peak = Math.max(peak, host.player.position.y);
      if (tick === 10) { expect(host.playerShove.t).toBe(0); expect(host.player.position.z).toBeCloseTo(travelled, 1); }
    }
    expect(travelled).toBeLessThan(-0.6); expect(peak).toBeGreaterThan(0.015); // the hop leaves the ground
    expect(host.playerFall).toEqual({ vy: 0, grounded: true }); expect(host.player.position.y).toBeCloseTo(0, 1);
    expect(snapshotSimHost(host).player.shove).toBeUndefined();
  } finally { host.dispose(); }
});

it('keeps a running knockback in the strict snapshot, continues it exactly, and refuses a malformed one', () => {
  const original = boot();
  let restored: SimHost | undefined;
  try {
    original.shovePlayer(2, 0, 7); original.step();
    const saved = serializeSimSnapshot(snapshotSimHost(original));
    expect(decodeSimSnapshot(saved).player.shove).toEqual(original.playerShove);
    restored = restoreSimHost(LEVEL, { rapier }, decodeSimSnapshot(saved));
    expect(restored.playerShove).toEqual(original.playerShove);
    for (let tick = 0; tick < 60; tick++) { original.step({ moveX: 0.4, moveZ: 0, yaw: 0 }); restored.step({ moveX: 0.4, moveZ: 0, yaw: 0 }); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
    const stale = decodeSimSnapshot(saved); stale.player.shove = { t: 0, vx: 1, vz: 0 };
    expect(() => restoreSimHost(LEVEL, { rapier }, stale)).toThrow('Snapshot instance registrations do not match');
    expect(() => decodeSimSnapshot(saved.replace(/"shove":\{[^}]*\}/u, '"shove":{"t":0.1}'))).toThrow();
  } finally { restored?.dispose(); original.dispose(); }
});
