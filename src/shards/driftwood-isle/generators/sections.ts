import { CollectionDisplaysSchema } from '@wildshard/format/collectionDisplay';
import * as v from 'valibot';
import { BodySlotsSchema } from '@wildshard/format/bodySlots';
import { WakeEncounterSchema } from '@wildshard/format/bossEncounter';
import { AmbientFlockSchema } from '@wildshard/format/ambientLife';
import { PrivateSceneSchema } from '@wildshard/format/clientChannels';

const reach = v.strictObject({ near: v.number(), far: v.number(), grow: v.number() });
const text = v.pipe(v.string(), v.maxLength(512));
const number = v.number();
const natural = v.pipe(v.number(), v.integer(), v.minValue(0));
const site = v.strictObject({ x: number, z: number, rot: number });
const point = v.strictObject({ x: number, y: number, z: number });
const anchor = v.strictObject({ x: number, y: number, z: number, yaw: number });
const box = v.strictObject({ x: number, z: number, hw: number, hd: number, rot: number, yBottom: number, yTop: number });
const desc = v.variant('kind', [
  v.strictObject({ kind: v.literal('box'), x: number, y: number, z: number, hx: number, hy: number, hz: number, yaw: number }),
  v.strictObject({ kind: v.literal('treads'), from: point, to: point, width: number, count: natural }),
]);
const boxes = v.pipe(v.array(box), v.maxLength(128));
const descs = v.pipe(v.array(desc), v.maxLength(128));
const surfaced = v.variant('kind', [
  v.strictObject({ kind: v.literal('box'), x: number, y: number, z: number, hx: number, hy: number, hz: number, yaw: number, surface: text }),
  v.strictObject({ kind: v.literal('treads'), from: point, to: point, width: number, count: natural, surface: text }),
]);
/** a fixed site's walkable floor: engine/physics/box FloorRect rows in own space, the first match wins */
const floors = v.pipe(v.array(v.strictObject({ x: number, z: number, hw: number, hd: number, y: number, rot: number, slope: v.exactOptional(number) })), v.maxLength(16));
const fixedSite = { site, origin: point, colliders: boxes, anchors: v.record(text, anchor), floors };
const shrineSite = v.strictObject({ ...fixedSite, descs: v.pipe(v.array(surfaced), v.maxLength(128)), baseY: number, terrace: number });
const npcScene = v.strictObject({ recipe: PrivateSceneSchema, parts: v.pipe(v.record(text, v.picklist(['group', 'object'])), v.maxEntries(16)),
  bindings: v.pipe(v.record(text, v.strictObject({ kind: v.picklist(['group', 'object']), part: text })), v.maxEntries(16)) });
const cove = v.strictObject({
  composition: v.strictObject({ root: text, rocks: text, cascade: text, look: text, reefPiece: text, piece: v.strictObject({ id: text, name: text, category: v.literal('nature'), file: text, surface: v.literal('rock'), solidFloor: v.literal(true) }) }),
  spec: v.strictObject({ pools: v.pipe(v.array(v.strictObject({ x: number, z: number, r: number })), v.maxLength(64)), crabSites: v.pipe(v.array(v.strictObject({ x: number, z: number })), v.maxLength(64)),
    fall: v.strictObject({ top: v.tuple([number, number]), foot: v.tuple([number, number]), width: number }),
    cave: v.strictObject({ x: number, z: number, yaw: number, w: number, h: number, depth: number }),
    caveBounds: v.strictObject({ x: number, z: number, r: number, yMin: number, yMax: number }) }),
  floors: v.pipe(v.array(v.strictObject({ x: number, z: number, hw: number, hd: number, y: number, rot: number, slope: v.exactOptional(number) })), v.maxLength(16)),
  native: v.strictObject({ colliders: boxes, anchors: v.record(text, anchor), descs: v.pipe(v.array(surfaced), v.maxLength(128)),
    cuts: v.pipe(v.array(v.strictObject({ x: number, z: number, hw: number, hd: number, yaw: number, below: number })), v.maxLength(16)) }),
  catalogue: v.strictObject({ placements: v.pipe(v.array(v.strictObject({ x: number, y: number, z: number, params: v.strictObject({ r: number, squash: number, moss: number }) })), v.maxLength(512)),
    boxes: v.pipe(v.array(number), v.maxLength(8192)) }),
});
const palm = { h: number, lean: number, leanDir: number, rot: number, fronds: natural };
const bush = { r: number, flowers: v.boolean() };
const foliageTier = v.strictObject({
  palms: v.strictObject({ specs: v.pipe(v.array(v.strictObject({ x: number, z: number, ...palm })), v.maxLength(1024)),
    placements: v.pipe(v.array(v.strictObject({ ...point.entries, params: v.strictObject(palm) })), v.maxLength(1024)) }),
  bushes: v.strictObject({ specs: v.pipe(v.array(v.strictObject({ x: number, z: number, ...bush })), v.maxLength(1024)),
    placements: v.pipe(v.array(v.strictObject({ ...point.entries, params: v.strictObject({ ...bush, phase: number }) })), v.maxLength(1024)) }),
});

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

