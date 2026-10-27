import { loadHeadlessProduct } from '../../src/sdk/headlessProduct';
import { builtProduct } from './builtProduct';

let pending: ReturnType<typeof loadHeadlessProduct> | undefined;

/** Use the normal build's complete verified output. Never invoke an author
 * program or admit a stale product as a test fallback. */
export function driftwoodEmittedProduct(): ReturnType<typeof loadHeadlessProduct> {
  pending ??= Promise.resolve().then(() => loadHeadlessProduct(builtProduct('driftwood-isle')));
  return pending;
}
