import * as v from 'valibot';
import { FigureGroupSchema } from './figures';
import { isJsonData } from './json';
import { QuestWorldSchema } from './questWorld';
import { QuestFiguresSchema } from './questFigures';
import { QuestContinuationSchema } from './questContinuation';
import { QuestPageTalksSchema, NpcDialogueRowSchema } from './npcs';
import { ReturnProgramSchema } from './namedJsonContracts';
import { ContractBoardPageSchema } from './contracts';
import { QuestPageCollectionsSchema, QuestPageDoorSchema, QuestPageMapSchema, QuestPageMoverSchema } from './questPageFacets';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1), v.maxLength(256)), ids = v.pipe(v.array(id), v.maxLength(64));
const frame = v.strictObject({ x: n, z: n, rot: n });
const place = v.strictObject({ poi: id, x: n, z: n,
  y: v.exactOptional(n), dy: v.exactOptional(n), yaw: v.exactOptional(n), anchor: v.exactOptional(id) });
const custom = v.pipe(v.string(), v.regex(/^custom\/[a-zA-Z0-9_./-]{1,249}$/));
/** Entered quest composition names resources and ordered effects, never functions.
 * Every facet past the shared entry, kit, talks, trader, cable and places is optional. */
export const QuestPageSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Quest page composition requires JSON rows'), v.strictObject({
  id, debug: id,
  /** Optional entry resources share this admitted document without new file names. */
  entryResources: v.exactOptional(v.strictObject({ world: QuestWorldSchema, figures: QuestFiguresSchema, continuation: QuestContinuationSchema })),
  /** a registered page world (its POI anchors and guide flock), and the frames its placements resolve in */
  world: v.exactOptional(id), frames: v.exactOptional(v.pipe(v.record(id, frame), v.maxEntries(4096))),
  placement: v.exactOptional(v.strictObject({ platforms: v.exactOptional(v.boolean()), registryReach: v.exactOptional(v.pipe(n, v.minValue(Number.MIN_VALUE))) })),
  files: v.strictObject({ services: id, stall: id, discovery: v.exactOptional(id), assembly: v.exactOptional(id), encounter: v.exactOptional(id),
    hints: v.exactOptional(id), returns: v.exactOptional(id), contracts: v.exactOptional(id), director: v.exactOptional(id), trader: v.exactOptional(id) }),
  /** the interaction table: the assembly file's constants, or a custom section's `table` */
  kit: v.exactOptional(v.strictObject({ section: v.exactOptional(custom), platforms: v.exactOptional(v.boolean()),
    registryReach: v.exactOptional(v.pipe(n, v.minValue(Number.MIN_VALUE))) })),
  events: v.unknown(), services: v.array(id),
  deaths: v.unknown(), deathOrder: n, deathMoves: v.array(v.strictObject({ effect: id, target: id })), deathKill: v.exactOptional(n),
  talks: QuestPageTalksSchema, held: v.exactOptional(id), quietPlaces: v.optional(ids, []), peopleLod: v.optional(v.boolean(), false),
  chapter: v.strictObject({ publishFlags: v.exactOptional(v.boolean()), placements: v.optional(v.boolean(), false), completion: v.optional(v.boolean(), false),
    remaining: v.exactOptional(id), program: v.exactOptional(v.unknown()) }),
  speaker: v.exactOptional(v.strictObject({ figure: id, feet: place, fire: place })),
  /** a placed trader's figure and counter; without it the stall's own rows place the trader */
  trader: v.exactOptional(v.strictObject({ figure: id, counter: id, offer: id, label: id, radius: n })),
  /** the stall's shop panel, held with the board as one modal pair */
  shop: v.optional(v.boolean(), false),
  board: v.exactOptional(v.strictObject({ ...v.omit(ContractBoardPageSchema, ['contracts', 'panel']).entries, panel: id })),
  /** lent page owners: `floor` the entered forest page, `sound` the ranged page's shot bank, and placed scene objects */
  forest: v.exactOptional(id), ranged: v.exactOptional(id),
  placed: v.optional(v.pipe(v.array(v.strictObject({ owner: id, scene: id })), v.maxLength(16)), []),
  door: v.exactOptional(QuestPageDoorSchema),
  mover: v.exactOptional(QuestPageMoverSchema), collections: v.exactOptional(QuestPageCollectionsSchema), map: v.exactOptional(QuestPageMapSchema),
  /** admitted page interaction files: `prompts` it creates and registers, over the page's borrowed owners; a page whose
   * `requires` owner is absent (an unbuilt door) is not bound */
  pages: v.optional(v.pipe(v.array(v.strictObject({ file: id, prompts: v.optional(ids, []), requires: v.optional(ids, []) })), v.maxLength(16)), []),
  /** named prompt points, lent to the pages as owner `points`: the floor under (x, z) plus `height` */
  points: v.optional(v.pipe(v.array(v.strictObject({ id, x: n, z: n, height: n })), v.maxLength(128)), []),
  /** the entry cable rows; `a`/`b`/`anchor` name scene points, `publish` the anchor they set */
  cable: v.strictObject({ view: v.unknown(), drawDistance: v.exactOptional(n),
    ends: v.exactOptional(v.strictObject({ a: id, b: id, anchor: id, publish: id })) }),
  /** discovered places: authored rows, else the discovery file's places */
  places: v.exactOptional(v.pipe(v.array(v.strictObject({ id, label: id, x: n, z: n, r: n, quiet: v.boolean() })), v.maxLength(256))),
  /** debug jumps (window `browser`): reset the flags to a beat's, stand at (x, z) facing `look`, optionally lift and set the hour */
  jumps: v.optional(v.pipe(v.record(id, v.strictObject({ x: n, z: n, flags: v.pipe(v.array(id), v.maxLength(256)), look: v.object({ x: n, z: n }),
    height: v.exactOptional(v.strictObject({ x: n, z: n, up: n })), phase: v.exactOptional(n) })), v.maxEntries(32)), {}),
  browser: v.exactOptional(id),
  boss: v.exactOptional(v.strictObject({ pool: place, reward: id })),
  sway: v.exactOptional(v.strictObject({ piece: id, height: n, ease: n, threshold: n, rate: n, speed: n, rollHz: n, roll: n, dipHz: n, dip: n })),
  guideHeight: v.exactOptional(n), placeInterval: n,
  systems: v.strictObject({ kit: id, kitAfter: v.optional(ids, []), talks: id, cable: id, places: id, before: ids,
    speakerPose: v.exactOptional(id), traderPose: v.exactOptional(id), trader: v.exactOptional(id), guide: v.exactOptional(id), sway: v.exactOptional(id) }),
}));
export type QuestPageRows = v.InferOutput<typeof QuestPageSchema>;
type Present<T, K extends keyof T> = T & { readonly [P in K]-?: NonNullable<T[P]> };
/** The placed-figure page (speaker, trader, boss and bridge rows present), as its shard's install reads it. */
export type QuestPageCompositionRows = Present<QuestPageRows, 'world' | 'speaker' | 'trader' | 'boss' | 'sway'> & {
  readonly systems: Present<QuestPageRows['systems'], 'speakerPose' | 'traderPose' | 'trader' | 'sway'>;
};
/** The admitted schema both shards' composition files are published under. */
export const QuestPageCompositionSchema = QuestPageSchema;

