import * as v from 'valibot';
import { test } from '@wildshard/engine/world/interact/flags';
import { parseQuestStepRows, type QuestStepRows } from '@wildshard/format/questSteps';

/** Existing owners supply facts; a signal never invents a death, pickup, dialogue completion or ride. */
export interface QuestStepSignal {
  readonly kind: 'talk' | 'kill' | 'collect' | 'deliver' | 'lead' | 'follow' | 'interact';
  readonly target: string;
}
interface GuardActor { readonly kind: string; readonly alive: boolean }
interface GuardRoster { readonly animals?: readonly GuardActor[] }
const isActorList = (value: readonly GuardActor[] | ReadonlyMap<string, GuardRoster>): value is readonly GuardActor[] => Array.isArray(value);
/** Declared seams. Inventory consumption must be atomic: false means no inventory mutation. */
export interface QuestStepPorts {
  readonly flags: { has: (flag: string) => boolean; set: (flag: string) => void; clear: (flag: string) => void };
  readonly position?: () => { readonly x: number; readonly z: number };
  readonly calls?: ReadonlyMap<string, (signal: QuestStepSignal | null) => void>;
  readonly inventory?: { add: (item: string, count: number) => void; take: (item: string, count: number) => boolean };
  readonly deliver?: ReadonlyMap<string, { readonly item: string; readonly count: number }>;
  readonly notice?: (text: string) => void;
  readonly actors?: readonly GuardActor[] | ReadonlyMap<string, GuardRoster> | (() => readonly GuardActor[] | undefined) | undefined;
}
/** Bounded quest step runner (G474). QuestState, flags and existing owner envelopes keep save authority.
 * Signals execute in authored order at the caller's original listener phase. update() is called by the existing
 * clock; the runner installs no scheduler, DOM, player driver or save slot. Wait progress is an explicit adapter.
 */
export class QuestStepRunner {
  readonly rows: QuestStepRows;
  private readonly waits = new Map<string, number>();
  constructor(input: unknown, private readonly ports: QuestStepPorts) {
    this.rows = parseQuestStepRows(input);
    for (const row of this.rows.steps) {
      if (row.kind === 'go-to' && ports.position === undefined) throw new Error('Quest go-to requires a position owner');
      if (row.kind === 'deliver' && (row.target === undefined || !ports.deliver?.has(row.target) || ports.inventory === undefined)) throw new Error('Quest delivery requires an inventory owner and offer');
      for (const effect of row.effects) {
        if (effect.kind === 'call' && !ports.calls?.has(effect.owner)) throw new Error(`Missing quest owner ${effect.owner}`);
        if (effect.kind === 'item' && ports.inventory === undefined) throw new Error('Quest grant requires an inventory owner');
        if (effect.kind === 'notice' && ports.notice === undefined) throw new Error('Quest notice requires a presentation owner');
      }
      if (row.kind === 'wait') this.waits.set(row.id, 0);
    }
    if (this.rows.guards.length > 0 && !Object.hasOwn(ports, 'actors')) throw new Error('Quest guards require a live actor owner');
    for (const offer of ports.deliver?.values() ?? []) if (!Number.isSafeInteger(offer.count) || offer.count <= 0) throw new Error('Invalid quest delivery count');
  }
  private enabled(row: QuestStepRows['steps'][number]): boolean {
    return (row.once === undefined || !this.ports.flags.has(row.once)) && test(this.ports.flags, row.when);
  }
  private run(row: QuestStepRows['steps'][number], signal: QuestStepSignal | null): void {
    if (row.once !== undefined) this.ports.flags.set(row.once);
    for (const effect of row.effects) {
      if (effect.kind === 'flag') { if (effect.value === false) this.ports.flags.clear(effect.flag); else this.ports.flags.set(effect.flag); }
      else if (effect.kind === 'item') this.ports.inventory?.add(effect.item, effect.count);
      else if (effect.kind === 'call') this.ports.calls?.get(effect.owner)?.(signal);
      else this.ports.notice?.(effect.text);
    }
  }
  /** A dialogue fires this only after reading completes; a lead fires it only at the actual end of its walk. */
  signal(signal: QuestStepSignal): void {
    for (const row of this.rows.steps) {
      if (row.kind !== signal.kind || row.target !== undefined && row.target !== signal.target || !this.enabled(row)) continue;
      if (row.kind === 'deliver') {
        const offer = this.ports.deliver?.get(signal.target);
        if (offer === undefined || this.ports.inventory?.take(offer.item, offer.count) !== true) continue;
      }
      this.run(row, signal);
    }
  }
  /** Read live actor state every time. A saved death flag is only the fallback when an actor roster is unavailable. */
  guard(id: string): string | null {
    const row = this.rows.guards.find(entry => entry.id === id);
    if (row === undefined) throw new Error(`Unknown quest guard ${id}`);
    const source = this.ports.actors, actors = typeof source === 'function' ? source() : source === undefined ? undefined
      : isActorList(source) ? source : source.get('actors')?.animals;
    return actors === undefined ? row.absentUnless !== undefined && this.ports.flags.has(row.absentUnless) ? null : row.message
      : actors.some(actor => actor.kind === row.actor && actor.alive) ? row.message : null;
  }
  /** Timers pause while their gates are false. Completed waits use their authored once flag for durable idempotence. */
  update(dt: number): void {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid quest step delta');
    for (const row of this.rows.steps) {
      if (!this.enabled(row)) continue;
      if (row.kind === 'go-to') {
        const point = this.ports.position?.();
        if (point !== undefined && Math.hypot(point.x - row.at.x, point.z - row.at.z) < row.radius) this.run(row, null);
      } else if (row.kind === 'wait') {
        const elapsed = (this.waits.get(row.id) ?? 0) + dt;
        this.waits.set(row.id, elapsed);
        if (elapsed >= row.seconds) this.run(row, null);
      }
    }
  }
  /** No added envelope when no wait is authored; legacy callers continue to persist their original flag/save bytes. */
  snapshot(): Record<string, number> { return Object.fromEntries(this.waits); }
  restore(value: unknown): void {
    const saved = v.parse(v.record(v.string(), v.pipe(v.number(), v.finite(), v.minValue(0))), value);
    if (Object.keys(saved).length !== this.waits.size || Object.keys(saved).some(id => !this.waits.has(id))) throw new Error('Invalid quest wait continuation');
    for (const [id, elapsed] of Object.entries(saved)) this.waits.set(id, elapsed);
  }
}
