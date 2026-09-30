// E306 / E315 M7 (docs/plans/MODEL-ARCHITECTURE.md): the Sets explorer's pure parts (src/explore/setView.ts). A set is
// framed from the air so its bounds stay on screen from every yaw of the slow orbit, its members read as rows, it is
// measured by the objects that draw it (each once), and `placeSet` hands the explorer what draws each member.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WorldRegistry, type RegisteredSet } from '../src/world/registry';
import { defineModel, modelContext } from '../src/models/model';
import { place } from '../src/models/place';
import { placeSet } from '../src/models/sets';
import { boxEdges, copyBoxes, drawnRoots, fitOrbit, liftOf, measureDrawn, memberFacts, orderSets, pendingOf, poseOrbit, regionOf, setsOf, setTotals, type NdcWindow } from '../src/explore/setView';

const ctx = modelContext(null);
const mat = new THREE.MeshBasicMaterial();
const hut = defineModel({ id: 'shared/test-sets-hut', name: 'Hut', category: 'buildings', pipeline: 'code', file: 'test/sets-explorer.test.ts', defaults: {}, build: () => [{ geometry: new THREE.BoxGeometry(4, 3, 4).translate(0, 1.5, 0), material: mat }] });
const crate = defineModel({ id: 'shared/test-sets-crate', name: 'Crate', category: 'props', pipeline: ['code', 'trellis'], file: 'test/sets-explorer.test.ts', defaults: {}, build: () => [{ geometry: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), material: mat }] });

/** a camp: two huts merged, five crates instanced, named as one set */
function camp(): { reg: WorldRegistry; set: RegisteredSet } {
  const reg = new WorldRegistry();
  const huts = place(hut, [{ x: 0, y: 0, z: 0 }, { x: 30, y: 0, z: 10 }], { ctx, draw: 'merged', registry: reg });
  const crates = place(crate, Array.from({ length: 5 }, (_, i) => ({ x: i * 2, y: 0, z: 8 })), { ctx, draw: 'instanced', registry: reg });
  return { reg, set: placeSet({ id: 'shared/test-camp', name: 'Camp', file: 'test/sets-explorer.test.ts', members: [huts, crates], registry: reg }) };
}