/** Optional chapter-only view facet: concrete mounted/arena owners are sampled
 * by a finite vocabulary; the admitted guest owns all story decisions. */
export const ChapterViewSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Chapter view requires JSON rows'), v.strictObject({
  figures: v.exactOptional(FigureGroupSchema),
  npcs: v.record(id, NpcDialogueRowSchema),
  places: v.pipe(v.array(v.strictObject({ id, label: id, x: n, z: n,
    r: v.pipe(n, v.minValue(0)), quiet: v.exactOptional(v.boolean()) })), v.maxLength(64)),
  program: ReturnProgramSchema,
  view: v.strictObject({ story: id, carried: id,
    system: v.strictObject({ id, before: ids, after: ids }),
    timeField: id, signal: id, interval: v.pipe(n, v.minValue(Number.MIN_VALUE)),
    observations: v.pipe(v.record(id, v.picklist(['taming.bonded', 'taming.upgraded', 'arena.inside', 'arena.tied'])), v.maxEntries(16)),
    pulse: v.strictObject({ signal: id, interval: v.pipe(n, v.minValue(Number.MIN_VALUE)) }),
    death: v.strictObject({ kind: id, signal: id }),
    debug: v.strictObject({ id, prop: id, goals: id }),
  }),
}));
export type ChapterViewRows = v.InferOutput<typeof ChapterViewSchema>;
