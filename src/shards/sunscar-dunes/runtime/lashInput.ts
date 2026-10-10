import * as v from 'valibot';
import type { HeadlessRuntimeInstallation } from '@wildshard/sdk/headlessRuntime';

type InputCommands = ReturnType<HeadlessRuntimeInstallation['commands']>;

const State = v.strictObject({ version: v.literal(1), held: v.pipe(v.number(), v.finite(), v.minValue(0)), wasHeld: v.boolean(),
  target: v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(128))) });
/** Signal's held input is a continuation of the actual Bullwhip hold/release law, separate from its timed lashes. */
export class SignalLashInput {
  private readonly result = { released: false, target: null as string | null };
  private readonly inputOverflow = new RangeError('Signal whip input exceeds the admitted tick bound');
  private held = 0;
  private wasHeld = false;
  private target: string | null = null;
  /** The browser's charge ring saturates at one; releasing any hold still throws the double crack. */
  charge(duration: number): number { return Math.min(1, this.held / duration); }
  /** Sample the last authoritative player input once per tick. A disabled weapon drops the hold without releasing. */
  sample(dt: number, commands: InputCommands, enabled: boolean): { readonly released: boolean; readonly target: string | null } {
    this.result.released = false; this.result.target = null;
    if (!enabled) { this.held = 0; this.wasHeld = false; this.target = null; return this.result; }
    let held = false, target: string | null = null;
    if (commands.length > 1024) throw this.inputOverflow;
    for (let i = 0; i < 1024; i++) { const command = commands[i]; if (command === undefined) break;
      if (command.kind === 'player') { held = command.heavy !== undefined; target = command.heavy?.targetId ?? null; } }
    const released = this.wasHeld && !held, aim = released ? this.target : target;
    if (held) this.held += dt;
    else if (released) this.held = 0;
    this.wasHeld = held; this.target = held ? target : null;
    this.result.released = released; this.result.target = aim; return this.result;
  }
  /** Save the live hold, including its actual named aim, before a shipping-worker handoff. */
  snapshot(): string { return JSON.stringify({ version: 1, held: this.held, wasHeld: this.wasHeld, target: this.target }); }
  /** Restore quietly: no release, swing, flags or damage is produced while restoring. */
  restore(saved: string): void {
    const state = v.parse(State, JSON.parse(saved));
    if (!state.wasHeld && (state.held !== 0 || state.target !== null)) throw new Error('Invalid inactive Signal whip hold');
    this.held = state.held; this.wasHeld = state.wasHeld; this.target = state.target;
  }
}
