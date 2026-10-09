import { app } from '../app/runtime';
/**
 * The app's binding of the baked navmesh (SF72 split it from the renderer-free src/engine/physics/navmesh.ts, which holds
 * the format, the parse and the queries): the active level's navmesh, and its fetch in the `physics` step. Every navmesh
 * this loads reports its query cost to the perf meter (frameCost.nav).
 */
import { parseNavmesh, type Navmesh } from './navmesh';
import { navmeshUrl } from './navmeshUrl';
import { frameCost } from '../core/frameCost';

/** The loaded shard's navmesh — null before the `physics` step, for a shard the build has none for, or in node tests. */
export function activeNavmesh(): Navmesh | null { return app.navmesh; }

/** Set (or clear) the active navmesh — node tests, or a shard switch. */
export function setActiveNavmesh(levelId: string, navmesh: Navmesh | null): void { app.navmesh = navmesh; app.navmeshId = navmesh ? levelId : null; }

/**
 * Fetch and parse the level `levelId`'s navmesh and make it the active one (the `physics` step; the file is a declared boot file, so
 * the loading bar counts it and the service worker caches it). Resolves null — a warning, never a failure — when the
 * build has none or it doesn't parse: the creatures then steer as they did before the navmesh.
 */
export async function loadNavmesh(levelId: string): Promise<Navmesh | null> {
  if (app.navmeshId === levelId) return app.navmesh;
  const url = navmeshUrl(levelId);
  if (url === null) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    const navmesh = parseNavmesh(await res.arrayBuffer());
    if (navmesh === null) throw new Error('not a navmesh.bin of this version');
    navmesh.costSink = (ms) => frameCost.nav(ms);
    setActiveNavmesh(levelId, navmesh);
    return navmesh;
  } catch (e) {
    console.warn(`[navmesh] ${levelId}: not loaded (${(e as Error).message}); creatures steer without it`);
    return null;
  }
}
