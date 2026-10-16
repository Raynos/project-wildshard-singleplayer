/**
 * Pine Hollow's timber landmarks as rows (E315 M2; PINE-HOLLOW-REMASTER PH-B3, G465), on the cabins' timber kit
 * (../world/timber.ts): the fire lookout, the zipline landing and the creek footbridge. A row names its model and its pad
 * (m: its detail distance runs from its foot less that much, its size).
 *
 * THE FIRE LOOKOUT: four splayed
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
 * THE ZIPLINE LANDING: a 3 m deck on log posts over the N road, X-braced along the road's sides, a railing, the gantry with
 * the cable's anchor and the buffer block the trolley meets, and a stair down off its −X side with as many risers as the
 * ground asks. Its frame: local +Z faces up the cable; the origin on the ground. Placed once in the Hollow; its anchors
 * (`zipBottom`, `landing`) are the ride's.
 *
 * THE CREEK FOOTBRIDGE: two bark stringer logs, a split-plank deck, log trestles in the gully, cribbed abutments and a log
 * handrail. Its frame: along local X (the road), the origin midway between its ends. Placed once where the E road crosses
 * the creek.
 *
 * The landing and the bridge are fitted to their sites (posts, bracing, stair foot and trestles reach the ground), built
 * offline at the site and on the turntable (G285: ../generators/siteTimbers.ts, read through ../world/timberSites.ts).
 *
 *   await Promise.all([loadTimber(ctx), loadSiteTimbers(ctx)]);   // then place() is synchronous
 */
import * as v from 'valibot';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { timberModel } from '../world/timber';
import { BRIDGE_HALF, siteCopy, type TimberSite } from '../world/timberSites';
import { TIMBER_ROW } from '../../world/timberBake';
import lookoutJson from '../../data/lookout.json' with { type: 'json' };

const LOOKOUT_NAME = 'fire-lookout';

const num = v.pipe(v.number(), v.finite());
const LookoutRowsSchema = v.strictObject({ bin: v.string(), bytes: num, seed: num, ...TIMBER_ROW });
const LOOKOUT_ROWS = v.parse(LookoutRowsSchema, lookoutJson);

const ROWS = [
  { id: LOOKOUT_NAME, name: 'Fire lookout', pad: 6 }, { id: 'zipline-landing', name: 'Zipline landing', pad: 4 },
  { id: 'creek-footbridge', name: 'Creek footbridge', pad: BRIDGE_HALF },
] as const;
export interface TimberParams {
  /** the copy: fitted to its site in the world, or on the turntable's flat ground (the lookout has one copy) */
  readonly site: TimberSite;
}
type TimberId = (typeof ROWS)[number]['id'];
const models = new Map(ROWS.map((r): [TimberId, ModelDef<TimberParams>] => [r.id, defineModel<TimberParams>({
  id: `pine-hollow/${r.id}`, name: r.name, category: 'buildings', pipeline: 'code', file: 'src/shards/pine-hollow/runtime/models/fireLookout.ts', surface: 'wood',
  defaults: { site: 'turntable' },
  ...timberModel((p: TimberParams) => (r.id === LOOKOUT_NAME ? { identity: LOOKOUT_NAME, row: LOOKOUT_ROWS } : siteCopy(r.id, p.site)), r.pad),
})]));

/** A timber landmark's model; throws for one without a row. */
export function timberLandmark(id: TimberId): ModelDef<TimberParams> {
  const m = models.get(id);
  if (m === undefined) throw new Error(`[pine-hollow] no timber row for ${id}`);
  return m;
}
