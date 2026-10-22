import { PagePathRampSchema } from './pagePreparation';
import { DeckCameraSwaySchema } from './deckCameraSway';
import { BakedSourceSchema, BakedTilesSchema } from './bakedTiles';
import { WaterSurfaceSchema } from './water';
import { ClientCuesSchema } from './clientCues';
import { ClientTrailsSchema } from './clientTrails';
import * as v from 'valibot';
import { isJsonData } from './json';
import { LightEmittersSchema } from './lightEmitters';
import { EasedFieldsSchema } from './easedFields';
import { SceneMotionSchema } from './sceneMotion';
import { ClientHeldMeleeSchema, ClientSpeciesProgramSchema, ClientQuestPageSchema, ClientPopulationSchema, ClientHeldBossSchema, ClientSpawnedBossSchema, ClientPlayerEnterSchema, ClientBossTelegraphSchema } from './clientNative';

const finite=v.pipe(v.number(),v.finite()),rgb=v.tuple([finite,finite,finite]);
const label=v.pipe(v.string(),v.minLength(1),v.maxLength(512));
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128), v.regex(/^[a-zA-Z][a-zA-Z0-9.-]*$/u));
/** A page-mode texture cap (game/shard/pagePolicy pageModeCap): inputs through `through` are held to `max`. */
const PageCapSchema = v.strictObject({ through: v.pipe(finite, v.minValue(0)), max: v.pipe(finite, v.minValue(0)) });
const attribute = v.pipe(v.string(), v.minLength(1), v.maxLength(64), v.regex(/^[_a-zA-Z][_a-zA-Z0-9]*$/u));
/** O7: a water row's own draw (WaterSurface.draw): its grid per tier (custom attributes renamed for its graph), level,
 *  baked floor, dry rectangles, foam boxes, and params lent from the product's toon lighting uniforms. */
