/** Decode one GLTF at a time. Explicit player demand can pass queued background
 * work, never the active decode; each class retains FIFO and failures release
 * the same single slot. Network reads and decoded ownership stay with callers. */
export class RigDecodeQueue {
  private readonly ordinary: (() => Promise<void>)[] = [];
  private readonly interactive: (() => Promise<void>)[] = [];
  private running = false;
  private scheduled = false;
  enqueue<T>(work: () => Promise<T>, priority: 'normal' | 'interactive' = 'normal'): Promise<T> {
    const result = new Promise<T>((resolve, reject) => {
      const run = async (): Promise<void> => {
        try { resolve(await work()); }
        catch (error: unknown) {
          // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- Forward the parser's exact callback rejection; do not replace its identity.
          reject(error);
        }
        finally { this.running = false; this.schedule(); }
      };
      (priority === 'interactive' ? this.interactive : this.ordinary).push(run);
    });
    this.schedule(); return result;
  }
  private schedule(): void {
    if (this.running || this.scheduled || this.ordinary.length + this.interactive.length === 0) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      const run = this.interactive.shift() ?? this.ordinary.shift();
      if (run === undefined) return;
      this.running = true; void run();
    });
  }
}
