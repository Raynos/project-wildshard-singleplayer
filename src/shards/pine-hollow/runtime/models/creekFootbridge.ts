/**
 * The creek footbridge (E315 M2; PINE-HOLLOW-REMASTER PH-B3), on the cabins' timber kit (../world/timber.ts): two bark
 * stringer logs, a split-plank deck, log trestles in the gully, cribbed abutments and a log handrail. Its frame: along
 * local X (the road), the origin midway between its ends. Fitted to its site (the deck runs from one bank to the other
 * and the trestles reach the gully's floor), built offline at the site and on the turntable (G285:
 * ../generators/siteTimbers.ts, read through ../world/timberSites.ts). Placed once where the E road crosses the creek
 * (src/shards/pine-hollow/world/landmarks.ts).
 */
import { defineModel } from '@wildshard/engine/models/model';
import { timberModel } from '../world/timber';
import { BRIDGE, BRIDGE_HALF, siteCopy, type TimberSite } from '../world/timberSites';

export interface CreekFootbridgeParams {
  /** the copy: fitted to its site in the world, or on the turntable (1.2 m over its gully) */
  readonly site: TimberSite;
}

export const creekFootbridge = defineModel<CreekFootbridgeParams>({
  id: 'pine-hollow/creek-footbridge', name: 'Creek footbridge', category: 'buildings', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/creekFootbridge.ts', surface: 'wood',
  defaults: { site: 'turntable' },
  ...timberModel((p: CreekFootbridgeParams) => siteCopy(BRIDGE.name, p.site), BRIDGE_HALF),
});
