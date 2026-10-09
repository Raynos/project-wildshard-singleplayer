// SF57 (E435): placement state lives as long as the world that placed it. A grid shard visit places into its region's
// registry; when the region leaves (`registry.retire()`), its model records and its per-frame cullers go, so N place /
// retire cycles keep `placementCensus()` flat, `cullPlaced` runs only live cullers and `placedGroups` returns only live
// groups. A build-only call (`registry: null`) lives as long as its owner scope.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WorldRegistry } from '../../src/engine/world/registry';
import { modelContext, type ModelDef } from '../../src/engine/models/model';
import { cullPlaced, finishWeld, place, placedCopies, placedGroups, placementCensus, weld } from '../../src/engine/models/place';
import { Scope } from '../../src/engine/app/scope';
import { withOwner } from '../../src/engine/app/ownership';

const material = new THREE.MeshBasicMaterial();
const ctx = modelContext(null);
const rock: ModelDef<{ s: number }> = {
  id: 'shared/test-lifetime-rock', name: 'Rock', category: 'nature', pipeline: 'code', file: 'test/engine/place-lifetime.test.ts', defaults: { s: 1 },
  build: (_c, p) => [{ geometry: new THREE.BoxGeometry(p.s, p.s, p.s), material }],
};
const cabin: ModelDef<{ s: number }> = {
  ...rock, id: 'shared/test-lifetime-cabin', name: 'Cabin',
  weld: () => {
    const root = new THREE.Group();
    return { root, parts: [{ material, geometries: [new THREE.BoxGeometry()] }], colliders: [], box: (target: THREE.Box3) => target.setFromObject(root) };
  },
};
const row = (n: number, z = 0): { x: number; y: number; z: number }[] => Array.from({ length: n }, (_, i) => ({ x: i * 4, y: 0, z }));
const camera = (): THREE.PerspectiveCamera => {
  const c = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  c.position.set(0, 2, 10); c.lookAt(0, 0, 0); c.updateMatrixWorld(true);
  return c;
};

const isInstanced = (o: THREE.Object3D): o is THREE.InstancedMesh => (o as Partial<THREE.InstancedMesh>).isInstancedMesh === true;

/** one shard visit: what a resident world places, then its build-only scratch under its owner */
function visit(): { registry: WorldRegistry; owner: Scope; field: THREE.InstancedMesh[] } {
  const registry = new WorldRegistry(), owner = new Scope('test.visit');
  const field = place(rock, row(12), { ctx, draw: 'instanced', cull: { far: 60 }, registry });
  place(rock, row(8, 30), { ctx, draw: 'merged', cell: 16, cull: { far: 80 }, registry });
  const joint = weld({ unit: 'copy', parent: new THREE.Group(), detail: 30 });
  place(cabin, row(2, -30), { ctx, draw: 'merged', weld: joint, registry });
  finishWeld(joint);
  withOwner(owner, () => { place(rock, row(4, 60), { ctx, draw: 'instanced', cull: { far: 40 }, registry: null }); });
  const meshes: THREE.InstancedMesh[] = [];
  field.object.traverse((o) => { if (isInstanced(o)) meshes.push(o); });
  return { registry, owner, field: meshes };
}

