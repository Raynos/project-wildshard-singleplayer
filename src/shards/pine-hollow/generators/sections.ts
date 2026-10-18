import { RoamingBossProfileSchema } from '@wildshard/format/bossProfiles';
import { BakedBuildingLookSchema, BuildingLifeLookSchema } from '@wildshard/format/buildings';
import { QuestStepRowsSchema } from '@wildshard/format/questSteps';
import { NpcDialogueRowSchema } from '@wildshard/format/npcs';
import { QuestGraphSchema } from '@wildshard/format/questGraph';
import { InteractionRowsSchema } from '@wildshard/format/questInteractions';
import { SpeciesSchema } from '@wildshard/format/speciesPrograms';
import { LimbRigSchema, LimbBlendSchema, BakedClipTable } from '@wildshard/format/limbRig';
import { LimbCollisionBake } from '@wildshard/format/limbCollision';
import { CollectionMountPackSchema, CollectionChalkSchema } from '@wildshard/format/collectionDisplay';
import * as v from 'valibot';
import { RoamingEncounterSchema, BossEncounterPresentationSchema } from '@wildshard/format/bossEncounter';
import { ForestLifeSchema } from '@wildshard/format/ambientLife';

const text = v.pipe(v.string(), v.maxLength(512));
const number = v.number();
const finite = v.pipe(v.number(), v.minValue(-Number.MAX_VALUE), v.maxValue(Number.MAX_VALUE));
const point = { x:finite, y:finite, z:finite };
const natural = v.pipe(v.number(), v.integer(), v.minValue(0));
const strings = v.pipe(v.array(text), v.maxLength(8192));
const pool = v.strictObject({ url: text, parts: strings });
const icon = v.picklist(['deer','boar','elk','bear','ghost','ironhide','claw','antlers','poi','laurel','rope','seaglass','coin','check','lock','tusk','longbow']);
const feat = v.strictObject({ id: text, name: text, goal: text, count: natural, kind: v.exactOptional(text), variant: v.exactOptional(text), event: v.exactOptional(text), title: text, icon });
const bagItem = v.strictObject({ id: text, label: text, icon, travels: v.boolean() });
const texture = v.strictObject({ url:text, srgb:v.boolean(), repeat:v.boolean() });
const triple = v.tuple([number, number, number]);
const pair = v.tuple([number, number]);
/** Cabin spatial facts are checked before section emission. */
export const CabinAmbienceSchema = v.strictObject({ floors:v.pipe(v.array(v.strictObject({ ...point, rot:finite, hw:finite, hd:finite })),v.maxLength(128)), firePits:v.pipe(v.array(v.strictObject(point)),v.maxLength(16)) });

export const PropKindSchema = v.picklist(['crate', 'barrel', 'bucket', 'hatchet']);
const propBox = v.strictObject({ hw: finite, hd: finite, h: finite });
export const LogKitSchema = v.strictObject({
  PROP_KINDS: v.tuple([v.literal('crate'), v.literal('barrel'), v.literal('bucket'), v.literal('hatchet')]),
  PROP_BOXES: v.strictObject({ crate: propBox, barrel: propBox, bucket: propBox, hatchet: v.null() }),
});

const kingAction = v.object({ action: v.picklist(['roar', 'sweep', 'strike', 'brace']) });
const KingProfileSchema = v.intersect([RoamingBossProfileSchema, v.object({ fight: v.object({
  adds: v.object({ kinds: v.array(v.picklist(['elk', 'boar'])) }), strike: kingAction, burst: kingAction, summon: kingAction, lanes: kingAction,
}) })]);

