import { specimenMaterial } from '@wildshard/game/models/specimenCatalogue';
import specimenData from '../boot/specimens.generated.json' with { type: 'json' };
import { defineModel } from '@wildshard/engine/models/model';
import { bakedActorGeometry } from '../world/places';

/** Same native specimen binding; its terrain-fitted shape is prepared before shipping. */
export const glacierSnout = defineModel<object>({
  id: 'nalati-grasslands/glacier-snout', name: 'Glacier snout', category: 'nature', pipeline: 'code',
  file: 'src/shards/nalati-grasslands/models/glacierSnout.ts', surface: 'ground', defaults: {},
  build: ctx => [{ geometry: bakedActorGeometry('glacier-snout:specimen'), material: specimenMaterial(ctx.sky, specimenData.materials.poi), castShadow: false, receiveShadow: true }],
});