const islandCoverFile = v.strictObject({ file: text, hash: v.pipe(v.string(), v.hash(['sha256'])), bytes: natural, used: natural,
  texture: v.strictObject({ width: natural, height: natural }), groundRect: v.tuple([number, number, number, number]),
  parts: v.tuple([v.tuple([natural, natural]), v.tuple([natural, natural]), v.tuple([natural, natural]), v.tuple([natural, natural]), v.tuple([natural, natural])]) });

/** Product-owned logical names and the client's build-time rows (W2b, G449); runtime/ never imports data/. */
export const SECTIONS = {
  'custom/enemyPlacements': EnemyPlacementsSchema,
  'custom/collections': CollectionDisplaysSchema,
  /** the faceted sky's cumulus ring: rows `[x, y, z, r, puff, cluster, baseY]` (generators/cumulus.ts) */
  'custom/cumulusPuffs': v.pipe(v.array(v.pipe(v.array(number), v.length(7))), v.maxLength(1024)),
  /** Entry decks, tiered foliage and fixed models: draw slots, colliders, anchors and floors. */
  'custom/fixedLayouts': v.strictObject({
    coverFiles: v.strictObject({ phone: islandCoverFile, desktop: islandCoverFile }),
    /** Authored native view parameters, read only after product admission. */
    nativeView: v.strictObject({
      BOSS_ENCOUNTER: WakeEncounterSchema,
    ISLAND_TIERS: v.strictObject({ phone: v.strictObject({ casterTiles: number, coverTiles: number, share: number, cover: reach, big: reach }), desktop: v.strictObject({ casterTiles: number, coverTiles: number, share: number, cover: reach, big: reach }) }),
    BOAT_LAYOUT: v.strictObject({"length": number, "beam": number, "floor": number, "deckThickness": number}),
    CAPTAIN_ARENA_R: number,
    CAPTAIN_ID: text,
    CAPTAIN_NAME: text,
    CASCADE_LOOKS: v.strictObject({"curtain": text, "pool": text, "puffs": text}),
    CASTAWAY_FACING: v.strictObject({"range": number, "rate": number, "maxSpeed": number, "wrapTarget": v.boolean(), "wrapOutput": v.boolean()}),
    CASTAWAY_HEAD_FOCUS: v.strictObject({"range": number, "yawLimit": number, "pitchLimit": number, "pitchScale": number, "eyeHeight": number, "minimumDistance": number, "response": v.literal("linear"), "rate": number, "clampAfterOffset": v.boolean(), "idle": v.strictObject({"cadence": v.strictObject({"kind": v.literal("sine"), "base": number, "frequency": number, "span": number}), "yaw": v.tuple([number, number]), "pitch": number})}),
    CASTAWAY_POSE: v.tuple([v.strictObject({"bone": v.literal("head"), "channel": v.literal("rotation.x"), "cases": v.tuple([v.strictObject({"sum": v.tuple([v.strictObject({"of": v.tuple([v.strictObject({"mem": text})])}), v.strictObject({"of": v.tuple([v.strictObject({"wave": v.literal("t"), "rate": number}), number])})])})])}), v.strictObject({"bone": v.literal("head"), "channel": v.literal("rotation.y"), "cases": v.tuple([v.strictObject({"sum": v.tuple([v.strictObject({"of": v.tuple([v.strictObject({"mem": text})])})])})])}), v.strictObject({"bone": v.literal("head"), "channel": v.literal("rotation.z"), "cases": v.tuple([v.strictObject({"sum": v.tuple([v.strictObject({"of": v.tuple([v.strictObject({"wave": v.literal("t"), "rate": number}), number])})])})])}), v.strictObject({"bone": v.literal("head"), "channel": v.literal("position.y"), "cases": v.tuple([v.strictObject({"sum": v.tuple([number, v.strictObject({"of": v.tuple([v.strictObject({"wave": v.literal("t"), "rate": number}), number])})])})])}), v.strictObject({"bone": v.literal("arm"), "channel": v.literal("rotation.x"), "cases": v.tuple([v.strictObject({"sum": v.tuple([number]), "when": v.strictObject({"mem": v.strictObject({"key": text, "atLeast": number})})}), v.strictObject({"sum": v.tuple([v.strictObject({"of": v.tuple([v.strictObject({"wave": v.literal("t"), "rate": number}), number])})])})])}), v.strictObject({"bone": v.literal("arm"), "channel": v.literal("rotation.y"), "cases": v.tuple([v.strictObject({"sum": v.tuple([number])})])}), v.strictObject({"bone": v.literal("arm"), "channel": v.literal("rotation.z"), "cases": v.tuple([v.strictObject({"sum": v.tuple([v.strictObject({"of": v.tuple([number, v.strictObject({"bounded": v.tuple([v.strictObject({"of": v.tuple([v.strictObject({"clock": v.literal("phase")}), number])})]), "max": number}), v.strictObject({"bounded": v.tuple([v.strictObject({"of": v.tuple([v.strictObject({"bounded": v.tuple([number, v.strictObject({"of": v.tuple([v.strictObject({"clock": v.literal("phase")}), number])})])}), number])})]), "min": number, "max": number})])}), v.strictObject({"of": v.tuple([v.strictObject({"wave": v.literal("phase"), "rate": number}), number, v.strictObject({"bounded": v.tuple([v.strictObject({"of": v.tuple([v.strictObject({"clock": v.literal("phase")}), number])})]), "max": number}), v.strictObject({"bounded": v.tuple([v.strictObject({"of": v.tuple([v.strictObject({"bounded": v.tuple([number, v.strictObject({"of": v.tuple([v.strictObject({"clock": v.literal("phase")}), number])})])}), number])})]), "min": number, "max": number})])})]), "when": v.strictObject({"mem": v.strictObject({"key": text, "atLeast": number})})}), v.strictObject({"sum": v.tuple([number, v.strictObject({"of": v.tuple([v.strictObject({"bounded": v.tuple([v.strictObject({"of": v.tuple([v.strictObject({"wave": v.literal("t"), "rate": number})])})]), "min": number}), number, v.strictObject({"mem": text})])})])})])}), v.strictObject({"bone": v.literal("flames"), "channel": v.literal("rotation.y"), "cases": v.tuple([v.strictObject({"sum": v.tuple([v.strictObject({"of": v.tuple([v.strictObject({"clock": v.literal("t")}), number])})])})])})]),
    CASTAWAY_SMOKE: v.strictObject({"count": number, "rise": number, "life": number, "rate": v.tuple([number, number]), "seedSpread": number, "reseed": number, "seed": number, "ease": number, "linear": number, "base": number, "lean": number, "wind": v.tuple([number, number]), "wanderX": v.tuple([number, number, number, number]), "wanderZ": v.tuple([number, number, number, number]), "size": v.tuple([number, number]), "fadeIn": number, "fadeOut": number, "fadePow": number, "thin": v.tuple([number, number, number]), "color": v.tuple([number, number, number]), "opacity": v.tuple([number, number]), "opacityFrom": number, "opacityTo": number, "bounds": v.strictObject({"offset": v.tuple([number, number, number]), "radius": number}), "renderOrder": number, "name": text}),
    COUNTER_TOP: v.strictObject({"w": number, "d": number, "y": number}),
    COVER_LOOKS: v.tuple([text, text, text, text, text, text, text, text, text, text, text, text, text]),
    CREATURE_LOOKS: v.strictObject({"body": text, "glowing": text, "captain": text}),
    FINALE_REWARD: v.strictObject({"x": number, "y": number, "z": number, "yaw": number, "pitch": number, "phase": number}),
    FIREFLY_LOOK: text,
    GULL_GRAPH_LOOK: text,
    ISLAND_LOOK: v.strictObject({"lod": number, "far": v.strictObject({"ratio": number, "error": number}), "coverDepth": number, "names": v.strictObject({"casterKinds": v.tuple([text, text, text]), "skip": text, "apart": text, "big": text}), "protoPrefix": text, "meshPrefix": text, "palmCell": number}),
    ISLAND_LOOKS: v.strictObject({"terrain": text, "props": text, "cover": text, "coverBig": text}),
    OCEAN_LOOK: text,
    POOL_LOOK: text,
    REEF_LOOK: text,
    REEF_ROCK: v.strictObject({"foot": text, "dark": text, "mid": text, "light": text, "edge": text, "warm": text, "cool": text, "crease": text, "moss": text, "mossLight": text, "mossDark": text, "wet": text}),
    SHORE_ROCK: v.strictObject({"foot": text, "dark": text, "mid": text, "light": text, "edge": text, "warm": text, "cool": text, "crease": text, "moss": text, "mossLight": text, "mossDark": text, "wet": text}),
    SHRINE_POOL_LOOK: text,
    SHRINE_SITES: v.strictObject({"world": v.strictObject({"x": number, "z": number, "rot": number}), "specimen": v.strictObject({"x": number, "z": number, "rot": number})}),
    SMOKE_LOOK: text,
    TRADER_FACING: v.strictObject({"range": number, "rate": number, "maxSpeed": number, "wrapTarget": v.boolean(), "wrapOutput": v.boolean()}),
    TRADER_HEAD_FOCUS: v.strictObject({"range": number, "yawLimit": number, "pitchLimit": number, "pitchScale": number, "eyeHeight": number, "minimumDistance": number, "response": v.literal("linear"), "rate": number, "clampAfterOffset": v.boolean(), "idle": v.strictObject({"cadence": v.strictObject({"kind": v.literal("sine"), "base": number, "frequency": number, "span": number}), "yaw": v.tuple([number, number]), "pitch": v.strictObject({"frequency": number, "threshold": number, "above": number, "below": number})})}),
    TRADER_POSE: v.tuple([v.strictObject({"bone": v.literal("figure"), "channel": v.literal("rotation.y"), "cases": v.tuple([v.strictObject({"sum": v.tuple([v.strictObject({"of": v.tuple([v.strictObject({"mem": text})])})])})])}), v.strictObject({"bone": v.literal("figure"), "channel": v.literal("rotation.z"), "cases": v.tuple([v.strictObject({"sum": v.tuple([v.strictObject({"of": v.tuple([v.strictObject({"wave": v.literal("t"), "rate": number}), number])})])})])}), v.strictObject({"bone": v.literal("figure"), "channel": v.literal("position.x"), "cases": v.tuple([v.strictObject({"sum": v.tuple([v.strictObject({"of": v.tuple([v.strictObject({"wave": v.literal("t"), "rate": number}), number])})])})])}), v.strictObject({"bone": v.literal("head"), "channel": v.literal("rotation.x"), "cases": v.tuple([v.strictObject({"sum": v.tuple([v.strictObject({"of": v.tuple([v.strictObject({"mem": text})])}), v.strictObject({"of": v.tuple([v.strictObject({"wave": v.literal("t"), "rate": number, "offset": number}), number])})])})])}), v.strictObject({"bone": v.literal("head"), "channel": v.literal("rotation.y"), "cases": v.tuple([v.strictObject({"sum": v.tuple([v.strictObject({"of": v.tuple([v.strictObject({"mem": text})])})])})])}), v.strictObject({"bone": v.literal("head"), "channel": v.literal("rotation.z"), "cases": v.tuple([v.strictObject({"sum": v.tuple([v.strictObject({"of": v.tuple([v.strictObject({"wave": v.literal("t"), "rate": number}), number])}), v.strictObject({"of": v.tuple([v.strictObject({"wave": v.literal("t"), "rate": number}), number])})])})])}), v.strictObject({"bone": v.literal("head"), "channel": v.literal("position.y"), "cases": v.tuple([v.strictObject({"sum": v.tuple([number, v.strictObject({"of": v.tuple([v.strictObject({"wave": v.literal("t"), "rate": number, "offset": number}), number])})])})])}), v.strictObject({"bone": v.literal("upper"), "channel": v.literal("rotation.x"), "cases": v.tuple([v.strictObject({"sum": v.tuple([v.strictObject({"of": v.tuple([number, v.strictObject({"mem": text})])})]), "when": v.strictObject({"mem": v.strictObject({"key": text, "atLeast": number})})}), v.strictObject({"sum": v.tuple([v.strictObject({"of": v.tuple([number, v.strictObject({"mem": text})])})]), "when": v.strictObject({"mem": v.strictObject({"key": text, "atLeast": number})})}), v.strictObject({"sum": v.tuple([v.strictObject({"of": v.tuple([number, v.strictObject({"mem": text})])})]), "when": v.strictObject({"mem": v.strictObject({"key": text, "atLeast": number})})}), v.strictObject({"sum": v.tuple([v.strictObject({"of": v.tuple([v.strictObject({"wave": v.literal("t"), "rate": number}), number])})])})])}), v.strictObject({"bone": v.literal("upper"), "channel": v.literal("rotation.z"), "cases": v.tuple([v.strictObject({"sum": v.tuple([number, v.strictObject({"of": v.tuple([number, v.strictObject({"mem": text})])})]), "when": v.strictObject({"mem": v.strictObject({"key": text, "atLeast": number})})}), v.strictObject({"sum": v.tuple([number, v.strictObject({"of": v.tuple([number, v.strictObject({"mem": text})])})]), "when": v.strictObject({"mem": v.strictObject({"key": text, "atLeast": number})})}), v.strictObject({"sum": v.tuple([number, v.strictObject({"of": v.tuple([number, v.strictObject({"mem": text})])})]), "when": v.strictObject({"mem": v.strictObject({"key": text, "atLeast": number})})}), v.strictObject({"sum": v.tuple([number])})])}), v.strictObject({"bone": v.literal("upper"), "channel": v.literal("rotation.y"), "cases": v.tuple([v.strictObject({"sum": v.tuple([v.strictObject({"of": v.tuple([number, v.strictObject({"mem": text})])})]), "when": v.strictObject({"mem": v.strictObject({"key": text, "atLeast": number})})}), v.strictObject({"sum": v.tuple([number]), "when": v.strictObject({"mem": v.strictObject({"key": text, "atLeast": number})})}), v.strictObject({"sum": v.tuple([v.strictObject({"of": v.tuple([number, v.strictObject({"mem": text})])})]), "when": v.strictObject({"mem": v.strictObject({"key": text, "atLeast": number})})}), v.strictObject({"sum": v.tuple([number])})])}), v.strictObject({"bone": v.literal("fore"), "channel": v.literal("rotation.x"), "cases": v.tuple([v.strictObject({"sum": v.tuple([number, v.strictObject({"of": v.tuple([number, v.strictObject({"mem": text})])})]), "when": v.strictObject({"mem": v.strictObject({"key": text, "atLeast": number})})}), v.strictObject({"sum": v.tuple([number, v.strictObject({"of": v.tuple([number, v.strictObject({"mem": text})])}), v.strictObject({"of": v.tuple([v.strictObject({"wave": v.literal("phase"), "rate": number}), number, v.strictObject({"mem": text})])})]), "when": v.strictObject({"mem": v.strictObject({"key": text, "atLeast": number})})}), v.strictObject({"sum": v.tuple([number, v.strictObject({"of": v.tuple([v.strictObject({"bounded": v.tuple([number, v.strictObject({"of": v.tuple([v.strictObject({"wave": v.literal("phase"), "rate": number}), number])})])}), number, v.strictObject({"mem": text})])})]), "when": v.strictObject({"mem": v.strictObject({"key": text, "atLeast": number})})}), v.strictObject({"sum": v.tuple([number])})])}), v.strictObject({"bone": v.literal("figure"), "channel": v.literal("rotation.x"), "cases": v.tuple([v.strictObject({"sum": v.tuple([number]), "when": v.strictObject({"mem": v.strictObject({"key": text, "atLeast": number})})}), v.strictObject({"sum": v.tuple([v.strictObject({"of": v.tuple([number, v.strictObject({"mem": text})])})]), "when": v.strictObject({"mem": v.strictObject({"key": text, "atLeast": number})})}), v.strictObject({"sum": v.tuple([number]), "when": v.strictObject({"mem": v.strictObject({"key": text, "atLeast": number})})}), v.strictObject({"sum": v.tuple([number])})])}), v.strictObject({"bone": v.literal("fore"), "channel": v.literal("rotation.y"), "cases": v.tuple([v.strictObject({"sum": v.tuple([number])})])}), v.strictObject({"bone": v.literal("fore"), "channel": v.literal("rotation.z"), "cases": v.tuple([v.strictObject({"sum": v.tuple([number])})])})]),
    TRAIL_SPECIMENS: v.strictObject({"fencePost": text, "two": text, "one": text, "three": text, "light": text, "dark": text}),
    TRAIL_SPECIMEN_ROWS: v.tuple([v.strictObject({"kind": v.literal("fence-post"), "id": v.literal("fencePost"), "params": v.strictObject({}), "size": v.tuple([number, number, number])}), v.strictObject({"kind": v.literal("signpost"), "id": v.literal("two"), "params": v.strictObject({"arrows": v.tuple([number, number]), "labels": v.tuple([text, text])}), "size": v.tuple([number, number, number])}), v.strictObject({"kind": v.literal("signpost"), "id": v.literal("one"), "params": v.strictObject({"arrows": v.tuple([number]), "labels": v.tuple([text])}), "size": v.tuple([number, number, number])}), v.strictObject({"kind": v.literal("signpost"), "id": v.literal("three"), "params": v.strictObject({"arrows": v.tuple([number, number, number]), "labels": v.tuple([text, text, text])}), "size": v.tuple([number, number, number])}), v.strictObject({"kind": v.literal("plank-step"), "id": v.literal("light"), "params": v.strictObject({"w": number, "roll": number, "yaw": number, "dark": v.boolean()}), "size": v.tuple([number, number, number])}), v.strictObject({"kind": v.literal("plank-step"), "id": v.literal("dark"), "params": v.strictObject({"w": number, "roll": number, "yaw": number, "dark": v.boolean()}), "size": v.tuple([number, number, number])})]),
    TROPHY_LAYOUT: v.strictObject({"ids": v.tuple([v.literal("bear"), v.literal("boar")]), "gap": number, "width": number, "height": number, "thickness": number, "mountY": number, "panelOffset": number}),
    WRECK_SITES: v.strictObject({"world": v.strictObject({"x": number, "z": number, "heading": number, "roll": number, "pitch": number, "floorY": number}), "specimen": v.strictObject({"x": number, "z": number, "heading": number, "roll": number, "pitch": number, "floorY": number})}),
    ZIPLINE_ROWS: v.strictObject({"world": text, "trolley": text, "specimen": text, "parked": text, "layout": v.strictObject({"top": v.strictObject({"x": number, "y": number, "z": number}), "bottom": v.strictObject({"x": number, "y": number, "z": number}), "sag": number, "prompt": v.strictObject({"x": number, "y": number, "z": number, "radius": number})}), "specimenLayout": v.strictObject({"top": v.strictObject({"x": number, "y": number, "z": number}), "bottom": v.strictObject({"x": number, "y": number, "z": number})})}),
    }),
    assembly: v.strictObject({ ocean: v.strictObject({ level: number, shallowColor: v.tuple([number, number, number]), deepColor: v.tuple([number, number, number]), deepDepth: number }),
      bridge: v.strictObject({ a: v.tuple([number, number]), b: v.tuple([number, number]), sag: number }),
      piers: v.pipe(v.array(v.strictObject({ id: text, label: text })), v.length(4)) }),
    fixedDraws: v.pipe(v.array(v.strictObject({ slot: text, file: text, channels: v.pipe(v.array(v.tuple([text, text])), v.maxLength(8)) })), v.length(90)),
    shadowTiers: v.strictObject({ phone: v.strictObject({ bush: v.boolean(), boulder: v.boolean() }), desktop: v.strictObject({ bush: v.boolean(), boulder: v.boolean() }) }),
    foliage: v.strictObject({ seed: natural, tiers: v.strictObject({ phone: foliageTier, desktop: foliageTier }), islandPalms: v.pipe(v.array(v.strictObject({ x: number, z: number, ...palm })), v.maxLength(64)) }),
    /** All seven authored pier collider sets, keyed to the exact primitive parameters. */
    piers: v.pipe(v.array(v.strictObject({ paramKey: v.pipe(v.string(), v.maxLength(4096)), colliders: v.pipe(v.array(v.variant('kind', [
      v.strictObject({ kind: v.literal('box'), x: number, y: number, z: number, hx: number, hy: number, hz: number, yaw: v.exactOptional(v.nullable(number)), rot: v.exactOptional(v.strictObject({ x: number, y: number, z: number, w: number })) }),
      v.strictObject({ kind: v.literal('hull'), x: number, y: number, z: number, points: v.pipe(v.array(number), v.maxLength(24)) }),
    ])), v.maxLength(128)) })), v.length(7)),
    npcScenes: v.strictObject({ castaway: npcScene, trader: npcScene }),
    gullPerches: v.pipe(v.array(point), v.maxLength(256)),
    boat: v.strictObject({ spec: v.strictObject({ x: number, z: number, heading: v.literal(0), waterY: number }), placement: point,
      walls: boxes, floors, cleats: v.tuple([number, number]),
      colliders: v.pipe(v.array(v.strictObject({ kind: v.literal('box'), x: number, y: number, z: number, hx: number, hy: number, hz: number })), v.length(5)) }),
    shoreBoulders: v.strictObject({
      placements: v.pipe(v.array(v.strictObject({ ...point.entries, yaw: number, leanX: number, leanZ: number, params: v.strictObject({ r: number, squash: number }) })), v.maxLength(512)),
      boxes: v.pipe(v.array(box), v.maxLength(512)),
    }),
    /** the sea cave's spec key, native colliders, anchors, stair descriptors, terrain cuts and reef-rock catalogue */
    cove,
    /** the shrine's two admitted sites (knoll and flat Explorer specimen): origin, colliders, stair descriptors, anchors, levels */
    shrine: v.strictObject({ world: shrineSite, specimen: shrineSite }),
    /** the trophy plaques' board, empty and full vertex ranges */
    hut: v.strictObject({ ...fixedSite, descs }),
    lookout: v.strictObject({ ...fixedSite, descs, zipTo: v.strictObject({ x: number, z: number }) }),
  }),
  /** the bag items, feats, owned perks and trader goods the kit registers (data/questInventory.ts, data/economy.ts) */
  /** the gull flock (data/gullsLook.ts GULL_FLOCK, @wildshard/sdk/looks/ambientFlock) */
  'custom/gullFlock': AmbientFlockSchema,
} as const;

const bridgeSpan = v.strictObject({ a: v.tuple([number, number]), b: v.tuple([number, number]), sag: number });
export const FILE_SCHEMAS = { 'data/bridgeRows.json': v.strictObject({ world: bridgeSpan, specimen: bridgeSpan }) };

/** Named world blobs share their build validator and generated runtime type. */
export const CoverCompositionSchema = v.strictObject({ name: text, placement: text, mesh: text, userData: v.record(text, v.boolean()) });

