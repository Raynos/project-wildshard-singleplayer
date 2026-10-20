import { describe, expect, it } from 'vitest';
import { checkModels } from '../scripts/check-models.mjs';

describe('model contract after client relocation', () => {
  it.each(['src/shards/nalati-grasslands-legacy/cragRock.ts', 'src/shards/nine-dragon-stack-legacy/vm/geo.ts'])('retains the frozen merge ceiling at %s', (file) => {
    expect(checkModels({ [file]: 'mergeGeometries(parts);' }).violations).toEqual([]);
    expect(checkModels({ [file]: 'mergeGeometries(parts); mergeGeometries(parts);' }).violations)
      .toEqual([expect.stringContaining('2 × mergeGeometries')]);
  });

  it.each([
    ['src/shards/driftwood-isle-legacy/world/rockKit.ts', 1],
    ['src/shards/pine-hollow-legacy/runtime/weapons/LeverRifle.ts', 8],
    ['src/shards/pine-hollow-legacy/runtime/weapons/crossbow/Crossbow.ts', 4],
  ] as const)('retains only the exact frozen merge ceiling at %s', (file, ceiling) => {
    const merge = 'mergeGeometries(parts);';
    expect(checkModels({ [file]: merge.repeat(ceiling) }).violations).toEqual([]);
    expect(checkModels({ [file]: merge.repeat(ceiling + 1) }).violations)
      .toEqual([expect.stringContaining(`${ceiling + 1} × mergeGeometries`)]);
    const primary = file.replace('-legacy/', '/');
    expect(checkModels({ [primary]: merge }).violations)
      .toEqual([expect.stringContaining('1 × mergeGeometries')]);
  });

  it('keeps the frozen crag on the model contract', () => {
    expect(checkModels({ 'src/shards/nalati-grasslands-legacy/cragRock.ts': 'registerSolid(piece);' }).violations)
      .toContainEqual(expect.stringContaining('on the model contract — it places models'));
  });

  it.each([['driftwood-isle', 'boat'], ['pine-hollow', 'fallenLog']])('checks the relocated %s model', (slug, name) => {
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
      'src/shards/pine-hollow/runtime/models/logCabin.ts': "defineModel({ id: 'pine-hollow/retired' });",
      'src/shards/far-reach/runtime/models/specimen.ts': "defineModel({ id: 'far-reach/specimen' });",
    };
    expect(checkModels(files).violations).toEqual([
      expect.stringContaining('pine-hollow/runtime/world/specimen.ts: defineModel outside'),
      expect.stringContaining('pine-hollow/runtime/models/unlisted.ts: defineModel outside'),
      expect.stringContaining('pine-hollow/runtime/models/logCabin.ts: defineModel outside'),
      expect.stringContaining('far-reach/runtime/models/specimen.ts: defineModel outside'),
    ]);
  });

  it('keeps cross-shard model imports restricted at the relocated paths', () => {
    const file = 'src/shards/driftwood-isle/runtime/models/boat.ts';
    expect(checkModels({ [file]: "import { model } from '../../../pine-hollow/runtime/models/fallenLog'; defineModel({ id: 'driftwood-isle/specimen' });" }).violations)
      .toEqual([expect.stringContaining("imports another shard's models")]);
  });

  it('recognizes the existing typed model factories without dropping prefix checks', () => {
    const file = 'src/shards/driftwood-isle/models/catalogue.ts';
    expect(checkModels({ [file]: "defineGeometryModel({ id: 'driftwood-isle/cove' });" }).violations).toEqual([]);
    expect(checkModels({ [file]: "defineGeometryModel({ id: 'other/cove' });" }).violations)
      .toEqual([expect.stringContaining("must start with 'driftwood-isle/'")]);
    expect(checkModels({ 'src/shards/far-reach/models/gear.ts': 'modelCatalogue(rows, owners);' }).violations).toEqual([]);
  });

  it.each(['src/shards/pine-hollow-legacy/models/creatures.ts'])('keeps the exact shared deer specialization at %s', (file) => {
    expect(checkModels({ [file]: "defineModel({ id: 'shared/deer', file: 'src/game/models/creatures.ts' });" }).violations).toEqual([]);
    expect(checkModels({ [file]: "defineModel({ id: 'shared/deer', file: 'other.ts' });" }).violations)
      .toEqual([expect.stringContaining("must start with 'pine-hollow/'")]);
    expect(checkModels({ [file]: "defineModel({ id: 'shared/bear', file: 'src/game/models/creatures.ts' });" }).violations)
      .toEqual([expect.stringContaining("must start with 'pine-hollow/'")]);
  });

  it('keeps the retired native roster outside the model-definition contract', () => {
    const file = 'src/shards/pine-hollow/roster.ts';
    expect(checkModels({ [file]: 'export const roster = () => rows.map(live);' }).violations).toEqual([]);
    expect(checkModels({ [file]: "defineModel({ id: 'pine-hollow/new-native' });" }).violations)
      .toEqual([expect.stringContaining('defineModel outside')]);
  });

  it('retains the exact relocated Nalati gear model contract', () => {
    const file = 'src/shards/nalati-grasslands/generators/gear.ts';
    expect(checkModels({ [file]: "defineModel({ id: 'nalati-grasslands/spear' });" }).violations).toEqual([]);
    expect(checkModels({ [file]: "defineModel({ id: 'other/spear' });" }).violations)
      .toEqual([expect.stringContaining("must start with 'nalati-grasslands/'")]);
    expect(checkModels({ 'src/shards/nalati-grasslands/generators/other.ts': "defineModel({ id: 'nalati-grasslands/spear' });" }).violations)
      .toEqual([expect.stringContaining('defineModel outside')]);
  });

  it.each([
    ['src/engine/render/scatterInstances.ts', 'new THREE.InstancedMesh();', 1],
    ['src/game/ambient/wingField.ts', 'new THREE.InstancedMesh();', 1],
    ['src/game/boss/arenaFire.ts', 'new THREE.InstancedMesh();', 2],
    ['src/game/practice/hookCourse.ts', 'registry.add({ object });', 1],
    ['src/game/weapons/heldPolearm.ts', 'new THREE.InstancedMesh();', 1],
    ['src/shards/nine-dragon-stack/world/casts.ts', 'new InstancedMesh();', 1],
  ] as const)('retains the relocated draw ceiling at %s', (file, draw, ceiling) => {
    expect(checkModels({ [file]: draw.repeat(ceiling) }).violations).toEqual([]);
    expect(checkModels({ [file]: draw.repeat(ceiling + 1) }).violations)
      .toEqual([expect.stringContaining(`${ceiling + 1} ×`)]);
  });

  it.each([
    ['src/game/plugin/ui.ts', 'new InstancedMesh();'],
    ['src/game/shardfile/worldSceneWeld.ts', 'new InstancedMesh();'],
    ['src/sdk/bake/glb.ts', 'mergeGeometries(parts);'],
    ['src/game/looks/posedInstances.ts', 'new THREE.InstancedMesh();'],
  ])('retains a one-draw ceiling at %s', (file, draw) => {
    expect(checkModels({ [file]: draw }).violations).toEqual([]);
    expect(checkModels({ [file]: `${draw} ${draw}` }).violations)
      .toEqual([expect.stringContaining('2 ×')]);
  });
});