/** World-only rows are checked at emission and read from verified named JSON. */
export const NativeViewSchema = v.strictObject({
  ...LogKitSchema.entries,
  QUADRUPED: v.strictObject({ spec: LimbRigSchema, blend: LimbBlendSchema, clips: BakedClipTable, collision: LimbCollisionBake,
    bones: v.array(v.strictObject({ name:text, parent:v.nullable(text), pos:triple })) }),
  BOSS_RIBS: triple, BOSS_ENCOUNTER: v.intersect([RoamingEncounterSchema, v.object({ profile: KingProfileSchema })]), BOSS_PRESENTATION: BossEncounterPresentationSchema,
  KINGS_CLEARING: v.strictObject({ x:number, z:number, r:number, blend:number, clear:number }),
  BEAR_CAVE: v.strictObject({ x:number, z:number, rot:number }), KING_ARENA_FOG:number,
  KING_FX_LOOKS:v.strictObject({ fog:text, flame:text }), CRAG_LOOK:text, SPRAY_LOOK:text,
  CAVE_LOOK:v.strictObject({ near:number, under:v.strictObject({ height:number, lzMin:number, lzMax:number }), fill:pair, surface:v.literal('rock'),
    shaft:v.strictObject({ look:text, radialSegments:number, heightSegments:number, renderOrder:number, gain:number, sunBase:number, sunGain:number, floor:number }),
    drips:v.strictObject({ color:number, size:number, opacity:number, period:number, periodStep:number, kinds:number, phaseStep:number, gravity:number, hang:number, minDrop:number }) }),
  SPRAY_PUFFS:v.strictObject({ notice:text, at:v.array(number), seed:v.array(number), size:v.array(number) }),
});


export const QuestLeadRowsSchema = v.strictObject({
  path: v.pipe(v.array(v.tuple([finite, finite])), v.minLength(1), v.maxLength(128)),
  near: v.pipe(finite, v.minValue(0)), first: v.pipe(finite, v.minValue(0)),
  trot: v.pipe(finite, v.minValue(0)), gone: v.pipe(finite, v.minValue(0)), past: v.pipe(finite, v.minValue(0)),
});

const questText = v.pipe(v.string(), v.maxLength(2048)), questNames = v.pipe(v.array(questText), v.maxLength(64));
const questFinite = v.pipe(v.number(), v.minValue(-Number.MAX_VALUE), v.maxValue(Number.MAX_VALUE)), questPoint = { x: questFinite, z: questFinite };
const questCondition = v.strictObject({ all: v.exactOptional(questNames), any: v.exactOptional(questNames), none: v.exactOptional(questNames) });
const questBase = { id: questText, at: v.strictObject({ poi: v.literal('world'), ...questPoint, y: questFinite, yaw: questFinite }),
  requires: v.exactOptional(questCondition), lockedLabel: v.exactOptional(questText), showWhen: v.exactOptional(questCondition),
  sets: v.exactOptional(questNames), toast: v.exactOptional(questText) };
const table = v.strictObject({ external: questNames, rows: v.pipe(v.array(v.variant('kind', [
  v.strictObject({ ...questBase, kind: v.literal('lever'), label: questText, latch: v.boolean() }),
  v.strictObject({ ...questBase, kind: v.literal('door'), look: v.literal('sluice'), w: questFinite, h: questFinite, latch: v.boolean(), opensWhen: questCondition }),
  v.strictObject({ ...questBase, kind: v.literal('pickup'), look: questText, label: questText, color: v.exactOptional(questText), item: v.exactOptional(questText), touch: v.exactOptional(v.boolean()) }),
  v.strictObject({ ...questBase, kind: v.literal('bench'), label: questText }),
])), v.maxLength(256)) });
export const PineQuestRowsSchema = v.strictObject({ lead: QuestLeadRowsSchema, steps: QuestStepRowsSchema, table, graph: QuestGraphSchema, interactions: InteractionRowsSchema,
  readings: v.strictObject({ speakers: v.record(questText, NpcDialogueRowSchema), continuation: v.strictObject({ bare: questText, wrapped: questNames }) }),
  policy: v.strictObject({ resinCount: v.pipe(questFinite, v.integer(), v.minValue(0), v.maxValue(64)), resinFlag: questText, tokenFlag: questText, tokenNames: questNames,
    readingDelay: v.pipe(finite, v.minValue(0)), lanternIds: v.strictObject({ pond: questText, ridge: questText, den: questText }) }),
  events: v.unknown(), deaths: v.unknown(), pageDeaths: v.unknown(), content: v.unknown(),
  beats: v.record(questText, v.strictObject({ adds: questNames, flags: questNames, at: v.picklist(['ranger', 'deck', 'launch', 'lodge', 'xz']),
    ...questPoint, look: v.strictObject(questPoint), night: v.exactOptional(v.boolean()), day: v.exactOptional(v.boolean()) })),
});
/** Admit immutable content before either original quest host installs effects; effect hosts validate their own rows. */
export function parsePineQuestRows(input: unknown): v.InferOutput<typeof PineQuestRowsSchema> {
  return v.parse(PineQuestRowsSchema, input);
}
/** Shared content contract for the existing page and renderer-free native owners. */
export type PineQuestRows = v.InferOutput<typeof PineQuestRowsSchema>;

