/**
 * The zipline landing (E315 M2; PINE-HOLLOW-REMASTER PH-B3), on the cabins' timber kit (../world/timber.ts): a 3 m deck on
 * log posts over the N road, X-braced along the road's sides, a railing, the gantry with the cable's anchor and the buffer
 * block the trolley meets, and a stair down off its −X side with as many risers as the ground asks. Its frame: local +Z
 * faces up the cable; the origin on the ground. Fitted to its site (its posts, bracing and stair foot reach the ground),
 * built offline at the site and on the turntable (G285: ../generators/siteTimbers.ts, read through ../world/timberSites.ts).
 * Placed once in the Hollow (src/shards/pine-hollow/world/landmarks.ts); its anchors (`zipBottom`, `landing`) are the ride's.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { timberFacts, timberMats } from '../world/timber';
import { LANDING, SITE_KEYS, siteTimber, type TimberSite } from '../world/timberSites';

export interface ZiplineLandingParams {
  /** the copy: fitted to its site in the world, or on the turntable's flat ground */
  readonly site: TimberSite;
}

const landing = timberFacts<ZiplineLandingParams>((ctx, p) => {
  const t = siteTimber(ctx, LANDING.name, p.site);
  t.finish(timberMats(ctx), 4);
  return t;
}, (p) => SITE_KEYS[p.site]);

export const ziplineLanding = defineModel<ZiplineLandingParams>({
  id: 'pine-hollow/zipline-landing', name: 'Zipline landing', category: 'buildings', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/ziplineLanding.ts', surface: 'wood',
  defaults: { site: 'turntable' },
  build: (ctx, p) => landing.build(ctx, p),
  colliders: (p, ctx) => landing.facts(ctx, p).colliders,
});

/** its deck floor and its anchors (`zipBottom`: the cable's end, `landing`: where the ride sets you down), own space */
export const ziplineLandingFacts = landing.facts;
