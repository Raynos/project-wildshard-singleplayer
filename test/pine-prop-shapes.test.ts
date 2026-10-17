import { expect, test } from 'vitest';
import { BoxGeometry, MeshStandardMaterial, Object3D } from 'three';
import { Rng } from '../src/engine/core/rng';
import { modelContext } from '../src/engine/models/model';
import { Scope } from '../src/engine/app/scope';
import { defineWorldSceneCatalogue, bindWorldSceneModelSources } from '../src/game/models/worldSceneCatalogue';
import authored from '../src/shards/pine-hollow/data/timberWorld.generated.json' with { type: 'json' };
import { SCENE_MODELS } from '../src/shards/pine-hollow/generators/sceneModelRows';

test('scene catalogue retains the original prop bounds, material identity, hulls and capsule', () => {
  const ctx = modelContext(null), owner = new Scope('pine-prop-shapes'), material = new MeshStandardMaterial();
  const shapes = [...authored.propShapes.rocks, ...authored.propShapes.stumps, ...authored.propShapes.log.parts];
  const geometries = new Map(shapes.map((row, i) => [JSON.stringify(['props', row.name]), new BoxGeometry(i + 1, 2, 3)]));
  const materials = new Map(SCENE_MODELS.models.flatMap(model => model.choices.flatMap(choice => [...choice.draws, ...choice.lods.flatMap(level => level.draws)].map(draw => [draw.material, material] as const))));
  bindWorldSceneModelSources(ctx, 'pine-hollow', { catalogue: SCENE_MODELS, geometries, materials }, owner);
  const catalogue = defineWorldSceneCatalogue(SCENE_MODELS), rocks = catalogue.model('props.rocks');
  try {
    for (const [shape, row] of authored.propShapes.rocks.entries()) {
      const parts = rocks.build(ctx, { shape, solid: true }, new Rng(1337));
      if (parts instanceof Object3D) throw new Error('Expected original native parts');
      expect(parts[0]?.material).toBe(material);
      expect(parts[0]?.geometry).toBe(geometries.get(JSON.stringify(['props', row.name])));
      expect(parts[0]?.geometry.boundingSphere?.center.toArray()).toEqual(row.sphere.slice(0, 3));
      expect(parts[0]?.geometry.boundingSphere?.radius).toBe(row.sphere[3]);
      expect(rocks.colliders?.({ shape, solid: true }, ctx)).toEqual([{ kind: 'hull', x: 0, y: 0, z: 0, points: new Float32Array(row.hull) }]);
      expect(rocks.colliders?.({ shape, solid: false }, ctx)).toEqual([]);
    }
    expect(catalogue.model('props.stumps').colliders?.({}, ctx)).toEqual(authored.propShapes.stumps.map(row => ({ kind: 'hull', x: 0, y: 0, z: 0, points: new Float32Array(row.hull) })));
    expect(catalogue.model('props.log').colliders?.({}, ctx)).toEqual([authored.propShapes.log.capsule]);
    expect(() => rocks.build(ctx, { shape: 6, solid: true }, new Rng(1337))).toThrow('authored choice');
  } finally { owner.dispose(); for (const geometry of geometries.values()) geometry.dispose(); material.dispose(); }
});
