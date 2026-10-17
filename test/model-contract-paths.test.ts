import { describe, expect, it } from 'vitest';
import { checkModels } from '../scripts/check-models.mjs';

describe('model contract after client relocation', () => {
  it.each(['src/shards/nalati-grasslands-legacy/cragRock.ts', 'src/shards/nine-dragon-stack-legacy/vm/geo.ts'])('retains the frozen merge ceiling at %s', (file) => {
    expect(checkModels({ [file]: 'mergeGeometries(parts);' }).violations).toEqual([]);
    expect(checkModels({ [file]: 'mergeGeometries(parts); mergeGeometries(parts);' }).violations)
      .toEqual([expect.stringContaining('2 × mergeGeometries')]);
  });

  it('keeps the frozen crag on the model contract', () => {
    expect(checkModels({ 'src/shards/nalati-grasslands-legacy/cragRock.ts': 'registerSolid(piece);' }).violations)
      .toContainEqual(expect.stringContaining('on the model contract — it places models'));
  });

  it.each([['driftwood-isle', 'boat'], ['pine-hollow', 'logCabin']])('checks the relocated %s model', (slug, name) => {
    const file = `src/shards/${slug}/runtime/models/${name}.ts`;
    expect(checkModels({ [file]: `defineModel({ id: '${slug}/specimen' });` }).violations).toEqual([]);
    expect(checkModels({ [file]: "defineModel({ id: 'other/specimen' });" }).violations)
      .toEqual([expect.stringContaining(`must start with '${slug}/'`)]);
    expect(checkModels({ [file]: 'export const empty = true;' }).violations)
      .toEqual([expect.stringContaining('defines no model')]);
  });

  it('keeps non-model runtime modules and other shard paths restricted', () => {
    const files = {
      'src/shards/pine-hollow/runtime/world/specimen.ts': "defineModel({ id: 'pine-hollow/specimen' });",
      'src/shards/pine-hollow/runtime/models/unlisted.ts': "defineModel({ id: 'pine-hollow/unlisted' });",
      'src/shards/far-reach/runtime/models/specimen.ts': "defineModel({ id: 'far-reach/specimen' });",
    };
    expect(checkModels(files).violations).toEqual([
      expect.stringContaining('pine-hollow/runtime/world/specimen.ts: defineModel outside'),
      expect.stringContaining('pine-hollow/runtime/models/unlisted.ts: defineModel outside'),
      expect.stringContaining('far-reach/runtime/models/specimen.ts: defineModel outside'),
    ]);
  });

  it('keeps cross-shard model imports restricted at the relocated paths', () => {
    const file = 'src/shards/driftwood-isle/runtime/models/boat.ts';
    expect(checkModels({ [file]: "import { model } from '../../../pine-hollow/runtime/models/logCabin'; defineModel({ id: 'driftwood-isle/specimen' });" }).violations)
      .toEqual([expect.stringContaining("imports another shard's models")]);
  });

  it('recognizes the existing typed model factories without dropping prefix checks', () => {
    const file = 'src/shards/driftwood-isle/runtime/models/cove.ts';
    expect(checkModels({ [file]: "defineGeometryModel({ id: 'driftwood-isle/cove' });" }).violations).toEqual([]);
    expect(checkModels({ [file]: "defineGeometryModel({ id: 'other/cove' });" }).violations)
      .toEqual([expect.stringContaining("must start with 'driftwood-isle/'")]);
    expect(checkModels({ 'src/shards/far-reach/models/gear.ts': 'modelCatalogue(rows, owners);' }).violations).toEqual([]);
  });

  it.each(['src/shards/pine-hollow/roster.ts', 'src/shards/pine-hollow-legacy/models/creatures.ts'])('keeps the exact shared deer specialization at %s', (file) => {
    expect(checkModels({ [file]: "defineModel({ id: 'shared/deer', file: 'src/game/models/creatures.ts' });" }).violations).toEqual([]);
    expect(checkModels({ [file]: "defineModel({ id: 'shared/deer', file: 'other.ts' });" }).violations)
      .toEqual([expect.stringContaining("must start with 'pine-hollow/'")]);
    expect(checkModels({ [file]: "defineModel({ id: 'shared/bear', file: 'src/game/models/creatures.ts' });" }).violations)
      .toEqual([expect.stringContaining("must start with 'pine-hollow/'")]);
  });

  it.each([
    ['src/game/plugin/ui.ts', 'new InstancedMesh();'],
    ['src/sdk/bake/glb.ts', 'mergeGeometries(parts);'],
    ['src/sdk/looks/posedInstances.ts', 'new THREE.InstancedMesh();'],
  ])('retains a one-draw ceiling at %s', (file, draw) => {
    expect(checkModels({ [file]: draw }).violations).toEqual([]);
    expect(checkModels({ [file]: `${draw} ${draw}` }).violations)
      .toEqual([expect.stringContaining('2 ×')]);
  });
});
