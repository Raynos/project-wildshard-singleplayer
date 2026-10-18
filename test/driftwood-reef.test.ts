// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { BufferGeometry, Mesh, MeshStandardMaterial } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { modelContext } from '@wildshard/engine/models/model';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { Scope } from '../src/engine/app/scope';
import { createOwnedGeometry } from '../src/engine/models/ownedGeometry';
import { defineWorldSceneCatalogue, bindWorldSceneModelSources } from '../src/game/models/worldSceneCatalogue';
import { parseWorldSceneModels } from '../src/format/worldSceneModels';
import { reefCatalogue, REEF_SCENE_LIBRARY } from '../src/shards/driftwood-isle/generators/reefCatalogue';
import { reefGeometry } from '../src/shards/driftwood-isle/generators/reef';
import { foliageTransport } from '../src/shards/driftwood-isle/generators/hibiscusTransport';
import { decodeReefWorld } from '../src/shards/driftwood-isle/generators/foliageGeometry';
import { REEF_SPECIMENS, REEF_MODEL_SEED } from '../src/shards/driftwood-isle/generators/reefSpecimenRows';

const isGeometry = (value: unknown): value is BufferGeometry => value instanceof BufferGeometry;

it('owns the native reef wind channels and full picking boxes without a geometry template', () => {
  const shape = reefGeometry('weed', REEF_SPECIMENS.weed.defaults, new Rng(1)), vertices = shape.getAttribute('position').count;
  const transport = foliageTransport(shape, [shape], {vertices, indices: 0, output: vertices, runs: [{start: 0, count: vertices}]}, 0x31464552, ['position', 'color', 'aSway']);
  const {geometry, boxes} = decodeReefWorld(transport, 1);
  try {
    expect(geometry.getAttribute('position').count).toBeGreaterThan(0);
    expect(geometry.getAttribute('aSway').count).toBe(geometry.getAttribute('position').count);
    expect(geometry.getAttribute('color').array.buffer).not.toBe(geometry.getAttribute('position').array.buffer);
    expect(geometry.getAttribute('position').array.buffer).not.toBe(transport.buffer);
    expect(boxes.buffer).not.toBe(transport.buffer);
    expect(() => decodeReefWorld(transport, 2)).toThrow('topology');
    expect(() => decodeReefWorld(transport.subarray(0, -4), 1)).toThrow('topology');
    new DataView(transport.buffer).setFloat32(40, Number.NaN, true);
    expect(() => decodeReefWorld(transport, 1)).toThrow('Nonfinite');
  } finally { geometry.dispose(); shape.dispose(); }
});

it('keeps every baked reef card byte-exact through Z2, with its sway and borrowed look', async () => {
  const material = new MeshStandardMaterial(), ctx = modelContext(null), owner = new Scope('reef-cards');
  const rows = parseWorldSceneModels({ product: 'driftwood-isle', models: reefCatalogue() });
  const catalogue = defineWorldSceneCatalogue(rows), geometries = new Map<string, BufferGeometry>();
  try {
    for (const model of rows.models) for (const choice of model.choices) {
      const draw = choice.draws[0]; if (draw === undefined) throw new Error('Missing reef draw');
      const file = REEF_SCENE_LIBRARY.models.find(row => row.id === draw.model);
      const kind = model.key === 'coral' ? 'coral' : model.key === 'seaweed' ? 'weed' : 'star';
      if (file === undefined) throw new Error('Missing reef asset');
      const row = REEF_SPECIMENS[kind], variant = row.variants.find(item => item.id === choice.id);
      const original = reefGeometry(kind, { ...row.defaults, ...variant?.params }, new Rng(REEF_MODEL_SEED));
      const bytes = staticGlb([{ geometry: original, material, customAttributes: { _SWAY: 'aSway' }, compactIndex: true }], `reef-${kind}`);
      original.dispose();
      const intake = createOwnedGeometry(file.file, file.attributes);
      await intake.load(bytes);
      geometries.set(JSON.stringify([draw.library, draw.model]), intake.take());
    }
    bindWorldSceneModelSources(ctx, rows.product, { catalogue: rows, geometries, materials: new Map([['reef', material]]) }, owner);
    for (const kind of ['coral', 'weed', 'star'] as const) {
      const key = kind === 'coral' ? 'coral' : kind === 'weed' ? 'seaweed' : 'reef-starfish', row = REEF_SPECIMENS[kind];
      const def = catalogue.model(key);
      for (const variant of [{params: row.defaults}, ...row.variants.map(item => ({params: {...row.defaults, ...item.params}}))]) {
        const original = reefGeometry(kind, variant.params, new Rng(REEF_MODEL_SEED));
        const built = def.build(ctx, variant.params, new Rng(1));
        if (Array.isArray(built) || !('children' in built)) throw new Error('Missing reef card');
        const mesh = built.children[0]; if (!(mesh instanceof Mesh) || !isGeometry(mesh.geometry)) throw new Error('Missing reef mesh');
        try {
          for (const [name, channel] of Object.entries(original.attributes)) expect(Array.from(mesh.geometry.getAttribute(name).array)).toEqual(Array.from(channel.array));
          expect(mesh.geometry.index === null ? null : Array.from(mesh.geometry.index.array)).toEqual(original.index === null ? null : Array.from(original.index.array));
          expect(mesh.material).toBe(material); expect(mesh.castShadow).toBe(false); expect(mesh.receiveShadow).toBe(true);
        } finally { original.dispose(); mesh.geometry.dispose(); }
      }
      expect(() => def.build(ctx, {...row.defaults, s: 12}, new Rng(1))).toThrow('authored choice');
    }
  } finally { owner.dispose(); for (const geometry of geometries.values()) geometry.dispose(); material.dispose(); }
});
