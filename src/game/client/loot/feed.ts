import { practiceRoomState as practiceRoom } from '@wildshard/engine/core/practiceRoomState';
import type { NetClient } from '@wildshard/engine/net/client';
import type { LevelContext } from '@wildshard/engine/level/context';
import { Bounty, type BountyTarget } from '../../shared/loot/Bounty';
import { DEATH_ORDER, onCreatureDeath, type CreatureDeathSource } from '../../shared/loot/deaths';
import { coinsFor, type LootGate } from './coins';

/** Coins that are this player's, and where they fell. */
export interface LootPayout { readonly at: { readonly x: number; readonly y: number; readonly z: number }; readonly coins: number }
/**
 * E6 COMBAT, J105: the one thing the loot's views ask of the world. Until the flip the feed is the page's own deaths and
 * bounty; a server's is its `reward` events, which are already this player's alone. A page has one feed, so a kill pays once.
 */
export interface LootFeed {
  /** Call for each payout; returns the unsubscribe. */
  readonly onPayout: (pay: (payout: LootPayout) => void) => () => void;
  /** What the shard's debug handle shows of the law behind this feed. */
  readonly debug: Readonly<Record<string, unknown>>;
}
type Body = CreatureDeathSource & BountyTarget & { readonly alive: boolean; readonly position: LootPayout['at'] };

/** The page's own payouts: each death it sees, against its saved bounty. The flip deletes this with `installLoot`'s page sim. */
export function pageLootFeed(ctx: Pick<LevelContext, 'on'>, manifest: LootGate & { slug: string }, animals: () => readonly Body[], lateKinds: readonly string[]): LootFeed {
  const census = Bounty.census(animals()), bounty = new Bounty(manifest.slug, census), pays = new Set<(payout: LootPayout) => void>();
  let fullClear = 0;
  for (const [key, n] of census) fullClear += n * coinsFor(manifest, key.split(':')[0] ?? key);
  for (const lone of lateKinds) if (!census.has(lone)) fullClear += coinsFor(manifest, lone);
  onCreatureDeath(ctx, animals, (body) => {
    if (pays.size === 0 || practiceRoom.open) return;
    const coins = coinsFor(manifest, body.kind);
    if (coins <= 0 || !bounty.claim(body)) return;
    for (const pay of pays) pay({ at: body.position, coins });
  }, DEATH_ORDER.loot);
  return { onPayout: pay => { pays.add(pay); return () => { pays.delete(pay); }; }, debug: { bounty, fullClear } };
}

/** The server's payouts to this client: a body's coins, where the client last drew it. */
export function netLootFeed(client: Pick<NetClient, 'onCombat' | 'fields' | 'latest'>): LootFeed {
  return { debug: {}, onPayout: pay => client.onCombat(event => {
    if (event.kind !== 'reward') return;
    const row = client.latest === null ? null : client.fields(client.latest, event.body), { x, y, z } = row ?? {};
    pay({ at: { x: typeof x === 'number' ? x : 0, y: typeof y === 'number' ? y : 0, z: typeof z === 'number' ? z : 0 }, coins: event.coins });
  }) };
}
