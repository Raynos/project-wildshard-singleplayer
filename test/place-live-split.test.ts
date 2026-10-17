// @vitest-environment happy-dom
import { afterEach, expect, test } from 'vitest';
import { BoxGeometry, Matrix4, MeshStandardMaterial } from 'three';
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
