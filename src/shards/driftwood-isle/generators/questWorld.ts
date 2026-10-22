import type { QuestWorldRows } from '@wildshard/format/questWorld';
import hut from '../data/hutBake.json' with { type: 'json' };
import lookout from '../data/lookoutBake.json' with { type: 'json' };
import shrine from '../data/shrineBake.json' with { type: 'json' };
import wreck from '../data/wreckBake.json' with { type: 'json' };
import cove from '../data/coveBake.json' with { type: 'json' };
import page from '../data/questPageComposition.json' with { type: 'json' };

interface Site { readonly origin: { readonly x: number; readonly y: number; readonly z: number }; readonly anchors: Readonly<Record<string, { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number }>> }
/** Match placeModelSite's exact translation and unchanged authored yaw.
 * These fixed facts never require constructing the world's meshes or colliders. */
export function driftwoodQuestWorld(): QuestWorldRows {
  const translated = (site: Site) => ({ anchors: Object.fromEntries(Object.entries(site.anchors).map(([id, at]) => [id,
    { x: at.x + site.origin.x, y: at.y + site.origin.y, z: at.z + site.origin.z, yaw: at.yaw }])) });
  return { id: page.world, pois: { hut: translated(hut), lookout: translated(lookout), wreck: { anchors: structuredClone(wreck.anchors) },
    shrine: translated(shrine.world), cave: { anchors: structuredClone(cove.native.anchors) } } };
}
