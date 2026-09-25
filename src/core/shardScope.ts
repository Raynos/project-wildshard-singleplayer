/**
 * What a resident shard owns in the page, so a parked one neither hears nor shows anything (SHARD-CACHE M1, E155).
 *
 * The game's code registers ~140 `document` / `window` listeners (keys, pointer lock, resize, the pause events …) and
 * appends its HUD, menus and canvas to `<body>`; none of it was written to be switched off. Rather than threading an
 * AbortSignal through every call, the page's own entry points are scoped:
 *
 *   - `document` / `window` `addEventListener` (installScopes): a listener added while a shard is the current scope is
 *     wrapped — it runs only while that shard is active, and the shard's eviction removes it. `once` means once while
 *     active. A listener added with no current scope (the shell: the loader, the service worker, the error modal,
 *     `asShell(…)`) is untouched.
 *   - `setInterval` / `setTimeout`: a timer started while a shard is current is the shard's; its eviction clears the ones
 *     still pending (a parked shard's keep running — the cheap ones: the frame meter's idle check, an ambience's next bird).
 *     A chain of timeouts (the island's surf scheduling its next swell) would otherwise hold an evicted world forever.
 *     The shell's own (the score's scheduler) start with `asShell`.
 *   - `<body>`'s children: an element appended while a shard is current belongs to it (a MutationObserver, flushed
 *     synchronously at every scope change so the attribution is exact). Parking a shard swaps each of its elements for a
 *     comment where it stood; activating swaps them back, in place (the stacking order is the same). The shell's own
 *     overlays (the loader, the resume screen, the rotate gate, the error / update / boot-settings panels) never belong
 *     to a shard.
 *
 * A single-shard session has one scope, always active: every wrapped listener runs, nothing is swapped.
 */

interface Reg { target: EventTarget; type: string; fn: EventListener; capture: boolean; listener: object; key: string }

export class ShardScope {
  /** true while this shard is the one running (or being built): its listeners fire */
  active = true;
  readonly regs: Reg[] = [];
  /** body children this shard appended, each with the comment that holds its place while parked */
  readonly nodes = new Map<Element, Comment | null>();
  /** intervals and pending timeouts it started (cleared on eviction) */
  readonly intervals = new Set<number>();
  readonly timeouts = new Set<number>();
  /** run on eviction (shell-level registrations the shard made: settings listeners …) */
  readonly disposers: (() => void)[] = [];
  // a plain field, not a constructor parameter property: node's type stripping loads this module for the boot-pack bake
  // (scripts/bake-packs.mjs, run by every vite build) and cannot parse parameter properties — the bake failed, every pack
  // part 404'd and the phones booted file by file
  readonly slug: string;
  constructor(slug: string) { this.slug = slug; }
}

/** the shell's overlays: never a shard's, whatever was current when they were appended */
const SHELL = '.ws-load, .ws-resume, .ws-rotate, .ws-update, .ws-reload, #wserr, #wserr-chip, #wsstuck, [data-ws-shell], [data-shell]';