const tradeText = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const amount = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
const item = v.picklist(['venison', 'deer-hide', 'boar-hide', 'boar-tusk', 'bear-pelt', 'amber-resin', 'lodge-ribbon']);
export const TradeSchema = v.strictObject({ id: tradeText, label: tradeText, short: tradeText, blurb: tradeText,
  give: v.pipe(v.array(v.strictObject({ item, n: amount })), v.minLength(1), v.maxLength(3)),
  get: v.union([v.strictObject({ bolts: amount }), v.strictObject({ ammo: v.picklist(['pitch', 'broadhead', 'cartridge', 'arrow']), n: amount }),
    v.strictObject({ skin: v.picklist(['scarback-furnace', 'hollow-ash']) })]), once: v.exactOptional(v.boolean()) });
export const TradeCatalogueSchema = v.strictObject({ goods: v.pipe(v.array(v.strictObject({ id: tradeText, name: tradeText, does: tradeText,
  icon: v.picklist(['bolt', 'rifle', 'longbow', 'crossbow']), price: v.literal(0), tile: tradeText, trade: TradeSchema,
  cost: v.pipe(v.array(v.strictObject({ item, n: amount, text: tradeText })), v.minLength(1), v.maxLength(3)) })), v.minLength(1), v.maxLength(64)), lines: v.record(tradeText, tradeText) });
export type TradeCatalogue = v.InferOutput<typeof TradeCatalogueSchema>;
export type TradeGood = TradeCatalogue['goods'][number];
export type Trade = v.InferOutput<typeof TradeSchema>;
export type TradeItem = v.InferOutput<typeof item>;
/** Preflight every offer and display link before the native modal or page panel can use a row. */
export function parseTradeCatalogue(input: unknown): TradeCatalogue {
  const parsed = v.parse(TradeCatalogueSchema, input);
  if (new Set(parsed.goods.map(g => g.id)).size !== parsed.goods.length || (Object.keys(parsed.lines).length !== item.options.length || item.options.some(id => parsed.lines[id] === undefined))
    || parsed.goods.some(g => g.id !== g.trade.id || g.cost.length !== g.trade.give.length
      || g.cost.some((c, i) => { const paid = g.trade.give[i]; return paid === undefined || c.item !== paid.item || c.n !== paid.n; }))) throw new Error('Invalid Pine trade catalogue');
  return parsed;
}

export type PineTradeSkin = 'hollow-ash' | 'scarback-furnace';

export const TradeItemSchema = item;
const grazerNumber = v.pipe(v.number(), v.minValue(-Number.MAX_VALUE), v.maxValue(Number.MAX_VALUE));
const grazerRgb = v.tuple([grazerNumber, grazerNumber, grazerNumber]);
const grazerFur = v.object({ texSeed: grazerNumber, tex: v.object({ contrast: grazerNumber, grizzle: grazerNumber,
  normalStrength: grazerNumber, bristle: grazerNumber, strandLen: grazerNumber, root: grazerNumber }), roughness: grazerNumber, sheen: grazerNumber,
  sheenColor: grazerRgb, envMapIntensity: grazerNumber, rim: grazerRgb, shellLen: grazerNumber, shag: grazerNumber,
  emissive: v.exactOptional(grazerRgb), emissiveIntensity: v.exactOptional(grazerNumber) });
const grazerVariant = v.object({ ...SpeciesSchema.entries.variants.item.entries,
  tint: v.exactOptional(v.record(v.string(), grazerRgb)),
  traits: v.exactOptional(v.record(v.string(), grazerNumber)),
  fur: v.exactOptional(v.object({ rim: v.exactOptional(grazerRgb), sheenColor: v.exactOptional(grazerRgb),
    emissive: v.exactOptional(grazerRgb), emissiveIntensity: v.exactOptional(grazerNumber) })) });
