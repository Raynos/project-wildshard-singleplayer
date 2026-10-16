import * as v from 'valibot';

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
const shrineSite = v.strictObject({ origin: point, colliders: boxes, descs: v.pipe(v.array(surfaced), v.maxLength(128)), anchors: v.record(text, anchor), baseY: number, waterY: number, terrace: number });
const trophySlots = v.strictObject({ ranges: runs, boards: runs, empty: v.strictObject({ bear: natural, boar: natural }), full: v.strictObject({ bear: natural, boar: natural }) });
const trailPoint = { x: number, y: number, z: number };
const trailGroup = <T extends v.GenericSchema>(pl: T) => v.strictObject({ pls: v.pipe(v.array(pl), v.maxLength(1024)), boxes: v.pipe(v.array(number), v.maxLength(16384)) });
const cove = v.strictObject({
  specKey: v.pipe(v.string(), v.maxLength(4096)),
  native: v.strictObject({ colliders: boxes, anchors: v.record(text, anchor), descs: v.pipe(v.array(surfaced), v.maxLength(128)),
    cuts: v.pipe(v.array(v.strictObject({ x: number, z: number, hw: number, hd: number, yaw: number, below: number })), v.maxLength(16)) }),
  catalogue: v.strictObject({ placements: v.pipe(v.array(v.strictObject({ x: number, y: number, z: number, params: v.strictObject({ r: number, squash: number, moss: number }) })), v.maxLength(512)),
    boxes: v.pipe(v.array(number), v.maxLength(8192)) }),
});
const icon = v.picklist(['rope', 'poi', 'laurel', 'seaglass', 'coin', 'check', 'sword', 'claw', 'coconut', 'meat', 'shell', 'hide']);
const feat = v.strictObject({ id: text, name: text, goal: text, count: natural, event: v.exactOptional(text), kind: v.exactOptional(text), title: text, icon });
const item = v.strictObject({ id: text, label: text, icon, travels: v.boolean() });
const modifier = v.strictObject({ attr: text, op: v.picklist(['add', 'mul', 'override']), value: number });
const effect = v.strictObject({ id: text, kind: v.literal('permanent'), tags: v.pipe(v.array(text), v.maxLength(32)), modifiers: v.pipe(v.array(modifier), v.maxLength(32)),
  grants: v.exactOptional(v.pipe(v.array(text), v.maxLength(32))), stacking: v.union([v.literal('none'), v.strictObject({ max: natural })]), group: v.exactOptional(text), removes: v.exactOptional(v.pipe(v.array(text), v.maxLength(32))) });
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
  /** the fixed models' baked layouts: the chime's draw slots, the hut's and the lookout's colliders, anchors and floors */
  'custom/fixedLayouts': v.strictObject({
    chimeSlots: runs,
    /** the sea cave's spec key, native colliders, anchors, stair descriptors, terrain cuts and reef-rock catalogue */
    cove,
    /** the shrine's two admitted sites (knoll and flat Explorer specimen): origin, colliders, stair descriptors, anchors, levels */
    shrine: v.strictObject({ world: shrineSite, specimen: shrineSite }),
    /** the trophy plaques' board, empty and full vertex ranges */
    trophySlots,
    hut: v.strictObject({ site, origin: point, floorY: number, colliders: boxes, descs, anchors: v.record(text, anchor),
      floor: v.strictObject({ cos: number, sin: number, lift: number, deck: v.strictObject({ w: number, d: number, z: number }), steps: v.strictObject({ z0: number, len: number, w: number }) }) }),
    lookout: v.strictObject({ site, zipTo: v.strictObject({ x: number, z: number }), origin: point, platformY: number, colliders: boxes, descs, anchors: v.record(text, anchor),
      floor: v.strictObject({ cos: number, sin: number, plat: number, h: number, stair: v.strictObject({ x0: number, len: number, w: number }) }) }),
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
  'custom/questRows': v.strictObject({ feats: v.pipe(v.array(feat), v.maxLength(128)), items: v.pipe(v.array(item), v.maxLength(128)), effects: v.pipe(v.array(effect), v.maxLength(128)), goods: v.pipe(v.array(good), v.maxLength(64)) }),
} as const;
