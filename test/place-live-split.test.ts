// @vitest-environment happy-dom
import { afterEach, expect, test } from 'vitest';
import { BoxGeometry, BufferAttribute, BufferGeometry, InterleavedBuffer, InterleavedBufferAttribute, Matrix4, MeshStandardMaterial } from 'three';
import { geometryBoundsSteps } from '../src/engine/world/geometryBounds';
import { defineModel, modelContext } from '../src/engine/models/model';
import { LIVE_SPLIT_EVERY, LIVE_SPLIT_OVER, place } from '../src/engine/models/place';
import { pageScope } from '../src/engine/app/resources';
import { WorldRegistry } from '../src/engine/world/registry';
import { noteFrameDrawn, setFramePacing } from '../src/engine/core/framePacing';

afterEach(() => { setFramePacing(false); });

function fixture(): { registry: WorldRegistry; run: () => Promise<{ pieces: number; colliders: number[]; yields: number }> } {
  const material = new MeshStandardMaterial(), registry = new WorldRegistry(), ctx = modelContext(null);
  const model = defineModel({ id: 'shared/live-split-fixture', name: 'Split fixture', category: 'props', pipeline: 'code', file: 'test/place-live-split.test.ts', defaults: {},
    build: () => [{ geometry: new BoxGeometry(1, 1, 1), material }],
    colliders: () => [{ kind: 'box', x: 0, y: 0.5, z: 0, hx: 0.5, hy: 0.5, hz: 0.5, yaw: 0 }] });
  const placements = Array.from({ length: 40 }, (_, i) => ({ x: i * 3, y: 0, z: 0, matrix: new Matrix4().makeTranslation(i * 3, 0, 0) }));
  return {
    registry,
    run: async () => {
      let yields = 0;
      const placed = place(model, placements, { ctx, draw: 'instanced', registry, piece: { id: 'split', split: { every: 30, yieldTask: () => { yields++; return Promise.resolve(); } } } });
      await placed.registered;
      const pieces = registry.pieces.filter(p => p.id.startsWith('split'));
      return { pieces: pieces.length, colliders: pieces.flatMap(p => (p.colliders ?? []).map(c => (c.kind === 'treads' ? c.from.x : c.x))), yields };
    },
  };
}

test('a split piece keeps its caller\'s every on the loading screen', async () => {
  const { run } = fixture();
  const out = await run();
  expect(out.pieces).toBe(2);
  expect(out.yields).toBe(1);
  expect(out.colliders).toHaveLength(40);
});

test('in play a split piece registers the same colliders a dozen at a time', async () => {
  const loading = await fixture().run();
  setFramePacing(true); noteFrameDrawn(performance.now());
  const { run } = fixture();
  const live = await run();
  expect(live.pieces).toBe(Math.ceil(40 / LIVE_SPLIT_EVERY));
  expect([...live.colliders].sort((a, b) => a - b)).toEqual([...loading.colliders].sort((a, b) => a - b));
});

test('in play a large unsplit piece splits on the engine\'s yield, the same colliders', async () => {
  const material = new MeshStandardMaterial(), ctx = modelContext(null);
  const model = defineModel({ id: 'shared/live-auto-split-fixture', name: 'Auto split fixture', category: 'props', pipeline: 'code', file: 'test/place-live-split.test.ts', defaults: {},
    build: () => [{ geometry: new BoxGeometry(1, 1, 1), material }],
    colliders: () => [{ kind: 'box', x: 0, y: 0.5, z: 0, hx: 0.5, hy: 0.5, hz: 0.5, yaw: 0 }] });
  const placements = Array.from({ length: 40 }, (_, i) => ({ x: i * 3, y: 0, z: 0, matrix: new Matrix4().makeTranslation(i * 3, 0, 0) }));
  const count = async (scoped: boolean, playing: boolean): Promise<{ pieces: number; colliders: number }> => {
    setFramePacing(playing); if (playing) noteFrameDrawn(performance.now());
    const registry = new WorldRegistry();
    if (scoped) registry.scope = pageScope;
    const placed = place(model, placements, { ctx, draw: 'instanced', registry, piece: { id: 'auto' } });
    await placed.registered;
    const pieces = registry.pieces.filter(p => p.id.startsWith('auto'));
    return { pieces: pieces.length, colliders: pieces.reduce((n, p) => n + (p.colliders?.length ?? 0), 0) };
  };
  expect(await count(true, false)).toEqual({ pieces: 1, colliders: 40 });
  expect(await count(false, true)).toEqual({ pieces: 1, colliders: 40 });
  expect(await count(true, true)).toEqual({ pieces: Math.ceil(40 / LIVE_SPLIT_EVERY), colliders: 40 });
  expect(40).toBeGreaterThan(LIVE_SPLIT_OVER);
});


test('packed and fallback bounds preserve three arithmetic and yield publication', () => {
  const packed = new Float32Array(65538 * 3);
  for (let i = 0; i < packed.length; i++) packed[i] = Math.sin(i * 1.7) * (i % 179 - 90);
  const interleaved = new InterleavedBuffer(new Float32Array([1, 3, -4, 99, -2, 0, 7, 99]), 4);
  const cases = [new BufferAttribute(packed, 3), new BufferAttribute(new Float32Array(), 3),
    new BufferAttribute(new Float32Array([-0, 0, -0, 0, -0, 0]), 3),
    new BufferAttribute(new Int16Array([-32768, 0, 32767, 17, -19, 4]), 3, true),
    new InterleavedBufferAttribute(interleaved, 3, 0)];
  for (const position of cases) for (const bounds of ['box', 'sphere', 'both'] as const) {
    const geometry = new BufferGeometry().setAttribute('position', position), oracle = geometry.clone();
    if (bounds !== 'sphere') oracle.computeBoundingBox();
    if (bounds !== 'box') oracle.computeBoundingSphere();
    const steps = geometryBoundsSteps(geometry, bounds);
    let count = 0;
    while (!steps.next().done) {
      count++;
      expect(geometry.boundingSphere).toBeNull(); expect(geometry.boundingBox).toBeNull();
    }
    expect(geometry.boundingBox).toEqual(oracle.boundingBox);
    expect(geometry.boundingSphere).toEqual(oracle.boundingSphere);
    if (position instanceof BufferAttribute && position.array === packed) expect(count).toBe(bounds === 'box' ? 2 : 4);
  }
  const morph = new BoxGeometry();
  morph.morphAttributes.position = [new BufferAttribute(new Float32Array(morph.getAttribute('position').array).fill(4), 3)];
  const oracle = morph.clone(); oracle.computeBoundingBox(); oracle.computeBoundingSphere();
  Array.from(geometryBoundsSteps(morph));
  expect(morph.boundingBox).toEqual(oracle.boundingBox); expect(morph.boundingSphere).toEqual(oracle.boundingSphere);
});