let current: ShardScope | null = null;
let observer: MutationObserver | null = null;
let installed = false;
let clearIntervalNow: (id: number) => void = (id) => { clearInterval(id); };
type AddFn = (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => void;
type RemoveFn = (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) => void;
const origRemove = new Map<EventTarget, RemoveFn>();
/** listener → its wrappers, by `type|capture` (the DOM keys a listener the same way) and by scope (a module-level
 *  handler two shards both add is two registrations, one per shard) */
const wrappers = new WeakMap<object, Map<string, Map<ShardScope, EventListener>>>();

/** the scope a registration made now belongs to (null: the shell) */
export function currentScope(): ShardScope | null { return current; }

/** make `s` the current scope (the shard being built or the running one; null = the shell) */
export function enterScope(s: ShardScope | null): void {
  flush();
  current = s;
}

/** run `fn` as scope `s` (a timer's handler, as the shard that started the timer) */
function runAs(s: ShardScope, fn: () => void): void {
  const prev = current;
  if (prev === s) { fn(); return; }
  enterScope(s);
  try { fn(); } finally { enterScope(prev); }
}

/** run `fn` as the shell: what it registers or appends is never a shard's */
export function asShell<T>(fn: () => T): T {
  const prev = current;
  enterScope(null);
  try { return fn(); } finally { enterScope(prev); }
}

/** a shell-level registration a shard made (a settings listener): undone when the shard is evicted */
export function onScopeDispose(fn: () => void): void { current?.disposers.push(fn); }

const keyOf = (type: string, options?: boolean | EventListenerOptions): string => `${type}|${String(typeof options === 'boolean' ? options : options?.capture === true)}`;

function scopeTarget(target: Document | Window): void {
  // EventTarget's own methods (what document / window inherit), called on the target: the page's add / remove as they were
  const add: AddFn = (type, listener, options) => { EventTarget.prototype.addEventListener.call(target, type, listener, options); };
  const remove: RemoveFn = (type, listener, options) => { EventTarget.prototype.removeEventListener.call(target, type, listener, options); };
  origRemove.set(target, remove);
  const scopedAdd: AddFn = (type, listener, options) => {
    const scope = current;
    if (scope === null || listener === null) { add(type, listener, options); return; }
    const key = keyOf(type, options);
    let byKey = wrappers.get(listener);
    if (!byKey) { byKey = new Map(); wrappers.set(listener, byKey); }
    let byScope = byKey.get(key);
    if (!byScope) { byScope = new Map(); byKey.set(key, byScope); }
    if (byScope.has(scope)) return; // the DOM ignores a second add of the same listener too
    const once = typeof options === 'object' && options.once === true;
    const capture = typeof options === 'boolean' ? options : options?.capture === true;
    const mine = byScope;
    const fn: EventListener = function fn(this: unknown, e: Event): void {
      if (!scope.active) return;
      if (once) { remove(type, fn, capture); mine.delete(scope); }
      if (typeof listener === 'function') listener.call(this, e); else listener.handleEvent(e);
    };
    byScope.set(scope, fn);
    scope.regs.push({ target, type, fn, capture, listener, key });
    // `once` is ours to keep (once while active): a parked shard must not lose a one-shot to another shard's event
    add(type, fn, typeof options === 'object' ? { ...options, once: false } : options);
  };
  const scopedRemove: RemoveFn = (type, listener, options) => {
    const byScope = listener === null ? undefined : wrappers.get(listener)?.get(keyOf(type, options));
    if (byScope !== undefined && byScope.size > 0) {
      // the current scope's registration, else the one there is (a shard removing its own listener)
      const scope = current !== null && byScope.has(current) ? current : byScope.keys().next().value;
      const fn = scope === undefined ? undefined : byScope.get(scope);
      if (scope !== undefined && fn !== undefined) { remove(type, fn, options); byScope.delete(scope); return; }
    }
    remove(type, listener, options);
  };
  Object.defineProperty(target, 'addEventListener', { value: scopedAdd, configurable: true, writable: true });
  Object.defineProperty(target, 'removeEventListener', { value: scopedRemove, configurable: true, writable: true });
}

/** attribute the body's queued child changes to the scope that was current when they happened */
function flush(): void {
  if (!observer) return;
  take(observer.takeRecords());
}
function take(records: readonly MutationRecord[]): void {
  const s = current;
  let late = false;
  for (const r of records) {
    if (s) for (const n of r.addedNodes) {
      if (!(n instanceof Element) || n.parentNode !== document.body || n.matches(SHELL)) continue;
      s.nodes.set(n, null);
      late ||= !s.active; // a parked shard's timer put it there: out of the page with the rest of it
    }
    for (const n of r.removedNodes) {
      if (!(n instanceof Element) || n.parentNode === document.body) continue;
      // a shard's own element taken out by its own code (Explore's viewer closing): no longer one to swap
      if (s?.nodes.get(n) === null) s.nodes.delete(n);
    }
  }
  if (late && s) { parkNodes(s); observer?.takeRecords(); }
}

function parkNodes(s: ShardScope): void {
  for (const [el, mark] of s.nodes) {
    if (mark !== null || !el.isConnected) continue;
    const m = document.createComment(`shard ${s.slug}`);
    el.replaceWith(m);
    s.nodes.set(el, m);
  }
}

/** Install the scoping (once, before the first shard builds). */
export function installScopes(): void {
  if (installed) return;
  installed = true;
  scopeTarget(document);
  scopeTarget(window);
  const setIv = window.setInterval.bind(window), clearIv = window.clearInterval.bind(window);
  const owner = new Map<number, ShardScope>();
  const scopedSet = (handler: TimerHandler, timeout?: number, ...args: unknown[]): number => {
    const s = current;
    const id = s === null || typeof handler !== 'function' ? setIv(handler, timeout, ...args) : setIv(() => { runAs(s, () => { Reflect.apply(handler, window, args); }); }, timeout);
    if (s) { s.intervals.add(id); owner.set(id, s); }
    return id;
  };
  const scopedClear = (id?: number): void => {
    if (id !== undefined) { owner.get(id)?.intervals.delete(id); owner.delete(id); }
    clearIv(id);
  };
  clearIntervalNow = (id: number): void => { owner.delete(id); clearIv(id); };
  Object.defineProperty(window, 'setInterval', { value: scopedSet, configurable: true, writable: true });
  const setTo = window.setTimeout.bind(window);
  const scopedTimeout = (handler: TimerHandler, timeout?: number, ...args: unknown[]): number => {
    const s = current;
    if (s === null || typeof handler !== 'function') return setTo(handler, timeout, ...args);
    // the handler runs as its shard (a timeout chain — the surf scheduling its next swell — stays that shard's)
    const id: number = setTo(() => { s.timeouts.delete(id); runAs(s, () => { Reflect.apply(handler, window, args); }); }, timeout);
    s.timeouts.add(id);
    return id;
  };
  Object.defineProperty(window, 'setTimeout', { value: scopedTimeout, configurable: true, writable: true });
  Object.defineProperty(window, 'clearInterval', { value: scopedClear, configurable: true, writable: true });
  observer = new MutationObserver(take);
  observer.observe(document.body, { childList: true });
}

/** claim an element that was in the page before the scope existed (index.html's canvas and #hud for the first shard) */
export function claim(scope: ShardScope, el: Element | null): void { if (el) scope.nodes.set(el, null); }

/** parking: the shard's listeners go quiet, its elements leave the page (a comment holds each one's place) */
export function parkScope(s: ShardScope): void {
  flush();
  s.active = false;
  parkNodes(s);
  observer?.takeRecords(); // our own swaps are not the shard's doing
}

/** activating: the shard's elements back where they stood, its listeners live */
export function activateScope(s: ShardScope): void {
  flush();
  for (const [el, mark] of s.nodes) {
    if (mark === null) continue;
    mark.replaceWith(el);
    s.nodes.set(el, null);
  }
  observer?.takeRecords();
  s.active = true;
}

/** eviction: every listener removed, every element gone, the disposers run */
export function disposeScope(s: ShardScope): void {
  flush();
  s.active = false;
  for (const r of s.regs) { origRemove.get(r.target)?.call(r.target, r.type, r.fn, r.capture); wrappers.get(r.listener)?.get(r.key)?.delete(s); }
  s.regs.length = 0;
  for (const id of s.intervals) clearIntervalNow(id);
  s.intervals.clear();
  for (const id of s.timeouts) clearTimeout(id);
  s.timeouts.clear();
  for (const [el, mark] of s.nodes) { mark?.remove(); el.remove(); }
  s.nodes.clear();
  observer?.takeRecords();
  for (const d of s.disposers.splice(0)) { try { d(); } catch (e) { console.warn('[shard] a disposer threw', e); } }
}

/** the shard host runs this page (several shards may be resident): a chunk change is a switch between them, not a new world */
export function scopesInstalled(): boolean { return installed; }

/**
 * The page's own timers and listeners, never a shard's: for shell code whose async continuations can run while any
 * shard is current (the background prefetch's sleeps, an error report's retry). A shard's timers are cleared when it is
 * evicted; a shell flow must not lose its wake-up with it. (The browser's own functions, taken before the scoping.)
 */
const nativeTimeout: (fn: () => void, ms?: number) => number = typeof window === 'undefined' ? (fn, ms) => setTimeout(fn, ms) : window.setTimeout.bind(window);
export const shell = {
  setTimeout: (fn: () => void, ms?: number): number => nativeTimeout(fn, ms),
  listen: (target: EventTarget, type: string, fn: EventListener, options?: boolean | AddEventListenerOptions): void => { EventTarget.prototype.addEventListener.call(target, type, fn, options); },
  unlisten: (target: EventTarget, type: string, fn: EventListener, options?: boolean | EventListenerOptions): void => { EventTarget.prototype.removeEventListener.call(target, type, fn, options); },
};