describe('placement lifetime (SF57)', () => {
  it('a visit\'s records and cullers go when its registry retires and its owner disposes', () => {
    const base = placementCensus();
    const { registry, owner } = visit();
    expect(placementCensus()).toEqual({ lives: base.lives + 2, records: base.records + 2, groups: base.groups + 3, cullers: base.cullers + 4 });
    expect(placedGroups()).toHaveLength(base.groups + 3);
    expect(placedCopies(rock.id)).toBe(20);
    // the first group of each model carries its catalog entry, under the model's own piece id
    expect(registry.pieces.map((p) => p.id)).toEqual([rock.id, `${rock.id}#2`, cabin.id]);
    expect(registry.models().map((m) => m.id).sort()).toEqual([cabin.id, rock.id]);
    registry.retire();
    expect(placementCensus()).toEqual({ ...base, lives: base.lives + 1, cullers: base.cullers + 1 });
    owner.dispose();
    expect(placementCensus()).toEqual(base);
    expect(placedGroups()).toHaveLength(base.groups);
    expect(placedCopies(rock.id)).toBe(0);
  });

  it('N place / retire cycles keep the records, groups and cullers flat', () => {
    const base = placementCensus();
    const peaks: number[] = [];
    for (let i = 0; i < 40; i++) {
      const { registry, owner } = visit();
      peaks.push(placementCensus().cullers);
      // every visit's catalog starts fresh: the model's own piece id and its entry, not `#k` of a retired visit
      expect(registry.pieces[0]?.id).toBe(rock.id);
      expect(registry.pieces[0]?.model).toBeDefined();
      registry.retire(); owner.dispose();
      expect(placementCensus()).toEqual(base);
    }
    expect(new Set(peaks).size).toBe(1);
  });

  it('cullPlaced runs only the live worlds\' cullers', () => {
    const live = visit(), gone = visit();
    const cam = camera();
    gone.registry.retire(); gone.owner.dispose();
    for (const m of [...live.field, ...gone.field]) m.count = 999;
    cullPlaced(cam);
    expect(live.field.some((m) => m.count !== 999)).toBe(true);
    expect(gone.field.every((m) => m.count === 999)).toBe(true);
    live.registry.retire(); live.owner.dispose();
  });

  it('a place into a retired registry records nothing and starts no culler', () => {
    const base = placementCensus();
    const registry = new WorldRegistry();
    registry.retire();
    expect(registry.retired).toBe(true);
    place(rock, row(3), { ctx, draw: 'instanced', cull: { far: 60 }, registry });
    expect(placementCensus()).toEqual(base);
    let ran = 0;
    registry.onRetire(() => { ran++; });
    expect(ran).toBe(1);
  });
});

describe('registry holds on the owner (SF57)', () => {
  it('a retired registry\'s pieces are no longer held by the long-lived owner they were added under', () => {
    const page = new Scope('test.page');
    const before = page.census.disposers;
    for (let i = 0; i < 20; i++) {
      const registry = new WorldRegistry();
      withOwner(page, () => {
        registry.onAdd(() => undefined);
        place(rock, row(3), { ctx, draw: 'instanced', registry });
      });
      expect(page.census.disposers).toBeGreaterThan(before);
      registry.retire();
      expect(page.census.disposers).toBe(before);
    }
    // a live registry still lets its owner remove what it added
    const registry = new WorldRegistry(), level = new Scope('test.level');
    withOwner(level, () => { place(rock, row(3), { ctx, draw: 'instanced', registry }); });
    expect(registry.pieces).toHaveLength(1);
    level.dispose();
    expect(registry.pieces).toHaveLength(0);
    registry.retire(); page.dispose();
  });

  it('a borrowed home\'s entry places into the page registry: its copy, record, culler and tap target go with the entry', () => {
    const base = placementCensus();
    const registry = new WorldRegistry(), page = new Scope('test.page');
    const before = page.census.disposers;
    for (let i = 0; i < 10; i++) {
      const entry = page.child('runtime.play');
      entry.run(() => { place(rock, row(3), { ctx, draw: 'instanced', cull: { far: 60 }, registry }); });
      expect(registry.pieces).toHaveLength(1); expect(registry.picks).toHaveLength(1);
      // the re-entry's copy is the model's first again: its own piece id and catalog entry
      expect(registry.pieces[0]?.id).toBe(rock.id); expect(registry.pieces[0]?.model).toBeDefined();
      expect(placementCensus()).toEqual({ lives: base.lives + 1, records: base.records + 1, groups: base.groups + 1, cullers: base.cullers + 1 });
      entry.dispose();
      expect(registry.pieces).toHaveLength(0); expect(registry.picks).toHaveLength(0);
      expect(placementCensus()).toEqual({ ...base, lives: base.lives + 1 });
    }
    // a registry that retires before the entry ends leaves nothing on the entry
    const entry = page.child('runtime.play');
    entry.run(() => { place(rock, row(3), { ctx, draw: 'instanced', cull: { far: 60 }, registry }); });
    const held = entry.census.disposers;
    registry.retire();
    expect(entry.census.disposers).toBeLessThan(held);
    expect(placementCensus()).toEqual(base);
    entry.dispose();
    expect(page.census.disposers).toBe(before);
    page.dispose();
  });
});
