// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { BufferGeometry, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D } from 'three';
import { Scope } from '../src/engine/app/scope';
import { modelContext, specimenReady } from '../src/engine/models/model';
import { Rng } from '../src/engine/core/rng';
import { SkyRig } from '../src/engine/world/skyRig';
import * as lowPolyKit from '../src/engine/world/lowpolyKit';
import { atlasFigureCard, kitFigureCard } from '../src/game/models/kitFigureCard';
import { parseExplorerCatalogue } from '../src/format/explorerCatalogue';
import { driftwoodKitFigureCards } from '../src/shards/driftwood-isle/generators/kitFigureCards';
import { driftwoodFixedProduct } from './fixtures/driftwoodFixedProduct';

const isGeometry = (value: unknown): value is BufferGeometry => value instanceof BufferGeometry;
const isMaterial = (value: unknown): value is Material => value instanceof Material;

function deferred<T>() {
  let done: (value: T) => void = () => { throw new Error('Deferred not initialized'); };
  const promise = new Promise<T>(resolve => { done = resolve; });
  return { promise, done };
}

test('kit cards admit only fixed ids and require their explicit live view owner', async () => {
  const owner = new Scope('kit-card-source'), product = await driftwoodFixedProduct();
  try {
    const rows = driftwoodKitFigureCards(), model = owner.run(() => kitFigureCard(product, rows, 'castaway'));
    expect(model.specimenLifetime).toBe('view'); expect(model.prepare).toBeUndefined();
    expect(() => model.build(modelContext(SkyRig.prototype), {}, new Rng(1))).toThrow('view owner');
    expect(() => kitFigureCard(product, rows, 'missing')).toThrow('declared figure');
    const entry = {kind:'kit-figure',file:'people/kit-cards.json',figure:'castaway'};
    expect(parseExplorerCatalogue({version:1,entries:[entry]}).entries).toEqual([entry]);
    expect(() => parseExplorerCatalogue({version:1,entries:[{...entry,build:'castaway'}]})).toThrow();
    const card = owner.child('retired-card'); card.dispose();
    expect(() => model.build({...modelContext(SkyRig.prototype),specimenScope:card}, {}, new Rng(1))).toThrow('owner left');
  } finally { owner.dispose(); }
});

test('a real cold card frees its copies and flame while leaving borrowed kit material alive', async () => {
  const owner = new Scope('kit-card-source'), card = owner.child('card'), product = await driftwoodFixedProduct();
  const borrowed = new MeshStandardMaterial(), materialDisposed = vi.fn<() => void>(); borrowed.addEventListener('dispose', materialDisposed);
  const materialLookup = vi.spyOn(lowPolyKit, 'lowPolyLookMaterial').mockReturnValue(borrowed);
  try {
    const model = owner.run(() => kitFigureCard(product, driftwoodKitFigureCards(), 'castaway'));
    const root = card.run(() => model.build({...modelContext(SkyRig.prototype),specimenScope:card}, {}, new Rng(1)));
    if (!(root instanceof Object3D)) throw new Error('Expected card root');
    await specimenReady(root);
    const meshes: { readonly geometry: BufferGeometry; readonly material: Material }[] = [];
    root.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const geometry: unknown = node.geometry, drawMaterial: unknown = node.material;
      if (!isGeometry(geometry) || !isMaterial(drawMaterial)) throw new Error('Unexpected card draw');
      meshes.push({geometry,material:drawMaterial});
    });
    expect(meshes.length).toBeGreaterThan(5);
    const flames = meshes.filter(mesh => mesh.material instanceof MeshBasicMaterial && mesh.material.name === 'castaway-flame');
    expect(flames).toHaveLength(1);
    const flame = flames[0]; if (flame === undefined || !(flame.material instanceof MeshBasicMaterial)) throw new Error('Missing flame material');
    const flameDisposed = vi.fn<() => void>(); flame.material.addEventListener('dispose',flameDisposed);
    const geometries = [...new Set(meshes.map(mesh => mesh.geometry))].map(geometry => {const disposed=vi.fn<() => void>();geometry.addEventListener('dispose',disposed);return disposed;});
    card.dispose();
    expect(flameDisposed).toHaveBeenCalledTimes(1);
    for (const disposed of geometries) expect(disposed).toHaveBeenCalledTimes(1);
    expect(materialDisposed).not.toHaveBeenCalled();
  } finally { card.dispose(); owner.dispose(); materialLookup.mockRestore(); borrowed.dispose(); }
});

