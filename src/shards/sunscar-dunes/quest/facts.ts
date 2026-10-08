import { Ledger, LedgerEmitter, type LedgerReceipt } from '@wildshard/game/ledger';
import type { parseLedgerRules } from '@wildshard/sdk/ledger';

type LedgerRule = ReturnType<typeof parseLedgerRules>[number];

/** Emit one declared fact for an entity; the platform ledger decides the grant. */
export type SignalFacts = (name: string, entity: string) => LedgerReceipt;

/**
 * The trusted runtime's fact port (SF14, SF50-p): Signal Dunes writes no progress for its feats; it emits the fact and the
 * platform ledger grants the profile achievement once per (shard, achievement), atomically with its dedupe record. The
 * instance is the first-party placement id (the slug: Select a shard, explore and the grid share it). No simulation host
 * runs this shard yet, so every fact is stamped tick 0 and told apart by its entity; a replayed or reloaded fact is the
 * same fact and grants nothing twice.
 */
export function signalFacts(store: ConstructorParameters<typeof Ledger>[0], identity: { readonly instance: string; readonly shard: string; readonly revision: number }, rules: readonly LedgerRule[]): SignalFacts {
  const ledger = new Ledger(store, [{ id: identity.instance, shard: identity.shard }], [{ shard: identity.shard, revision: identity.revision, rules }], []);
  return (name, entity) => {
    const rule = rules.find((row) => row.fact === name);
    if (rule === undefined) throw new Error(`Undeclared Signal Dunes fact ${name}`);
    // one cursor per emission: tick 0 and ordinal 0, so the fact's identity is (instance, shard, revision, entity)
    return new LedgerEmitter(ledger, { ...identity }, rule.origin, () => 0, []).emit(name, entity);
  };
}
