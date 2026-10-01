import * as v from 'valibot';
import { saves } from '../saves/runtime';
import type { Action } from './InputService';

const schema = v.record(v.string(), v.record(v.string(), v.array(v.string())));
const controls = saves.define({ key: 'controls', scope: 'global', version: 1, schema, initial: (): Record<string, Record<string, string[]>> => ({}) });
type Keys = Partial<Record<Action, readonly string[]>>;
/** Context-local overrides retain unmodified defaults and swap conflicts explicitly. */
export class Bindings {
  private readonly defaults = new Map<string, Keys>();
  private overrides = controls.read();
  private readonly changed: () => void;
  constructor(changed: () => void) { this.changed = changed; }
  define(context: string, keys: Keys): void { this.defaults.set(context, keys); }
  remove(context: string): void { this.defaults.delete(context); }
  keys(context: string): Keys { return { ...this.defaults.get(context), ...this.overrides[context] }; }
  entries(): readonly { context: string; action: Action; codes: readonly string[] }[] {
    return [...this.defaults.keys()].flatMap((context) => Object.entries(this.keys(context)).map(([action, codes]) => ({ context, action: action as Action, codes })));
  }
  conflict(context: string, action: Action, code: string): Action | undefined {
    return Object.entries(this.keys(context)).find(([other, codes]) => other !== action && codes.includes(code))?.[0] as Action | undefined;
  }
  rebind(context: string, action: Action, code: string, swap = false): Action | undefined {
    if (!this.defaults.has(context)) throw new Error(`Unknown binding context ${context}`);
    const conflict = this.conflict(context, action, code); if (conflict !== undefined && !swap) return conflict;
    const previous = this.keys(context)[action] ?? [], edits = { ...this.overrides[context], [action]: [code] };
    if (conflict !== undefined) edits[conflict] = [...previous];
    this.overrides = { ...this.overrides, [context]: edits }; controls.write(this.overrides); this.changed(); return undefined;
  }
  reset(): void { this.overrides = {}; controls.reset(); this.changed(); }
}
