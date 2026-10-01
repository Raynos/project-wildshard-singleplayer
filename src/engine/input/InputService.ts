import type { Scope } from '../app/scope';
import type { EquipmentAction } from '../combat/Tool';
import type { InputContextDef } from '../level/context';
import type { DiscSpot, TouchRelabel } from '../ui/hudSlots';

export type Action = EquipmentAction | 'crouch' | 'crouch.hold' | 'sprint' | 'use'
  | 'move.forward' | 'move.back' | 'move.left' | 'move.right'
  | 'ride.whistle' | 'ride.offer' | 'ride.gallop' | 'ride.horseTab' | 'lean.left' | 'lean.right';
interface Context { def: InputContextDef; scope: Scope }
/** Additive contexts and a shared press buffer. Consuming a press removes it for every later system. */
export class InputService {
  private readonly definitions = new Map<string, Context>();
  private readonly stack: Context[] = [];
  private readonly pushed = new Map<string, () => void>();
  private readonly presses = new Map<Action, number>();
  private readonly down = new Set<Action>();
  private readonly ups = new Set<Action>();
  readonly buffer = { ms: 120 };
  private readonly now: () => number;
  private paint: ((labels: Partial<Record<DiscSpot, TouchRelabel>>) => void) | undefined;
  constructor(now: () => number) { this.now = now; }
  register(def: InputContextDef, scope: Scope): void {
    if (this.definitions.has(def.id)) throw new Error(`Duplicate input context: ${def.id}`);
    const entry = { def, scope }; this.definitions.set(def.id, entry);
    if (def.keys !== undefined && typeof document !== 'undefined') {
      const heldKeys = new Set<string>();
      const sample = (): void => {
        for (const [action, codes] of Object.entries(def.keys ?? {})) {
          this.setHeld(action as Action, this.stack.includes(entry) && codes.some((code) => heldKeys.has(code)));
        }
      };
      scope.listen(document, 'keydown', (event) => {
        if (!(event instanceof KeyboardEvent)) return;
        heldKeys.add(event.code); sample();
      });
      scope.listen(document, 'keyup', (event) => {
        if (!(event instanceof KeyboardEvent)) return;
        heldKeys.delete(event.code); sample();
      });
      scope.listen(window, 'blur', () => { heldKeys.clear(); sample(); });
      scope.onDispose(() => { heldKeys.clear(); sample(); });
    }
    scope.onDispose(() => { this.pop(def.id); this.definitions.delete(def.id); });
  }
  push(id: string, scope: Scope): void {
    const entry = this.definitions.get(id);
    if (entry === undefined) throw new Error(`Unknown input context: ${id}`);
    if (scope.disposed || this.stack.includes(entry)) return;
    this.stack.push(entry); this.repaint();
    this.pushed.set(id, scope.capture('disposers', () => { this.pop(id); }));
  }
  pop(id: string): void { const at = this.stack.findIndex((entry) => entry.def.id === id); if (at === -1) return; this.stack.splice(at, 1); this.pushed.get(id)?.(); this.pushed.delete(id); this.repaint(); }
  get top(): string { return this.stack.at(-1)?.def.id ?? ''; }
  private allowed(action: Action): boolean {
    for (const { def } of [...this.stack].reverse()) {
      if (def.enabled?.() === false) continue;
      if (Array.isArray(def.actions) && def.actions.includes(action)) return true;
      if (def.blocks === 'below' || def.blocks?.includes(action)) return false;
    }
    return true;
  }
  press(action: Action): void { this.presses.set(action, this.now()); }
  setHeld(action: Action, on: boolean): void {
    if (on && !this.down.has(action)) this.press(action);
    if (!on && this.down.has(action)) this.ups.add(action);
    if (on) this.down.add(action); else this.down.delete(action);
  }
  pressed(action: Action): boolean {
    const at = this.presses.get(action);
    if (at === undefined) return false;
    if (this.now() - at > this.buffer.ms) { this.presses.delete(action); return false; }
    return this.allowed(action);
  }
  held(action: Action): boolean { return this.allowed(action) && this.down.has(action); }
  released(action: Action): boolean { return this.allowed(action) && this.ups.has(action); }
  consume(action: Action): boolean { if (!this.pressed(action)) return false; this.presses.delete(action); return true; }
  clear(): void { this.presses.clear(); this.down.clear(); this.ups.clear(); }
  touchSink(paint: (labels: Partial<Record<DiscSpot, TouchRelabel>>) => void, scope: Scope): void {
    this.paint = paint; this.repaint(); scope.onDispose(() => { if (this.paint === paint) { paint({}); this.paint = undefined; } });
  }
  repaint(): void {
    const labels: Partial<Record<DiscSpot, TouchRelabel>> = {};
    for (const { def } of this.stack) if (def.enabled?.() !== false) Object.assign(labels, def.touch?.relabel);
    this.paint?.(labels);
  }
}
