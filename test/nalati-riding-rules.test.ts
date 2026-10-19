import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { NalatiTamingLaw } from '../src/shards/nalati-grasslands/runtime/tamingLaw';
import type { NalatiTamingPorts, TamingHorse, TamingHerd } from '../src/shards/nalati-grasslands/runtime/tamingBindings';
import programs from '../src/shards/nalati-grasslands/behaviour/riding.generated.json' with { type: 'json' };

function rig() {
  const horse: TamingHorse = { entityId: 'wild', kind: 'horse', scale: 1, alive: true, yaw: 0, position: new Vector3(), mem: {}, headWorld: out => out.set(0, 2, 0), setMotion: () => undefined };
  let stallion: TamingHorse | null = horse;
  const hud = { offer: true, lean: 0 };
  const herd: TamingHerd<TamingHorse> = { get stallion() { return stallion; }, stallionState: 'beaten', cx: 0, cz: 0, trust: 100, alert: 0, alertOwned: false, mode: 'graze',
    addTrust(value) { this.trust = Math.max(0, Math.min(100, this.trust + value)); }, leadAway() { this.mode = 'flee'; }, releaseStallion() { stallion = null; } };
  let mounted: TamingHorse | null = null, damage = 0, saved: string | null = null, hidden = false, retired = false;
  const ports: NalatiTamingPorts<TamingHorse, TamingHerd<TamingHorse>> = { programs, bond: { read: () => saved, write: value => { saved = value; } },
    player: { position: new Vector3(0, 0, 2), crouching: true, yaw: 0, pitch: 0, keys: new Set(), camera: { position: new Vector3(0, 2, 2), getWorldDirection: out => out.set(0, 0, -1) } },
    mount: { get mounted() { return mounted !== null; }, get horse() { return mounted; }, breakShake: 0, breakRoll: 0, mount: a => { mounted = a; return true; }, dismount: () => { mounted = null; }, addMountable: () => undefined, removeMountable: () => undefined },
    hud, herds: () => [herd], rest: { x: 0, z: 0, face: { x: 1, z: 0 } }, wind: () => ({ x: 0, z: 1, strength: 1 }), random: () => .25,
    spawnBonded: (x, z, yaw, argymaq) => ({ ...horse, entityId: 'bonded', kind: argymaq ? 'argymaq' : 'horse', position: new Vector3(x, 0, z), yaw }), hideStallion: () => { hidden = true; }, retireBonded: () => { retired = true; }, hurt: value => { damage += value; } };
  return { horse, herd, ports, hud, law: new NalatiTamingLaw(ports), result: () => ({ mounted, damage, saved, hidden, retired }) };
}

test('approach selects the closest eligible live stallion and spends trust from observations', () => {
  const law = ReturnProgram.page(programs.approach);
  const candidates = [{ x: 0, y: 0, z: 0, alive: 1, argymaq: 0 }, { x: 0, y: 0, z: 10, alive: 1, argymaq: 1 }];
  expect(law.project('select', { count: 2, px: 0, py: 0, pz: 1, bonded: 0, argymaq: 0 }, undefined, candidates)['index']).toBe(0);
  expect(law.project('select', { count: 2, px: 0, py: 0, pz: 1, bonded: 1, argymaq: 0 }, undefined, candidates)['index']).toBe(1);
  expect(law.project('select', { count: 2, px: 0, py: 0, pz: 1, bonded: 1, argymaq: 1 }, undefined, candidates)['index']).toBe(-1);
  expect(law.project('select', { count: 2, px: 100, py: 0, pz: 1, bonded: 0, argymaq: 0 }, undefined, candidates)['active']).toBe(0);
  const row = law.project('approach', { scale: 1, dt: .1, distance: 2, beaten: 0, mounted: 0, speed: 0, dot: 0, lookT: 0, offer: 1, alert: 0, trust: 99, crouched: 1, downwind: 1, strength: 1, flee: 0 });
  expect(row['trust']).toBe(1.5); expect(row['radius']).toBe(3.6);
  expect(law.project('event', { x: 0, z: 0, cx: 0, cz: 0, px: 0, pz: 0, shot: 1, alert: 0 })).toEqual({ trust: -30, alert: 100 });
});

test('ten-Hz native binding completes five rounds, adopts once, and restricts the second bond to Argymaq', () => {
  const { law, hud, horse, result } = rig(); law.update(.1); expect(law.interactable.radius).toBe(3.6); law.startBreaking();
  let previous = 0;
  for (let i = 0; i < 220 && law.phase === 'breaking'; i++) {
    const b = law.view.balance;
    hud.lean = Math.max(-1, Math.min(1, b * 8 + (b - previous) * 10 * 2)); previous = b;
    law.update(.1);
  }
  expect(law.phase).toBe('bonded'); expect(result().hidden).toBe(true); expect(result().saved).toBe('1'); expect(result().mounted?.entityId).toBe('bonded'); expect(result().damage).toBe(0);
  expect(law.canTame(horse)).toBe(false); expect(law.canTame({ ...horse, kind: 'argymaq' })).toBe(true);
});

test('throwing applies health and trust effects; mid-round numeric state reconnects without spawning', () => {
  const a = rig(); a.law.update(.1); a.law.startBreaking(); a.law.update(.1);
  const wire = a.law.snapshot(); a.law.restore(wire, [a.horse]); expect(a.law.snapshot()).toBe(wire);
  for (let i = 0; i < 200 && a.law.phase === 'breaking'; i++) { a.hud.lean = -1; a.law.update(.1); }
  expect(a.law.phase).toBe('wild'); expect(a.result().damage).toBe(10); expect(a.herd.trust).toBe(60); expect(a.result().saved).toBeNull();
});

test('riding projections enforce practice-room panic, mount identity, rail range and walk controls', () => {
  const law = ReturnProgram.page(programs.riding);
  expect(law.project('panic', { x: 0, z: 0, px: 1, pz: 0, bite: 0, practice: 1 })['duration']).toBe(0);
  expect(law.project('panic', { x: 0, z: 0, px: 1, pz: 0, bite: 0, practice: 0 })['duration']).toBe(2.2);
  expect(law.project('mount', { mounted: 0, present: 1, alive: 1, driven: 0, available: 0, breaking: 1, stallion: 1 })['accept']).toBe(1);
  expect(law.project('mount', { mounted: 0, present: 1, alive: 1, driven: 0, available: 0, breaking: 1, stallion: 0 })['accept']).toBe(0);
  expect(law.project('name', { x: 6, z: 0, cx: 0, cz: 0, px: 6, pz: 0, alive: 1, yaw: 0, scale: 1 })['distance']).toBe(1e12);
  expect(law.project('walk', { version: 1, board: 0, swim: 0, depth: .2, forward: 1, crouched: 1, sprint: 1, grounded: 1 })).toEqual({ crouched: 1, sprinting: 0, wade: .2 / 1.1 });
});
