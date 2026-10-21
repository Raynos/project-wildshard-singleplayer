/** A quest page's placed kit figures (`quest.composition` `figures.file`, G571): each figure's kit and catalogue rows by
 *  id, where it stands (composition places), its part geometry and extra objects by scene resource id, what it
 *  publishes, and its pose system; a trader figure adds its counter model and live owners. Numbers and ids only. */
import * as v from 'valibot';
import { isJsonData } from './json';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128)), n = v.pipe(v.number(), v.finite()), triple = v.tuple([n, n, n]);
const place = v.strictObject({ poi: id, x: n, z: n, y: v.exactOptional(n), dy: v.exactOptional(n), yaw: v.exactOptional(n), anchor: v.exactOptional(id) });
/** where an object sits in the figure's frame: its feet (origin), or the fire turned into that frame */
const at = v.picklist(['feet', 'fire']);
const object = v.variant('kind', [
  /** an unlit vertex-coloured mesh (a fire's flames: colour > 1 blooms) */
  v.strictObject({ kind: v.literal('basic-mesh'), id, name: id, draw: id, colour: triple, vertexColors: v.boolean(), at, lift: n }),
  /** a building cloud (smoke) in a lent look: hidden, on an empty draw, until its draw and look are both lent */
  v.strictObject({ kind: v.literal('cloud'), id, name: id, draw: id, look: id, at, center: triple, radius: n, order: n, seeds: v.boolean() }),
]);
const system = v.strictObject({ id, before: v.pipe(v.array(id), v.maxLength(8)) });
const ids = v.pipe(v.record(id, id), v.check(rows => Object.keys(rows).length <= 16, 'at most 16 figure parts'));
export const QuestFigureSchema = v.strictObject({
  id, kit: id, feet: place, fire: v.exactOptional(place),
  /** each kit part's fixed draw slot; campAt 'fire' moves the camp part to the fire */
  parts: ids, campAt: v.exactOptional(v.literal('fire')),
  objects: v.optional(v.pipe(v.array(object), v.maxLength(8)), []),
  publish: v.optional(v.pipe(v.array(v.strictObject({ id, draw: id })), v.maxLength(8)), []),
  /** a placed trader: its registry piece and name, the catalogue model whose static card is its specimen, and the counter
   *  model ahead metres in front of its feet */
  piece: v.exactOptional(id), card: v.exactOptional(id), name: v.exactOptional(id),
  counter: v.exactOptional(v.strictObject({ model: id, ahead: n, piece: id, name: id, solidFloor: v.boolean() })),
  system,
});
export const QuestFiguresSchema = v.pipe(v.unknown(), v.check(isJsonData, 'plain JSON figures'),
  v.strictObject({ figures: v.pipe(v.array(QuestFigureSchema), v.maxLength(8)) }));
export type QuestFigureRows = v.InferOutput<typeof QuestFigureSchema>;
export type QuestFiguresRows = v.InferOutput<typeof QuestFiguresSchema>;
