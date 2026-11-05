import * as v from 'valibot';
import { LedgerBookSchema, type LedgerBookSave } from '@wildshard/engine/net/ledgerBook';
import type { SaveKeyDef, SaveSlot, SaveStorage } from '@wildshard/engine/saves/store';
import { MAX_TICK_SNAPSHOT_CHARS } from '../tickProtocol';

/** One saved run: the sim's continuation and the receipts that go with it. */
export interface SavedContinuation { readonly tick: number; readonly snapshot: string; readonly ledger?: LedgerBookSave }
/** The continuation's save key. */
export const CONTINUATION: SaveKeyDef<SavedContinuation | null> = { key: 'continuation', scope: 'shard', version: 1, initial: () => null,
  schema: v.nullable(v.strictObject({ tick: v.pipe(v.number(), v.integer(), v.minValue(0)), snapshot: v.pipe(v.string(), v.maxLength(MAX_TICK_SNAPSHOT_CHARS)), ledger: v.exactOptional(LedgerBookSchema) })) };
/** A continuation gets its own documents: it is megabytes, and every other save write would rewrite it. Two, for the fallback. */
const documents = (slug: string): readonly [string, string] => [`standalone-${slug}`, `standalonealt-${slug}`];

/** A save that read back whole, and which document it came from. */
export interface ContinuationCandidate { readonly index: number; readonly saved: SavedContinuation }

/**
 * P1-E5.2c (J102): a corrupt save falls back without losing the last good one. A save goes to two documents in turn and never
 * to the one that last proved good, so a write that is torn, refused or bad leaves that one whole. Proved means restored from,
 * or written and acked durable. Boot tries the newest first and walks back; if a save reads but will not restore, its bytes
 * are set aside before anything can write over them, because that can as well be this build's fault as the save's.
 */
export class ContinuationSlots {
  private readonly slot: SaveSlot<SavedContinuation | null>;
  private readonly names: readonly [string, string];
  private readonly storage: SaveStorage;
  private readonly prefix: string;
  private good: number | null = null;
  private writing = 0;
  constructor(slot: SaveSlot<SavedContinuation | null>, slug: string, storage: SaveStorage, prefix: string) {
    this.slot = slot; this.names = documents(slug); this.storage = storage; this.prefix = prefix;
  }
  /** Every save that reads back, newest first. */
  candidates(): readonly ContinuationCandidate[] {
    return this.names.flatMap((name, index) => { const saved = this.slot.peek(name); return saved === null ? [] : [{ index, saved }]; }).sort((a, b) => b.saved.tick - a.saved.tick);
  }
  /** This one restored: it is now the save nothing may overwrite. */
  restored(candidate: ContinuationCandidate): void { this.good = candidate.index; }
  /** This one read back but would not restore. Keep its bytes where SaveStore keeps corrupt copies; the last such copy stands. */
  setAside(candidate: ContinuationCandidate): void {
    const key = `${this.prefix}${this.names[candidate.index] ?? ''}`, raw = this.storage.getItem(key);
    if (raw !== null) this.storage.setItem(`${key}.corrupt.restore`, raw);
  }
  /** Write a save to the document that is not the last good one. */
  write(saved: SavedContinuation): boolean {
    this.writing = this.good === 0 ? 1 : 0;
    return this.slot.write(saved, this.names[this.writing]);
  }
  /** The real storage answered for the last write: only a durable one replaces the last good save. */
  settled(durable: boolean): void { if (durable) this.good = this.writing; }
}
