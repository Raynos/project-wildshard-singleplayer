import * as v from 'valibot';
import type { SaveStore, InstanceSaveSlot } from '@wildshard/engine/saves/store';
import type { SimHost } from '@wildshard/engine/sim';
import { fnv1a32 } from '@wildshard/engine/core/rng';
import { serializeSimSnapshotSteps, finishSimSteps, decodeSimSnapshot, SnapshotBasisMismatchError, SIM_REGION_SNAPSHOT_CHAR_BUDGET, type SimSnapshot, type SimSnapshotBytes } from '@wildshard/engine/sim/snapshot';
import { instanceSave, type LocalSaveInstance } from '../instanceSaves';
import { Ledger, installLedgerEmitter, type LedgerCatalogueItem, type LedgerEmitter } from '../ledger';
import type { QuestDataPorts } from '../quest/declared';
import type { Shardfile } from '../shardfile/schema';
import { GridWallet } from './wallet';
import { ClientCheckpointSchema, clientStateFromRegion, restoreClientState, type ClientCheckpoint } from '../shardfile/clientState';
import type { ShardfileSimulation } from '../shardfile/simulation';

const schema = v.nullable(v.strictObject({ revision: v.pipe(v.number(), v.integer(), v.minValue(1)),
  snapshot: v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(128 * 1024 * 1024))), logical: v.optional(v.nullable(ClientCheckpointSchema), null),
  mode: v.optional(v.picklist(['exact', 'logical']), 'exact'),
  integrity: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffffff))) }));
type SavedRegion = v.InferOutput<typeof schema>;
const continuation = { key: 'platform.region', scope: 'shard' as const, version: 1, schema, initial: (): SavedRegion => null };
function regionIntegrity(value: NonNullable<SavedRegion>): number {
  return fnv1a32(JSON.stringify({ revision: value.revision, snapshot: value.snapshot, logical: value.logical, mode: value.mode }));
}
function storedCharacters(value: SavedRegion): number {
  return JSON.stringify({ keys: { [continuation.key]: { v: continuation.version, data: value } } }).length;
}

/** Durable local continuation and rewards for one stable placement; coordinates never enter a save key. */
export class GridRegionDurability {
  readonly wallet: GridWallet;
  readonly ledger: Ledger;
  readonly quest: QuestDataPorts;
  private readonly saved: InstanceSaveSlot<SavedRegion>;
  private readonly identity: { instance: string; shard: string; revision: number };
  private readonly source: Shardfile;
  private readonly emitters = new Map<string, LedgerEmitter>();
  private pendingLogical: ClientCheckpoint | null = null;
  private physicsBasis: Uint8Array | undefined;
  private colliders: ShardfileSimulation['colliders'] = new Map();
  private receipt: { mode: 'exact' | 'logical'; characters: number } | null = null;

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
  bind(host: SimHost, colliders: ShardfileSimulation['colliders'] = new Map()): void {
    this.colliders = colliders;
    this.emitters.clear();
    for (const rule of this.source.ledger) {
      if (!this.emitters.has(rule.origin.source)) this.emitters.set(rule.origin.source, installLedgerEmitter(host, this.ledger, this.identity, rule.origin));
    }
  }
  /** Own the freshly admitted immutable bodyless world bytes; a saved exact delta must match this basis. */
  setPhysicsBasis(bytes: Uint8Array): void { this.physicsBasis = bytes; }
  /** Release resident-only basis/ports when its world unloads; persisted progress remains readable on admission. */
  unbind(): void { this.physicsBasis = undefined; this.colliders = new Map(); this.emitters.clear(); }
  /** Last successful durable continuation path and complete region payload character count. */
  state(): { mode: 'exact' | 'logical'; characters: number } | null { return this.receipt === null ? null : { ...this.receipt }; }

