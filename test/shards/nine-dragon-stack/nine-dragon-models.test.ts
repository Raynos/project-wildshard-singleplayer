// E306 / E315 M4: Nine Dragon's models on the contract. `place` hands an instanced model to the shard's own culler
// (`PlaceOptions.culler`) exactly as a hand-rolled InstancedMesh was — every copy written into level 0, each LOD its own
// empty mesh — and every facade piece the grammar can place is a model (a new piece can't slip past the catalog).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { defineModel, definedModels, modelContext } from '../../../src/engine/models/model';
import { type HandedBatch, place } from '../../../src/engine/models/place';
import { BAKED, DRAWN_AS, PIECE_IDS } from '../../../src/shards/nine-dragon-stack/world/facade/pieceIds';
import { FACADE_BAKED, FACADE_MODELS } from '../../../src/shards/nine-dragon-stack/models/facade';
import { balustradePanel } from '../../../src/shards/nine-dragon-stack/models/balustradePanel';
import { mahjongSitter, umbrellaWalker } from '../../../src/shards/nine-dragon-stack/models/crowd';
import { feiZhuaHook } from '../../../src/shards/nine-dragon-stack/models/feiZhuaHook';
import { guardianLion } from '../../../src/shards/nine-dragon-stack/models/lion';
import { diningPavilion, marketBooth, parasolTable } from '../../../src/shards/nine-dragon-stack/models/market';
import { cableGondola, drone, monorailTrain } from '../../../src/shards/nine-dragon-stack/models/movers';
import { paperLantern } from '../../../src/shards/nine-dragon-stack/models/paperLantern';
import { airConBox, galleryPlant } from '../../../src/shards/nine-dragon-stack/models/wallKit';
import { brassDragonHook, drumStool, inkFigure, mahjongTableModel, parkedScooter } from '../../../src/shards/nine-dragon-stack/models/inKit';
import { PAIFANG, paifang } from '../../../src/shards/nine-dragon-stack/models/paifang';
import { banyan, earthGodShrine, kowloonSteleModel } from '../../../src/shards/nine-dragon-stack/models/banyan';
import { hawkerStallModel, noodleStallModel } from '../../../src/shards/nine-dragon-stack/models/stalls';
import { sign } from '../../../src/shards/nine-dragon-stack/models/signs';
import { lotusFinial } from '../../../src/shards/nine-dragon-stack/models/lotusFinial';
import { laundryLineModel } from '../../../src/shards/nine-dragon-stack/models/laundry';
import { landingPlanterModel } from '../../../src/shards/nine-dragon-stack/models/landingPlanter';
import { GUARD_Z0, PARAPET, WELL_BALUSTRADE_COLLIDERS, wellBalustrade } from '../../../src/shards/nine-dragon-stack/models/wellBalustrade';
import { lampPostModel, lotusPostModel } from '../../../src/shards/nine-dragon-stack/models/bridgePosts';
import { GATE, PLAZA, WELL, Y0 } from '../../../src/shards/nine-dragon-stack/layout';
import { STAIR_GATE } from '../../../src/shards/nine-dragon-stack/world/stairPlan';
import { WELL_BALUSTRADE_AT } from '../../../src/shards/nine-dragon-stack/world/specimenDims';
import { RIM } from '../../../src/shards/nine-dragon-stack/world/wellBounds';
import { placeCollider, poseOf } from '../../../src/engine/models/colliders';
import type { ColliderDesc } from '../../../src/engine/world/registry';

/** every Nine Dragon model but the facade's (FACADE_MODELS, FACADE_BAKED) */
const OTHERS = [balustradePanel, umbrellaWalker, mahjongSitter, feiZhuaHook, guardianLion, marketBooth, parasolTable, diningPavilion, monorailTrain, cableGondola, drone, paperLantern, galleryPlant, airConBox, brassDragonHook, drumStool, parkedScooter, mahjongTableModel, inkFigure, paifang,
  // (the E315 second pass: drawn into the kits, the sign mesh and the facade shell)
  banyan, earthGodShrine, kowloonSteleModel, noodleStallModel, hawkerStallModel, sign, lotusFinial, laundryLineModel, landingPlanterModel,
  // (E346: the Well's balustrade and the crossings' posts)
  wellBalustrade, lotusPostModel, lampPostModel];

