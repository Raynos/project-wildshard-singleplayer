import { isDev } from '@wildshard/engine/core/devMode';

/** Developer-only spans retain one result per product/step, including failed preparation. */
export async function timeClientPreparation<T>(slug: string, step: string, work: () => T | Promise<T>): Promise<T> {
  if (!isDev()) return work();
  const name = `wildshard.prepare:${slug}:${step}`, start = performance.now();
  try { return await work(); }
  finally {
    performance.clearMeasures(name);
    performance.measure(name, { start, end: performance.now() });
  }
}
