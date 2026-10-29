/** A failed deployment-owned module or sheet, not an arbitrary application exception. */
export function staleChunkFailure(error: unknown, base: string): boolean {
  if (!(error instanceof Error)) return false;
  const module = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/iu.test(error.message);
  const stylesheet = /^(?:Stylesheet failed:|Unable to preload CSS for )/u.test(error.message);
  if (!module && !stylesheet) return false;
  const address = /(?:https?:\/\/[^\s"']+|\/assets\/[^\s"']+)/u.exec(error.message)?.[0];
  if (address === undefined) return module;
  try {
    const url = new URL(address, base);
    return url.origin === new URL(base).origin && /^\/assets\/[^/]+-[\w-]{8}\.(?:js|css)$/u.test(url.pathname);
  } catch { return false; }
}
export interface ChunkRecoveryPorts {
  readonly base: string;
  readonly runningBuild: string;
  readonly version: () => Promise<string | null>;
  readonly prepare: (build: string) => Promise<boolean>;
  readonly claimed: () => boolean;
  readonly claim: () => boolean;
  readonly reload: () => void;
}
/** Concurrent module/CSS failures share one bounded discovery and one durable reload claim. */
export function createChunkRecovery(ports: ChunkRecoveryPorts): (error: unknown) => Promise<boolean> {
  let pending: Promise<boolean> | undefined;
  const run = async (): Promise<boolean> => {
    try {
      const next = await ports.version();
      if (next === null || next === ports.runningBuild || ports.claimed() || !await ports.prepare(next) || !ports.claim()) return false;
      ports.reload(); return true;
    } catch { return false; }
  };
  function recover(failure: unknown): Promise<boolean> {
    if (ports.runningBuild === '' || ports.claimed() || !staleChunkFailure(failure, ports.base)) return Promise.resolve(false);
    pending ??= run().finally(() => { pending = undefined; });
    return pending;
  }
  return recover;
}
