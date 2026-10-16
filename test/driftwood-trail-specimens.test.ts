// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { BoxGeometry, MeshStandardMaterial, Object3D } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { modelContext, seedOf, type ModelDef, type ModelBuild, type ModelPart } from '@wildshard/engine/models/model';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { createOwnedGeometry as modelGeometry } from '@wildshard/engine/models/ownedGeometry';
import { fencePost, signpost, plankStep } from '../src/shards/driftwood-isle/runtime/models/trailside';
import { fencePost as nativePost, signpost as nativeSign, plankStep as nativePlank } from '../src/shards/driftwood-isle/generators/trailsideModels';
import { TRAIL_SPECIMENS } from '../src/shards/driftwood-isle/data/trailSpecimens';

it('transfers sole geometry ownership and leaves no template behind', async () => {
  const original = new BoxGeometry(), intake = modelGeometry('/owned-model.glb');
  await intake.load(original);
  const owned = intake.take();
  expect(owned.getAttribute('position').array.buffer).not.toBe(original.getAttribute('position').array.buffer);
  expect(() => intake.copy()).toThrow('not loaded');
  expect(() => intake.take()).toThrow('not loaded');
  owned.dispose(); original.dispose();
});
it('loads all authored trail cards through their native material and refuses unbaked shapes', async () => {
  const ctx = modelContext(null), material = new MeshStandardMaterial();
  ctx.once('driftwood-isle/trail:material', () => material);
  const emitted = new Map<string, Uint8Array>();
  const cards: (() => Promise<void>)[] = [];
  const isParts = (built: ModelBuild): built is readonly ModelPart[] => Array.isArray(built);
  const add = <P extends object>(model: ModelDef<P>, native: ModelDef<P>): void => {
    for (const variant of native.variants ?? [{ id: 'fencePost', params: {} }]) {
      const params = { ...native.defaults, ...variant.params };
      const built = native.build(ctx, params, new Rng(seedOf(native)));
      if (!isParts(built) || built[0] === undefined) throw new Error('Native draw missing');
      const url: unknown = Reflect.get(TRAIL_SPECIMENS, variant.id);
      if (typeof url !== 'string') throw new Error('Specimen URL missing');
      emitted.set(url, staticGlb([{ geometry: built[0].geometry, material, compactIndex: true }])); built[0].geometry.dispose();
      expect(model.id).toBe(native.id);
      cards.push(async () => {
        const ready = new Promise<void>(resolve => { document.addEventListener('ws:model-ready', () => resolve(), { once: true }); });
        const holder = model.build(ctx, params, new Rng(seedOf(model)));
        expect(holder).toBeInstanceOf(Object3D); await ready;
        if (!(holder instanceof Object3D)) throw new Error('Specimen holder missing');
        expect(holder.children.length).toBeGreaterThan(0);
      });
    }
  };
  add(fencePost, nativePost); add(signpost, nativeSign); add(plankStep, nativePlank);
  const mocked = vi.spyOn(globalThis, 'fetch').mockImplementation(input => {
    const bytes = typeof input === 'string' ? emitted.get(input) : undefined;
    if (bytes === undefined) throw new Error('Unknown specimen request');
    return Promise.resolve(new Response(Uint8Array.from(bytes).buffer));
  });
  try {
    for (const card of cards) await card();
    expect(() => signpost.build(ctx, { arrows: [2], labels: ['UNBAKED'] }, new Rng(1))).toThrow('no authored');
  } finally { mocked.mockRestore(); material.dispose(); }
});