  /** Keep exact-revision engine state; an older revision reserves portable progress for a freshly admitted simulation. Future revisions remain untouched. */
  read(allowLogical = false): SimSnapshot | undefined {
    this.pendingLogical = null;
    const value = this.saved.read();
    if (value === null) return undefined;
    if (value.integrity !== undefined && value.integrity !== regionIntegrity(value)) throw new Error('Regional continuation integrity mismatch');
    if (value.revision > this.identity.revision) throw new Error('Regional continuation is from a future revision');
    if (value.revision < this.identity.revision) {
      if (!allowLogical) throw new Error('Regional continuation requires logical migration');
      if (value.logical === null && value.snapshot === null) throw new Error('Missing regional progress');
      this.pendingLogical = value.logical ?? clientStateFromRegion(this.source, decodeSimSnapshot(value.snapshot, this.physicsBasis), value.revision, 1);
      return undefined;
    }
    if (value.mode === 'logical') {
      if (!allowLogical || value.logical === null || value.snapshot !== null) throw new Error('Regional continuation requires logical restore');
      this.pendingLogical = value.logical; return undefined;
    }
    if (value.snapshot === null) throw new Error('Missing exact regional continuation');
    try {
      const snapshot = decodeSimSnapshot(value.snapshot, this.physicsBasis);
      if (snapshot.levelId !== this.identity.shard) throw new Error('Regional continuation belongs to another shard');
      return snapshot;
    } catch (error) {
      // Only new sealed records can distinguish a validated platform basis change from damaged exact state.
      // Legacy unsealed deltas still require their original basis; no broad decode failure becomes a migration.
      if (!(error instanceof SnapshotBasisMismatchError) || !allowLogical || value.integrity === undefined
        || error.levelId !== this.identity.shard || value.logical?.version !== 2
        || value.logical.shard !== this.identity.shard || value.logical.revision !== this.identity.revision
        || value.logical.tick !== error.tick || value.logical.lane !== null) throw error;
      this.pendingLogical = value.logical;
      return undefined;
    }
  }
  /** Apply reserved logical progress after the new region's adapters and ledger are installed; false must abort admission without rewriting the old save. */
  restoreLogical(sim: ShardfileSimulation, items: Parameters<typeof restoreClientState>[2] = new Map()): boolean {
    if (this.pendingLogical === null) return true;
    if (!restoreClientState(this.source, sim, items, this.pendingLogical)) return false;
    this.pendingLogical = null; return true;
  }

  /** Retry both local and profile rewards; false holds the crossing in its current frame. */
  flush(): boolean {
    const local = this.wallet.flush(), profile = this.ledger.flush();
    return local && profile;
  }

  /** Persist the complete region only after its money and facts are durable; failed writes retain a retryable copy. */
  checkpoint(snapshot: SimSnapshot | SimSnapshotBytes): boolean { return finishSimSteps(this.checkpointSteps(snapshot)); }
  /** The same checkpoint in stages for a periodic autosave: each `yield` may wait a frame; the snapshot, basis and
   *  prop states are read before the first pause, and the save is written only in the last stage. */
  *checkpointSteps(snapshot: SimSnapshot | SimSnapshotBytes): Generator<undefined, boolean> {
    if (snapshot.levelId !== this.identity.shard) throw new Error('Regional checkpoint belongs to another shard');
    if (!this.flush()) return false;
    const logical = clientStateFromRegion(this.source, snapshot, this.identity.revision, this.source.state.version,
      Object.fromEntries([...this.colliders].map(([id, port]) => [id, port.active()])));
    const wire = yield* serializeSimSnapshotSteps(snapshot, this.physicsBasis);
    yield;
    if (!this.flush()) return false; // facts emitted while the stages waited are durable before the region is
    let value: SavedRegion = { revision: this.identity.revision, snapshot: wire, logical, mode: 'exact' };
    value.integrity = regionIntegrity(value);
    if (storedCharacters(value) > SIM_REGION_SNAPSHOT_CHAR_BUDGET) {
      value = { ...value, snapshot: null, mode: 'logical' };
      value.integrity = regionIntegrity(value);
    }
    const characters = storedCharacters(value);
    if (characters > SIM_REGION_SNAPSHOT_CHAR_BUDGET) throw new Error('Logical regional progress exceeds its durable character budget');
    const durable = this.saved.write(value);
    if (durable) this.receipt = { mode: value.mode, characters };
    return durable;
  }
}
