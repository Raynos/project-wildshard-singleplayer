import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Rng } from '../src/engine/core/rng';
import { modelContext, withModelPlacementVisitor, type ModelDef, type ModelPlacementVisitor } from '../src/engine/models/model';
import { place, weld } from '../src/engine/models/place';
import { fakeWorld } from './fake/world';

const material = new THREE.MeshStandardMaterial({ color: 0x736c54 });
function definition(build: ModelDef<{ width: number }>['build']): ModelDef<{ width: number }> {
  return { id: 'shared/bake-fixture', name: 'Bake fixture', category: 'props', pipeline: 'code', file: 'test/model-bake-visitor.test.ts', defaults: { width: 1 }, seed: 73, build };
}

describe('scoped authored-placement bake visitor', () => {
  it('captures all variant copies before a handed culler hides them, with no extra builds or RNG draws', () => {
    let builds = 0;
    const random: number[] = [], observed: { level: number; xs: number[]; material: THREE.Material }[] = [];
    const def = definition((_, params, rng) => {
      builds++; random.push(rng.next());
      return [{ geometry: new THREE.BoxGeometry(params.width, 1, 1), material }];
    });
    const lodModel = { ...def, variants: [{ id: 'wide', label: 'Wide', params: { width: 2 } }], lods: [{ from: 40, build: (_: unknown, params: { width: number }, rng: Rng) => {
      builds++; random.push(rng.next()); return [{ geometry: new THREE.BoxGeometry(params.width, 1, 1), material }];
    } }] };
    const visit: ModelPlacementVisitor = () => (event) => {
      if (event.kind !== 'model' || event.built instanceof THREE.Object3D) throw new Error('Expected model parts');
      for (const part of event.built) observed.push({ level: event.level, xs: event.placements.map((p) => p.x), material: part.material });
    };
    const taken: THREE.InstancedMesh[] = [];
    const placed = place(lodModel, [{ x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0, variant: 'wide' }, { x: 3, y: 0, z: 0 }], {
      ctx: modelContext(null, null, visit), draw: 'instanced', registry: null,
      culler: { take: (group) => { for (const level of group.levels) if (level.mesh !== null) { level.mesh.count = 0; taken.push(level.mesh); } } },
    });
    expect(placed.copies).toBe(3);
    expect(taken.length).toBe(4);
    expect(taken.every((mesh) => mesh.count === 0)).toBe(true);
    expect(observed.map(({ level, xs }) => ({ level, xs }))).toEqual([{ level: 0, xs: [1, 3] }, { level: 1, xs: [1, 3] }, { level: 0, xs: [2] }, { level: 1, xs: [2] }]);
    expect(observed.every((row) => row.material === material)).toBe(true);
    expect(builds).toBe(4);
    const base = new Rng(73).next(), lod = new Rng(73 ^ Math.imul(1, 0x9e3779b9)).next();
    expect(random).toEqual([base, lod, base, lod]);
  });

  it('observes merged geometry in model space before in-place transforms and preserves per-copy RNG order', () => {
    const positions: number[] = [], draws: number[] = [];
    const def = definition((_, params, rng) => {
      draws.push(rng.next()); return [{ geometry: new THREE.BoxGeometry(params.width, 1, 1), material }];
    });
    const visit: ModelPlacementVisitor = (call) => {
      expect(call.pieceId).toBe('fixture.rocks'); expect(call.moving).toBe(false);
      return (event) => {
        if (event.kind !== 'model' || event.built instanceof THREE.Object3D) throw new Error('Expected parts');
        const part = event.built[0]; if (part === undefined) throw new Error('Missing built part');
        positions.push(part.geometry.getAttribute('position').getX(0));
      };
    };
    place(def, [{ x: 20, y: 0, z: 0 }, { x: 40, y: 0, z: 0, params: { width: 2 } }], { ctx: modelContext(null, null, visit), draw: 'merged', registry: null, piece: { id: 'fixture.rocks' } });
    expect(positions).toEqual([0.5, 1]);
    const rng = new Rng(73); expect(draws).toEqual([rng.next(), rng.next()]);
  });

  it('observes site-fitted weld parts before joining and never rebuilds drawn-elsewhere geometry', () => {
    const root = new THREE.Group(), geometry = new THREE.BoxGeometry(), worlds: number[] = [];
    let builds = 0, welds = 0;
    const def = { ...definition(() => { builds++; throw new Error('Specimen must not run'); }), weld: () => {
      welds++; root.position.x = 20;
      return { root, parts: [{ material, geometries: [geometry] }], colliders: [], box: (target: THREE.Box3) => target.setFromObject(root) };
    } };
    const visit: ModelPlacementVisitor = (call) => {
      if (call.drawnInto !== undefined) expect(call.drawnInto).toBe(root);
      return (event) => { if (event.kind !== 'weld') throw new Error('Expected weld'); expect(event.built.parts[0]?.geometries[0]).toBe(geometry); worlds.push(event.built.root.position.x); };
    };
    const ctx = modelContext(null, null, visit), joint = weld({ unit: 'copy', parent: new THREE.Group(), detail: 30 });
    place(def, [{ x: 20, y: 0, z: 0 }], { ctx, draw: 'merged', weld: joint, registry: null });
    place(def, [{ x: 20, y: 0, z: 0 }], { ctx, draw: 'single', drawnInto: { object: root, boxes: new Float32Array([19, -1, -1, 21, 1, 1]) }, registry: null, piece: { follows: root } });
    expect(worlds).toEqual([20]); expect(welds).toBe(1); expect(builds).toBe(0);
  });

  it('binds only the owned sky and removes the observer even after an asynchronous build rejects', async () => {
    const { sky } = fakeWorld(), { sky: other } = fakeWorld(), ctx = modelContext(sky);
    let calls = 0;
    const visit: ModelPlacementVisitor = () => { calls++; return undefined; };
    const def = definition(() => [{ geometry: new THREE.BoxGeometry(), material }]);
    const run = () => { place(def, [{ x: 0, y: 0, z: 0 }], { ctx, draw: 'single', registry: null }); };
    await expect(withModelPlacementVisitor(sky, visit, async () => {
      run();
      place(def, [{ x: 0, y: 0, z: 0 }], { ctx: modelContext(other), draw: 'single', registry: null });
      await expect(withModelPlacementVisitor(sky, visit, () => Promise.resolve())).rejects.toThrow('already bound');
      throw new Error('Owned build failed');
    })).rejects.toThrow('Owned build failed');
    run(); expect(calls).toBe(1); expect(ctx.visitPlacement).toBeUndefined();
  });
});
