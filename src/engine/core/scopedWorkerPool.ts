import { WorkerPool } from 'three/examples/jsm/utils/WorkerPool.js';
import type { Scope } from '../app/scope';

/** Keep Three's queue and concurrency, with explicit ownership of its worker message subscriptions. */
export class ScopedWorkerPool extends WorkerPool {
  private readonly scope: Scope;
  private readonly listeners = new Map<number, () => void>();

  constructor(scope: Scope, pool = 4) {
    super(pool);
    this.scope = scope;
    scope.onDispose(() => { this.dispose(); });
  }

  override _initWorker(workerId: number): void {
    if (this.scope.disposed) throw new Error('Worker pool owner is disposed');
    if (this.workers[workerId]) return;
    const worker = this.workerCreator();
    this.listeners.set(workerId, this.scope.listen(worker, 'message', (event) => { this._onMessage(workerId, event); }));
    this.workers[workerId] = worker;
  }

  override dispose(): void {
    for (const cancel of this.listeners.values()) cancel();
    this.listeners.clear();
    super.dispose();
  }
}
