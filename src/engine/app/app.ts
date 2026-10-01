import { RngService } from '../core/rng';
import type { Scene } from 'three';
import type { Game } from '../core/Game';
import type { Physics } from '../physics/Physics';
import type { Bodies } from '../physics/bodies';
import type { Navmesh } from '../physics/navmesh';
import type { WorldClock } from '../world/WorldClock';
import type { WorldRegistry } from '../world/registry';
import type { AimTarget } from '../player/AimTargets';
import type { Audio } from '../audio/Audio';
import { AppDebug, EveryFrameScheduler, PendingSaves, resolveGrade } from './services';
import { Events } from '../events/events';
import { GameClock } from '../core/clock';
import { AssetService } from './assets';
import { Scope } from './scope';
import { PHASES, sortSystems, type AppState, type Phase, type SystemSpec } from './systems';

interface StateHook { state: AppState; run: () => void }
export type SystemsByPhase = Readonly<Record<Phase, readonly SystemSpec[]>>;

export class App {
  private currentState: AppState = 'boot';
  private systems = new Map<string, SystemSpec>();
  private readonly systemScopes = new Map<string, Scope>();
  private enters = new Set<StateHook>();
  private exits = new Set<StateHook>();
  private transitioning = false;
  private transitions: AppState[] = [];
  readonly stateHistory: AppState[] = ['boot'];
  readonly events: Events;
  readonly engineScope = new Scope('engine');
  levelScope: Scope | null = null;
  private sorted: SystemsByPhase | null = null;
  readonly clock = new GameClock();
  readonly rng = new RngService();
  readonly assets = new AssetService();
  scene: Scene | null = null;
  render: Game | null = null;
  audio: Audio | null = null;
  unloadLevel(): void {
    if (!this.render) throw new Error('Render service is not installed');
    this.render.unloadLevel();
  }
  physics: Physics | null = null;
  bodies: Bodies | null = null;
  navmesh: Navmesh | null = null;
  navmeshId: string | null = null;
  dayCycle: WorldClock | null = null;
  aimTargets: readonly AimTarget[] = [];
  registryValue: WorldRegistry | null = null;
  registryFactory: (() => WorldRegistry) | null = null;
  get registry(): WorldRegistry {
    if (this.registryValue) return this.registryValue;
    if (!this.registryFactory) throw new Error('Registry service is not installed');
    this.registryValue = this.registryFactory();
    return this.registryValue;
  }
  readonly gradeFor = resolveGrade;
  readonly saves = new PendingSaves();
  readonly debug = new AppDebug();
  readonly scheduler = new EveryFrameScheduler();

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
        this.stateHistory.push(target);
        this.clock.paused = target === 'paused' || target === 'title' || target === 'loading' || target === 'boot' || target === 'error';
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
    this.systemScopes.set(system.id, scope);
    this.sorted = null;
    try { this.systemsByPhase(); } catch (error) { this.systems.delete(system.id); this.sorted = null; throw error; }
    scope.capture('systems', () => { this.systems.delete(system.id); this.systemScopes.delete(system.id); this.sorted = null; });
  }
  systemIds(scope: Scope): string[] { return [...this.systemScopes].filter(([, owner]) => owner.belongsTo(scope)).map(([id]) => id); }
  systemsByPhase(): SystemsByPhase {
    if (this.sorted) return this.sorted;
    const all = [...this.systems.values()];
    const result: Record<Phase, readonly SystemSpec[]> = {
      input: [], 'fixed.pre': [], 'fixed.step': [], 'fixed.post': [], update: [], late: [], render: [],
    };
    for (const phase of PHASES) result[phase] = sortSystems(all.filter((system) => system.phase === phase));
    this.sorted = result;
    return result;
  }
}
