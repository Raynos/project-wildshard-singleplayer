/** A shard change navigates to a fresh page. iOS Safari must release the old renderer and JS heap before the next boot. */
import { chunkUrl, findChunk } from '../shard/registry';
import { markUnload } from '#engine/boot/lastEnd';
import { setTitleArrival } from '#engine/boot/titleArrival';

export interface ShardRequest {
  /** into the world (ENTER WORLD) */
  enter?: boolean;
  /** into the Explore viewer's hub (EXPLORE WORLD) */
  explore?: boolean;
  /** into the shared HUD + Weapon Explorer practice room */
  arena?: boolean;
}
/** what the Debug card shows (Menu.ts): the resident shards, least → most recently used, and their estimated texture memory */
export interface ShardMemory { cap: number; shards: { slug: string; running: boolean; textureMB: number }[] }
interface Switcher { memory: () => ShardMemory }

let switcher: Switcher | null = null;
const ARENA_ARRIVAL = 'ws.shardArrival.arena';
/** A practice-room selection crosses a page navigation without a new URL switch. */
export function consumeArenaArrival(slug: string): boolean {
  try {
    const saved = sessionStorage.getItem(ARENA_ARRIVAL);
    sessionStorage.removeItem(ARENA_ARRIVAL);
    return saved === slug;
  } catch { return false; }
}

/** The Debug readout still uses the live host's memory numbers. */
export function setShardSwitcher(s: Switcher): void { switcher = s; }

export function requestShard(slug: string, req: ShardRequest = {}): void {
  if (!findChunk(slug)) return;
  setTitleArrival({ slug, mode: req.arena === true ? 'arena' : req.explore === true ? 'explore' : 'enter' });
  try {
    if (req.arena === true) sessionStorage.setItem(ARENA_ARRIVAL, slug);
    else sessionStorage.removeItem(ARENA_ARRIVAL);
  } catch { /* the target page opens on its title if session storage is unavailable */ }
  const u = new URL(chunkUrl(slug));
  for (const name of ['at', 'glreload', 'x', 'z', 'yaw', 'pitch', 'explore', 'cam', 'model', 'skipintro', 'tour', 'quest', 'drop']) u.searchParams.delete(name);
  if (req.explore === true) u.searchParams.set('explore', 'hub');
  markUnload(`shard switch to ${slug} (fresh page)`);
  // replace, not assign (NALATI-FINISH B8, E302): an assigned navigation parks the old shard's page in WebKit's
  // back/forward cache (pagehide `persisted`, measured in the iOS Simulator), its heap alive while the next shard boots on
  // top of it; a replaced one is torn down
  location.replace(u.toString());
}

/** the resident shards' memory (null without a host: a dev page) */
export function shardMemory(): ShardMemory | null { return switcher?.memory() ?? null; }