test('ancestor retirement during catalogue read publishes no cold geometry or figure', async () => {
  const owner = new Scope('kit-card-source'), card = owner.child('card'), product = await driftwoodFixedProduct();
  const read = product.file.bind(product), bytes = await read('people/catalogue.json'), gate = deferred<Uint8Array>(), started = deferred<string>();
  const reads = vi.spyOn(product,'file').mockImplementation(name => {if(name==='people/catalogue.json'){started.done(name);return gate.promise;}return read(name);});
  const warning = vi.spyOn(console,'warn').mockImplementation(() => undefined);
  try {
    const model = owner.run(() => kitFigureCard(product, driftwoodKitFigureCards(), 'castaway'));
    const root = card.run(() => model.build({...modelContext(SkyRig.prototype),specimenScope:card}, {}, new Rng(1)));
    if (!(root instanceof Object3D)) throw new Error('Expected card root');
    await started.promise;
    const steps=owner.disposeSteps();steps.next();expect(owner.disposing).toBe(true);
    gate.done(bytes);await specimenReady(root);
    expect(reads).toHaveBeenCalledTimes(1);
    expect(root.children).toHaveLength(1);
    expect(root.children[0]?.children).toHaveLength(0);
    for (const step of steps) expect(step.scope.length).toBeGreaterThan(0);
  } finally { reads.mockRestore();warning.mockRestore();owner.dispose(); }
});

test('an atlas kit card is one card whose variants are its merged figure atlases, built only for a view owner', () => {
  const atlas = (cell: number) => ({ url: '/assets/orchard/people/picker.glb', name: 'orchard-people', skeleton: 'npc.figures.v1', columns: 1, rows: 1, cell,
    sources: ['/assets/orchard/people/picker.src.glb'], joints: ['picker-root', 'picker-head', 'picker-arm'], rim: 0.3, bands: 0.8 });
  const entry = { kind: 'kit-figure', id: 'orchard/people', name: 'Orchard people', file: 'src/shards/orchard/people.ts', copies: 2, drawnAs: 'skinned',
    atlases: { picker: { label: 'The picker', phone: atlas(256), desktop: atlas(512) }, keeper: { label: 'The keeper', phone: atlas(256), desktop: atlas(512) } } };
  const [row] = parseExplorerCatalogue({ version: 1, entries: [entry] }).entries;
  if (row?.kind !== 'kit-figure' || !('atlases' in row)) throw new Error('Expected an atlas kit card');
  const model = atlasFigureCard(row);
  expect(model).toMatchObject({ id: 'orchard/people', category: 'people', specimenLifetime: 'view', defaults: { figure: 'picker' } });
  expect(model.variants?.map(variant => variant.label)).toEqual(['The picker', 'The keeper']);
  expect(() => model.build(modelContext(SkyRig.prototype), { figure: 'picker' }, new Rng(1))).toThrow('view owner');
  expect(() => parseExplorerCatalogue({ version: 1, entries: [{ ...entry, atlases: {} }] })).toThrow();
  expect(() => parseExplorerCatalogue({ version: 1, entries: [{ ...entry, atlases: { picker: { ...entry.atlases.picker, build: 'picker' } } }] })).toThrow();
  const { id: _id, ...anonymous } = row;
  expect(() => atlasFigureCard(anonymous)).toThrow('id, name, file');
});