const WaterDrawSchema = v.strictObject({
  grid: v.strictObject({ phone: BakedSourceSchema, desktop: BakedSourceSchema }),
  attributes: v.pipe(v.record(attribute, attribute), v.maxEntries(8)),
  level: finite,
  floor: v.exactOptional(BakedSourceSchema),
  dry: v.pipe(v.array(v.pipe(v.strictObject({ minX: finite, minZ: finite, maxX: finite, maxZ: finite }),
    v.check(rect => rect.minX < rect.maxX && rect.minZ < rect.maxZ, 'positive dry rectangle'))), v.maxLength(16)),
  foam: v.pipe(v.array(v.strictObject({ x: finite, z: finite, hw: finite, hd: finite, rot: finite, yTop: finite, yBottom: finite })), v.maxLength(2048)),
  lent: v.pipe(v.record(attribute, v.picklist(['uCloudShadow', 'uToonNight', 'uSeaLevel', 'uCloudTime'])), v.maxEntries(8)),
  /** the toon lighting's sea level is this water's level */
  toonSeaLevel: v.boolean(),
});
/** Client-only declarations select compiled platform features, never modules, owners or property paths. */
export const ClientFeatureSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('strings.register') }),
  v.strictObject({ kind: v.literal('content.catalogue'), quests: v.boolean(), finishes: v.boolean(),
    economy: v.exactOptional(v.boolean()),
    weapons: v.pipe(v.array(id), v.maxLength(256)), ammunition: v.pipe(v.array(id), v.maxLength(256)),
    effects: v.pipe(v.array(v.picklist(['starter', 'finishes'])), v.maxLength(2)),
    compendiums: v.pipe(v.array(id), v.maxLength(64)),
    encounters: v.pipe(v.array(v.strictObject({ id, displayName: label, showHeadBar: v.boolean() })), v.maxLength(64)) }),
  v.strictObject({ kind: v.literal('state.adventure'), file: label }),
  v.strictObject({ kind: v.literal('world.meadow'), file: label }),
  v.strictObject({ kind: v.literal('world.ambient-life'), file: label,
    flocks: v.pipe(v.array(v.strictObject({ id, owner: id })), v.maxLength(64),
      v.check(rows => new Set(rows.map(row => row.id)).size === rows.length && new Set(rows.map(row => row.owner)).size === rows.length, 'unique ambient ids and owners')) }),
  v.strictObject({ kind: v.literal('world.runtime-hooks'), floor: v.exactOptional(id),
    overhead: v.pipe(v.array(id), v.maxLength(64), v.check(rows => new Set(rows).size === rows.length, 'unique overhead owners')),
    meleeSilent: v.exactOptional(v.boolean()) }),
  v.strictObject({ kind: v.literal('world.movers'), system: id,
    bindings: v.pipe(v.array(v.variant('kind', [
      v.strictObject({ kind: v.literal('object'), id, owner: id, order: v.exactOptional(v.picklist(['XYZ', 'YXZ'])),
        visibility: v.exactOptional(v.literal('enabled')),
        moor: v.exactOptional(v.strictObject({ look: id, water: finite, cleats: v.tuple([finite, finite]) })) }),
      v.strictObject({ kind: v.literal('chain'), id, owner: id }),
    ])), v.minLength(1), v.maxLength(64), v.check(rows => new Set(rows.map(row => row.id)).size === rows.length, 'unique mover ids')) }),
  v.strictObject({ kind: v.literal('world.bind-sets'),
    placed: v.pipe(v.array(id), v.maxLength(1024)),
    groups: v.pipe(v.array(v.strictObject({ id, placed: v.pipe(v.array(id), v.maxLength(1024)) })), v.maxLength(128),
      v.check(rows => new Set(rows.map(row => row.id)).size === rows.length, 'unique named-place groups')),
    quest: v.exactOptional(id) }),
  v.strictObject({ kind: v.literal('world.paths'), rows: PagePathRampSchema }),
  v.strictObject({ kind: v.literal('world.dressing') }),
  v.strictObject({ kind: v.literal('population.wildlife'), file: label,
    crowd: v.strictObject({ json: label, binary: label }), navSteer: v.boolean(),
    frame: v.strictObject({ id, after: v.pipe(v.array(id), v.maxLength(16)), before: v.pipe(v.array(id), v.maxLength(16)) }) }),
  v.strictObject({kind:v.literal('world.sets'),rows:v.pipe(v.array(v.strictObject({place:label,id:label,name:label,file:label,pois:v.optional(v.pipe(v.array(label),v.maxLength(128),v.check(names=>new Set(names).size===names.length)),[]),x:finite,z:finite,r:v.pipe(finite,v.minValue(0)),mode:v.exactOptional(v.picklist(['centre','bounds']))})),v.maxLength(128),v.check(rows=>new Set(rows.map(row=>row.id)).size===rows.length))}),
  v.strictObject({ kind: v.literal('riding.session'), file: label }),
  v.strictObject({ kind: v.literal('practice.course'), course: v.picklist(['horse', 'grapple']),
    title: label, blurb: label, icon: v.pipe(v.string(), v.minLength(1), v.maxLength(4096)), art: label, file: label }),
  v.strictObject({ kind: v.literal('held.claims.prepare'), id }),
  v.strictObject({ kind: v.literal('population.product-creatures') }),
  v.strictObject({ kind: v.literal('population.hull-book') }),
  v.strictObject({ kind: v.literal('held.claims.install'), claims: id }),
  v.strictObject({ kind: v.literal('held.cosmetics') }),
  v.strictObject({ kind: v.literal('held.ranged-feel') }),
  v.strictObject({kind:v.literal('bag.finds'),id,quest:id,file:label}),
  v.strictObject({kind:v.literal('look.painterly'),shadeTint:rgb,rimColor:rgb,wind:v.strictObject({x:finite,z:finite,strength:finite})}),
  v.strictObject({ kind: v.literal('audio.scene') }),
  // G571: a shard's declared forest page (and its cave at the page-mode texture cap), its weather and its ambient life
  v.strictObject({ kind: v.literal('world.forest-page'), file: label, cave: v.exactOptional(v.strictObject({ file: label,
    cap: v.strictObject({ shard: v.nullable(PageCapSchema), grid: v.nullable(PageCapSchema) }),
    spots: v.exactOptional(v.strictObject({ ranged: label, zone: id, fade: finite, max: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(256)) })) })) }),
  v.strictObject({ kind: v.literal('weather.forest'), file: label }),
  v.strictObject({ kind: v.literal('page.life'), file: label, ranged: label, object: v.exactOptional(id) }),
  v.strictObject({ kind: v.literal('held.ranged-page'), file: label, shadowBatch: v.exactOptional(v.strictObject({ shard: v.boolean(), grid: v.boolean() })) }),
  v.strictObject({ kind: v.literal('quest.continuation'), file: label }),
  v.strictObject({ kind: v.literal('quest.views'), file: label }),
  v.strictObject({ kind: v.literal('view.deck-camera-sway'), rows: DeckCameraSwaySchema, module: label }),
  v.strictObject({ kind: v.literal('quest.world'), file: label, ambient: v.exactOptional(id) }),
  v.strictObject({ kind: v.literal('quest.reference'), id }),
  v.strictObject({ kind: v.literal('quest.composition'), id, file: label,
    equipment: v.exactOptional(v.strictObject({ ranged: id, animals: id, sounds: id })),
    figures: v.exactOptional(v.strictObject({ file: label, draws: id })), reference: v.exactOptional(id) }),
  v.strictObject({ kind: v.literal('quest.spawns'), id, source: v.pipe(label, v.regex(/^custom\/[A-Za-z][A-Za-z0-9_.-]*$/u)), quest: id, animals: id, sounds: id }),
  v.strictObject({kind:v.literal('world.water'),rows:v.pipe(v.array(v.union([v.strictObject({id,surface:WaterSurfaceSchema,geometry:v.pipe(v.string(),v.minLength(1),v.maxLength(256))}),v.strictObject({id,surface:WaterSurfaceSchema,draw:WaterDrawSchema})])),v.minLength(1),v.maxLength(8),v.check(rows=>new Set(rows.map(row=>row.id)).size===rows.length))}),
  v.strictObject({ kind: v.literal('world.scenes'), graphs: v.exactOptional(v.picklist(['required', 'debug'])) }),
  v.strictObject({ kind: v.literal('world.baked'), rows: v.pipe(v.array(BakedTilesSchema), v.minLength(1), v.maxLength(4), v.check(rows => new Set(rows.map(row => row.id)).size === rows.length, 'unique baked tile ids')) }),
  v.strictObject({ kind: v.literal('motion.channels'), rows: SceneMotionSchema }),
  ClientHeldMeleeSchema, ClientSpeciesProgramSchema, ClientQuestPageSchema, ClientPopulationSchema, ClientTrailsSchema, ClientCuesSchema,
  ClientHeldBossSchema, ClientSpawnedBossSchema, ClientPlayerEnterSchema, ClientBossTelegraphSchema,
  v.strictObject({ kind: v.literal('light.emitters'), rows: LightEmittersSchema }),
  v.strictObject({ kind: v.literal('weather.fields'), rows: EasedFieldsSchema, quest: id }),
  v.strictObject({ kind: v.literal('debug.expose'), name: id }),
]);
/** Rows are unordered. Phase, rank and lifetime belong exclusively to the compiled registry. */
export const ClientPlanSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Client plan requires plain JSON'), v.strictObject({ version: v.literal(1), features: v.pipe(v.array(ClientFeatureSchema), v.maxLength(64)) }),
  v.check(plan => new Set(plan.features.map(row => row.kind === 'debug.expose' ? `${row.kind}:${row.name}` : row.kind)).size === plan.features.length, 'Duplicate client feature'));
export type ClientPlan = v.InferOutput<typeof ClientPlanSchema>;
export type ClientFeatureRow = ClientPlan['features'][number];
export type ClientFeatureKind = ClientFeatureRow['kind'];
/** Strict admission rejects unknown kinds and executable/reflected settings before installing any feature. */
export function parseClientPlan(input: unknown): ClientPlan { return v.parse(ClientPlanSchema, input); }
