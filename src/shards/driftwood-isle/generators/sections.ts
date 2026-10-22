import * as v from 'valibot';
import { CollectionDisplaysSchema } from '@wildshard/format/collectionDisplay';
import { AmbientFlockSchema } from '@wildshard/format/ambientLife';
import { BodySlotsSchema } from '@wildshard/format/bodySlots';
import { ResolvedIslandLibrarySchema } from '@wildshard/format/islandLibrary';

const text = v.pipe(v.string(), v.maxLength(512));
const number = v.number();
const natural = v.pipe(v.number(), v.integer(), v.minValue(0));
const placement = v.strictObject({
  enemies: v.pipe(v.array(v.strictObject({ kind: v.picklist(['crab', 'monkey', 'sailor']), variant: v.nullable(text),
    x: number, z: number, yaw: number, herd: number, practice: v.exactOptional(v.literal(true)) })), v.maxLength(64)),
  herds: natural, centres: v.pipe(v.array(v.strictObject({ x: number, z: number })), v.maxLength(16)),
  kinds: v.pipe(v.array(v.picklist(['crab', 'monkey'])), v.maxLength(16)),
  stream: v.strictObject({ version: v.literal(1), state: natural, initial: natural, scrambledFork: v.boolean() }),
});
/** Named offline spawn rows; all sampling runs only in the author compiler. */
export const EnemyPlacementsSchema = v.strictObject({ seed: natural, volley: BodySlotsSchema,
  practice: v.strictObject({ x: number, z: number }), hold: v.strictObject({ x: number, z: number }),
  page: v.strictObject({ phone: placement, desktop: placement }), native: placement });
export type EnemyPlacements = v.InferOutput<typeof EnemyPlacementsSchema>;

/** Named geometry bootstrap data; no private section or executable mirror is added. */
export const FixedGeometryGroupsSchema = v.strictObject({
    cargo: v.strictObject({ barrel: text, lying: text, crate: text, broken: text, coil: text }),
    driftLogs: v.strictObject({ long: text, short: text, pale: text }),
    npc: v.strictObject({ trader: v.strictObject({ body: text, head: text, upper: text, fore: text }), castaway: v.strictObject({ body: text, camp: text, head: text, arm: text, flames: text }) }),
    entryDecks: v.strictObject({ world: text, deep: text, shallow: text }),
    cover: v.record(text, text), piers: v.record(text, v.strictObject({ deck: text, cloth: v.nullable(text) })),
});


export const SECTIONS = {
  'custom/enemyPlacements': EnemyPlacementsSchema,
  'custom/collections': CollectionDisplaysSchema,
  'custom/cumulusPuffs': v.pipe(v.array(v.pipe(v.array(number), v.length(7))), v.maxLength(1024)),
  'custom/fixedLayouts': ResolvedIslandLibrarySchema,
  'custom/gullFlock': AmbientFlockSchema,
} as const;

const bridgeSpan = v.strictObject({ a: v.tuple([number, number]), b: v.tuple([number, number]), sag: number });
export const FILE_SCHEMAS = { 'data/bridgeRows.json': v.strictObject({ world: bridgeSpan, specimen: bridgeSpan }) };


