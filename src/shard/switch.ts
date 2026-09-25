/**
 * Going to another shard (E155): the title deck's ENTER WORLD / EXPLORE WORLD on another shard's card and the complete
 * card's "Next shard" ask for it here. In the game the shard host (src/shard/ShardHost.ts) answers — a resident shard in
 * place, any other built in the page behind the loader. A page without a host (a dev entry) navigates, as every shard
 * change did before E155.
 *
 *   requestShard('pine-hollow', { enter: true })     // play it: straight in if it is resident, else its title once built
 *   requestShard('driftwood-isle', { explore: true }) // its EXPLORE WORLD hub
 *   shardResident('nalati-grasslands')                // in memory now (the deck's hint)
 */
import { chunkUrl } from '../chunks/registry';

export interface ShardRequest {
  /** into the world (ENTER WORLD) */
  enter?: boolean;
  /** into the Explore viewer's hub (EXPLORE WORLD) */
  explore?: boolean;
}
interface Switcher { go: (slug: string, req: ShardRequest) => void; resident: (slug: string) => boolean }

let switcher: Switcher | null = null;

/** the shard host takes the requests (main.ts, once) */
export function setShardSwitcher(s: Switcher): void { switcher = s; }

export function requestShard(slug: string, req: ShardRequest = {}): void {
  if (switcher) { switcher.go(slug, req); return; }
  const u = new URL(chunkUrl(slug));
  if (req.explore === true) u.searchParams.set('explore', 'hub');
  location.href = u.toString();
}

/** is `slug` in memory (switching to it is instant)? */
export function shardResident(slug: string): boolean { return switcher?.resident(slug) ?? false; }
