// E315 M1 (project/archive/2026-09-30-model-architecture.md): Driftwood's models on the contract — a moving copy's colliders ride it
// (`piece.follows: 'copy'`, the sailboat), and the island's models build in their own space (origin at their foot).
import { beforeAll, describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Admit the actual committed model bytes before synchronous placement.
import { readFileSync } from 'node:fs';
import { loadFixedGeometry } from '../../../src/shards/driftwood-isle/boot/fixedGeometry';
import { FIXED_MODEL_FILES } from '../../../src/shards/driftwood-isle/data/modelFiles';
import * as THREE from 'three';
import { WorldRegistry } from '../../../src/engine/world/registry';
import type { SkyRig as Sky } from '../../../src/engine/world/skyRig';
import { defineModel, modelContext } from '../../../src/engine/models/model';
import { place } from '../../../src/engine/models/place';
import { boat, boatColliders } from '../../../src/shards/driftwood-isle/models/boat';
import { palm } from '../../../src/shards/driftwood-isle/models/palm';
import { hut, hutLayout } from '../../../src/shards/driftwood-isle/models/hut';
import { lookout, lookoutLayout } from '../../../src/shards/driftwood-isle/models/lookout';
import { shipwreck } from '../../../src/shards/driftwood-isle/models/shipwreck';
import { barrel, crate, ropeCoil } from '../../../src/shards/driftwood-isle/models/cargo';
import { driftLog } from '../../../src/shards/driftwood-isle/models/driftLog';
import { reefRock } from '../../../src/shards/driftwood-isle/models/reefRock';
import { ropeBridge, ropeBridgeLayout } from '../../../src/shards/driftwood-isle/models/ropeBridge';

/** the world side's sources and the shard's setup, as text (the M8 check below) */
const SOURCES = import.meta.glob<string>(["../../../src/engine/world/*.ts","../../../src/shards/driftwood-isle/world/*.ts","../../../src/main.ts"], { query: '?raw', import: 'default', eager: true });
expect(Object.keys(SOURCES).length).toBeGreaterThan(0);
const source = (file: string): string => { const s = SOURCES[`../../../${file}`]; if (s === undefined) throw new Error(`no source ${file}`); return s; };

// a stand-in sky: the materials only ask it to prepare them (no renderer in a test)
const sky = { setupMaterial(_m: THREE.Material): void { /* nothing to prepare */ }, csm: { lightDirection: new THREE.Vector3(0, -1, 0) } } as Sky;
const ctx = modelContext(sky);

describe('Driftwood models (E315 M1)', () => {
  it("piece.follows 'copy': the piece rides its one single copy, its colliders in the copy's own space", () => {
    const reg = new WorldRegistry();
    const mat = new THREE.MeshBasicMaterial();
    const raft = defineModel({
      id: 'shared/test-raft', name: 'Raft', category: 'props', pipeline: 'code', file: 'test/shards/driftwood-isle/models-driftwood.test.ts', defaults: {},
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
    const meshes: THREE.Object3D[] = [];
    placed.object.traverse((node) => { if (node instanceof THREE.Mesh) meshes.push(node); });
    expect(meshes).toHaveLength(3);
    expect(meshes.map((mesh) => [mesh.castShadow, mesh.receiveShadow])).toEqual([[true, true], [false, true], [true, false]]);
    expect(meshes[1]?.parent).toBe(meshes[0]);
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
    /** each migrated world-side file: what it may still draw (and register as a world piece) itself, and why (a file that grows one more fails) */
    const WORLD: Record<string, { why: string; draws: Partial<Record<'mergeGeometries' | 'InstancedMesh' | 'BatchedMesh' | 'Mesh', number>>; registers?: number }> = {
      'src/shards/driftwood-isle/world/Palms.ts': { why: 'an empty stand-in mesh when nothing was placed', draws: { Mesh: 1 } },
      'src/shards/driftwood-isle/world/Bushes.ts': { why: 'an empty stand-in mesh when nothing was placed', draws: { Mesh: 1 } },
      'src/shards/driftwood-isle/world/Boulders.ts': { why: '', draws: {} },
      'src/shards/driftwood-isle/world/Pier.ts': { why: '', draws: {} },
      'src/shards/driftwood-isle/world/Hut.ts': { why: '', draws: {} },
      'src/shards/driftwood-isle/world/Lookout.ts': { why: '', draws: {} },
      'src/shards/driftwood-isle/world/RopeBridge.ts': { why: '', draws: {} },
      'src/shards/driftwood-isle/world/Zipline.ts': { why: 'the ride: its rig and its trolley, which runs the wire (the zipline model drawnInto them)', draws: { Mesh: 2 } },
      'src/shards/driftwood-isle/world/Wreck.ts': { why: 'the wreck site\'s weld: the vessel and the cove\'s surroundings in one kit (the AO and the lantern light over all of it), the reef rocks\' smooth mesh, the lantern flames (its models drawnInto them)', draws: { mergeGeometries: 1, Mesh: 3 } },
      'src/shards/driftwood-isle/world/Shrine.ts': { why: 'the firefly cloud (an effect, not a model)', draws: { Mesh: 1 } },
      'src/shards/driftwood-isle/world/Boat.ts': { why: 'the mooring lines: world geometry between two placed models', draws: { mergeGeometries: 1, Mesh: 1 } },
      'src/shards/driftwood-isle/world/Seabed.ts': { why: 'the reef weld: every coral / seaweed / starfish copy in one mesh (drawnInto)', draws: { mergeGeometries: 1, Mesh: 1 } },
      'src/shards/driftwood-isle/world/BlenderIsland.ts': { why: 'the cove: its terrain tiles (world) and its tiles of prototype copies (drawnInto)', draws: { Mesh: 2 } },
      'src/shards/driftwood-isle/world/Trailside.ts': { why: 'the trail\'s weld: its ropes, rails and trestle stairs (world, piece `trailside`), and its posts / signposts / steps (drawnInto)', draws: { Mesh: 1 }, registers: 1 },
      'src/shards/driftwood-isle/world/Cove.ts': { why: 'the sea cave welded into the crag, the pools and the cascade (world, piece `cove`); its reef rocks drawnInto their baked smooth mesh', draws: { Mesh: 4 }, registers: 1 },
      'src/shards/driftwood-isle/world/GroundCover.ts': { why: 'a scatter field streamed round the viewer (world, §1): its kinds\' instanced tiers, its dune logs\' mesh (drift logs drawnInto it)', draws: { InstancedMesh: 1, Mesh: 1 } },
    };
    const strip = (s: string): string => s.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/^\s*\/\/.*$/gm, '');
    const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
    for (const [file, w] of Object.entries(WORLD)) {
      const code = strip(source(file));
      expect(code, `${file} registers by hand`).not.toMatch(/\bregisterModel\(|\bregisterSolid\(|\bmodel:\s*(?:\{|true)|\baddBuilt\(/);
      expect(count(code, /\.add\(\{[^}]*?\bobject:/g), `${file}: world pieces registered by hand (declared: ${w.registers ?? 0})`).toBeLessThanOrEqual(w.registers ?? 0);
      const got = {
        mergeGeometries: count(code, /\bmergeGeometries\(/g), InstancedMesh: count(code, /new (?:THREE\.)?InstancedMesh\(/g),
        BatchedMesh: count(code, /new (?:THREE\.)?BatchedMesh\(/g), Mesh: count(code, /new (?:THREE\.)?(?:Mesh|Points|LineSegments)\(/g),
      };
      for (const [k, n] of Object.entries(got)) expect(n, `${file}: ${k} (declared world: ${w.why || 'nothing'})`).toBeLessThanOrEqual(w.draws[k as keyof typeof got] ?? 0);
    }
    // and the shard's setup registers no built thing by hand: every one registers itself (a model through place, a weld as world)
    const main = strip(source('src/main.ts'));
    expect(main).not.toMatch(/\baddBuilt\b/);
    for (const id of ['palms', 'pier', 'jetty-', 'hut', 'lookout', 'wreck', 'bridge', 'cove', 'trailside', 'shrine', 'boat', 'rocks', 'bushes']) expect(main, id).not.toMatch(new RegExp(`registry\\.add\\(\\{ id: '${id}`));
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

  it("the Wreck cove's models build their specimens in their own space, on the ground at the origin", () => {
    for (const m of [shipwreck, barrel, crate, ropeCoil, driftLog, reefRock] as const) {
      const placed = place(m as typeof barrel, [{ x: 0, y: 0, z: 0 }], { ctx, draw: 'merged', registry: null });
      const box = new THREE.Box3().setFromObject(placed.object), c = box.getCenter(new THREE.Vector3());
      expect(Math.hypot(c.x, c.z), m.id).toBeLessThan(m === shipwreck ? 4 : 0.6); // centred on the origin
      // standing on it (the wreck's keel just under, a reef rock sunk to its waist: its origin is its centre)
      expect(box.min.y, m.id).toBeGreaterThan(m === shipwreck ? -1.2 : m === reefRock ? -1 : -0.35);
      expect(box.max.y, m.id).toBeGreaterThan(0.1);
    }
  });

  it('the rope bridge: its group in own space at end a, its chain in the world, its deck posed into the group', () => {
    const ground = (x: number): number => 5 + x * 0.01, span = { a: [40, 10] as [number, number], b: [52, 22] as [number, number], sag: 0.9 };
    const params = { span, ground };
    const lay = ropeBridgeLayout(sky, params);
    expect(lay.o).toEqual({ x: 40, y: Math.fround(5.4), z: 10 });
    const placed = place(ropeBridge, [{ ...lay.o, params }], { ctx, draw: 'single', registry: null });
    expect(placed.object).toBe(lay.mesh); // the world's copy is the group its layout drives
    expect(placed.object.position.toArray()).toEqual([40, Math.fround(5.4), 10]);
    placed.object.updateMatrixWorld(true);
    // the deck's first segment: the chain's rest pose (world) is where its holder draws it
    const seg = lay.chainSpec().segments[0], holder = lay.chainSpec().owners[0]?.follows;
    const p = new THREE.Vector3().setFromMatrixPosition(holder?.matrixWorld ?? new THREE.Matrix4());
    expect(p.distanceTo(new THREE.Vector3(seg?.x, seg?.y, seg?.z))).toBeLessThan(1e-5);
    // its colliders placed back where the world's were
    expect(placed.colliders.length).toBe(lay.colliderDescs().length);
    const w = lay.colliderDescs()[0], c = placed.colliders[0];
    expect(c?.kind === 'box' && w?.kind === 'box' ? Math.hypot(c.x - w.x, c.y - w.y, c.z - w.z) : 1).toBeLessThan(1e-9);
    expect(lay.floorHeightAt(46, 16)).toBeGreaterThan(4.5);
  });
});

beforeAll(async () => { await loadFixedGeometry(new Map(Object.values(FIXED_MODEL_FILES).map((url) => [url, new Uint8Array(readFileSync(`public${url}`))]))); });
