// oxlint-disable-next-line import/no-nodejs-modules -- Real collider proof uses the committed native Rapier binary.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it, vi } from 'vitest';
import { BatchedMesh, BoxGeometry, Group, Mesh, MeshBasicMaterial, Scene } from 'three';
import { App } from '../src/engine/app/app';
import { SceneOwnership } from '../src/engine/app/sceneOwnership';
import { AssetService } from '../src/engine/app/assets';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import { createLevelInstallation } from '../src/engine/level/installation';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { Physics } from '../src/engine/physics/Physics';
import { addPiece } from '../src/engine/physics/pieces';
import { castRay } from '../src/engine/physics/query';
import { WorldRegistry, type Piece } from '../src/engine/world/registry';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import type { GridCell } from '../src/game/grid/assembly';
import { createRegionalView } from '../src/game/grid/regionalView';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

const noop = (): void => undefined;
const MB = 1_000_000;
const cell: GridCell = { instance: 'region-1', slug: 'region', cell: [1, 0], origin: { x: 540, y: 0, z: 0 } };
const box = (id: string, y: number, extra: Partial<Piece> = {}): Piece => ({ id, name: id, category: 'props', file: 'test/grid-regional-view.test.ts',
  colliders: [{ kind: 'box', x: 0, y, z: 0, hx: 2, hy: 0.5, hz: 2 }], ...extra });

function fixture() {
  const app = new App(), home = new Physics(rapier), region = new Physics(rapier), scene = new Scene();
  const homeRegistry = new WorldRegistry(), homeScope = new Scope('home');
  // bootstrap's listener: it closes over the HOME physics and scene, which is why a region cannot share it.
  withOwner(homeScope, () => { homeRegistry.onAdd((piece) => { if (piece.object) scene.add(piece.object); addPiece(home, piece); }); });
  app.registryValue = homeRegistry;
  const allocator = new ResidencyAllocator(), resident = new Scope('resident:region-1');
  const claim = allocator.reserve({ id: 'runtime:region-1', category: 'product', bytes: 40 * MB, owner: cell.instance, distance: 0, needed: true });
  if (claim === null) throw new Error('Fixture claim refused');
  const shared = new MeshBasicMaterial();
  const view = createRegionalView({ cell, home: { x: 0, z: 0 }, scene, physics: region, slot: app, assets: { isAcquired: (r) => r === shared },
    allocator, claim, scope: resident, ground: { heightAt: () => 0, waterSurfaceAt: () => null } });
  return { app, home, region, scene, homeRegistry, allocator, claim, resident, view, shared };
}
const down = (physics: Physics) => { physics.step(); return castRay(physics, { x: 0, y: 10, z: 0 }, { x: 0, y: -1, z: 0 }, 20); };

it('protects an entered view and permits quota eviction of its parked resident', () => {
  const allocator = new ResidencyAllocator(), resident = new Scope('evictable-region'), scene = new Scene(), physics = new Physics(rapier);
  const claim = allocator.reserve({ id: 'runtime:region-1', category: 'product', bytes: 40 * MB, owner: cell.instance, distance: 0, needed: false,
    evictSync: () => { resident.dispose(); } });
  if (claim === null) throw new Error('Fixture claim refused');
  const view = createRegionalView({ cell, home: { x: 0, z: 0 }, scene, physics, slot: { registryValue: null }, assets: { isAcquired: () => false },
    allocator, claim, scope: resident, ground: { heightAt: () => 0, waterSurfaceAt: () => null } });
  const entered = resident.child('entered'); view.enter(entered);
  const next = { id: 'next', category: 'product' as const, owner: 'next', bytes: 550 * MB, distance: 0, needed: true };
  try {
    expect(allocator.reserve(next)).toBeNull(); expect(resident.disposed).toBe(false);
    expect(allocator.entries().find(row => row.id === claim.id)?.holds).toBe(1);
    entered.dispose(); expect(view.census().held).toBe(false);
    const lease = allocator.reserve(next); expect(lease).not.toBeNull(); expect(resident.disposed).toBe(true);
    expect(scene.children).toHaveLength(0); expect(physics.world.colliders.len()).toBe(0);
    lease?.release();
  } finally { resident.dispose(); claim.release(); physics.dispose(); }
  expect(allocator.entries()).toEqual([]);
});

it('refuses to exist without the cell\'s reserved whole-runtime claim', () => {
  const allocator = new ResidencyAllocator(), physics = new Physics(rapier);
  const claim = allocator.reserve({ id: 'runtime:other', category: 'product', bytes: MB, owner: 'other', distance: 0, needed: true });
  if (claim === null) throw new Error('Fixture claim refused');
  expect(() => createRegionalView({ cell, home: { x: 0, z: 0 }, scene: new Scene(), physics, slot: { registryValue: null }, assets: { isAcquired: () => false },
    allocator, claim, scope: new Scope('resident'), ground: { heightAt: () => 0, waterSurfaceAt: () => null } })).toThrow(/reserved whole-runtime claim/u);
});

