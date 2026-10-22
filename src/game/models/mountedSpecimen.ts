import * as v from 'valibot';
import { creatureFactory } from '@wildshard/engine/models/creature';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import type { MountedSpecimenSeatRows } from '@wildshard/format/mountedSpecimenRows';
import { SpecimenModelMetadataSchema } from '@wildshard/format/specimenCatalogue';
import { loadFirstPartyProduct } from '../shardfile/runtimeProduct';
import { seatedFigureView } from '../riding/seatedFigure';

const id = v.pipe(v.string(), v.minLength(1)), number = v.pipe(v.number(), v.finite());
/** A specimen of a figure seated on a species rig (G530 O1: one shard's mounted rider): the rig at its scale, the figure
 *  on the declared joint as the ride seats it (riding/seatedFigure). Rows only; the profile is the admitted product file
 *  the row names. */
export function defineMountedSpecimen(input: unknown): ModelDef<object> {
  const row = v.parse(v.strictObject({ model: SpecimenModelMetadataSchema, slug: id, json: id,
    species: id, variant: id, scale: number }), input);
  let prepared: MountedSpecimenSeatRows | null = null;
  const { surface, variants, seed, specimenYaw, ...metadata } = row.model;
  return defineModel<object>({ ...metadata,
    ...(surface === undefined ? {} : { surface }), ...(variants === undefined ? {} : { variants }),
    ...(seed === undefined ? {} : { seed }), ...(specimenYaw === undefined ? {} : { specimenYaw }),
    prepare: async () => { prepared = await (await loadFirstPartyProduct(row.slug)).json<MountedSpecimenSeatRows>(row.json); },
    build: ctx => {
      if (prepared === null) throw new Error('Mounted specimen is not prepared');
      const factory = creatureFactory(ctx), rig = factory.instantiate(factory.model(row.species, row.variant), row.scale);
      rig.bones[prepared.mount]?.add(seatedFigureView(prepared).root); return rig.mesh;
    },
  });
}
