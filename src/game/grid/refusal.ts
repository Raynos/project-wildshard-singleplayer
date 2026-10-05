/**
 * What a shard that can't load shows (SHARD-PLATFORM SF58 (12), G167, `art/grid/round-18-refused-cell/board.jpg`): a cell
 * whose shard is refused (by memory admission, a validation / safety failure, a format it can't read or a load error) shows
 * **its frozen grey far view under a static dome** behind the soft wall (B); with no far view it falls back to **the empty
 * void and a "SHARD UNAVAILABLE" holo sign** with one reason line (A). SHARD SELECT shows that shard's **UNAVAILABLE card**.
 *
 * This module is the pure part: `classifyRefusal` maps the thrown admission error to a reason (or null: a cell that is only
 * waiting for M3, or a page tearing down, is not refused), `refusedLook` maps (reason, far view) to B or A, and
 * `ShardRefusals` remembers this session's refused slugs for SHARD SELECT. The soft wall still blocks entry either way.
 */
import * as v from 'valibot';
import { app } from '@wildshard/engine/app/runtime';
import { GAME_STRINGS } from '../strings';

/** Why a shard can't load: its format needs a newer client, it does not fit this device's budget, it failed a safety
 *  check (validation, caps, hashes, parsers), or its bytes did not arrive. */
export type ShardRefusal = 'upgrade' | 'too-big' | 'safety' | 'load';
const REFUSALS = ['upgrade', 'too-big', 'safety', 'load'] as const satisfies readonly ShardRefusal[];

/** Thrown by an admission that is not a refusal: the cell's shard is not a playable shardfile yet (it stays its far proxy
 *  behind the closed soft wall until M3). */
export class GridCellWaiting extends Error {
  override readonly name = 'GridCellWaiting';
}

// today's admission messages, until each thrower is typed (the M3 waits throw GridCellWaiting once liveSession adopts it)
const WAITING = /is not a shardfile shard|declares a hybrid runtime \(M3\)|disposed/u;
const UPGRADE = /needs a compatible client|needs a format version/u;
const TOO_BIG = /residency|shared budget|admission deferred|can be evicted|cache capacity exceeded/u;

/** The reason a failed admission refuses its shard, or null when the cell is only waiting (M3) or the page is closing. */
export function classifyRefusal(error: unknown): ShardRefusal | null {
  if (error instanceof GridCellWaiting) return null;
  if (error instanceof TypeError) return 'load'; // fetch rejects with a TypeError when the bytes can't arrive
  const message = error instanceof Error ? error.message : String(error);
  if (WAITING.test(message)) return null;
  if (UPGRADE.test(message)) return 'upgrade';
  if (TOO_BIG.test(message)) return 'too-big';
  return 'safety';
}

/** The one reason line, exactly as the board and the plan word it. */
export function refusalReason(refusal: ShardRefusal): string {
  const s = GAME_STRINGS.unavailable;
  return refusal === 'upgrade' ? s.upgrade : refusal === 'too-big' ? s.tooBig : refusal === 'safety' ? s.safety : s.load;
}

/** The cell's far view: drawn (resident in the rings), still on its way, or none (it failed, or the shard has none). */
export type FarViewStatus = 'resident' | 'loading' | 'none';
/** B: the far view frozen grey under a static dome; A: the void and the SHARD UNAVAILABLE sign. */
export type RefusedLook = 'frozen' | 'void';
/** G167: B when the far view is drawn, else A (a far view that arrives later turns A into B). Null: not refused. */
export function refusedLook(refusal: ShardRefusal | null, far: FarViewStatus): RefusedLook | null {
  if (refusal === null) return null;
  return far === 'resident' ? 'frozen' : 'void';
}

const schema: v.GenericSchema<unknown, Readonly<Record<string, ShardRefusal>>> = v.record(v.string(), v.picklist(REFUSALS));
/** the app's save store (src/engine/saves/store.ts) */
type Store = typeof app.saves;
/** This session's refused shards, for SHARD SELECT's UNAVAILABLE card. Session scope: a reload in the tab keeps the card,
 *  a fresh launch tries the shard again (a memory squeeze or a dropped connection is not forever). */
export interface ShardRefusals {
  note: (slug: string, refusal: ShardRefusal) => void;
  clear: (slug: string) => void;
  read: (slug: string) => ShardRefusal | null;
}
/** The injectable store lets a Node test run the real round trip. */
export function shardRefusals(store: Store): ShardRefusals {
  const slot = store.define({ key: 'shardRefusals', scope: 'session', version: 1, schema, initial: (): Readonly<Record<string, ShardRefusal>> => ({}) });
  return {
    note: (slug, refusal) => { const all = slot.read(); if (all[slug] !== refusal) slot.write({ ...all, [slug]: refusal }); },
    clear: (slug) => { const all = slot.read(); if (slug in all) slot.write(Object.fromEntries(Object.entries(all).filter(([key]) => key !== slug))); },
    read: (slug) => slot.read()[slug] ?? null,
  };
}
let page: ShardRefusals | null = null;
/** this page's refusals, on the app's save store (defined on first use) */
export function pageShardRefusals(): ShardRefusals {
  page ??= shardRefusals(app.saves);
  return page;
}
