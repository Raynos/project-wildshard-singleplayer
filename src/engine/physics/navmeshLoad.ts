import { parseNavigation, readNavigation, type NavigationContent } from '@wildshard/format/navigation';
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
 * `bakedId` selects an authored offline folder; cache ownership remains the independent `levelId`.
 */
export async function loadNavmesh(levelId: string, bakedId = levelId, content?: NavigationContent): Promise<Navmesh | null> {
  if (content !== undefined) {
    const row = parseNavigation(content.row);
    const bytes = 'bytes' in content ? content.bytes : await fetch(content.url).then(async response => {
      if (!response.ok) throw new Error('Required navigation bytes are unavailable');
      return new Uint8Array(await response.arrayBuffer());
    });
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)));
    const hash = [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== row.file) throw new Error('Required navigation hash differs');
    readNavigation(row, bytes);
    const navmesh = parseNavmesh(Uint8Array.from(bytes).buffer);
    if (navmesh === null) throw new Error('Required navigation could not construct its query mesh');
    navmesh.costSink = ms => frameCost.nav(ms); setActiveNavmesh(levelId, navmesh); return navmesh;
  }
  if (app.navmeshId === levelId) return app.navmesh;
  const url = navmeshUrl(bakedId);
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