const grazerRow = v.object({ ...SpeciesSchema.entries, fur: grazerFur, variants: v.array(grazerVariant),
  rigContract: v.object({ skeleton: v.string(), clips: v.array(v.never()), sockets: v.array(v.string()) }),
  pose: v.object({ grazeNeck: grazerNumber, gallopTail: grazerNumber }),
  body: v.object({ bones: v.array(v.object({ name: v.string(), parent: v.nullable(v.string()), pos: grazerRgb })),
    furParts: v.array(v.never()), hardParts: v.array(v.never()), eyeParts: v.array(v.never()),
    dims: v.object({ bodyY: grazerNumber, bodyHalfLen: grazerNumber, bodyRadius: grazerNumber, headRadius: grazerNumber, legLen: grazerNumber,
      feet: v.array(v.tuple([grazerNumber, grazerNumber])), halfWidth: grazerNumber }) }) });
export const PineGrazersSchema = v.strictObject({ deer: grazerRow, elk: grazerRow });

export const ThrallLookSchema = v.strictObject({ pose: v.unknown(),
  traits: v.record(v.string(), v.number()),
  tint: v.record(v.string(), v.tuple([v.number(), v.number(), v.number()])),
});
const cabinNumber = v.pipe(v.number(), v.minValue(-Number.MAX_VALUE), v.maxValue(Number.MAX_VALUE)), cabinXyz = v.tuple([cabinNumber, cabinNumber, cabinNumber]);
const CabinLight = v.strictObject({ color: cabinNumber, intensity: cabinNumber, distance: cabinNumber, decay: cabinNumber, at: cabinXyz, seed: cabinNumber, kind: v.picklist(['fire', 'lamp']), rank: cabinNumber });
/** a static box solid as the builder emitted it (world space, turned by `yaw`) */
const CabinBox = v.strictObject({ kind: v.literal('box'), x: cabinNumber, y: cabinNumber, z: cabinNumber, hx: cabinNumber, hy: cabinNumber, hz: cabinNumber, yaw: v.exactOptional(cabinNumber), surface: v.exactOptional(v.picklist(['stone', 'wood'])) });
/** a legacy box (src/engine/physics/box.ts `BoxSpec`) */
const CabinLegacy = v.strictObject({ x: cabinNumber, z: cabinNumber, hw: cabinNumber, hd: cabinNumber, rot: cabinNumber, yTop: cabinNumber, yBottom: cabinNumber });
/**
 * What a building adds to its root, in the order it added it. A number names a geometry in the bake's binary (by index):
 * a swinging door (leaf, strap hinges, battens on its pivot; `collider` its legacy box), a fire glow, the fire pit's model
 * copy, a particle cloud (its instance seeds are geometry `seeds`), the porch lantern (its pivot, the ring, its light), the
 * mill wheel on its pivot, and a light straight on the root.
 */
