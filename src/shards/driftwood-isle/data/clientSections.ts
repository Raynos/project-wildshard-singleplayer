import * as v from 'valibot';
import { defineSection, type DefinedSection } from '@wildshard/sdk/sections';
import cumulusPuffs from './cumulusPuffs.json' with { type: 'json' };
import islandClips from './islandClips.generated.json' with { type: 'json' };
import chimeSlots from './chimeSlots.json' with { type: 'json' };
import coveBake from './coveBake.json' with { type: 'json' };
import hut from './hutBake.json' with { type: 'json' };
import lookout from './lookoutBake.json' with { type: 'json' };
import { DRIFTWOOD_FEATS, DRIFTWOOD_ITEMS } from './questInventory';
import { DRIFTWOOD_EFFECTS, GOODS } from './economy';

// The same structure runtime/sections.ts reads (data/ cannot import runtime/); publication checks the emitted JSON
// against that runtime registry too, so the two cannot drift silently.
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

const CumulusPuffs = v.pipe(v.array(v.pipe(v.array(number), v.length(7))), v.maxLength(1024));
const IslandClips = v.strictObject({ sourceVertices: natural, sourceIndices: natural, outputIndices: natural, ranges: runs });
const FixedLayouts = v.strictObject({
  chimeSlots: runs,
  cove,
  hut: v.strictObject({ site, origin: point, floorY: number, colliders: boxes, descs, anchors: v.record(text, anchor),
    floor: v.strictObject({ cos: number, sin: number, lift: number, deck: v.strictObject({ w: number, d: number, z: number }), steps: v.strictObject({ z0: number, len: number, w: number }) }) }),
  lookout: v.strictObject({ site, zipTo: v.strictObject({ x: number, z: number }), origin: point, platformY: number, colliders: boxes, descs, anchors: v.record(text, anchor),
    floor: v.strictObject({ cos: number, sin: number, plat: number, h: number, stair: v.strictObject({ x0: number, len: number, w: number }) }) }),
});

/** Driftwood's client rows (W2b, G449), build-only: the runtime reads them from the product, never from data/. */
const QuestRows = v.strictObject({ feats: v.pipe(v.array(feat), v.maxLength(128)), items: v.pipe(v.array(item), v.maxLength(128)), effects: v.pipe(v.array(effect), v.maxLength(128)), goods: v.pipe(v.array(good), v.maxLength(64)) });

const section = (name: string, schema: v.GenericSchema, value: unknown): DefinedSection => defineSection(name, schema, v.parse(schema, value));
export const DRIFTWOOD_CLIENT_SECTIONS: readonly DefinedSection[] = [
  section('custom/cumulusPuffs', CumulusPuffs, cumulusPuffs),
  section('custom/islandClips', IslandClips, islandClips),
  section('custom/fixedLayouts', FixedLayouts, { chimeSlots, cove: coveBake, hut, lookout }),
  section('custom/questRows', QuestRows, { feats: DRIFTWOOD_FEATS, items: DRIFTWOOD_ITEMS, effects: DRIFTWOOD_EFFECTS, goods: GOODS }),
];
