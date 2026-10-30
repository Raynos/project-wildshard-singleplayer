// oxlint-disable-next-line import/no-nodejs-modules -- The explicit author operation lends one snapshot factory across bundled helper copies.
import { AsyncLocalStorage } from 'node:async_hooks';
// oxlint-disable-next-line import/no-nodejs-modules -- Complete native comparison preserves the exact input even across an author bundle boundary.
import { Buffer } from 'node:buffer';
import { immutableAsset } from './assetHandle';

interface OwnedAsset { readonly bytes: Uint8Array; readonly hash: string }
type Factory = (input: Uint8Array) => OwnedAsset;
interface ScopePort { readonly current: () => Factory | undefined }
const slot = Symbol.for('wildshard.sdk.asset-owner.v1');
const scope = new AsyncLocalStorage<Factory>();
const port: ScopePort = Object.freeze({ current: (): Factory | undefined => scope.getStore() });
let active = 0;

function own(input: Uint8Array): OwnedAsset {
  const asset = immutableAsset(input);
  return { bytes: asset.copy(), hash: asset.hash };
}

/** Explicit author-only ownership scope; importing a module installs nothing.
 * Its frozen port exposes the active factory, never the private snapshot table.
 * Canonical format hash/verification functions do not consult this port. */
export async function withAssetOwner<T>(work: () => Promise<T>): Promise<T> {
  const present: unknown = Reflect.get(globalThis, slot);
  if (present !== undefined && present !== port) return work();
  if (present === undefined) Object.defineProperty(globalThis, slot, { value: port, configurable: true });
  active++;
  try { return await scope.run(own, work); }
  finally { if (--active === 0 && Reflect.get(globalThis, slot) === port) Reflect.deleteProperty(globalThis, slot); }

}

/** A bundled producer receives exact owned bytes and their identity from its
 * active CLI factory. Fresh contexts fall back to their own actual digest.
 * These metadata are not an admission capability: every validator uses its
 * private handle registry and checks complete current bytes independently. */
export function ownAssetBytes(input: Uint8Array): OwnedAsset {
  const activePort: unknown = Reflect.get(globalThis, slot);
  if (typeof activePort !== 'object' || activePort === null || !('current' in activePort) || typeof activePort.current !== 'function') return own(input);
  const current: unknown = Reflect.apply(activePort.current, activePort, []);
  if (typeof current !== 'function') return own(input);
  const result: unknown = Reflect.apply(current, undefined, [input]);
  if (typeof result !== 'object' || result === null || !('bytes' in result) || !(result.bytes instanceof Uint8Array) ||
    !('hash' in result) || typeof result.hash !== 'string' || !/^[a-f0-9]{64}$/u.test(result.hash) || Buffer.compare(input, result.bytes) !== 0)
    throw new Error('Author asset owner did not preserve its input bytes');
  // The factory's byte copy must own an ordinary buffer, not a concurrent shared view.
  if (!(result.bytes.buffer instanceof ArrayBuffer)) throw new Error('Author asset owner returned shared bytes');
  return { bytes: result.bytes, hash: result.hash };
}
