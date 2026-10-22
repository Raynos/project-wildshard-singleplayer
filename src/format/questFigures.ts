/** A quest page's placed kit figures (`quest.composition` `figures.file`, G571): each figure's kit and catalogue rows by
 *  id, where it stands (composition places), its part geometry and extra objects by scene resource id, what it
 *  publishes, and its pose system; a trader figure adds its counter model and live owners. Numbers and ids only. */
import * as v from 'valibot';
import { isJsonData } from './json';
import { SpecimenModelMetadataSchema } from './specimenCatalogue';

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
const ids = v.pipe(v.record(id, id), v.maxEntries(16));
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
/** One live figure per kit: a kit's catalogue rows name its part sources (`<kit>.<part>.source`) and its attention
 *  programs (`npc.<kit>`), so two rows reusing a kit would collide in the page's resources; ids are unique too. */
export const QuestFiguresSchema = v.pipe(v.unknown(), v.check(isJsonData, 'plain JSON figures'),
  v.strictObject({ figures: v.pipe(v.array(QuestFigureSchema), v.maxLength(8),
    v.check(rows => new Set(rows.map(row => row.kit)).size === rows.length && new Set(rows.map(row => row.id)).size === rows.length, 'one figure per kit, unique ids')) }));
export type QuestFigureRows = v.InferOutput<typeof QuestFigureSchema>;
export type QuestFiguresRows = v.InferOutput<typeof QuestFiguresSchema>;


/** Cold Explorer kit cards reuse the live figure rows; their model has no
 * ignored params or variants and their source selects one fixed field only. */
export const KitFigureCardsSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Kit figure cards require plain JSON'), v.strictObject({
  catalogue: id, draws: v.pipe(v.string(), v.regex(/^custom\/[A-Za-z][A-Za-z0-9_.-]*$/u)),
  cards: v.pipe(v.record(id, v.strictObject({
    model: v.strictObject({ ...v.pick(SpecimenModelMetadataSchema, ['id', 'name', 'file', 'category', 'pipeline', 'surface']).entries, defaults: v.strictObject({}) }),
    figure: QuestFigureSchema,
  })), v.maxEntries(64), v.check(rows => Object.keys(rows).length > 0, 'at least one kit figure card')),
}));
export type KitFigureCardsRows = v.InferOutput<typeof KitFigureCardsSchema>;

/** Read standalone rows or the fixed resource field of an admitted quest page.
 * The field is compiled here; documents cannot provide a selector or callback. */
export function parseQuestFiguresDocument(input: unknown): QuestFiguresRows {
  const rows = v.parse(v.pipe(v.unknown(), v.check(isJsonData, 'Quest document requires JSON rows'), v.union([
    QuestFiguresSchema, v.object({ entryResources: v.object({ figures: QuestFiguresSchema }) }),
  ])), input);
  return 'entryResources' in rows ? rows.entryResources.figures : rows;
}
