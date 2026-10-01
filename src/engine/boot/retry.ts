/** Retry an async module download after 800 ms and 2500 ms; preserve the final rejection.
 * A cached module evaluation error is rethrown by the module loader, without evaluating it again.
 * This leaf is also used before the engine and its scopes have loaded.
 */
export async function retried<T>(load: () => Promise<T>): Promise<T> {
  for (const wait of [800, 2500]) {
    try { return await load(); } catch {
      // oxlint-disable-next-line wildshard/no-global-listener-patch -- Pre-engine import retries await and consume each one-shot timer; this leaf must not import a Scope.
      await new Promise<void>((resolve) => { globalThis.setTimeout(resolve, wait); });
    }
  }
  return load();
}
