import * as v from 'valibot';
import type { SaveStore, SaveSlot } from '@wildshard/engine/saves/store';
import type { SimHost, SimValue } from '@wildshard/engine/sim';
import { LedgerFactSchema, parseLedgerRules, type LedgerFact, type LedgerRule } from './shardfile/ledger';

const natural = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER));
const schema = v.strictObject({ facts: v.record(v.string(), LedgerFactSchema),
  items: v.record(v.string(), v.strictObject({ item: v.string(), tier: natural, quantity: natural })),
  achievements: v.record(v.string(), v.strictObject({ shard: v.string(), id: v.string(), title: v.string(), count: natural, threshold: natural, earned: v.boolean() })) });
type LedgerState = v.InferOutput<typeof schema>;
const definition = { key: 'platform.ledger', scope: 'profile' as const, version: 1, schema, initial: (): LedgerState => ({ facts: {}, items: {}, achievements: {} }) };

/** A placement identity remains stable when its cell changes; several instances may use one package. */
export interface LedgerInstance { id: string; shard: string; cell?: readonly [number, number] }
/** The platform admits catalogue items at capped power tiers, independently of author data. */
export interface LedgerCatalogueItem { id: string; maxTier: number }
/** A grant is confirmed only by a durable save write; a pending receipt may be retried. */
export interface LedgerReceipt { id: string; status: 'granted' | 'duplicate' | 'pending' }
/** Collision-free instance + package + revision + entity + tick + ordinal; relocation changes no key. */
export function ledgerFactId(fact: LedgerFact): string { return JSON.stringify([fact.instance, fact.shard, fact.revision, fact.entity, fact.tick, fact.ordinal]); }

/** Local ledger implementation: profile grants and their fact dedupe record share one atomic SaveStore write. */
export class Ledger {
  private readonly slot: SaveSlot<LedgerState>;
  private readonly instances: Map<string, string>;
  private readonly rules: Map<string, { revision: number; rule: LedgerRule }>;
  private readonly pending = new Set<string>();
  constructor(store: SaveStore, instances: readonly LedgerInstance[], mappings: readonly { shard: string; revision: number; rules: readonly LedgerRule[] }[], catalogue: readonly LedgerCatalogueItem[]) {
    this.instances = new Map(instances.map((instance) => [instance.id, instance.shard]));
    if (this.instances.size !== instances.length) throw new Error('Duplicate ledger instance');
    const items = new Map(catalogue.map((item) => [item.id, item.maxTier]));
    if (items.size !== catalogue.length || catalogue.some((item) => !Number.isSafeInteger(item.maxTier) || item.maxTier < 0)) throw new Error('Invalid platform catalogue');
    this.rules = new Map();
    for (const mapping of mappings) {
      if (!Number.isSafeInteger(mapping.revision) || mapping.revision < 1) throw new Error('Invalid ledger revision');
      for (const rule of parseLedgerRules(mapping.rules)) {
        const key = JSON.stringify([mapping.shard, mapping.revision, rule.fact]);
        if (this.rules.has(key)) throw new Error('Duplicate ledger mapping');
        for (const reward of rule.rewards) if (reward.kind === 'catalogue' && (items.get(reward.item) === undefined || reward.tier > (items.get(reward.item) ?? -1))) throw new Error('Reward is outside the platform catalogue');
        this.rules.set(key, { revision: mapping.revision, rule });
      }
    }
    this.slot = store.define(definition);
  }
  /** Includes pending in-memory saves, following SaveStore's offline fallback; receipts distinguish durability. */
  state(): LedgerState { return this.slot.read(); }
  record(input: LedgerFact): LedgerReceipt {
    const fact = v.parse(LedgerFactSchema, input), id = ledgerFactId(fact), mapping = this.rules.get(JSON.stringify([fact.shard, fact.revision, fact.name]));
    if (this.instances.get(fact.instance) !== fact.shard || mapping === undefined || mapping.revision !== fact.revision
      || mapping.rule.origin.kind !== fact.origin.kind || mapping.rule.origin.source !== fact.origin.source) throw new Error('Fact identity or provenance is not admitted');
    const state = this.slot.read(), prior = state.facts[id];
    if (prior !== undefined && (prior.name !== fact.name || prior.origin.kind !== fact.origin.kind || prior.origin.source !== fact.origin.source)) throw new Error('Fact identity reused for another outcome');
    if (prior === undefined) {
      for (const reward of mapping.rule.rewards) this.grant(state, fact.shard, reward);
      state.facts[id] = fact;
    }
    // A duplicate also retries the identical document: SaveStore may contain a failed-write memory fallback,
    // even when this Ledger was reconstructed against that same store without its original pending set.
    if (!this.slot.write(state)) { this.pending.add(id); return { id, status: 'pending' }; }
    const retried = this.pending.has(id); this.pending.clear();
    return { id, status: prior === undefined || retried ? 'granted' : 'duplicate' };
  }
  private grant(state: LedgerState, shard: string, reward: LedgerRule['rewards'][number]): void {
    if (reward.kind === 'catalogue') {
      const key = JSON.stringify([reward.item, reward.tier]), previous = state.items[key]?.quantity ?? 0;
      const quantity = previous + reward.quantity;
      if (!Number.isSafeInteger(quantity)) throw new RangeError('Catalogue quantity overflow');
      state.items[key] = { item: reward.item, tier: reward.tier, quantity };
      return;
    }
    const key = JSON.stringify([shard, reward.id]), current = state.achievements[key];
    if (current !== undefined && (current.title !== reward.title || current.threshold !== reward.threshold)) throw new Error('Achievement identity changed');
    const count = Math.min(reward.threshold, (current?.count ?? 0) + 1);
    state.achievements[key] = { shard, id: reward.id, title: reward.title, count, threshold: reward.threshold, earned: count === reward.threshold };
  }
  /** Retry all pending profile grants together without recomputing any reward. */
  flush(): boolean { if (this.pending.size === 0) return true; if (!this.slot.write(this.slot.read())) return false; this.pending.clear(); return true; }
}

