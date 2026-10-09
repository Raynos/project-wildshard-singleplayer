// oxlint-disable-next-line import/no-nodejs-modules -- The acceptance witness runs in a fresh native Node process without test setup.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the same Node version as the invoking test runner.
import { execPath } from 'node:process';
import { beforeAll, describe, expect, it } from 'vitest';
import { createSimHost, SIM_API_VERSION } from '../../src/engine/sim';
import { loadRapier } from '../../src/engine/physics/rapier';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { SWORD_IRON } from '../../src/game/weapons/starterMeleeProfile';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
describe('versioned renderer-free simulation entry', () => {
  it('boots plain data with the kit species and iron sword, then steps 10,000 ticks in native Node', () => {
    const out = execFileSync(execPath, ['--import', './scripts/sim-node-loader.mjs', 'test/fixtures/sim-level/run.mjs'], { encoding: 'utf8' });
    expect(JSON.parse(out)).toEqual({ ticks: 10_000, damage: 5, questComplete: true, renderer: false });
    expect(SIM_LEVEL.weapon.id).toBe(SWORD_IRON.id); expect(SIM_LEVEL.weapon.damage).toBe(SWORD_IRON.damage);
    expect(SIM_LEVEL.weapon.windup).toBe(SWORD_IRON.moves?.combo[0]?.windup);
    expect(SIM_LEVEL.weapon.active + SIM_LEVEL.weapon.windup).toBeCloseTo(SWORD_IRON.moves?.combo[0]?.slashEnd ?? 0);
  });
  it('isolates entity, RNG, event, quest and timer state across two hosts', () => {
    const a = createSimHost(structuredClone(SIM_LEVEL), { rapier }), b = createSimHost(structuredClone(SIM_LEVEL), { rapier });
    try {
      a.state.timers['deadline'] = 1; a.flags.set('only:a'); a.step();
      a.entities.get('boar:1')?.applyFinalDamage(20, a.player.position, a.player.position);
      expect(a.entities.get('boar:1')?.hp).toBe(80); expect(b.entities.get('boar:1')?.hp).toBe(100);
      expect(b.state.tick).toBe(0); expect(b.flags.has('only:a')).toBe(false); expect(b.state.timers).toEqual({});
      a.rng.stream('ai').next(); expect(a.rng.snapshot()).not.toEqual(b.rng.snapshot());
    } finally { a.dispose(); b.dispose(); }
  });
  it('rejects unsupported versions, duplicate identities and nonfinite commands before stepping', () => {
    expect(SIM_API_VERSION).toBe(1);
    expect(() => createSimHost({ ...SIM_LEVEL, version: 2 }, { rapier })).toThrow('version');
    expect(() => createSimHost({ ...SIM_LEVEL, entities: [...SIM_LEVEL.entities, ...SIM_LEVEL.entities] }, { rapier })).toThrow('identity');
    const host = createSimHost(SIM_LEVEL, { rapier });
    try {
      expect(() => host.step({ moveX: Number.NaN, moveZ: 0, yaw: 0 })).toThrow('command'); expect(host.state.tick).toBe(0);
      expect(() => host.advance(-1)).toThrow('delta'); expect(host.advance(1 / 120)).toBe(0); expect(host.advance(1 / 120)).toBe(1);
    } finally { host.dispose(); }
    expect(() => host.step()).toThrow('disposed'); host.dispose();
  });
  it('owns fixed-step registrations and rejects duplicate ids even without adapters', () => {
    const host = createSimHost(SIM_LEVEL, { rapier });
    let count = 0;
    try {
      const remove = host.onStep('brain', () => { count++; });
      expect(() => host.onStep('brain', () => { count++; })).toThrow('registration');
      host.step(); expect(count).toBe(1); remove();
      host.onStep('brain', () => { count += 2; }); remove();
      host.step(); expect(count).toBe(3);
    } finally { host.dispose(); }
  });
  it('SF57: an early remove drops the host scope hold on its step callback', () => {
    const host = createSimHost(SIM_LEVEL, { rapier });
    try {
      const baseline = host.scope.census.disposers;
      for (let i = 0; i < 50; i++) { const remove = host.onStep(`brain.${i}`, () => undefined); remove(); remove(); }
      expect(host.scope.census.disposers).toBe(baseline);
    } finally { host.dispose(); }
  });
  it('places every body at its spawn before the first step, never at the world origin (G222 playtest #7)', () => {
    const level = structuredClone(SIM_LEVEL);
    level.player.at = { x: -6, y: 0, z: 5 };
    for (const entity of level.entities) entity.at = { x: 7, y: 0, z: -9 };
    const host = createSimHost(level, { rapier });
    try {
      const bodiesAt = (x: number, z: number): number => {
        let n = 0;
        host.physics.world.intersectionsWithPoint({ x, y: 0.4, z }, (c) => { if (c.shape.type !== rapier.ShapeType.HeightField) n++; return true; });
        return n;
      };
      // the boar never walks here (no step): its capsule must still stand where it was placed
      expect(bodiesAt(0, 0)).toBe(0);
      expect(bodiesAt(7, -9)).toBe(level.entities.length);
      expect(bodiesAt(-6, 5)).toBe(1);
    } finally { host.dispose(); }
  });
});
