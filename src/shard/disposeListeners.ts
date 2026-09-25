/**
 * An evicted shard's renderer must not outlive it (E159: "dispose everything … and memory drops").
 *
 * A WebGLRenderer hangs a `dispose` listener on every material, texture and geometry it uploads, so it can free its GPU
 * copy when the object is disposed. Objects a module caches for the page — the wind's shared depth material, a pickup's
 * orb texture, the fog's cloud texture in a uniform bag — are uploaded by every shard that draws them. When a shard is
 * evicted, those shared objects still hold its renderer's listener, and through the renderer its canvas and everything
 * the canvas's listeners close over: the whole evicted world (the heap snapshot of E159's first eviction test showed
 * exactly that chain: MeshDepthMaterial → _listeners.dispose → onMaterialDispose → the renderer → the Game).
 *
 * Disposing the shared objects would drop the resident shards' copies too (a re-upload, a program re-link: a stall).
 * Instead every `dispose` listener added while a shard is the current scope (src/core/shardScope.ts) is recorded against
 * that shard, and its eviction takes exactly those listeners off whatever objects are still alive — its renderer's, and
 * any its own code hung on a shared object. Records hold their objects weakly: an object dropped without a dispose
 * (garbage) is not kept alive by this.
 *
 *   trackDisposeListeners()        // once, before the first shard builds (the shard host)
 *   releaseDisposeListeners(scope) // on eviction
 */
import * as THREE from 'three';
import { currentScope, type ShardScope } from '../core/shardScope';

type Listener = (event: unknown) => void;
/** object → its `dispose` listeners that a shard added, and which shard */
const owned = new WeakMap<object, Map<Listener, ShardScope>>();
/** per shard: the objects it hung a listener on (weakly) */
const targets = new WeakMap<ShardScope, WeakRef<object>[]>();
let installed = false;
/** EventDispatcher's own removeEventListener, before the patch */
let removeOriginal: ((target: object, type: string, listener: Listener) => void) | null = null;

export function trackDisposeListeners(): void {
  if (installed) return;
  installed = true;
  const proto: object = THREE.EventDispatcher.prototype;
  const add: unknown = Reflect.get(proto, 'addEventListener'), remove: unknown = Reflect.get(proto, 'removeEventListener');
  if (typeof add !== 'function' || typeof remove !== 'function') return;
  const addFn = (target: object, type: string, listener: Listener): void => { Reflect.apply(add, target, [type, listener]); };
  const removeFn = (target: object, type: string, listener: Listener): void => { Reflect.apply(remove, target, [type, listener]); };
  removeOriginal = removeFn;
  function recordingAdd(this: object, type: string, listener: Listener): void {
    addFn(this, type, listener);
    const scope = type === 'dispose' ? currentScope() : null;
    if (scope === null) return;
    let m = owned.get(this);
    if (!m) { m = new Map(); owned.set(this, m); }
    if (m.has(listener)) return;
    m.set(listener, scope);
    let list = targets.get(scope);
    if (!list) { list = []; targets.set(scope, list); }
    list.push(new WeakRef(this));
  }
  function recordingRemove(this: object, type: string, listener: Listener): void {
    removeFn(this, type, listener);
    if (type === 'dispose') owned.get(this)?.delete(listener);
  }
  Object.defineProperty(proto, 'addEventListener', { configurable: true, writable: true, value: recordingAdd });
  Object.defineProperty(proto, 'removeEventListener', { configurable: true, writable: true, value: recordingRemove });
}

/** take every `dispose` listener `scope` added off the objects still alive (its eviction); returns how many */
export function releaseDisposeListeners(scope: ShardScope): number {
  const list = targets.get(scope), remove = removeOriginal;
  targets.delete(scope);
  if (!list || !remove) return 0;
  let n = 0;
  for (const ref of list) {
    const t = ref.deref();
    const m = t === undefined ? undefined : owned.get(t);
    if (t === undefined || !m) continue;
    for (const [fn, s] of m) {
      if (s !== scope) continue;
      remove(t, 'dispose', fn);
      m.delete(fn);
      n++;
    }
  }
  return n;
}
