import * as v from 'valibot';
import { AmbientFlockSchema } from '@wildshard/format/ambientLife';

const text = v.pipe(v.string(), v.maxLength(512));
const number = v.number();
const natural = v.pipe(v.number(), v.integer(), v.minValue(0));
const run = v.strictObject({ start: natural, count: natural });
const runs = v.pipe(v.array(run), v.maxLength(512));
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
const trophySlots = v.strictObject({ ranges: runs, boards: runs, empty: v.strictObject({ bear: natural, boar: natural }), full: v.strictObject({ bear: natural, boar: natural }) });
const trailPoint = { x: number, y: number, z: number };
const trailGroup = <T extends v.GenericSchema>(pl: T) => v.strictObject({ pls: v.pipe(v.array(pl), v.maxLength(1024)), boxes: v.pipe(v.array(number), v.maxLength(16384)) });
const cove = v.strictObject({
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
const icon = v.picklist(['rope', 'poi', 'laurel', 'seaglass', 'coin', 'check', 'sword', 'claw', 'coconut', 'meat', 'shell', 'hide']);
const feat = v.strictObject({ id: text, name: text, goal: text, count: natural, event: v.exactOptional(text), kind: v.exactOptional(text), title: text, icon });
const item = v.strictObject({ id: text, label: text, icon, travels: v.boolean() });
const modifier = v.strictObject({ attr: text, op: v.picklist(['add', 'mul', 'override']), value: number });
const effectId = v.pipe(text, v.startsWith('effect.')) as v.GenericSchema<`effect.${string}`>;
const effectTag = v.pipe(text, v.includes('.')) as v.GenericSchema<`${string}.${string}`>;
const effect = v.strictObject({ id: effectId, kind: v.literal('permanent'), tags: v.pipe(v.array(effectTag), v.maxLength(32)), modifiers: v.pipe(v.array(modifier), v.maxLength(32)),
  grants: v.exactOptional(v.pipe(v.array(effectTag), v.maxLength(32))), stacking: v.union([v.literal('none'), v.strictObject({ max: natural })]), group: v.exactOptional(text), removes: v.exactOptional(v.pipe(v.array(effectId), v.maxLength(32))) });
const goodId = v.picklist(['whetstone-1', 'whetstone-2', 'heart-1', 'heart-2', 'sea-chart', 'cape']);
const good = v.strictObject({ id: goodId, name: text, does: text, icon: v.picklist(['whetstone', 'heart', 'chart', 'cape']), price: natural, needs: v.exactOptional(goodId) });

/** Product-owned logical names and the client's build-time rows (W2b, G449); runtime/ never imports data/. */
export const SECTIONS = {
  'custom/assets': v.strictObject({
    byUrl: v.record(v.pipe(v.string(), v.maxLength(512)), v.pipe(v.string(), v.maxLength(240))),
  }),
  /** the faceted sky's cumulus ring: rows `[x, y, z, r, puff, cluster, baseY]` (generators/cumulus.ts) */
  'custom/cumulusPuffs': v.pipe(v.array(v.pipe(v.array(number), v.length(7))), v.maxLength(1024)),
  /** the native terrain's retained index runs around the baked island (generators/islandClips.ts) */
  'custom/islandClips': v.strictObject({ sourceVertices: natural, sourceIndices: natural, outputIndices: natural, ranges: runs }),
  /** the fixed models' baked layouts: the chime's draw slots, the hut's, lookout's and shrine's colliders, anchors and floors */
  'custom/fixedLayouts': v.strictObject({
    chimeSlots: runs,
    gullPerches: v.pipe(v.array(point), v.maxLength(10)),
    /** the sea cave's spec key, native colliders, anchors, stair descriptors, terrain cuts and reef-rock catalogue */
    cove,
    /** the shrine's two admitted sites (knoll and flat Explorer specimen): origin, colliders, stair descriptors, anchors, levels */
    shrine: v.strictObject({ world: shrineSite, specimen: shrineSite }),
    /** the trophy plaques' board, empty and full vertex ranges */
    trophySlots,
    hut: v.strictObject({ ...fixedSite, descs }),
    lookout: v.strictObject({ ...fixedSite, descs, zipTo: v.strictObject({ x: number, z: number }) }),
  }),
  /** the trail weld's spec key, post / sign / plank placements, legacy boxes and native colliders (data/trailsideBake.json) */
  'custom/trailside': v.strictObject({
    specKey: v.pipe(v.string(), v.maxLength(4096)),
    posts: trailGroup(v.strictObject(trailPoint)),
    signs: trailGroup(v.strictObject({ ...trailPoint, params: v.strictObject({ arrows: v.pipe(v.array(number), v.maxLength(8)), labels: v.pipe(v.array(text), v.maxLength(8)) }) })),
    planks: trailGroup(v.strictObject({ ...trailPoint, params: v.strictObject({ w: number, roll: number, yaw: number, dark: v.boolean() }) })),
    colliders: v.pipe(v.array(box), v.maxLength(1024)),
    worldColliders: v.pipe(v.array(v.union([
      v.strictObject({ kind: v.literal('box'), x: number, y: number, z: number, hx: number, hy: number, hz: number, yaw: number }),
      v.strictObject({ kind: v.literal('box'), x: number, y: number, z: number, hx: number, hy: number, hz: number, rot: v.strictObject({ x: number, y: number, z: number, w: number }) }),
      v.strictObject({ kind: v.literal('treads'), from: point, to: point, width: number, count: natural }),
    ])), v.maxLength(1024)),
  }),
  /** the bag items, feats, owned perks and trader goods the kit registers (data/questInventory.ts, data/economy.ts) */
  /** the gull flock (data/gullsLook.ts GULL_FLOCK, @wildshard/sdk/looks/ambientFlock) */
  'custom/gullFlock': AmbientFlockSchema,
  'custom/questRows': v.strictObject({ feats: v.pipe(v.array(feat), v.maxLength(128)), items: v.pipe(v.array(item), v.maxLength(128)), effects: v.pipe(v.array(effect), v.maxLength(128)), goods: v.pipe(v.array(good), v.maxLength(64)) }),
} as const;

const placement = v.strictObject({
  enemies: v.pipe(v.array(v.strictObject({ kind: v.picklist(['crab', 'monkey', 'sailor']), variant: v.nullable(text),
    x: number, z: number, yaw: number, herd: number, practice: v.exactOptional(v.literal(true)) })), v.maxLength(64)),
  herds: natural, centres: v.pipe(v.array(v.strictObject({ x: number, z: number })), v.maxLength(16)),
  kinds: v.pipe(v.array(v.picklist(['crab', 'monkey'])), v.maxLength(16)),
  stream: v.strictObject({ version: v.literal(1), state: natural, initial: natural, scrambledFork: v.boolean() }),
});
/** Named offline spawn rows; all sampling runs only in the author compiler. */
export const EnemyPlacementsSchema = v.strictObject({ seed: natural,
  practice: v.strictObject({ x: number, z: number }), hold: v.strictObject({ x: number, z: number }),
  page: v.strictObject({ phone: placement, desktop: placement }), native: placement });
export type EnemyPlacements = v.InferOutput<typeof EnemyPlacementsSchema>;