describe('the Sets explorer', () => {
  it('placeSet hands the explorer what draws each member, and every copy box', () => {
    const { reg, set } = camp();
    expect(reg.sets).toEqual([set]);
    expect(set.placed?.map((p) => [p.model, p.copies])).toEqual([[hut.id, 2], [crate.id, 5]]);
    expect(copyBoxes(set)).toHaveLength(7);
    expect(copyBoxes(set, crate.id).map((b) => b.getCenter(new THREE.Vector3()).x)).toEqual([0, 2, 4, 6, 8]);
    expect(set.bounds.containsBox(copyBoxes(set, hut.id)[1] ?? new THREE.Box3())).toBe(true);
    expect(setTotals(set)).toEqual({ models: 2, copies: 7 });
  });

  it('member rows: most copies first, the catalog\'s name and badges; a model not in the catalog says so', () => {
    const { set } = camp();
    const facts = memberFacts(set, [{ id: hut.id, name: 'Hut', pipeline: ['code'], drawnAs: 'merged' }]);
    expect(facts).toEqual([
      { model: crate.id, name: crate.id, copies: 5, pipeline: [], drawnAs: null },
      { model: hut.id, name: 'Hut', copies: 2, pipeline: ['code'], drawnAs: 'merged' },
    ]);
    expect(setsOf(hut.id, [set]).map((s) => s.id)).toEqual(['shared/test-camp']);
    expect(setsOf('shared/nothing', [set])).toEqual([]);
  });

  it('frames the set from every yaw inside the window, its centre lifted above the sheet', () => {
    const { set } = camp();
    const cam = new THREE.PerspectiveCamera(72, 402 / 874, 0.08, 2600); // the game's camera on a portrait phone
    const win: NdcWindow = { x0: -0.86, x1: 0.86, y0: -0.05, y1: 0.8 };
    const d = fitOrbit(set.bounds, cam, 0.72, win);
    const centre = set.bounds.getCenter(new THREE.Vector3()), p = new THREE.Vector3();
    let widest = 0;
    for (let k = 0; k < 16; k++) {
      poseOrbit(cam, centre, k * 0.4, 0.72, d, liftOf(win));
      for (let i = 0; i < 8; i++) {
        p.set(i & 1 ? set.bounds.max.x : set.bounds.min.x, i & 2 ? set.bounds.max.y : set.bounds.min.y, i & 4 ? set.bounds.max.z : set.bounds.min.z).project(cam);
        expect(p.x).toBeGreaterThanOrEqual(win.x0 - 0.02); expect(p.x).toBeLessThanOrEqual(win.x1 + 0.02);
        expect(p.y).toBeGreaterThanOrEqual(win.y0 - 0.02); expect(p.y).toBeLessThanOrEqual(win.y1 + 0.02);
        widest = Math.max(widest, Math.abs(p.x), p.y - liftOf(win), liftOf(win) - p.y);
      }
      // the centre sits at the window's middle height, on the vertical centre line
      p.copy(centre).project(cam);
      expect(p.x).toBeCloseTo(0, 5); expect(p.y).toBeCloseTo(liftOf(win), 5);
    }
    expect(widest).toBeGreaterThan(0.4); // fitted, not a speck: some yaw fills the window
  });

  it('measures a set by the objects that draw it, each once, as they stand this frame', () => {
    const { set } = camp();
    const roots = drawnRoots(set);
    expect(roots).toHaveLength(2);
    expect(measureDrawn(roots)).toEqual({ tris: 2 * 12 + 5 * 12, calls: 2 });
    // members drawn into one kit share it; a copy drawn inside another member's object is drawn by that one
    const kit = new THREE.Group(), inner = new THREE.Mesh(new THREE.BoxGeometry(), mat);
    kit.add(inner);
    const shared: RegisteredSet = { ...set, placed: [{ model: 'a', object: kit, copies: 1, copyBox: (_i, t) => t }, { model: 'b', object: kit, copies: 1, copyBox: (_i, t) => t }, { model: 'c', object: inner, copies: 1, copyBox: (_i, t) => t }] };
    expect(drawnRoots(shared)).toEqual([kit]);
    expect(measureDrawn([kit])).toEqual({ tris: 12, calls: 1 });
    kit.visible = false;
    expect(measureDrawn([kit])).toEqual({ tris: 0, calls: 0 }); // hidden (a far LOD level, a culled cell): not drawn
  });

  it('a shard\'s 10–20 places read in order: by region (north is −z), by name, or most copies first; one still to come waits at the end', () => {
    const at = (id: string, x: number, z: number, copies: number): { set: RegisteredSet; totals: { copies: number } } => ({
      set: { id, name: id, file: 'x.ts', members: [], bounds: new THREE.Box3(new THREE.Vector3(x - 5, 0, z - 5), new THREE.Vector3(x + 5, 4, z + 5)) }, totals: { copies },
    });
    const none = { set: { id: 'Ghost', name: 'Ghost', file: 'x.ts', members: [], bounds: new THREE.Box3(), pending: ['a/b'] }, totals: { copies: 0 } };
    const sets = [at('Wreck', 200, 10, 3), at('Hut', 0, 0, 1), at('Lookout', 150, -180, 9), at('Pier', 0, -240, 2), at('Cove', -200, 190, 40), none];
    expect(sets.map((s) => s.set.bounds.isEmpty() ? null : regionOf(s.set.bounds, 250))).toEqual(['East', 'Centre', 'North-east', 'North', 'South-west', null]);
    expect(orderSets(sets, 'map', 250).map((r) => [r.region, r.info.set.id])).toEqual([['Centre', 'Hut'], ['North', 'Pier'], ['North-east', 'Lookout'], ['East', 'Wreck'], ['South-west', 'Cove'], [null, 'Ghost']]);
    expect(orderSets(sets, 'az', 250).map((r) => r.info.set.id)).toEqual(['Cove', 'Ghost', 'Hut', 'Lookout', 'Pier', 'Wreck']);
    expect(orderSets(sets, 'size', 250).map((r) => r.info.set.id)).toEqual(['Cove', 'Lookout', 'Wreck', 'Pier', 'Hut', 'Ghost']);
    expect(pendingOf(none.set)).toEqual(['a/b']);
    expect(pendingOf(at('x', 0, 0, 1).set)).toEqual([]);
  });

  it('marks: twelve edges a box, every end on its corners', () => {
    const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 4, 20));
    const b = boxEdges([box, box]);
    expect(b).toHaveLength(2 * 12 * 2 * 3);
    for (let i = 0; i < b.length; i += 3) expect([b[i] === 0 || b[i] === 10, b[i + 1] === 0 || b[i + 1] === 4, b[i + 2] === 0 || b[i + 2] === 20]).toEqual([true, true, true]);
  });
});
