import { describe, expect, it, afterAll } from 'vitest';
import { overrideTerrain } from '#engine-internal/world/Heightfield';
import { PerspectiveCamera, Vector3 } from 'three';
import { app, PlayerHealth, Scope } from '#engine';
import { Player } from '#engine-internal/player/Player';
import { legacyDouble } from '../fake/FakeGame';
import { Physics } from '#engine-internal/physics/Physics';
import { loadRapier } from '#engine-internal/physics/rapier';
import { groups } from '#engine-internal/physics/groups';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

// a flat, dry world through the terrain port, not a module mock (E422)
const restoreTerrain = overrideTerrain({ heightAt: () => 0 });
afterAll(restoreTerrain);

async function fixture(board: boolean, wall = false, ceiling = false) {
  const R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()), physics = new Physics(R);
  physics.world.createCollider(R.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0).setCollisionGroups(groups('WORLD')));
  if (wall) physics.world.createCollider(R.ColliderDesc.cuboid(0.1, 20, 10).setTranslation(1, 10, 0).setCollisionGroups(groups('WORLD')));
  if (ceiling) physics.world.createCollider(R.ColliderDesc.cuboid(10, 0.1, 10).setTranslation(0, 3, 0).setCollisionGroups(groups('WORLD')));
  const player = new Player(new PerspectiveCamera(), physics, legacyDouble<HTMLCanvasElement>({}), { waterLine: { update: () => undefined, setHint: () => undefined } });
  player.spawn(0, 0, 0, board ? 0.45 : 0.02); player.setHover(board);
  const scope = new Scope('player-impulse'), previous = app.levelScope;
  app.levelScope = scope;
  const health = new PlayerHealth(app.events, { now: () => 0, position: () => player.position,
    dodging: () => false, dodgeGuard: () => false, mode: () => board ? 'board' : 'foot',
    impulse: (velocity) => player.impulse(velocity) });
  app.registerPlayer(health, scope);
  const step = (count = 1) => { for (let i = 0; i < count; i++) { player.input(1 / 60); physics.step(); player.step(1 / 60); } };
  step(30);
  return { player, health, step, dispose: () => { scope.dispose(); app.levelScope = previous; player.motor.dispose(); physics.dispose(); } };
}

describe('public player impulse through Rapier', () => {
  for (const board of [false, true]) {
    const mode = board ? 'board' : 'foot';
    it(`copies and adds impulses, then decays at the creature rate on ${mode}`, async () => {
      const f = await fixture(board);
      try {
        if (!board) { f.player.position.y = 5; f.player.onGround = false; } // measure decay without floor-contact deflection
        const gust = new Vector3(3, 0, 0), start = f.player.position.clone();
        app.player?.impulse(gust); app.player?.impulse(gust); gust.set(999, 999, 999);
        f.step(); expect(f.player.position.x - start.x).toBeCloseTo(6 / 60, 4);
        const first = f.player.position.x;
        f.step(); expect(f.player.position.x - first).toBeCloseTo(6 / 60 * Math.exp(-3.5 / 60), 4);
        f.step(240); const end = f.player.position.x; f.step(30);
        expect(f.player.position.x).toBeCloseTo(end, 3); expect(end - start.x).toBeGreaterThan(1.5);
      } finally { f.dispose(); }
    });
    it(`resolves even a large shove against a wall on ${mode}`, async () => {
      const f = await fixture(board, true);
      try {
        app.player?.impulse(new Vector3(1000, 0, 0)); f.step(60);
        expect(f.player.position.x).toBeGreaterThan(0.2);
        expect(f.player.position.x).toBeLessThan(0.55); // near face 0.9 minus capsule radius and controller gap
      } finally { f.dispose(); }
    });
    it(`lifts the player and stops at a ceiling on ${mode}`, async () => {
      const f = await fixture(board, false, true);
      try {
        const start = f.player.position.y;
        app.player?.impulse(new Vector3(0, 30, 0)); f.step();
        expect(f.player.position.y).toBeGreaterThan(start + 0.3);
        if (board) expect(f.player.hoverAir).toBe(true);
        for (let i = 0; i < 90; i++) { f.step(); expect(f.player.position.y).toBeLessThan(1.13); }
      } finally { f.dispose(); }
    });
  }
  it('rejects non-finite input and clears pending impulses on respawn', async () => {
    const f = await fixture(false);
    try {
      expect(() => app.player?.impulse(new Vector3(Infinity, 0, 0))).toThrow('finite');
      expect(() => app.player?.impulse(new Vector3(0, Number.NaN, 0))).toThrow('finite');
      app.player?.impulse(new Vector3(10, 0, 0)); f.player.spawn(0, 0, 0, 0.02); f.step();
      expect(f.player.position.x).toBe(0);
      f.health.attributes.health = 0; app.player?.impulse(new Vector3(10, 0, 0)); f.step();
      expect(f.player.position.x).toBe(0);
    } finally { f.dispose(); }
  });
});
