import type { Scope } from '@wildshard/engine/app/scope';

/** End an admission batch after a browser paint opportunity, so the road and G217 loading screen keep drawing.
 * Node has no presentation loop; cancellation rejects the pending batch before any further allocation. */
export function yieldGridAdmission(scope: Scope): Promise<void> {
  if (scope.disposed) return Promise.reject(new Error('Grid admission scope disposed'));
  if (typeof globalThis.requestAnimationFrame !== 'function') return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    let done = false;
    const forget = scope.capture('disposers', () => {
      if (done) return;
      done = true; reject(new Error('Grid admission scope disposed'));
    });
    scope.raf(() => { scope.timeout(0, () => {
      if (done) return;
      done = true; forget(); resolve();
    }); });
  });
}
