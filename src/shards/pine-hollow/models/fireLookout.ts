/**
 * The fire lookout (E315 M2; PINE-HOLLOW-REMASTER PH-B3), on the cabins' timber kit (../world/timber.ts): four splayed
 * peeled-log legs with girts and X-bracing, a stair of five flights inside a railed cage (treads the character climbs), a
 * 6 m deck with a railing, the glazed cab with a hipped moss roof, and the zipline's launch jutting off the deck. Its
 * frame: local −Z faces down the cable to the landing, local +X the trail's arrival (the stair's door); the origin on the
 * crag-top pad. Placed once on the Ridge (src/shards/pine-hollow/world/landmarks.ts), its anchors (`zipTop`, `launch`)
 * handed to the ride. One merged mesh per material; the detail set drops past the cabins' detail distance.
 *
 * Built offline (G285, SF72 "bake the code-built worlds"): `../generators/fireLookout.ts` (`src/shards/pine-hollow/generators/bake-pine-lookout.mjs`)
 * leaves the native fact records unchanged. The combined author Scene (generators/timberWorld.ts) emits charged tile
 * GLBs; the shared original-draw reader reconstructs their geometry before the native timber finisher applies materials.
 *
 *   await loadFireLookout(ctx);   // with loadTimber(ctx): place() is synchronous, the bake first
 */
import * as v from 'valibot';
import { defineModel, type ModelContext } from '@wildshard/engine/models/model';
import { timberFacts, timberMats } from '../world/timber';
import { TIMBER_ROW } from '../world/timberBake';
import { loadSiteTimbers, timberFromViews } from '../world/timberSites';
import lookoutJson from '../data/lookout.json' with { type: 'json' };

/** The retained native timber identity. */
export const LOOKOUT_NAME = 'fire-lookout';

const num = v.pipe(v.number(), v.finite());
export const LookoutRowsSchema = v.strictObject({ bin: v.string(), bytes: num, seed: num, ...TIMBER_ROW });
export type LookoutRows = v.InferOutput<typeof LookoutRowsSchema>;
/** the bake's rows, parsed strictly once */
export const LOOKOUT_ROWS: LookoutRows = v.parse(LookoutRowsSchema, lookoutJson);

/** Fetch the lookout's bake into this shard's context (once). */
export async function loadFireLookout(ctx: ModelContext): Promise<void> {
  await loadSiteTimbers(ctx);
}

const tower = timberFacts<Record<string, never>>((ctx) => {
  const t = timberFromViews(ctx, LOOKOUT_NAME, LOOKOUT_NAME, LOOKOUT_ROWS);
  t.finish(timberMats(ctx), 6); // its detail distance from the tower's foot less 6 m (its size)
  return t;
});

export const fireLookout = defineModel<Record<string, never>>({
  id: 'pine-hollow/fire-lookout', name: 'Fire lookout', category: 'buildings', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/fireLookout.ts', surface: 'wood',
  defaults: {},
  build: (ctx, p) => tower.build(ctx, p),
  colliders: (p, ctx) => tower.facts(ctx, p).colliders,
});

/** its deck floors and its anchors (`zipTop`: the cable's end, `launch`: where you stand to ride), own space */
export const fireLookoutFacts = tower.facts;