/** Per-host fact cursor. The host supplies identity, tick and provenance; callers submit only an outcome and entity. */
export class LedgerEmitter {
  private tick = -1;
  private ordinal = 0;
  private readonly ledger: Ledger;
  private readonly identity: { instance: string; shard: string; revision: number };
  private readonly origin: LedgerFact['origin'];
  private readonly now: () => number;
  private readonly dedupe: string[];
  constructor(ledger: Ledger, identity: { instance: string; shard: string; revision: number }, origin: LedgerFact['origin'], now: () => number, dedupe: string[]) {
    this.ledger = ledger; this.identity = identity; this.origin = origin; this.now = now; this.dedupe = dedupe;
  }
  emit(name: string, entity: string): LedgerReceipt {
    const tick = this.now();
    if (tick !== this.tick) { this.tick = tick; this.ordinal = 0; }
    const fact = { ...this.identity, origin: this.origin, tick, ordinal: this.ordinal++, name, entity };
    const receipt = this.ledger.record(fact);
    if (!this.dedupe.includes(receipt.id)) this.dedupe.push(receipt.id);
    return receipt;
  }
  snapshot(): SimValue { return { tick: this.tick, ordinal: this.ordinal }; }
  restore(input: SimValue): void {
    const state = v.parse(v.strictObject({ tick: v.pipe(v.number(), v.integer(), v.minValue(-1), v.maxValue(Number.MAX_SAFE_INTEGER)), ordinal: natural }), input);
    this.tick = state.tick; this.ordinal = state.ordinal;
  }
}
/** Register the fact cursor with the same-engine snapshot host and retry failed durable writes in fixed steps. */
export function installLedgerEmitter(host: SimHost, ledger: Ledger, identity: { instance: string; shard: string; revision: number }, origin: LedgerFact['origin']): LedgerEmitter {
  const emitter = new LedgerEmitter(ledger, identity, origin, () => host.state.tick, host.slots.ledgerDedupe);
  host.onStep(`ledger.${origin.kind}.${origin.source}`, () => { ledger.flush(); }, { snapshot: () => emitter.snapshot(), restore: (state) => { emitter.restore(state); } });
  return emitter;
}
