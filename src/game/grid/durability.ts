import * as v from 'valibot';
import type { SaveStore, InstanceSaveSlot } from '@wildshard/engine/saves/store';
import type { SimHost } from '@wildshard/engine/sim';
import { serializeSimSnapshot, decodeSimSnapshot, type SimSnapshot } from '@wildshard/engine/sim/snapshot';
import { instanceSave, type LocalSaveInstance } from '../instanceSaves';
import { Ledger, installLedgerEmitter, type LedgerCatalogueItem, type LedgerEmitter } from '../ledger';
import type { QuestDataPorts } from '../quest/declared';
import type { Shardfile } from '../shardfile/schema';
import { GridWallet } from './wallet';

const schema = v.nullable(v.strictObject({ revision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  snapshot: v.pipe(v.string(), v.minLength(1), v.maxLength(128 * 1024 * 1024)) }));
type SavedRegion = v.InferOutput<typeof schema>;
const continuation = { key: 'platform.region', scope: 'shard' as const, version: 1, schema, initial: (): SavedRegion => null };

/** Durable local continuation and rewards for one stable placement; coordinates never enter a save key. */
export class GridRegionDurability {
  readonly wallet: GridWallet;
  readonly ledger: Ledger;
  readonly quest: QuestDataPorts;
  private readonly saved: InstanceSaveSlot<SavedRegion>;
  private readonly identity: { instance: string; shard: string; revision: number };
  private readonly source: Shardfile;
  private readonly emitters = new Map<string, LedgerEmitter>();

  constructor(store: SaveStore, placement: LocalSaveInstance, source: Shardfile, catalogue: readonly LedgerCatalogueItem[]) {
    this.source = source;
    this.identity = { instance: placement.id, shard: source.identity.slug, revision: source.identity.revision };
    this.saved = instanceSave(store, continuation, placement);
    this.wallet = new GridWallet(store, placement);
    this.ledger = new Ledger(store, [{ id: placement.id, shard: source.identity.slug }],
      [{ shard: source.identity.slug, revision: source.identity.revision, rules: source.ledger }], catalogue);
    this.quest = {
      fact: (name, entity) => {
        const emitter = this.emitters.get('quest.complete');
        if (emitter === undefined) throw new Error('Missing admitted regional quest provenance');
        emitter.emit(name, entity);
      },
      coins: (amount) => { this.wallet.addCoins(amount); },
    };
  }

  /** Install the same cursor adapters before restoring a host, so silent restore never repeats rewards. */
  bind(host: SimHost): void {
    this.emitters.clear();
    for (const rule of this.source.ledger) {
      if (!this.emitters.has(rule.origin.source)) this.emitters.set(rule.origin.source, installLedgerEmitter(host, this.ledger, this.identity, rule.origin));
    }
  }

  /** Refuse another revision or engine format instead of interpreting it as an empty region. */
  read(): SimSnapshot | undefined {
    const value = this.saved.read();
    if (value === null) return undefined;
    if (value.revision !== this.identity.revision) throw new Error('Regional continuation revision changed');
    const snapshot = decodeSimSnapshot(value.snapshot);
    if (snapshot.levelId !== this.identity.shard) throw new Error('Regional continuation belongs to another shard');
    return snapshot;
  }

  /** Retry both local and profile rewards; false holds the crossing in its current frame. */
  flush(): boolean {
    const local = this.wallet.flush(), profile = this.ledger.flush();
    return local && profile;
  }

  /** Persist the complete region only after its money and facts are durable; failed writes retain a retryable copy. */
  checkpoint(snapshot: SimSnapshot): boolean {
    if (snapshot.levelId !== this.identity.shard) throw new Error('Regional checkpoint belongs to another shard');
    if (!this.flush()) return false;
    return this.saved.write({ revision: this.identity.revision, snapshot: serializeSimSnapshot(snapshot) });
  }
}
