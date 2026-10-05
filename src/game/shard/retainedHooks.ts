import type { Scope } from '@wildshard/engine/app/scope';
import { currentOwner, withOwner } from '@wildshard/engine/app/ownership';
import type { ShardContext } from './context';
import { bindPlayerEffects } from '@wildshard/engine/combat/effects/EffectService';
import type { Vector3 } from 'three';

const enteredServices = new WeakMap<ShardContext, (install: (scope: Scope) => void) => void>();
const playerBindings = new WeakSet<ShardContext>();

/** Whether this trusted context retains its home resources while entered services are independently scoped. */
export function retainsRuntimeServices(context: ShardContext): boolean { return enteredServices.has(context); }

/** Keep status movement and damage attached to a retained home's player while shard callbacks come and go. */
export function installRetainedPlayerEffects(context: ShardContext, player: {
  movement: { effectMoveLocked: boolean; effectMoveScale: number }; position: () => Vector3;
}): void {
  if (!retainsRuntimeServices(context)) throw new Error('Player lifetime binding needs a retained context');
  if (playerBindings.has(context)) throw new Error('Player effects already bound');
  const target = context.app.player, effects = context.app.effects;
  if (target === null || effects === null) throw new Error('Player lifetime binding needs health and effects');
  bindPlayerEffects({ effects, target, movement: player.movement, combat: context.app.combat, position: player.position, scope: context.scope });
  context.app.events.on('player.died', ({ actor }) => {
    if (actor !== target) return;
    for (const effect of effects.active(target)) if (effect.def.tags.some((tag) => tag.startsWith('status.'))) effects.remove(target, effect.def.id);
  }, context.scope);
  playerBindings.add(context);
  context.scope.onDispose(() => { playerBindings.delete(context); });
}

/** Install a transient service for each home entry; ordinary staged contexts keep their original level scope. */
export function installEnteredRuntimeService(context: ShardContext, install: (scope: Scope) => void): void {
  if (context.scope.disposed) throw new Error('Trusted runtime is disposed');
  const entered = enteredServices.get(context);
  if (entered === undefined) install(context.scope); else entered(install);
}

/** Publish a trusted browser debug observer only during its cell entry, restoring the exact borrowed descriptor. */
export function installEnteredRuntimeObserver(context: ShardContext, name: string, observer: object): void {
  installEnteredRuntimeService(context, (scope) => {
    if (typeof window === 'undefined') throw new Error('Browser debug observer needs a window');
    const previous = Object.getOwnPropertyDescriptor(window, name);
    Object.defineProperty(window, name, { configurable: true, enumerable: previous?.enumerable ?? true, value: observer, writable: true });
    scope.onDispose(() => {
      if (previous === undefined) Reflect.deleteProperty(window, name);
      else Object.defineProperty(window, name, previous);
    });
  });
}

/** Reinstall entered callbacks while a borrowed home's models and authored state remain resident. */
export class RetainedRuntimeHooks {
  readonly context: ShardContext;
  private readonly resident: Scope;
  private readonly installers: ((scope: Scope) => void)[] = [];
  private entered: Scope | undefined;
  private generation = 0;

  constructor(base: ShardContext) {
    this.resident = base.scope;
    this.activate();
    const generation = this.generation;
    const register = (install: (scope: Scope) => void): void => {
      const owner = currentOwner(), entered = this.entered;
      // Existing callbacks re-enter their new owner. A yielded old hook has no such owner and cannot publish here.
      if (base.scope.disposed || entered === undefined || (generation !== this.generation
        && (owner === null || !owner.belongsTo(entered)))) throw new Error('Trusted callback registration left its cell');
      withOwner(entered, () => install(entered));
      this.installers.push(install);
    };
    this.context = { ...base, get progress() { return base.progress; },
      system: (spec) => { register((scope) => { base.app.addSystem(spec, scope); }); },
      on: (name, fn, options) => { register((scope) => { base.app.events.on(name, fn, scope, options); }); },
      answer: (name, fn, options) => { register((scope) => { base.app.events.answer(name, fn, scope, options); }); },
    };
    enteredServices.set(this.context, register);
    base.scope.onDispose(() => { enteredServices.delete(this.context); this.deactivate(); this.installers.length = 0; });
  }
  /** Publish each recorded callback in a fresh entered scope, once; failure rolls back every partial registration. */
  activate(): void {
    if (this.resident.disposed) throw new Error('Retained home is disposed');
    if (this.entered !== undefined) return;
    const scope = this.resident.child('runtime.entered');
    try {
      for (const install of this.installers) withOwner(scope, () => install(scope));
      this.entered = scope;
    } catch (error) { scope.dispose(); throw error; }
  }
  /** Remove every system/listener/answerer before another cell becomes active; resident geometry is untouched. */
  deactivate(): void {
    const scope = this.entered; if (scope === undefined) return;
    this.entered = undefined; this.generation++; scope.dispose();
  }
}
