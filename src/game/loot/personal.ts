import * as v from 'valibot';
import { WeightedTable } from '@wildshard/engine/ai/weighted';
import type { SimHost } from '@wildshard/engine/sim';
import { bountyKey } from './Bounty';
import { coinValue } from './coinAmounts';
import { readLootTables, type LootContext } from './tableRows';

/** What a personal roll needs of the shard. */
export interface PersonalLootPorts {
  /** A body's coins for one player's roll, off `next`: the page's table. */
  readonly coins: (kind: string, next: () => number) => number;
  /** File the grant in the tick's ledger effects, for this player alone. */
  readonly grant: (player: string, coins: number) => void;
}
const Economy: v.GenericSchema<unknown, { rows: { loot: { economy?: { tables?: unknown } | undefined }[] } }> = v.object({ rows: v.object({ loot: v.array(v.object({ economy: v.optional(v.object({ tables: v.optional(v.unknown()) })) })) }) });
/** A shard's coin roll, from its `economy/loot` rows: the table the page pays from. Null on a shard whose kills pay nothing. */
export function personalCoinTable(economy: unknown): PersonalLootPorts['coins'] | null {
  if (economy === undefined) return null;
  const tables = v.parse(Economy, economy).rows.loot[0]?.economy?.tables;
  const row = tables === undefined ? undefined : readLootTables(tables).find(entry => entry.domain === 'coins' || entry.id === 'coins');
  if (row === undefined) return null;
  const table = new WeightedTable<string, LootContext>(row.table);
  return (kind, next) => coinValue(table.roll({ kind }, next));
}
const paidKey = (player: string, key: string): string => `loot:${player}:${key}`;

/**
 * J105, M8: personal loot on the server. When a body dies in a room, everyone with meaningful damage (`DamageBook.meaningful`)
 * rolls for themselves, off the `loot` stream, and the grant goes through the tick's ledger effects and an event only they get.
 * Each player's bounty is its own: a slot pays them as many times as the shard started with it, counted in
 * `slots.ledgerDedupe`, so a replayed death grants nothing twice.
 *
 * Alone, this does nothing: a lone player's drops stay exactly what the page pays today, and a one-player save keeps its bytes.
 */
export function installPersonalLoot(host: SimHost, ports: PersonalLootPorts): void {
  const caps = new Map<string, number>();
  for (const body of host.entities.values()) { const key = bountyKey(body); caps.set(key, (caps.get(key) ?? 0) + 1); }
  const next = (): number => host.rng.stream('loot').next(), { ledgerDedupe } = host.slots;
  host.events.on('actor.died', ({ actor }) => {
    const body = host.entities.get(actor.id), rollers = host.damage.meaningful(actor.id);
    host.damage.forget(actor.id);
    if (body === undefined || host.players.size < 2) return;
    const key = bountyKey(body), cap = caps.get(key) ?? 1;
    for (const player of rollers) {
      const paid = paidKey(player, key);
      if (ledgerDedupe.filter(row => row === paid).length >= cap) continue;
      const coins = ports.coins(body.kind, next);
      if (coins <= 0) continue;
      ledgerDedupe.push(paid);
      ports.grant(player, coins);
      host.events.emit('reward.granted', { player, coins, body: actor.id });
    }
  }, host.scope);
}
