/**
 * The fire pit and the porch lantern as rows (E315 M2, G465): CC0 scans each building dresses itself with (its materials
 * fixed, lit like the rest); the model is a copy at the origin of the first building's (../world/cabinKit.ts `dressedCopy`).
 */
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { dressedCopy } from '../world/cabinKit';

const ROWS = [{ key: 'firePitObj', id: 'stone-fire-pit', name: 'Stone fire pit' }, { key: 'lanternObj', id: 'porch-lantern', name: 'Porch lantern' }] as const;

/** What each building draws into its own root, with its model. */
export const DRAWN_INTO_MODELS: readonly (readonly [(typeof ROWS)[number]['key'], ModelDef<Record<string, never>>])[] = ROWS.map((r) => [r.key, defineModel({
  id: `pine-hollow/${r.id}`, name: r.name, category: 'props', pipeline: 'cc0', file: 'src/shards/pine-hollow/runtime/models/stoneFirePit.ts', defaults: {},
  build: (ctx) => dressedCopy(ctx, r.key),
})]);
