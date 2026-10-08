// G223 (E435): an entered regional view hides its cell's coarse cover (far proxy, ring tiles) and gives it back on leave.
// oxlint-disable-next-line import/no-nodejs-modules -- the regional view's physics uses the committed native Rapier binary.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { Group, Scene } from 'three';
import { Scope } from '../src/engine/app/scope';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { Physics } from '../src/engine/physics/Physics';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import type { GridCell } from '../src/game/grid/assembly';
import { bindCellCover, cellCoverOf, cellCoverPort } from '../src/game/grid/cellCover';
import { createRegionalView } from '../src/game/grid/regionalView';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

const cell: GridCell = { instance: 'region-1', slug: 'region', cell: [0, 1], origin: { x: 0, y: 0, z: 555 } };

it('counts covers per instance and shows a root again only when the last cover leaves', () => {
  const a = new Group(), b = new Group(), roots = new Map([['a', a], ['b', b]]);
  const port = cellCoverPort((id) => roots.get(id));
  const first = port.cover('a'), second = port.cover('a');
  expect([a.visible, b.visible, port.covered('a')]).toEqual([false, true, true]);
  first(); first(); // idempotent
  expect(a.visible).toBe(false);
  second();
  expect([a.visible, port.covered('a')]).toEqual([true, false]);
  expect(() => { port.cover('missing')(); }).not.toThrow();
});

it('binds one port per scene and unbinds only its own', () => {
  const scene = new Scene(), port = cellCoverPort(() => undefined);
  const unbind = bindCellCover(scene, port);
  expect(cellCoverOf(scene)).toBe(port);
  expect(() => bindCellCover(scene, cellCoverPort(() => undefined))).toThrow(/already has a grid cell cover/u);
  unbind();
  expect(cellCoverOf(scene)).toBeNull();
});

it('hides the cell\'s coarse root while a regional view is entered, on re-entry too, and gives it back on leave and on dispose', () => {
  const scene = new Scene(), coarse = new Group(); coarse.name = 'grid-cell:region-1'; scene.add(coarse);
  const unbind = bindCellCover(scene, cellCoverPort((id) => (id === cell.instance ? coarse : undefined)));
  const allocator = new ResidencyAllocator(), resident = new Scope('resident:region-1'), physics = new Physics(rapier);
  const claim = allocator.reserve({ id: 'runtime:region-1', category: 'product', bytes: 1_000_000, owner: cell.instance, distance: 0, needed: true });
  if (claim === null) throw new Error('Fixture claim refused');
  const view = createRegionalView({ cell, home: { x: 0, z: 0 }, scene, physics, slot: { registryValue: null }, assets: { isAcquired: () => false },
    allocator, claim, scope: resident, ground: { heightAt: () => 0, waterSurfaceAt: () => null } });
  try {
    // parked: the coarse cover draws the cell, the region's own root is hidden
    expect([coarse.visible, view.root.visible]).toEqual([true, false]);
    for (let visit = 0; visit < 2; visit++) {
      const entry = resident.child(`entry-${visit}`); view.enter(entry);
      expect([coarse.visible, view.root.visible]).toEqual([false, true]);
      entry.dispose();
      expect([coarse.visible, view.root.visible]).toEqual([true, false]);
    }
    // a view disposed while entered still hands the cover back
    view.enter(resident.child('entry-last'));
    expect(coarse.visible).toBe(false);
    view.dispose();
    expect(coarse.visible).toBe(true);
  } finally { resident.dispose(); claim.release(); physics.dispose(); unbind(); }
});

it('enters without a grid session (no port bound to the scene)', () => {
  const scene = new Scene(), allocator = new ResidencyAllocator(), resident = new Scope('resident'), physics = new Physics(rapier);
  const claim = allocator.reserve({ id: 'runtime:region-1', category: 'product', bytes: 1_000_000, owner: cell.instance, distance: 0, needed: true });
  if (claim === null) throw new Error('Fixture claim refused');
  const view = createRegionalView({ cell, home: { x: 0, z: 0 }, scene, physics, slot: { registryValue: null }, assets: { isAcquired: () => false },
    allocator, claim, scope: resident, ground: { heightAt: () => 0, waterSurfaceAt: () => null } });
  try { const entry = resident.child('entry'); view.enter(entry); expect(view.root.visible).toBe(true); entry.dispose(); }
  finally { resident.dispose(); claim.release(); physics.dispose(); }
});
