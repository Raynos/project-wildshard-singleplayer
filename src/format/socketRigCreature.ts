import * as v from 'valibot';
import { SpecimenModelMetadataSchema } from './specimenCatalogue';

/** A socket-dressed creature card: the existing model, coat and socket source rows. */
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128)), n = v.pipe(v.number(), v.finite()), rgb = v.tuple([n, n, n]);
const coat = v.strictObject({ id, label: id, weight: n, rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']), scale: v.tuple([n, n]),
  hp: v.exactOptional(n), tint: v.exactOptional(v.pipe(v.record(id, rgb), v.maxEntries(32))),
  traits: v.exactOptional(v.pipe(v.record(id, v.union([n, v.boolean(), id])), v.maxEntries(32))) });
export const SocketRigCreatureSchema = v.strictObject({
  model: v.pick(SpecimenModelMetadataSchema, ['id', 'file', 'pipeline', 'surface']),
  /** the product whose socket rig rows dress the card, and that rows file */
  product: id, sockets: id,
  kind: id, coat,
});

export type SocketRigCreatureRows = v.InferOutput<typeof SocketRigCreatureSchema>;
