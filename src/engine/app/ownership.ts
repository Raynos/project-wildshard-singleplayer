import type { Scope } from './scope';

/** Explicit synchronous construction owner; callbacks re-enter their registering Scope. */
let owner: Scope | null = null;
/** How many `withOwner` sections are on the stack: 0 means the owner is the ambient one `enterOwner` left (an `await`
 *  continuation, a bare native callback). */
let entered = 0;
/** Owned async builds now pending (`ownerTask`), and what `ownerCensus` reports about ambient reads while one is. */
const tasks = new Set<{ scope: Scope }>();
const STRAY_KEEP = 8;
const census = { strayReads: 0, stacks: [] as string[] };
const loggedSites = new Set<string>();
const dev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;
/** One facade per (service, scope). */
const facades = new WeakMap<object, WeakMap<Scope, object>>();
export function currentOwner(): Scope | null {
  if (entered === 0 && tasks.size > 0) strayRead();
  return owner;
}
/** The owner an enclosing `withOwner` section set, or null when the owner is only the ambient one (an `await`
 *  continuation, a native callback). A service with a lifetime of its own (a region's registry) uses this to take its own
 *  scope instead of the page's ambient one; it is never a stray read (SF57). */
export function enteredOwner(): Scope | null { return entered > 0 ? owner : null; }
export function enterOwner(next: Scope | null): void { owner = next; }
export function withOwner<T>(scope: Scope | null, fn: () => T): T {
  const previous = owner; owner = scope; entered++;
  try { return fn(); } finally { owner = previous; entered--; }
}
export function asShell<T>(fn: () => T): T { return withOwner(null, fn); }
export function onOwnerDispose(fn: () => void): void { currentOwner()?.onDispose(fn); }

/**
 * SF57: an owner only lasts until the first `await` — `withOwner(scope, () => asyncBuild())` sets it for the synchronous
 * prefix, and every continuation runs under the ambient owner (the page's). Browsers have no hook into native `await`
 * continuations, so an asynchronous build carries its owner explicitly instead: the services it is handed are wrapped
 * with `ownedFacade`, and each call through them re-enters the build's scope. What a build registers after an `await`
 * through such a service (a quest card, a listener, a resource) then ends with the build, not with the page.
 *
 * Every method read through the facade runs under `withOwner(scope)`, with the real service as `this` (private fields
 * keep working). Plain data, class constructors and callables with their own `prototype` pass through untouched; nested
 * service objects are not wrapped (a facade is one level deep, by design: identity of nested objects is kept).
 */
export function ownedFacade<T extends object>(scope: Scope, service: T): T {
  let byScope = facades.get(service);
  if (byScope === undefined) { byScope = new WeakMap(); facades.set(service, byScope); }
  const known = byScope.get(scope); if (known !== undefined) return known as T;
  const wrapped = new WeakMap<object, unknown>();
  const facade = new Proxy(service, { get(target, key) {
    const value: unknown = Reflect.get(target, key, target);
    if (typeof value !== 'function' || Object.hasOwn(value, 'prototype')) return value;
    const method = value as (...args: unknown[]) => unknown;
    const cached = wrapped.get(method); if (cached !== undefined) return cached;
    const call = (...args: unknown[]): unknown => withOwner(scope, () => Reflect.apply(method, target, args));
    wrapped.set(method, call);
    return call;
  }, set(target, key, value: unknown) { return Reflect.set(target, key, value, target); } });
  byScope.set(scope, facade);
  return facade;
}

/**
 * An asynchronous build owned by `scope` (a resident shard's world / kit / play hook): `withOwner`, returning exactly what
 * `fn` returns. While its promise is pending, `ownerCensus()` counts ambient owner reads (a registration that would land
 * on the page scope instead of the build's) and keeps the newest few stacks, so a leak names its call site; dev builds
 * log each new site once.
 */
export function ownerTask<T>(scope: Scope, fn: () => T): T {
  const task = { scope };
  tasks.add(task);
  const settle = (): void => { tasks.delete(task); };
  let result: T;
  try { result = withOwner(scope, fn); } catch (error) { settle(); throw error; }
  // the caller gets the very promise the build returned (no extra ticks); the census entry ends on a side branch
  if (typeof result === 'object' && result !== null && typeof Reflect.get(result, 'then') === 'function') void Promise.resolve(result).then(settle, settle);
  else settle();
  return result;
}
function strayRead(): void {
  census.strayReads++;
  // a stack costs microseconds: the first 32 reads, then every 256th (a build can read the owner thousands of times)
  if (!dev && census.strayReads > 32 && census.strayReads % 256 !== 0) return;
  const stack = new Error('ambient owner read during an owned async build').stack ?? '';
  const site = stack.split('\n').slice(2, 4).join('\n');
  if (census.stacks.length >= STRAY_KEEP) census.stacks.shift();
  census.stacks.push(stack);
  if (dev && !loggedSites.has(site)) {
    loggedSites.add(site);
    console.warn(`[owner] a registration after an await saw the ambient owner (${owner?.name ?? 'none'}), not its build's; pass the build's scope or an ownedFacade.\n${site}`);
  }
}
/** Owned async builds pending now and the ambient owner reads seen while any was pending (SF57). */
export function ownerCensus(): { readonly pendingTasks: number; readonly strayReads: number; readonly stacks: readonly string[] } {
  return { pendingTasks: tasks.size, strayReads: census.strayReads, stacks: [...census.stacks] };
}
