import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
/**
 * Pine Hollow's two site-fitted timber landmarks, the zipline landing and the creek footbridge (E315 M2; PH-B3), where
 * they stand and their offline bake (G285, SF72 "bake the code-built worlds"). Each is fitted to the ground under it: the
 * landing's posts and stair foot, the bridge's deck from bank to bank and its trestles down to the gully's floor. Their
 * builders run at build time (`../generators/siteTimbers.ts`, `src/shards/pine-hollow/generators/bake-pine-site-timbers.mjs`) over the page's own
 * baked terrain. The combined timber Scene emits admitted world tiles and an Explorer-only library; the fact rows
 * remain unchanged. The shared reader reconstructs each original draw before the native material/shadow finisher.
 */
import type { ModelContext } from '@wildshard/engine/models/model';
import { resourceScope } from '@wildshard/engine/app/resources';
import { readWholeGeometry, type WholeGeometryView } from '@wildshard/game/plugin/geometry';
import authored from '../../data/timberWorld.generated.json' with { type: 'json' };

/** the tower / landing turn: local −Z points from the lookout down the cable to the landing (the ride and the vista bench, PH-C1 / C8) */
export const ZIP_YAW = authored.placements.lookout.yaw;
const KEY = 'pine-hollow/timber:views';

/** Fetch the site timbers' bake into this shard's context (once). */
export async function loadSiteTimbers(ctx: ModelContext): Promise<Map<string, WholeGeometryView>> {
  const source = (await loadFirstPartyProduct('pine-hollow')).shardfile;
  if (source.props === null) throw new Error('[timber] missing admitted props');
  const refs = authored.shardfile.files.filter(file => file.kind === 'glb').map(file => file.hash);
  const pending = ctx.once(KEY, () => readWholeGeometry(resourceScope(), source,
    refs));
  const ready = await pending; ctx.once('pine-hollow/timber:ready', () => ready);
  return ready;
}
