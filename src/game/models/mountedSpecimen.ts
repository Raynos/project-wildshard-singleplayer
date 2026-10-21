import * as v from 'valibot';
import { creatureFactory } from '@wildshard/engine/models/creature';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import { PrivateSceneSchema } from '@wildshard/format/clientChannels';
import { SpecimenModelMetadataSchema } from '@wildshard/format/specimenCatalogue';
import { shapeBook } from './shapeBook';
import { loadFirstPartyProduct } from '../shardfile/runtimeProduct';
import { createClientScene } from '../plugin/ui';

const id = v.pipe(v.string(), v.minLength(1)), number = v.pipe(v.number(), v.finite());
/** What the catalogue reads of a seated figure's profile: its joint, scene and painterly material (its clips are the
 *  shard's view code's). */
const seat = v.object({ mount: id, figure: PrivateSceneSchema, material: v.strictObject({ id, rim: number, bands: number }) });

/** A specimen of a figure seated on a species rig (G530 O1: one shard's mounted rider): the rig at its scale, the figure's
 *  private scene from the shape book on the declared joint, as the game seats it. Rows only; the profile is the admitted
 *  product file the row names. One user: charged back to it by the ruler. */
export function defineMountedSpecimen(input: unknown, shapes: object): ModelDef<object> {
  const row = v.parse(v.strictObject({ model: SpecimenModelMetadataSchema, slug: id, json: id,
    species: id, variant: id, scale: number, geometry: v.array(id) }), input);
  let prepared: v.InferOutput<typeof seat> | null = null;
  const { surface, variants, seed, specimenYaw, ...metadata } = row.model;
  return defineModel<object>({ ...metadata,
    ...(surface === undefined ? {} : { surface }), ...(variants === undefined ? {} : { variants }),
    ...(seed === undefined ? {} : { seed }), ...(specimenYaw === undefined ? {} : { specimenYaw }),
    prepare: async () => { prepared = v.parse(seat, await (await loadFirstPartyProduct(row.slug)).json(row.json)); },
    build: ctx => {
      if (prepared === null) throw new Error('Mounted specimen is not prepared');
      const factory = creatureFactory(ctx), rig = factory.instantiate(factory.model(row.species, row.variant), row.scale);
      const material = painterlyMaterial(null, { rim: prepared.material.rim, bands: prepared.material.bands });
      const view = createClientScene(prepared.figure, { geometry: new Map(shapeBook(shapes).geometries(row.geometry)), materials: new Map([[prepared.material.id, material]]) });
      rig.bones[prepared.mount]?.add(view.root); return rig.mesh;
    },
  });
}
