import * as v from 'valibot';
import type { DialogueFlags } from '@wildshard/game/quest/dialogue';
import { RANGER, MILLER, TRADER } from '../quest/wardensHollow';
import { PineDialogue } from './dialogue';

const Wrapped = v.strictObject({ kind: v.picklist(['miller', 'trader']), reading: v.unknown() });
export type PinePersonKind = 'ranger' | 'miller' | 'trader';
interface Point { readonly x: number; readonly y: number; readonly z: number }
/** Capture stores prompt position separately from the actual speaker head: Mott's hatch offsets the former. */
export interface PinePersonSpot {
  readonly kind: PinePersonKind;
  readonly prompt: Point & { readonly radius: number };
  readonly at: Point;
}

/** One reading modal owns use input. NPC-specific completion effects are lent by the quest; cancelling or leaving range
 * never pays them. Closed/default-Hale continuation remains the existing shape. */
export class PinePeople {
  private readonly readings: Record<PinePersonKind, PineDialogue>;
  private current: PinePersonKind | null = null;
  constructor(flags: DialogueFlags, spots: readonly PinePersonSpot[], private readonly completed: (kind: PinePersonKind) => void) {
    if (spots.length !== 3) throw new RangeError('Pine has exactly three captured speakers');
    const reading = (kind: PinePersonKind, npc: typeof RANGER): PineDialogue => {
      const matches = spots.filter(spot => spot.kind === kind), spot = matches[0];
      if (matches.length !== 1 || spot === undefined || spot.prompt.radius <= 0
        || ![spot.at.x, spot.at.y, spot.at.z, spot.prompt.x, spot.prompt.y, spot.prompt.z, spot.prompt.radius].every(Number.isFinite)) throw new RangeError(`Missing captured Pine ${kind} prompt`);
      return new PineDialogue(flags, spot.at, spot.prompt.radius, npc);
    };
    this.readings = { ranger: reading('ranger', RANGER), miller: reading('miller', MILLER), trader: reading('trader', TRADER) };
  }
  get active(): boolean { return this.current !== null && this.readings[this.current].active; }
  press(kind: PinePersonKind): void {
    const selected = this.active ? this.current : kind;
    if (selected === null) throw new Error('Missing active Pine speaker');
    this.current = selected;
    const reading = this.readings[selected]; reading.use();
    if (!reading.active) { this.current = null; this.completed(selected); }
  }
  dismiss(): void { if (this.current !== null) this.readings[this.current].dismiss(); this.current = null; }
  advanceReading(dt: number, feet: Point): void {
    if (this.current === null) return;
    const reading = this.readings[this.current]; reading.step(dt, feet);
    if (!reading.active) this.current = null;
  }
  snapshot(): ReturnType<PineDialogue['snapshot']> | { kind: 'miller' | 'trader'; reading: ReturnType<PineDialogue['snapshot']> } {
    if (this.current === null) return null;
    const reading = this.readings[this.current].snapshot();
    return this.current === 'ranger' ? reading : { kind: this.current, reading };
  }
  prepareRestore(value: unknown): () => void {
    if (value === null) return () => { this.dismiss(); };
    const wrapped = v.safeParse(Wrapped, value), kind = wrapped.success ? wrapped.output.kind : 'ranger';
    const reading = wrapped.success ? wrapped.output.reading : value;
    if (reading === null) throw new RangeError('A saved Pine speaker must still be reading');
    const commit = this.readings[kind].prepareRestore(reading);
    return () => { this.dismiss(); commit(); this.current = kind; };
  }
}
