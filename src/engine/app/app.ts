import { Events } from '../events/events';
import type { GameClock } from '../core/clock';
import type { AssetService } from './assets';
import type { Scope } from './scope';
import { PHASES, sortSystems, type AppState, type Phase, type SystemSpec } from './systems';

interface StateHook { state: AppState; run: () => void }
export type SystemsByPhase = Readonly<Record<Phase, readonly SystemSpec[]>>;

export class App {
  private currentState: AppState = 'boot';
  private systems = new Map<string, SystemSpec>();
  private enters = new Set<StateHook>();
  private exits = new Set<StateHook>();
  private transitioning = false;
  private transitions: AppState[] = [];
  readonly events: Events;
  clock?: GameClock;
  assets?: AssetService;

  constructor(events = new Events()) { this.events = events; }
  get state(): AppState { return this.currentState; }

  setState(next: AppState): void {
    this.transitions.push(next);
    if (this.transitioning) return;
    this.transitioning = true;
    try {
      while (this.transitions.length > 0) {
        const target = this.transitions.shift();
        if (target === undefined || target === this.currentState) continue;
        const prev = this.currentState;
        const exits = [...this.exits];
        for (const hook of exits) if (hook.state === prev && this.exits.has(hook)) hook.run();
        this.currentState = target;
        const enters = [...this.enters];
        for (const hook of enters) if (hook.state === target && this.enters.has(hook)) hook.run();
        this.events.emit('app.state', { prev, next: target });
      }
    } finally { this.transitioning = false; this.transitions.length = 0; }
  }
  private hook(hooks: Set<StateHook>, state: AppState, fn: () => void, scope: Scope): void {
    if (scope.disposed) return;
    const hook = { state, run: fn };
    hooks.add(hook);
    scope.onDispose(() => { hooks.delete(hook); });
  }
  onEnter(state: AppState, fn: () => void, scope: Scope): void { this.hook(this.enters, state, fn, scope); }
  onExit(state: AppState, fn: () => void, scope: Scope): void { this.hook(this.exits, state, fn, scope); }

  addSystem(spec: SystemSpec, scope: Scope): void {
    if (scope.disposed) return;
    if (this.systems.has(spec.id)) throw new Error(`Duplicate system id: ${spec.id}`);
    // Copy the declarative ordering so a caller cannot change the validated graph later.
    const system = { ...spec, ...(spec.before ? { before: [...spec.before] } : {}),
      ...(spec.after ? { after: [...spec.after] } : {}) };
    this.systems.set(system.id, system);
    try { this.systemsByPhase(); } catch (error) { this.systems.delete(system.id); throw error; }
    scope.onDispose(() => { this.systems.delete(system.id); });
  }
  systemsByPhase(): SystemsByPhase {
    const all = [...this.systems.values()];
    const result: Record<Phase, readonly SystemSpec[]> = {
      input: [], 'fixed.pre': [], 'fixed.step': [], 'fixed.post': [], update: [], late: [], render: [],
    };
    for (const phase of PHASES) result[phase] = sortSystems(all.filter((system) => system.phase === phase));
    return result;
  }
}
