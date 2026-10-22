import * as v from 'valibot';
import { TreeSetSchema } from '@wildshard/format/treeSetRows';
import rest from '../data/spruceRest.generated.json' with { type: 'json' };

// Spruce is stiff: ~0.35 m of sway at the top of an 18 m tree (painterly's sway is metres per metre² of height), the bark
// at 0.4 of it, and a warm rim on the sun side of the spires.
const SWAY = 0.0011;

/** Nalati's painterly Tian Shan spruce as tree set rows (G601 C5): bake-spruce.mjs's rest pool, four painterly surfaces. */
export const TREE_SET = v.parse(TreeSetSchema, {
  product: 'nalati-grasslands', set: 'nalati-spruce', geometry: { url: rest.geometry, parts: rest.parts, channels: [] },
  looks: { kind: 'painterly', bark: { rim: 0.15, bands: 0.8, sway: SWAY * 0.4 }, needles: { rim: 0.2, bands: 0.85, sway: SWAY },
    twigs: { rim: 0.1, bands: 0.85, sway: SWAY }, far: { rim: 0.25, bands: 0.7, sway: SWAY } },
  tintBark: true,
  model: { id: 'nalati-grasslands/spruce', name: 'Spruce', file: 'src/shards/nalati-grasslands/generators/spruceGeometry.ts' },
  variants: rest.variants.map((row, i) => ({ name: `spruce-${String(i)}`, label: `Spruce ${String(i + 1)}`, species: 'spruce', height: row.height, trunk: row.trunk, collider: 1 })),
});