const CabinNode = v.variant('t', [
  v.strictObject({ t: v.literal('door'), pivot: cabinXyz, leaf: cabinNumber, iron: cabinNumber, batten: cabinNumber, id: v.string(), collider: cabinNumber, top: cabinNumber, use: cabinXyz, slab: CabinBox }),
  v.strictObject({ t: v.literal('glow'), g: cabinNumber, at: cabinXyz, yaw: cabinNumber }),
  v.strictObject({ t: v.literal('pit'), at: cabinXyz, yaw: cabinNumber }),
  v.strictObject({ t: v.literal('particles'), mat: v.picklist(['flame', 'ember', 'smoke']), seeds: cabinNumber, at: cabinXyz, order: cabinNumber, detail: v.boolean() }),
  v.strictObject({ t: v.literal('lantern'), pivot: cabinXyz, ring: cabinNumber, light: CabinLight, swing: cabinNumber }),
  v.strictObject({ t: v.literal('wheel'), g: cabinNumber, at: cabinXyz, yaw: cabinNumber }),
  v.strictObject({ t: v.literal('light'), light: CabinLight }),
]);
const KIT_MATS = ['log', 'endGrain', 'chink', 'roof', 'beam', 'deck', 'door', 'stone', 'bark', 'iron', 'cloth', 'char'] as const;
const CabinMatrices = v.array(v.array(cabinNumber));
/** one building as the bake built it where it stands (world space unless said) */
export const BakedBuildingSchema = v.strictObject({
  id: v.string(), index: cabinNumber, hamlet: v.boolean(), at: cabinXyz, rot: cabinNumber,
  /** its main room's width (across the ridge) and length (along it), m */
  size: v.tuple([cabinNumber, cabinNumber]),
  /** its parts per material, in the order they first came: one geometry each (the builder's list, merged) */
  parts: v.array(v.tuple([v.picklist(KIT_MATS), cabinNumber])),
  /** its window groups, one geometry each */
  glass: v.array(cabinNumber),
  nodes: v.array(CabinNode),
  /** its legacy boxes (the door's among them) and its static solids (`prop`: a prop model's own box) */
  colliders: v.array(CabinLegacy),
  solids: v.array(v.strictObject({ d: CabinBox, prop: v.boolean() })),
  floors: v.array(v.strictObject({ x: cabinNumber, z: cabinNumber, rot: cabinNumber, hw: cabinNumber, hd: cabinNumber, y: cabinNumber })),
  rooms: v.array(v.strictObject({ x: cabinNumber, z: cabinNumber, hw: cabinNumber, hd: cabinNumber })),
  doorAt: v.tuple([cabinNumber, cabinNumber]),
  /** the props it set about: world matrices (column-major) per kind */
  props: v.strictObject({ crate: CabinMatrices, barrel: CabinMatrices, bucket: CabinMatrices, hatchet: CabinMatrices }),
  firePit: v.nullable(cabinXyz),
});
/** One geometry in the binary: its attributes (name, item size), its vertices (`unique` stored, expanded by `index` when
 *  it was built without one), or its own index (`own`: u16 / u32) kept as built. */
const CabinGeometry = v.strictObject({ attrs: v.array(v.tuple([v.string(), cabinNumber])), count: cabinNumber, unique: cabinNumber, own: v.nullable(v.picklist(['u16', 'u32'])), indexCount: cabinNumber });
/** the bake's rows: the binary's content hash and size, its geometries in byte order, the buildings, the hamlet's root */
export const CabinRowsSchema = v.strictObject({ bin: v.string(), bytes: cabinNumber, geometries: v.array(CabinGeometry), buildings: v.array(BakedBuildingSchema), hamlet: v.nullable(v.strictObject({ at: cabinXyz, pad: cabinNumber })) });


export const CabinSeedsSchema = v.array(v.strictObject({ ordinal: v.pipe(v.number(), v.integer(), v.minValue(0)), width: v.literal(4), values: v.array(finite) }));
export const RuntimeGraphsSchema = v.pipe(v.array(v.pipe(v.string(), v.maxLength(128))), v.maxLength(128));
export const PlaceSetsSchema = v.array(v.strictObject({ id: v.string(), place: v.string(), name: v.string(), x: v.number(), z: v.number(), r: v.number() }));


/** Checked against the build's emitted JSON before publication; client reads never import data/. */
const appearanceNumber = v.pipe(v.number(), v.minValue(-Number.MAX_VALUE), v.maxValue(Number.MAX_VALUE)), appearancePair = v.tuple([appearanceNumber, appearanceNumber]), appearanceTriple = v.tuple([appearanceNumber, appearanceNumber, appearanceNumber]);
const materialRow = v.strictObject({ color: appearanceNumber, roughness: appearanceNumber, metalness: appearanceNumber,
  transparent: v.exactOptional(v.boolean()), opacity: v.exactOptional(appearanceNumber), envMapIntensity: v.exactOptional(appearanceNumber),
  emissiveIntensity: v.exactOptional(appearanceNumber), emissive: v.exactOptional(appearanceNumber), side: v.exactOptional(v.picklist([0, 1, 2])),
  depthWrite: v.exactOptional(v.boolean()), vertexColors: v.exactOptional(v.boolean()) });
const timberDraw = v.strictObject({ depth: v.picklist(['proxy', 'near']), receiveShadow: v.boolean(),
  castShadow: v.exactOptional(v.boolean()), until: v.exactOptional(appearanceNumber) });
