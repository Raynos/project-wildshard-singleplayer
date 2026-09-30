// E306 / E315 M4: Nine Dragon's models on the contract. `place` hands an instanced model to the shard's own culler
// (`PlaceOptions.culler`) exactly as a hand-rolled InstancedMesh was — every copy written into level 0, each LOD its own
// empty mesh — and every facade piece the grammar can place is a model (a new piece can't slip past the catalog).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { defineModel, definedModels, modelContext } from '../src/models/model';
import { type HandedBatch, place } from '../src/models/place';
import { BAKED, DRAWN_AS, PIECES, type PieceId } from '../src/chunks/nine-dragon-stack/world/facade/pieces';
import { FACADE_MODELS } from '../src/chunks/nine-dragon-stack/models/facade';
import { balustradePanel } from '../src/chunks/nine-dragon-stack/models/balustradePanel';
import { mahjongSitter, umbrellaWalker } from '../src/chunks/nine-dragon-stack/models/crowd';
import { feiZhuaHook } from '../src/chunks/nine-dragon-stack/models/feiZhuaHook';
import { guardianLion } from '../src/chunks/nine-dragon-stack/models/lion';
import { diningPavilion, marketBooth, parasolTable } from '../src/chunks/nine-dragon-stack/models/market';
import { cableGondola, drone, monorailTrain } from '../src/chunks/nine-dragon-stack/models/movers';
import { paperLantern } from '../src/chunks/nine-dragon-stack/models/paperLantern';
import { airConBox, galleryPlant } from '../src/chunks/nine-dragon-stack/models/wallKit';
import { brassDragonHook, drumStool, inkFigure, mahjongTableModel, parkedScooter } from '../src/chunks/nine-dragon-stack/models/inKit';

/** every Nine Dragon model but the facade's (FACADE_MODELS) */
const OTHERS = [balustradePanel, umbrellaWalker, mahjongSitter, feiZhuaHook, guardianLion, marketBooth, parasolTable, diningPavilion, monorailTrain, cableGondola, drone, paperLantern, galleryPlant, airConBox, brassDragonHook, drumStool, parkedScooter, mahjongTableModel, inkFigure];

const ctx = modelContext(null);

describe('Nine Dragon models (E306 M4)', () => {
  it('a culled instanced model: level 0 holds every copy, each LOD an empty mesh of its own, handed per part', () => {
    const mat = new THREE.MeshBasicMaterial();
    const post = defineModel<{ h: number }>({
      id: 'shared/test-handed', name: 'Post', category: 'props', pipeline: 'code', file: 'test/nine-dragon-models.test.ts', defaults: { h: 2 },
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

  it('every facade piece the grammar places is drawn as a model (or baked into the shell)', () => {
    for (const id of Object.keys(PIECES) as PieceId[]) {
      if (BAKED.has(id)) continue;
      // (an alias draws as the piece it names: batch.ts)
      const drawn = DRAWN_AS[id]?.as ?? id;
      expect(FACADE_MODELS[drawn], `${id} → ${drawn}`).toBeDefined();
    }
  });

  it('Nine Dragon models say how they are made and live in the shard\'s models folder', () => {
    const nd = definedModels().filter((d) => d.id.startsWith('nine-dragon-stack/'));
    expect(nd.map((d) => d.id).sort()).toEqual([...Object.values(FACADE_MODELS), ...OTHERS].map((d) => d.id).sort());
    for (const d of nd) {
      expect(d.file, d.id).toMatch(/^src\/chunks\/nine-dragon-stack\/models\/[a-zA-Z]+\.ts$/);
      expect(d.pipeline.length, d.id).toBeGreaterThan(0);
    }
    expect(new Set(nd.map((d) => d.id)).size).toBe(nd.length);
    expect(nd.filter((d) => d.pipeline === 'trellis').map((d) => d.id).sort()).toEqual([
      'nine-dragon-stack/fei-zhua-hook', 'nine-dragon-stack/guardian-lion', 'nine-dragon-stack/mahjong-sitter', 'nine-dragon-stack/umbrella-walker',
    ]);
  });
});