/** a box collider's eight corners, world space, rounded to 1 µm and sorted (its rotation applied): an order-free identity */
function corners(c: ColliderDesc): string[] {
  if (c.kind !== 'box') return [JSON.stringify(c)];
  const q = c.rot === undefined ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.yaw ?? 0) : new THREE.Quaternion(c.rot.x, c.rot.y, c.rot.z, c.rot.w);
  const out: string[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const v = new THREE.Vector3(sx * c.hx, sy * c.hy, sz * c.hz).applyQuaternion(q).add(new THREE.Vector3(c.x, c.y, c.z));
    out.push([v.x, v.y, v.z].map((n) => (Math.round(n * 1e6) / 1e6 || 0).toFixed(6)).join(','));
  }
  return [`${c.kind}|${c.surface ?? ''}|${out.sort().join(';')}`];
}
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, surface: 'stone' | 'wood'): ColliderDesc => ({ kind: 'box', x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, hx: Math.abs(x1 - x0) / 2, hy: Math.abs(y1 - y0) / 2, hz: Math.abs(z1 - z0) / 2, surface });

const ctx = modelContext(null);

describe('Nine Dragon models (E306 M4)', () => {
  it('a culled instanced model: level 0 holds every copy, each LOD an empty mesh of its own, handed per part', () => {
    const mat = new THREE.MeshBasicMaterial();
    const post = defineModel<{ h: number }>({
      id: 'shared/test-handed', name: 'Post', category: 'props', pipeline: 'code', file: 'test/shards/nine-dragon-stack/nine-dragon-models.test.ts', defaults: { h: 2 },
      variants: [{ id: 'tall', label: 'Tall', params: { h: 4 } }],
      build: (_c, p) => [{ geometry: new THREE.BoxGeometry(0.2, p.h, 0.2), material: mat }],
      lods: [{ from: 30, build: () => [{ geometry: new THREE.BoxGeometry(0.1, 1, 0.1), material: mat }] }, { from: 90, build: () => [] }],
    });
    const taken: HandedBatch[] = [];
    const root = new THREE.Group();
    const tint = new THREE.Color(0.123456789, 0.5, 0.987654321);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(1, 2, 3), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.7), new THREE.Vector3(1, 2, 0.5));
    const placed = place(post, [
      { x: 1, y: 2, z: 3, matrix: m, color: tint }, { x: 5, y: 0, z: 0, variant: 'tall' }, { x: 9, y: 0, z: 0 },
    ], { ctx, draw: 'instanced', culler: { take: (b) => { taken.push(b); } }, registry: null, parent: root });
    expect(placed.object.parent).toBe(root);
    expect(taken).toHaveLength(2); // the base variant and the tall one, one part each
    const [base, tall] = taken;
    expect(base?.levels.map((l) => l.from)).toEqual([0, 30, 90]);
    expect(base?.levels[2]?.mesh).toBeNull(); // nothing is drawn past 90 m
    const b0 = base?.levels[0]?.mesh, b1 = base?.levels[1]?.mesh;
    expect(b0?.count).toBe(2);
    expect(b0?.boundingSphere).not.toBeNull();
    expect(b1?.count).toBe(0);
    expect(b1?.visible).toBe(false);
    expect(b1?.instanceMatrix).not.toBe(b0?.instanceMatrix); // each level its own buffers (the culler packs per mesh)
    // the copy's matrix and colour as given: float32 of the same doubles, the colour's own linear floats
    const got = new THREE.Matrix4();
    b0?.getMatrixAt(0, got);
    expect(Array.from(got.elements)).toEqual(Array.from(new Float32Array(m.elements)));
    const c = new THREE.Color();
    b0?.getColorAt(0, c);
    expect([c.r, c.g, c.b]).toEqual(Array.from(new Float32Array([tint.r, tint.g, tint.b])));
    expect(base?.poses[1]?.elements[12]).toBe(9); // placement order within the variant
    expect(tall?.levels[0]?.mesh?.count).toBe(1);
    expect(placed.drawnAs).toBe('instanced');
  });

  it('every facade piece the grammar places is drawn as a model, or baked into the shell as one', () => {
    for (const id of PIECE_IDS) {
      if (BAKED.has(id)) { expect(FACADE_BAKED[id], id).toBeDefined(); continue; }
      // (an alias draws as the piece it names: batch.ts)
      const drawn = DRAWN_AS[id]?.as ?? id;
      expect(FACADE_MODELS[drawn], `${id} → ${drawn}`).toBeDefined();
    }
  });

  it('the paifang\'s own-space gates are the ones the world builds (about their centre bay)', () => {
    PAIFANG.square.posts.forEach((p, i) => { expect(p + GATE.x).toBeCloseTo(GATE.posts[i] ?? Number.NaN, 9); });
    expect(PAIFANG.square.s).toBe(GATE.s);
    expect(PAIFANG.stair.posts).toEqual(STAIR_GATE.posts);
    expect(PAIFANG.stair.s).toBe(STAIR_GATE.s);
  });

  it('E346: the paifang\'s posts, placed with its copies, are the boxes the stair and the gate bridges registered by hand', () => {
    const at = (kind: 'stair' | 'well', pl: Parameters<typeof poseOf>[0]): string[] =>
      (paifang.colliders?.({ kind }, ctx) ?? []).flatMap((c) => (c.kind === 'drawn-hull' ? [] : corners(placeCollider(c, poseOf(pl)))));
    // the stair's: its four post bases with drum stones across the stair (stairstreet.ts before E346), the copy turned −90°
    const G = STAIR_GATE;
    const stair = G.posts.map((p): ColliderDesc => ({ kind: 'box', x: G.x, y: G.y + 4.5, z: G.z + p, hx: 1.4 * G.s, hy: 4.5, hz: 0.7 * G.s, surface: 'stone' }));
    expect(at('stair', { x: G.x, y: G.y, z: G.z, yaw: -Math.PI / 2 }).sort()).toEqual(stair.flatMap(corners).sort());
    // a gate bridge's: its four lacquered posts (well-bridges.ts gateBridge before E346), at any bridge
    const cx = -14.3, y = Y0 - 18, z = -27;
    const well = [cx - 5.4, cx - 2.3, cx + 2.3, cx + 5.4].map((p): ColliderDesc => ({ kind: 'box', x: p, y: y + 3.5, z, hx: 0.45, hy: 3.5, hz: 0.45, surface: 'wood' }));
    expect(at('well', { x: cx, y, z }).sort()).toEqual(well.flatMap(corners).sort());
  });

  it('E346: the Well\'s balustrade, placed where it stands, is the edge the fragment registered by hand (nds-edges)', () => {
    const got = WELL_BALUSTRADE_COLLIDERS.map((c) => placeCollider(c, poseOf({ ...WELL_BALUSTRADE_AT }))).flatMap(corners).sort();
    const edges = [
      box(PLAZA.x0 - 0.1, Y0, WELL.z0, PLAZA.x0 + 0.5, Y0 + 1.12, PLAZA.z1 + 0.6, 'stone'),
      box(PLAZA.x0 - 0.1, Y0 + 1.12, WELL.z0, PLAZA.x0 + 0.1, Y0 + PARAPET, GUARD_Z0, 'stone'),
      box(PLAZA.x0 - 0.1, Y0 + 1.12, RIM.z1, PLAZA.x0 + 0.1, Y0 + PARAPET, PLAZA.z1 + 0.6, 'stone'),
    ];
    expect(got).toEqual(edges.flatMap(corners).sort());
    expect(wellBalustrade.colliders?.({}, ctx)).toBe(WELL_BALUSTRADE_COLLIDERS);
  });

  it('Nine Dragon models say how they are made and live in the shard\'s models folder', () => {
    const nd = definedModels().filter((d) => d.id.startsWith('nine-dragon-stack/'));
    expect(nd.map((d) => d.id).sort()).toEqual([...Object.values(FACADE_MODELS), ...Object.values(FACADE_BAKED), ...OTHERS].map((d) => d.id).sort());
    for (const d of nd) {
      expect(d.file, d.id).toMatch(/^src\/shards\/nine-dragon-stack\/models\/[a-zA-Z]+\.ts$/);
      expect(d.pipeline.length, d.id).toBeGreaterThan(0);
    }
    expect(new Set(nd.map((d) => d.id)).size).toBe(nd.length);
    expect(nd.filter((d) => d.pipeline === 'trellis').map((d) => d.id).sort()).toEqual([
      'nine-dragon-stack/fei-zhua-hook', 'nine-dragon-stack/guardian-lion', 'nine-dragon-stack/mahjong-sitter', 'nine-dragon-stack/umbrella-walker',
    ]);
  });
});