/** Client-only author rows: unknown fields, malformed vectors and unbounded lists refuse before construction. */
export const CabinAppearanceSchema = v.strictObject({
  BUILDING_LOOK: BakedBuildingLookSchema,
  CABIN_DOOR_LOOK: v.string(), CABIN_MOSS_LOOKS: v.strictObject({ roof: v.string(), stone: v.string() }),
  HEARTH_LOOKS: v.strictObject({ smoke: v.string(), flame: v.string(), ember: v.string() }),
  CABIN_LIFE: BuildingLifeLookSchema,
  CABIN_PBR: v.pipe(v.array(v.strictObject({ key: v.picklist(['log', 'roof', 'beam', 'deck', 'door', 'stone', 'bark']),
    scan: v.string(), color: appearanceTriple, normal: appearancePair })), v.length(7)),
  CABIN_MATERIALS: v.strictObject({ endGrain: materialRow, chink: materialRow, glass: materialRow, iron: materialRow, cloth: materialRow, char: materialRow }),
  TIMBER_DRAWS: v.strictObject({ log: timberDraw, endGrain: timberDraw, chink: timberDraw, roof: timberDraw, beam: timberDraw, deck: timberDraw,
    door: timberDraw, stone: timberDraw, bark: timberDraw, iron: timberDraw, cloth: timberDraw, char: timberDraw }),
  TIMBER_GLASS: v.strictObject({ renderOrder: appearanceNumber, receiveShadow: v.boolean() }),
  CABIN_GLASS_EMISSIVE: appearanceTriple, CABIN_LIGHT: v.strictObject({ count: appearanceNumber, color: appearanceNumber, intensity: appearanceNumber, distance: appearanceNumber, decay: appearanceNumber }),
});

const floorNumber = v.pipe(v.number(), v.minValue(-Number.MAX_VALUE), v.maxValue(Number.MAX_VALUE));

const floorKinds = ['ferns', 'shrubs', 'litter', 'stones', 'moss', 'reeds'] as const;
const floorPlace = v.strictObject({ x: floorNumber, y: floorNumber, z: floorNumber, nx: floorNumber, ny: floorNumber, nz: floorNumber, rot: floorNumber, scale: floorNumber, r: floorNumber, g: floorNumber, b: floorNumber, matrix: v.pipe(v.array(floorNumber), v.length(16)) });
const floorList = v.pipe(v.array(floorPlace), v.maxLength(40_000)), count = v.pipe(v.number(), v.integer(), v.minValue(0));
/** Exact ordered layouts; malformed records, count mismatches and oversized floors refuse. */
export const FloorRowsSchema = v.strictObject({ counts: v.tuple([count, count, count, count, count, count]),
  layout: v.strictObject({ ferns: floorList, shrubs: floorList, litter: floorList, stones: floorList, moss: floorList, reeds: floorList }) });
export function parseFloorRows(input: unknown): v.InferOutput<typeof FloorRowsSchema> {
 const row=v.parse(FloorRowsSchema,input);
 if (!(  row.counts.reduce((total, n) => total + n, 0) <= 40_000 && floorKinds.every((kind, i) => row.layout[kind].length === row.counts[i]))) throw new Error('Invalid Pine floor counts');
 return row;
}


export const SECTIONS = {
  'custom/cabinAppearance': CabinAppearanceSchema,
  'custom/questRuntime': PineQuestRowsSchema,
  'custom/tradeCatalogue': TradeCatalogueSchema,
  'custom/grazers': PineGrazersSchema,
  'custom/thrallLook': ThrallLookSchema,
  'custom/runtimeGraphs': RuntimeGraphsSchema,
  'custom/placeSets': PlaceSetsSchema,
  'custom/cabinAmbience': CabinAmbienceSchema,
  'custom/questInventory':v.strictObject({feats:v.pipe(v.array(feat),v.maxLength(128)),items:v.pipe(v.array(bagItem),v.maxLength(128))}),
  'custom/ambientLife':ForestLifeSchema,
  'custom/paintedTextures':v.strictObject({textures:v.strictObject({coatArm:texture,chalk:texture,coatMap:texture,coatNormal:texture}),chalk:CollectionChalkSchema}),
  'custom/trophyMounts':CollectionMountPackSchema,
  'custom/kingKit':v.strictObject({pool,lanterns:v.pipe(v.array(triple),v.maxLength(8))}),
} as const;


export const TradeGoodSchema = TradeCatalogueSchema.entries.goods.pipe[0].item;
export const PineTradeSkinSchema = v.picklist(['hollow-ash', 'scarback-furnace']);

