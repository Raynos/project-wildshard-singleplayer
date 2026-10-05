import type { Scope } from '@wildshard/engine/app/scope';
import type { ShardContext } from '@wildshard/game/shard/context';
import { installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';

/** Keep authored quest state resident, but recreate modal input and cancel timers at every home exit. */
export class PineQuestLifetime {
  private readonly retained: boolean;
  private readonly resident: Scope;
  private entered: Scope | undefined;
  constructor(private readonly context: ShardContext) {
    this.retained = retainsRuntimeServices(context);
    this.resident = context.scope;
    this.entered = this.resident;
    if (this.retained) installEnteredRuntimeService(context, (scope) => {
      this.entered = scope;
      scope.onDispose(() => { if (this.entered === scope) this.entered = undefined; });
    });
  }
  /** OFF constructs the original resident widget; retained mode constructs one widget per entry. */
  view<T>(name: string, create: (scope: Scope) => T): () => T {
    if (!this.retained) { const view = create(this.resident.child(name)); return () => view; }
    let current: T | undefined;
    installEnteredRuntimeService(this.context, (scope) => {
      const view = create(scope.child(name)); current = view;
      scope.onDispose(() => { if (current === view) current = undefined; });
    });
    return () => { if (current === undefined) throw new Error('Pine quest view left its cell'); return current; };
  }
  /** Wire the newly constructed widgets without rebuilding quest data or NPC figures. */
  enter(run: () => void): void {
    if (!this.retained) run(); else installEnteredRuntimeService(this.context, run);
  }
  leave(run: () => void): void {
    if (this.retained) installEnteredRuntimeService(this.context, (scope) => { scope.onDispose(run); });
  }
  /** Preserve the original OFF teardown order; entered views have already disposed when their cell left. */
  disposeLegacy(run: () => void): void { if (!this.retained) run(); }
  timeout(ms: number, run: () => void): ReturnType<Scope['timeout']> {
    const scope = this.entered;
    if (scope === undefined) throw new Error('Pine quest timer left its cell');
    return scope.timeout(ms, run);
  }
  cancelTimer(timer: ReturnType<typeof setTimeout> | 0): void { this.entered?.cancelTimer(timer); }
  /** The resident objective/caption keep their exact DOM insertion positions while hidden on the road. */
  retainRoot(root: HTMLElement, reset: () => void): void {
    if (!this.retained) return;
    const parent = root.parentNode, before = root.nextSibling;
    installEnteredRuntimeService(this.context, (scope) => {
      if (before?.parentNode === parent) before.before(root); else parent?.append(root);
      scope.onDispose(() => { reset(); root.remove(); });
    });
  }
}