it('writes the destination physics through the page verbs while entered, hides parked geometry on leave and disposes to baseline', () => {
  const f = fixture(), { view } = f;
  expect(view.root.parent).toBe(f.scene);
  expect([view.root.position.x, view.root.position.z]).toEqual([540, 0]); // the cell's render offset from the home frame
  expect(view.census()).toMatchObject({ visible: false, bound: false, held: false });

  // A world-stage piece parks with the resident; an entered piece belongs to the entry scope.
  const world = f.resident.child('runtime.world'), entry = f.resident.child('runtime:region-1');
  view.enter(entry);
  expect(f.app.registry).toBe(view.registry);
  expect(view.census().visible).toBe(true);
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial(), disposed: string[] = [];
  geometry.addEventListener('dispose', () => { disposed.push('geometry'); });
  material.addEventListener('dispose', () => { disposed.push('material'); });
  f.shared.addEventListener('dispose', () => { disposed.push('shared'); });
  const installation = createLevelInstallation(f.app, entry, {}, () => ({ set: noop, detail: noop }));
  // HybridRuntimeSession runs every trusted stage under the entered scope's ownership.
  withOwner(entry, () => { installation.context.piece(box('entered.deck', 1, { object: new Mesh(geometry, material), floor: () => 1.5 })); });
  const follows = new Group(); view.root.add(follows);
  withOwner(entry, () => { f.app.registry.add(box('entered.raft', 4, { follows, object: new Mesh(new BoxGeometry(), f.shared) })); });
  withOwner(world, () => { f.app.registry.add(box('parked.rock', -2, { object: new Mesh(new BoxGeometry(), new MeshBasicMaterial()) })); });

  expect(f.homeRegistry.pieces).toHaveLength(0); // the home's captured listener never saw a regional piece
  expect(f.home.world.colliders.len()).toBe(0);
  expect(down(f.home)).toBeNull();
  expect(down(f.region)?.point.y).toBeCloseTo(4.5, 3); // the raft's top, in the region's frame-local world
  expect(view.queries.platforms.map(floor => floor(0, 0))).toEqual([1.5]);
  expect(view.census()).toMatchObject({ bodies: 1, colliders: 3, pieces: 3, objects: 4, movers: 1, platforms: 1, bound: true });
  follows.position.y = 2; view.sync(); f.region.step(); f.region.step();
  expect(down(f.region)?.point.y).toBeCloseTo(6.5, 3); // moving pieces pose from the regional root

  // Leave: entered handles go, the page registry returns to the home, parked geometry stays but is hidden.
  entry.dispose();
  expect(f.app.registry).toBe(f.homeRegistry);
  expect(view.census()).toEqual({ bodies: 0, colliders: 1, pieces: 1, objects: 2, movers: 0, platforms: 0, bound: false, visible: false, held: false });
  expect(disposed).toEqual(['geometry', 'material']); // the page asset cache's shared material is never disposed with a region
  expect(down(f.region)?.point.y).toBeCloseTo(-1.5, 3);

  // Re-entry shows the parked root again; disposal (eviction or page leave) returns to baseline.
  const again = f.resident.child('runtime:region-1');
  view.enter(again);
  expect(view.census()).toMatchObject({ visible: true, bound: true });
  view.dispose();
  expect(f.app.registry).toBe(f.homeRegistry); // a view disposed before its entry restores the page registry
  expect(view.root.parent).toBeNull();
  expect(view.census()).toEqual({ bodies: 0, colliders: 0, pieces: 0, objects: 0, movers: 0, platforms: 0, bound: false, visible: false, held: false });
  expect(f.region.world.colliders.len()).toBe(0);
  expect(f.region.world.bodies.len()).toBe(0);
  expect(f.allocator.has(f.claim.id)).toBe(true); // the caller owns the claim; the view only held it
  f.claim.release();
  expect(f.allocator.has(f.claim.id)).toBe(false);
  again.dispose(); world.dispose(); f.resident.dispose();
});

it('keeps captured piece batches under their piece owner and disposes once on leave then page unload', () => {
  const f = fixture(), page = new Scope('capturing-page'), entry = f.resident.child('entry');
  f.view.enter(entry);
  const material = new MeshBasicMaterial(), batch = new BatchedMesh(1, 24, 36, material), source = new BoxGeometry();
  batch.addInstance(batch.addGeometry(source)); source.dispose();
  const dispose = vi.spyOn(batch, 'dispose'), geometryDispose = vi.spyOn(batch.geometry, 'dispose');
  const installation = createLevelInstallation(f.app, entry, {}, () => ({ set: noop, detail: noop }));
  withOwner(entry, () => { installation.context.piece(box('captured.batch', 0, { object: batch })); });
  const ownership = new SceneOwnership(f.scene, page, new AssetService());
  ownership.capture(); ownership.capture();
  expect(f.view.scope.census.resources).toBe(1); expect(page.census.resources).toBe(0);
  entry.dispose(); f.view.dispose(); page.dispose(); f.resident.dispose();
  expect(dispose).toHaveBeenCalledOnce(); expect(geometryDispose).toHaveBeenCalledOnce();
  expect(f.scene.children).toEqual([]); expect(f.region.world.colliders.len()).toBe(0);
  f.claim.release(); f.home.dispose(); f.region.dispose();
});


it('shares a placement object across pieces without freeing it until its last piece leaves', () => {
  const f = fixture(), first = f.resident.child('first'), last = f.resident.child('last');
  const batch = new BatchedMesh(1, 24, 36, new MeshBasicMaterial()), source = new BoxGeometry();
  batch.addInstance(batch.addGeometry(source)); source.dispose();
  const dispose = vi.spyOn(batch, 'dispose');
  withOwner(first, () => { f.view.registry.add(box('first', 0, { object: batch })); });
  withOwner(last, () => { f.view.registry.add(box('last', 1, { object: batch })); });
  expect(f.view.root.children).toEqual([batch]); expect(f.region.world.colliders.len()).toBe(2);
  first.dispose(); expect(dispose).not.toHaveBeenCalled(); expect(batch.parent).toBe(f.view.root);
  expect(f.region.world.colliders.len()).toBe(1);
  last.dispose(); expect(dispose).toHaveBeenCalledOnce(); expect(batch.parent).toBeNull();
  f.view.dispose(); f.resident.dispose(); f.claim.release(); f.home.dispose(); f.region.dispose();
});
