import * as THREE from 'three';
import { afterEach, describe, expect, it, vi, afterAll } from 'vitest';
import { overrideTerrain } from '#engine/world/Heightfield';
import { Scope } from '#engine';
import { Enemies } from '#shards/driftwood-isle/creatures/Enemies';
import { getActiveChunk, setActiveChunk } from '#game/shard/registry';
import { invokeLegacy } from '../fake/legacyActor';
import { manager } from '../fake/manager';

// a flat, dry world through the terrain port, not a module mock (E422)
const restoreTerrain = overrideTerrain({ heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null });
afterAll(restoreTerrain);
const originalChunk = getActiveChunk().slug;
afterEach(() => { setActiveChunk(originalChunk); });
function placements(scope?: Scope): { enemies: Enemies; f: ReturnType<typeof manager> } {
  setActiveChunk('driftwood-isle'); const f = manager();
  const palms = [-150, 0, 150].flatMap((x) => Array.from({ length: 4 }, (_, i) =>
    ({ x: x + i * 2, z: 100, h: 8, lean: 0, leanDir: 0, rot: 0, fronds: 8 })));
  const enemies = new Enemies(f.manager, { scene: f.game.scene, sky: f.sky, palms, ...(scope === undefined ? {} : { scope }),
    crabSites: [{ x: -40, z: -100 }, { x: 40, z: -100 }], practice: { x: 0, z: -200 },
    wreck: { floorHeightAt: () => 2 } });
  for (const method of ['placeCrabs', 'placePracticeCrab', 'placeMonkeys', 'placeSailor']) invokeLegacy(enemies, method);
  return { enemies, f };
}
describe('Driftwood actual enemy placement baseline', () => {
  it('keeps seeded crab groups, three palm troops, practice crab and wreck sailor positions', () => {
    const a = placements(), b = placements();
    const rows = (f: ReturnType<typeof manager>): object[] => f.manager.animals.map((animal) =>
      ({ kind: animal.kind, variant: animal.variant, hp: animal.hp, herd: animal.herd,
        xyz: animal.position.toArray().map((v) => Number(v.toFixed(4))), yaw: Number(animal.yaw.toFixed(4)) }));
    expect(rows(a.f)).toEqual(rows(b.f));
    expect({ placed: a.enemies.placed, animals: rows(a.f), hold: a.f.manager.enemyWorld.hold }).toMatchSnapshot('seeded enemies');
    for (const herd of a.f.manager.herds.filter((h) => h.kind === 'crab' && h.members.length > 1)) {
      expect(herd.members[0]?.variant).toBe('big'); expect(herd.members.slice(1).every((c) => c.variant === 'small')).toBe(true);
    }
    expect(a.enemies.placed.troops).toBe(3); expect(a.enemies.placed.sailors).toBe(1);
  });
  it('scope retirement removes only this enemy population and is idempotent', () => {
    const scope = new Scope('enemies'); const { f } = placements(scope); const unrelated = f.manager.spawn('boar', 0, 0, 0);
    scope.dispose(); scope.dispose(); expect(f.manager.animals).toEqual([unrelated]);
  });
  it('practice crab needs both45s dead and30m away, then fades before replacing the body', () => {
    const { enemies, f } = placements(), crab = enemies.practiceCrab;
    if (crab === null) throw new Error('practice crab missing');
    crab.alive = false; const fade = vi.spyOn(crab, 'fadeOut').mockImplementation(() => undefined);
    const near = new THREE.Vector3(0, 0, -200), far = new THREE.Vector3(30, 0, -200), count = f.manager.animals.length;
    invokeLegacy(enemies, 'tickPractice', 44, far); invokeLegacy(enemies, 'tickPractice', 1, near);
    expect(fade).not.toHaveBeenCalled(); expect(f.manager.animals).toHaveLength(count);
    invokeLegacy(enemies, 'tickPractice', 0.01, far); expect(fade).toHaveBeenCalledOnce();
    crab.hidden = true; invokeLegacy(enemies, 'tickPractice', 0.01, far);
    expect(f.manager.animals).toHaveLength(count + 1); expect(enemies.practiceCrab).not.toBe(crab);
    expect(enemies.practiceCrab?.variant).toBe('small'); expect(enemies.practiceCrab?.position.toArray()).toEqual([0, 0, -200]);
  });
});
