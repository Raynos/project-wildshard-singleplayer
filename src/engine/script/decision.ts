import type { ScriptV1Command, ScriptV1CommandName, ScriptV1Event, ScriptV1EventName, ScriptV1ListName, ScriptV1ReadName } from '@wildshard/format/scriptAbiV1';

/** Resolved ids are produced from admitted rows, never looked up through a shard runtime module. */
export type DecisionIdKind = 'actors' | 'moves' | 'strikes' | 'timers' | 'cues' | 'fields' | 'flags' | 'zones' | 'spots' | 'targets' | 'spawns' | 'signals' | 'facts' | 'rewards' | 'channels' | 'impulses' | 'weather';
/** Durable numeric slots; JSON boolean values occupy f64 0/1 in the IO block. */
export interface DecisionStateSlot { name: string; type: 'bool' | 'i32' | 'f64'; default: number | boolean; scope: 'binding' | 'actor' | 'player'; min?: number; max?: number }
/** Renderer-free, resolved script declaration. Wire-schema admission remains the format's responsibility. */
export interface DecisionScript {
  id: string; module: string; side: 'sim' | 'view'; on: readonly ScriptV1EventName[]; tick: number | null;
  stateVersion: number; state: readonly DecisionStateSlot[]; params: Readonly<Record<string, number>>;
  ids: Readonly<Partial<Record<DecisionIdKind, Readonly<Record<string, number>>>>>;
  reads: readonly ScriptV1ReadName[]; lists: readonly ScriptV1ListName[]; commands: readonly ScriptV1CommandName[];
  onFail: 'hold' | 'reset' | 'skip';
}
/** Stable, numeric binding identity and its actor ownership. Instance seeds a fresh encounter stream. */
export interface DecisionBinding { id: number; script: string; self: number; actors: readonly number[]; instance: number }
/** Every query and transaction knows the trusted binding, not caller-supplied actor ownership. */
export interface DecisionContext { tick: number; binding: DecisionBinding; script: DecisionScript; observed: ReadonlySet<number> }
/** Validation is read-only; commit cannot fail and is invoked only after the complete call validates. */
export interface DecisionCommit { commit: () => void }
/** Engine adapters only. Shard-authored callbacks never cross this boundary. */
export interface DecisionWorld {
  read: (op: number, a: number, b: number, context: DecisionContext) => number;
  list: (op: number, a: number, b: number, output: Float64Array, context: DecisionContext) => number;
  prepare: (commands: readonly ScriptV1Command[], context: DecisionContext) => DecisionCommit;
  failed: (mode: DecisionScript['onFail'], context: DecisionContext, reason: string) => void;
}
/** Complete logical continuation; restoring it must not enter Wasm, including ws_init. */
export interface DecisionSnapshot {
  version: 1; tick: number;
  /** Validated at a decision tick, applied only by the next fixed step. Restore re-prepares without Wasm. */
  staged: readonly {
    binding: number; tick: number; observed: readonly number[]; commands: readonly ScriptV1Command[];
    slots: Readonly<Record<string, number | boolean>>; timers: Readonly<Record<string, number>>; rng: number; lastCall: number;
  }[];
  bindings: readonly {
    id: number; script: string; stateVersion: number; slots: Readonly<Record<string, number | boolean>>;
    timers: Readonly<Record<string, number>>; rng: number; failures: number; disabled: boolean;
    pending: readonly ScriptV1Event[]; lastCall: number | null;
  }[];
}
/** Trace observers are tooling ports and are absent from the allocation-free production hot path. */
export type DecisionTrace =
  | { kind: 'read'; tick: number; binding: number; op: number; a: number; b: number; result: number }
  | { kind: 'list'; tick: number; binding: number; op: number; a: number; b: number; result: readonly number[] }
  | { kind: 'call'; tick: number; binding: number; ok: boolean; fuel: number; reason: string | null;
      before: Readonly<Record<string, number | boolean>>; after: Readonly<Record<string, number | boolean>>; commands: readonly ScriptV1Command[] };
export interface DecisionMetrics { binding: number; calls: number; fuel: number; maxFuel: number; commands: number; refusals: number; carried: number; disabled: boolean }
/** Constructor contract for the real host. One module instance per hash, logical state per binding. */
export interface DecisionHostOptions {
  scripts: readonly DecisionScript[]; bindings: readonly DecisionBinding[]; modules: ReadonlyMap<string, Uint8Array>;
  seed: readonly [number, number]; world: DecisionWorld; trace?: (entry: DecisionTrace) => void;
  limits?: { fuelPerCall?: number; fuelPerTick?: number };
}
/** KA2 implements this interface. The scenario driver uses exactly the production scheduler and save path. */
export interface DecisionHost {
  enqueue: (binding: number, event: ScriptV1Event) => void;
  /** Consecutive 60 Hz ticks; tick zero is the initial state, so the first step is one. */
  step: (tick: number) => void;
  snapshot: () => DecisionSnapshot;
  /** Validate the complete snapshot before mutation. Re-prepare staged transactions; never execute Wasm. */
  restore: (snapshot: DecisionSnapshot) => void;
  state: (binding: number) => Readonly<Record<string, number | boolean>>;
  metrics: () => readonly DecisionMetrics[];
}
