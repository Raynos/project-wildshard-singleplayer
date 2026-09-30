// E315 M1 (docs/plans/MODEL-ARCHITECTURE.md): Driftwood's models on the contract — a moving copy's colliders ride it
// (`piece.follows: 'copy'`, the sailboat), and the island's models build in their own space (origin at their foot).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WorldRegistry } from '../src/world/registry';
import type { Sky } from '../src/world/Sky';
import { defineModel, modelContext } from '../src/models/model';
import { place } from '../src/models/place';
import { boat, boatColliders } from '../src/chunks/driftwood-isle/models/boat';
import { palm } from '../src/chunks/driftwood-isle/models/palm';
import { hut, hutLayout } from '../src/chunks/driftwood-isle/models/hut';
import { lookout, lookoutLayout } from '../src/chunks/driftwood-isle/models/lookout';

/** the world side's sources and the shard's setup, as text (the M8 check below) */
const SOURCES = import.meta.glob<string>(['../src/world/*.ts', '../src/main.ts'], { query: '?raw', import: 'default', eager: true });
const source = (file: string): string => { const s = SOURCES[`../${file}`]; if (s === undefined) throw new Error(`no source ${file}`); return s; };

// a stand-in sky: the materials only ask it to prepare them (no renderer in a test)
const sky = { setupMaterial(_m: THREE.Material): void { /* nothing to prepare */ }, csm: { lightDirection: new THREE.Vector3(0, -1, 0) } } as Sky;
const ctx = modelContext(sky);

