import * as v from 'valibot';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import { FLAG } from '../data/flags';
import { brazierFlag } from '../quest/brazierFlag';

const saved = v.strictObject({ version: v.literal(1), raised: v.boolean(), fire: v.boolean(), braziers: v.array(v.strictObject({ oiled: v.boolean(), lit: v.boolean() })) });
/** Actual well, oil, waymark and signal-fire rules, independent of their meshes and prompts. */
export class SignalInteractions {
  readonly braziers: { oiled: boolean; lit: boolean }[];
  raised: boolean;
  fire = false;
  private readonly flags: Pick<Flags, 'has' | 'set'>;
  constructor(flags: Pick<Flags, 'has' | 'set'>, count: number) {
    this.flags = flags; this.raised = flags.has(FLAG.oil);
    this.braziers = Array.from({ length: count }, () => ({ oiled: false, lit: false }));
  }
  readLogbook(): boolean { if (this.flags.has(FLAG.logbook)) return false; this.flags.set(FLAG.logbook); return true; }
  pullWell(): boolean { if (this.raised) return false; this.raised = true; return true; }
  takeOil(): 'taken' | 'unraised' | 'already' {
    if (this.flags.has(FLAG.oil)) return 'already';
    if (!this.raised) return 'unraised';
    this.flags.set(FLAG.oil); return 'taken';
  }
  pour(index: number): 'poured' | 'missing' | 'already' {
    const brazier = this.at(index);
    if (brazier.lit) return 'already';
    if (!this.flags.has(FLAG.oil)) return 'missing';
    if (brazier.oiled) return 'already';
    brazier.oiled = true; return 'poured';
  }
  light(index: number, changed?: () => void): boolean {
    const brazier = this.at(index);
    if (brazier.lit || !brazier.oiled) return false;
    brazier.lit = true; changed?.(); this.flags.set(brazierFlag(index)); return true;
  }
  get allLit(): boolean { return this.braziers.every(brazier => brazier.lit); }
  lightFire(changed?: () => void): boolean {
    if (this.fire) return false;
    this.fire = true; changed?.(); this.flags.set(FLAG.lit); return true;
  }
  /** Transient oil/raised state belongs in exact continuation; durable completed flags remain in Flags. */
  snapshot(): string { return JSON.stringify({ version: 1, raised: this.raised, fire: this.fire, braziers: this.braziers }); }
  restore(input: string): void {
    const raw: unknown = JSON.parse(input), state = v.parse(saved, raw);
    if (state.braziers.length !== this.braziers.length || state.braziers.some(brazier => brazier.lit && !brazier.oiled)) throw new Error('Incompatible signal interaction state');
    this.raised = state.raised; this.fire = state.fire;
    state.braziers.forEach((brazier, index) => { Object.assign(this.at(index), brazier); });
  }
  private at(index: number): { oiled: boolean; lit: boolean } {
    const brazier = this.braziers[index]; if (brazier === undefined) throw new Error('Unknown signal brazier'); return brazier;
  }
}
