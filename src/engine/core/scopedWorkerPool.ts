import { WorkerPool } from 'three/examples/jsm/utils/WorkerPool.js';
import type { Scope } from '../app/scope';
import { waitFor } from '../boot/waits';

const completedReply = (): undefined => undefined;

/** Keep Three's queue and concurrency, with explicit ownership of its worker message subscriptions. */
export class ScopedWorkerPool extends WorkerPool {
  private readonly scope: Scope;
  private readonly listeners = new Map<number, () => void>();

  constructor(scope: Scope, pool = 4) {
    super(pool);
    this.scope = scope;
    scope.onDispose(() => { this.dispose(); });
  }

  override postMessage(message: unknown, transfer?: Transferable[]): Promise<MessageEvent<unknown>> {
    return waitFor('Texture transcode worker', super.postMessage(message, transfer), 'worker');
  }

  override _onMessage(workerId: number, event: MessageEvent<unknown>): void {
    super._onMessage(workerId, event);
    // A queued successor replaces this slot; only an idle slot holds the
    // completed promise and its transferred texture reply unnecessarily.
    if ((this.workerStatus & (1 << workerId)) === 0) this.workersResolve[workerId] = completedReply;
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