describe('Driftwood models (E315 M1)', () => {
  it("piece.follows 'copy': the piece rides its one single copy, its colliders in the copy's own space", () => {
    const reg = new WorldRegistry();
    const mat = new THREE.MeshBasicMaterial();
    const raft = defineModel({
      id: 'shared/test-raft', name: 'Raft', category: 'props', pipeline: 'code', file: 'test/models-driftwood.test.ts', defaults: {},
      build: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 3), mat)); return g; },
      colliders: () => [{ kind: 'box', x: 0, y: 0.1, z: 0, hx: 1, hy: 0.1, hz: 1.5 }],
    });
    const placed = place(raft, [{ x: 10, y: 1, z: -5, yaw: 0.4 }], { ctx, draw: 'single', registry: reg, piece: { id: 'raft', follows: 'copy' } });
    const piece = reg.get('raft');
    expect(piece?.follows).toBe(placed.object);
    expect(piece?.colliders).toEqual([{ kind: 'box', x: 0, y: 0.1, z: 0, hx: 1, hy: 0.1, hz: 1.5 }]); // own space
    expect(placed.colliders[0]).toMatchObject({ kind: 'box', x: 10, z: -5 }); // the Placed keeps the placed ones
    expect(placed.object.position.toArray()).toEqual([10, 1, -5]);
    expect(() => place(raft, [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }], { ctx, draw: 'single', registry: reg, piece: { follows: 'copy' } })).toThrow(/one 'single' placement/);
  });

  it('the sailboat: placed single, its walls and floor ride it exactly as the old local set', () => {
    const reg = new WorldRegistry();
    const placed = place(boat, [{ x: -4.2, y: 0.8, z: -244 }], { ctx, draw: 'single', registry: reg, piece: { id: 'boat', follows: 'copy', solidFloor: true } });
    expect(placed.drawnAs).toBe('single');
    expect(reg.get('boat')?.colliders).toEqual(boatColliders());
    expect(reg.models().find((m) => m.id === 'driftwood-isle/boat')).toMatchObject({ name: 'Sailboat', copies: 1, pipeline: 'code', category: 'buildings' });
  });

  it('own space: a palm stands on its origin, its trunk capsules around the axis', () => {
    const placed = place(palm, [{ x: 0, y: 0, z: 0, params: { h: 8, lean: 0, leanDir: 0, rot: 0, fronds: 10 } }], { ctx, draw: 'merged', registry: null });
    const box = new THREE.Box3().setFromObject(placed.object);
    expect(box.min.y).toBeCloseTo(-0.3, 0); // the coconuts and frond tips hang lower than the crown, never under the foot
    expect(box.max.y).toBeGreaterThan(8);
    expect(placed.colliders).toHaveLength(3);
    for (const c of placed.colliders) expect(Math.hypot(c.kind === 'capsule' ? c.x : 99, c.kind === 'capsule' ? c.z : 99)).toBeLessThan(1e-9);
  });

  it('M8: the Driftwood files on the contract never register a thing by hand, and draw by hand only what they declare world', () => {
    /** each migrated world-side file: what it may still draw itself, and why (a file that grows one more fails) */
    const WORLD: Record<string, { why: string; draws: Partial<Record<'mergeGeometries' | 'InstancedMesh' | 'BatchedMesh' | 'Mesh', number>> }> = {
      'src/world/Palms.ts': { why: 'an empty stand-in mesh when nothing was placed', draws: { Mesh: 1 } },
      'src/world/Bushes.ts': { why: 'an empty stand-in mesh when nothing was placed', draws: { Mesh: 1 } },
      'src/world/Boulders.ts': { why: '', draws: {} },
      'src/world/Pier.ts': { why: '', draws: {} },
      'src/world/Hut.ts': { why: '', draws: {} },
      'src/world/Lookout.ts': { why: '', draws: {} },
      'src/world/Shrine.ts': { why: 'the firefly cloud (an effect, not a model)', draws: { Mesh: 1 } },
      'src/world/Boat.ts': { why: 'the mooring lines: world geometry between two placed models', draws: { mergeGeometries: 1, Mesh: 1 } },
      'src/world/Seabed.ts': { why: 'the reef weld: every coral / seaweed / starfish copy in one mesh (drawnInto)', draws: { mergeGeometries: 1, Mesh: 1 } },
      'src/world/BlenderIsland.ts': { why: 'the cove: its terrain tiles (world) and its tiles of prototype copies (drawnInto)', draws: { Mesh: 2 } },
      'src/world/Trailside.ts': { why: 'the trail\'s weld: its ropes, rails and trestle stairs, and its posts / signposts / steps (drawnInto)', draws: { mergeGeometries: 1, Mesh: 1 } },
    };
    const strip = (s: string): string => s.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/^\s*\/\/.*$/gm, '');
    const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
    for (const [file, w] of Object.entries(WORLD)) {
      const code = strip(source(file));
      expect(code, `${file} registers by hand`).not.toMatch(/\bregisterModel\(|\bregisterSolid\(|\.add\(\{[^}]*?\bobject:|\bmodel:\s*(?:\{|true)|\baddBuilt\(/);
      const got = {
        mergeGeometries: count(code, /\bmergeGeometries\(/g), InstancedMesh: count(code, /new (?:THREE\.)?InstancedMesh\(/g),
        BatchedMesh: count(code, /new (?:THREE\.)?BatchedMesh\(/g), Mesh: count(code, /new (?:THREE\.)?(?:Mesh|Points|LineSegments)\(/g),
      };
      for (const [k, n] of Object.entries(got)) expect(n, `${file}: ${k} (declared world: ${w.why || 'nothing'})`).toBeLessThanOrEqual(w.draws[k as keyof typeof got] ?? 0);
    }
    // and the shard's setup never hand-registers them again
    const main = strip(source('src/main.ts'));
    for (const id of ['palms', 'pier', 'jetty-', 'hut', 'lookout', 'shrine', 'boat', 'rocks', 'bushes']) expect(main, id).not.toMatch(new RegExp(`addBuilt\\(\`?'?${id}|registry\\.add\\(\\{ id: '${id}`));
  });

  it("the hut's layout and its geometry come from one build per site", () => {
    const ground = (): number => 0.5, site = { x: 10, z: -20, rot: 0 };
    const lay = hutLayout({ site, ground });
    expect(lay.floorY).toBeCloseTo(1.1, 9); // own space: the cabin floor stands 1.1 m over the ground at its centre
    expect(lay.floorHeightAt(0, 0)).toBeCloseTo(1.1, 9);
    expect(Object.keys(lay.anchors).sort()).toEqual(['door', 'hutChest', 'npc', 'porch']);
    const placed = place(hut, [{ x: site.x, y: 0.5, z: site.z, params: { site, ground } }], { ctx, draw: 'merged', registry: null });
    expect(hutLayout({ site, ground })).toBe(lay); // the same builder (by its site)
    expect(new THREE.Box3().setFromObject(placed.object).getCenter(new THREE.Vector3()).x).toBeCloseTo(10, 0); // built where it stands
    expect(placed.colliders.length).toBe(lay.colliderDescs().length);
  });

  it("the lookout's layout and its geometry come from one build per site", () => {
    const ground = (): number => 2, site = { x: 40, z: 60, rot: 0.6 }, params = { site, ground, zipTo: { x: 80, z: 20 } };
    const lay = lookoutLayout(params);
    expect(lay.platformY).toBeCloseTo(7, 9); // own space: the platform stands 7 m over the ground at its centre
    expect(lay.floorHeightAt(0, 0)).toBeCloseTo(7, 9);
    expect(Object.keys(lay.anchors).sort()).toEqual(['beacon', 'shard', 'stairFoot', 'zipTop']);
    const placed = place(lookout, [{ x: site.x, y: 2, z: site.z, params }], { ctx, draw: 'merged', registry: null });
    expect(lookoutLayout(params)).toBe(lay); // the same builder (by its site)
    expect(new THREE.Box3().setFromObject(placed.object).getCenter(new THREE.Vector3()).x).toBeCloseTo(40, -1); // built where it stands
    expect(placed.colliders.length).toBe(lay.colliderDescs().length);
    expect(placed.colliders.find((c) => c.kind === 'treads')).toBeDefined(); // the stair
  });
});