const physicsSpec = v.object({ label: v.string(), rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']) });
const physicsBody = { id: v.string(), kind: v.string(), variant: v.string(), spec: physicsSpec, seed: finite, scale: finite };
const physicsTriple = v.tuple([finite, finite, finite]);
const kingHit = v.strictObject({ head: physicsTriple, body: v.tuple([physicsTriple, physicsTriple]), fore: v.tuple([physicsTriple, physicsTriple]), ribs: physicsTriple, radius: v.pipe(finite, v.minValue(0.001)) });
const shelterTree = v.tuple([finite, finite, v.pipe(finite, v.minValue(0)), v.pipe(finite, v.minValue(0)), v.pipe(finite, v.minValue(0), v.maxValue(1))]);
export const PinePhysicsSchema = v.object({ version: v.literal(1),
 ground: v.strictObject({ rows: finite, cols: finite, heights: v.string(), friction: finite, groups: finite, scale: v.strictObject(point), at: v.strictObject(point) }),
 solids: v.array(v.unknown()),
 actors: v.array(v.strictObject({ ...physicsBody, herd: finite, scripted: v.boolean() })), parked: v.array(v.strictObject(physicsBody)),
 trees: v.array(v.tuple([finite, finite, v.pipe(finite, v.minValue(0))])), herds: v.array(v.strictObject({ kind: v.string(), members: v.array(v.string()) })), kingHit, shelterTrees: v.array(shelterTree),
});

const cavePair = v.tuple([finite, finite]), caveTriple = v.tuple([finite, finite, finite]);
const caveRows = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: T) => v.pipe(v.array(schema), v.maxLength(256));
export const CaveRowsSchema = v.strictObject({ meta: v.strictObject({ version: v.literal(1),
  holes: caveRows(v.strictObject({ lx: finite, lz: finite, hw: finite, hd: finite, y0: finite, y1: finite })),
  cuts: caveRows(v.strictObject({ lx: finite, lz: finite, hw: finite, hd: finite, below: finite })),
  spots: caveRows(v.strictObject({ lx: finite, lz: finite, r: finite })), inside: caveRows(cavePair),
  shaft: v.strictObject({ top: caveTriple, foot: caveTriple, r0: finite, r1: finite }),
  drips: caveRows(v.tuple([finite, finite, finite, finite])), floor: caveRows(cavePair),
  tris: v.strictObject({ cave: finite, far: finite, col: finite }),
}), shell: v.unknown() });


const spotXyz = { x: finite, y: finite, z: finite };
const spotPoint = v.strictObject(spotXyz), spotPrompt = v.strictObject({ ...spotXyz, radius: finite });
export const PineSpotsSchema = v.object({ version: v.literal(1),
  rows: v.array(v.strictObject({ id: v.string(), kind: v.string(), ...spotXyz, yaw: finite, prompt: v.nullable(spotPoint) })),
  people: v.exactOptional(v.pipe(v.array(v.strictObject({ kind: v.picklist(['ranger', 'miller', 'trader']), prompt: spotPrompt, at: spotPoint })), v.length(3))),
  board: v.exactOptional(spotPrompt), talk: spotPrompt, lanterns: v.strictObject({ pond: spotPrompt, ridge: spotPrompt, den: spotPrompt }),
  zip: v.strictObject({ prompt: spotPrompt, top: spotPoint, bottom: spotPoint, landing: spotPoint }), rifle: spotPrompt });
export function parsePineSpots(input: unknown): v.InferOutput<typeof PineSpotsSchema> {
  const row = v.parse(PineSpotsSchema, input);
  if (row.people !== undefined && new Set(row.people.map(person => person.kind)).size !== 3) throw new Error('Invalid Pine people spots');
  return row;
}
export const PoolGroundSchema = v.array(finite);

const PineSpotsFileSchema = v.strictObject({ ...PineSpotsSchema.entries, profile: v.string(), notice: v.string() });
export const FILE_SCHEMAS = { 'data/spots.generated.json': PineSpotsFileSchema, 'data/cabins.json': CabinRowsSchema, 'data/physics.generated.json': PinePhysicsSchema };

export function parseQuestLeadRows(input: unknown): v.InferOutput<typeof QuestLeadRowsSchema> { return v.parse(QuestLeadRowsSchema, input); }
