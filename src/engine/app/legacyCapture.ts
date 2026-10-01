/** Temporary capture of legacy listeners, timers and body appends into F8 Scopes.
 * X1 and X2 migrate call sites to explicit scope registration, then remove this capture.
 */
import { Scope } from './scope';

interface Reg { target: EventTarget; type: string; fn: EventListener; capture: boolean; listener: object; key: string; forget: () => void; owner: Scope }

export class LegacyCapture {
  readonly resources = new Scope('level');
  owner = this.resources;
  readonly regs: Reg[] = [];
  readonly nodes = new Set<Element>();
  readonly nodeOwners = new Map<Element, Scope>();
  /** intervals and pending timeouts it started (cleared on disposal) */
  readonly intervals = new Set<number>();
  readonly timeouts = new Set<number>();
  readonly timerOwners = new Map<number, { scope: Scope; kind: 'timeouts' | 'intervals' }>();
  /** run on disposal (shell-level registrations the shard made: settings listeners …) */
  readonly disposers: (() => void)[] = [];
  // a plain field, not a constructor parameter property: node's type stripping loads this module for the boot-pack bake
  // (scripts/bake-packs.mjs, run by every vite build) and cannot parse parameter properties — the bake failed, every pack
  // part 404'd and the phones booted file by file
  readonly slug: string;
  constructor(slug: string) { this.slug = slug; }
}

/** the shell's overlays: never a shard's, whatever was current when they were appended */
const SHELL = '.ws-load, .ws-resume, .ws-rotate, .ws-update, .ws-reload, #wserr, #wserr-chip, #wsstuck, [data-ws-shell], [data-shell]';

let current: LegacyCapture | null = null;
let observer: MutationObserver | null = null;
let installed = false;
const engineTimers = new Map<number, 'timeouts' | 'intervals'>();
let clearIntervalNow: (id: number) => void = (id) => { clearInterval(id); };
type AddFn = (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => void;
type RemoveFn = (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) => void;
const origRemove = new WeakMap<EventTarget, RemoveFn>();
// oxlint-disable-next-line typescript/unbound-method -- Native DOM method saved before wrapping; every call supplies its target with .call.
const nativeAdd = typeof EventTarget === 'undefined' ? null : EventTarget.prototype.addEventListener;
// oxlint-disable-next-line typescript/unbound-method -- Native DOM method saved before wrapping; every call supplies its target with .call.
const nativeRemove = typeof EventTarget === 'undefined' ? null : EventTarget.prototype.removeEventListener;
const windowAdd: unknown = typeof window === 'undefined' ? null : Reflect.get(window, 'addEventListener');
const windowRemove: unknown = typeof window === 'undefined' ? null : Reflect.get(window, 'removeEventListener');
/** listener → its wrappers, by `type|capture` (the DOM keys a listener the same way) and by scope (a module-level
 *  handler two shards both add is two registrations, one per shard) */
const wrappers = new WeakMap<object, WeakMap<EventTarget, Map<string, Map<LegacyCapture, EventListener>>>>();

/** the scope a registration made now belongs to (null: the shell) */
export function currentScope(): LegacyCapture | null { return current; }
export function levelRegistrations(): { listeners: { window: number; document: number; canvas: number; other: number }; timers: { timeouts: number; intervals: number; raf: number } } {
  const listeners = { window: 0, document: 0, canvas: 0, other: 0 }, timers = { timeouts: 0, intervals: 0, raf: 0 };
  if (!current) return { listeners, timers };
  for (const reg of current.regs) if (reg.owner.belongsTo(current.resources)) {
    listeners[reg.target === window ? 'window' : reg.target === document ? 'document' : reg.target instanceof HTMLCanvasElement ? 'canvas' : 'other']++;
  }
  for (const entry of current.timerOwners.values()) if (entry.scope.belongsTo(current.resources)) timers[entry.kind]++;
  return { listeners, timers };
}
export function retainedRegistrations(): ReturnType<typeof levelRegistrations> {
  const listeners = { window: 0, document: 0, canvas: 0, other: 0 }, timers = { timeouts: 0, intervals: 0, raf: 0 };
  if (current) {
    for (const reg of current.regs) if (!reg.owner.belongsTo(current.resources)) listeners[reg.target === window ? 'window' : reg.target === document ? 'document' : reg.target instanceof HTMLCanvasElement ? 'canvas' : 'other']++;
    for (const entry of current.timerOwners.values()) if (!entry.scope.belongsTo(current.resources)) timers[entry.kind]++;
  }
  for (const kind of engineTimers.values()) timers[kind]++;
  return { listeners, timers };
}
/** Live timer identities, including shell timers captured outside a level. */
export function registrationTimerIds(): { timeouts: number[]; intervals: number[] } {
  const ids = { timeouts: [] as number[], intervals: [] as number[] };
  for (const [id, kind] of engineTimers) ids[kind].push(id);
  for (const [id, entry] of current?.timerOwners ?? []) ids[entry.kind].push(id);
  return ids;
}
export function withScopeOwner<T>(owner: Scope, fn: () => T): T {
  const scope = current;
  if (!scope) return fn();
  flush();
  const prev = scope.owner;
  scope.owner = owner;
  try { return fn(); } finally { flush(); scope.owner = prev; }
}

/** make `s` the current scope (the shard being built or the running one; null = the shell) */
export function enterScope(s: LegacyCapture | null): void {
  flush();
  current = s;
}

/** run `fn` as scope `s` (a timer's handler, as the shard that started the timer) */
function runAs(s: LegacyCapture, fn: () => void): void {
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

/** a shell-level registration a shard made (a settings listener): undone when the shard is disposed */
export function onScopeDispose(fn: () => void): void { current?.owner.onDispose(fn); }

const keyOf = (type: string, options?: boolean | EventListenerOptions): string => `${type}|${String(typeof options === 'boolean' ? options : options?.capture === true)}`;

function scopeTarget(target: EventTarget): void {
  if (origRemove.has(target)) return;
  // EventTarget's own methods (what document / window inherit), called on the target: the page's add / remove as they were
  const add: AddFn = (type, listener, options) => {
    if (target === window && typeof windowAdd === 'function') Reflect.apply(windowAdd, target, [type, listener, options]);
    else nativeAdd?.call(target, type, listener, options);
  };
  const remove: RemoveFn = (type, listener, options) => {
    if (target === window && typeof windowRemove === 'function') Reflect.apply(windowRemove, target, [type, listener, options]);
    else nativeRemove?.call(target, type, listener, options);
  };
  origRemove.set(target, remove);
  const scopedAdd: AddFn = (type, listener, options) => {
    const scope = current;
    if (scope === null || listener === null) { add(type, listener, options); return; }
    if (scope.owner.disposed || (typeof options === 'object' && options.signal?.aborted)) return;
    const key = keyOf(type, options);
    let byTarget = wrappers.get(listener);
    if (!byTarget) { byTarget = new WeakMap(); wrappers.set(listener, byTarget); }
    let byKey = byTarget.get(target);
    if (!byKey) { byKey = new Map(); byTarget.set(target, byKey); }
    let byScope = byKey.get(key);
    if (!byScope) { byScope = new Map(); byKey.set(key, byScope); }
    if (byScope.has(scope)) return; // the DOM ignores a second add of the same listener too
    const once = typeof options === 'object' && options.once === true;
    const capture = typeof options === 'boolean' ? options : options?.capture === true;
    const mine = byScope;
    const owner = scope.owner;
    let forget = () => { /* Bound after registration. */ };
    const fn: EventListener = function fn(this: unknown, e: Event): void {
      if (owner.disposed) return;
      if (once) cleanup();
      withScopeOwner(owner, () => { if (typeof listener === 'function') listener.call(this, e); else listener.handleEvent(e); });
    };
    byScope.set(scope, fn);
    const signal = typeof options === 'object' ? options.signal : undefined;
    const capturedScope = scope;
    const reg = { target, type, fn, capture, listener, key, owner, forget: cleanup };
    scope.regs.push(reg);
    function cleanup(): void {
      remove(type, fn, capture); mine.delete(capturedScope); forget();
      signal?.removeEventListener('abort', cleanup);
      const at = capturedScope.regs.indexOf(reg); if (at !== -1) capturedScope.regs.splice(at, 1);
    }
    forget = owner.capture('listeners', cleanup);
    // A one-shot removes its capture record together with the native listener.
    if (typeof options === 'object') {
      const nativeOptions = { ...options, once: false };
      delete nativeOptions.signal; // Our abort handler removes both the native listener and its scope record.
      add(type, fn, nativeOptions);
    } else add(type, fn, options);
    signal?.addEventListener('abort', cleanup, { once: true });
  };
  const scopedRemove: RemoveFn = (type, listener, options) => {
    const byScope = listener === null ? undefined : wrappers.get(listener)?.get(target)?.get(keyOf(type, options));
    if (byScope !== undefined && byScope.size > 0) {
      // the current scope's registration, else the one there is (a shard removing its own listener)
      const scope = current !== null && byScope.has(current) ? current : byScope.keys().next().value;
      const fn = scope === undefined ? undefined : byScope.get(scope);
      if (scope !== undefined && fn !== undefined) {
        remove(type, fn, options); byScope.delete(scope);
        const at = scope.regs.findIndex((r) => r.fn === fn);
        if (at !== -1) scope.regs[at]?.forget(); // cleanup already removes its record; a second splice loses the next listener.
        return;
      }
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
  for (const r of records) {
    if (s) for (const n of r.addedNodes) {
      if (!(n instanceof Element) || !n.isConnected || n.closest(SHELL)) continue;
      s.nodes.add(n);
      s.nodeOwners.set(n, s.owner);
      for (const child of n.querySelectorAll('*')) s.nodeOwners.set(child, s.owner);
      const node = n;
      s.owner.capture('nodes', () => {
        node.remove(); s.nodes.delete(node); s.nodeOwners.delete(node);
        for (const child of node.querySelectorAll('*')) s.nodeOwners.delete(child);
      });
    }
    for (const n of r.removedNodes) {
      if (!(n instanceof Element) || n.isConnected) continue;
      // An element removed by its own code is no longer captured.
      if (s?.nodes.has(n)) s.nodes.delete(n);
    }
  }
}

/** Install the scoping (once, before the first shard builds). */
export function installLegacyCapture(): void {
  if (installed) return;
  installed = true;
  scopeTarget(document);
  scopeTarget(window);
  const captureAdd: AddFn = function captureAdd(this: EventTarget, type, listener, options): void {
    if (current) { scopeTarget(this); this.addEventListener(type, listener, options); }
    else nativeAdd?.call(this, type, listener, options);
  };
  EventTarget.prototype.addEventListener = captureAdd;
  // DOM implementations can expose a bound window EventTarget class while nodes inherit the base class.
  let nodeProto: unknown = Object.getPrototypeOf(document.createElement('span'));
  while (typeof nodeProto === 'object' && nodeProto !== null) {
    if (Object.hasOwn(nodeProto, 'addEventListener')) { Object.defineProperty(nodeProto, 'addEventListener', { configurable: true, writable: true, value: captureAdd }); break; }
    nodeProto = Object.getPrototypeOf(nodeProto);
  }
  const setIv = window.setInterval.bind(window), clearIv = window.clearInterval.bind(window);
  const owner = new Map<number, LegacyCapture>();
  const intervalCaptures = new Map<number, () => void>();
  const scopedSet = (handler: TimerHandler, timeout?: number, ...args: unknown[]): number => {
    const s = current;
    const resourceOwner = s?.owner;
    if (resourceOwner?.disposed) return 0;
    const id = s === null || typeof handler !== 'function' ? setIv(handler, timeout, ...args) : setIv(() => {
      if (!resourceOwner || resourceOwner.disposed) return;
      runAs(s, () => withScopeOwner(resourceOwner, () => { Reflect.apply(handler, window, args); }));
    }, timeout);
    if (s && resourceOwner) {
      s.intervals.add(id); owner.set(id, s);
      s.timerOwners.set(id, { scope: resourceOwner, kind: 'intervals' });
      intervalCaptures.set(id, resourceOwner.capture('timers', () => { clearIv(id); s.intervals.delete(id); s.timerOwners.delete(id); owner.delete(id); intervalCaptures.delete(id); }));
    }
    if (!s) engineTimers.set(id, 'intervals');
    return id;
  };
  const scopedClear = (id?: number): void => {
    if (id !== undefined) engineTimers.delete(id);
    if (id !== undefined) { intervalCaptures.get(id)?.(); intervalCaptures.delete(id); owner.get(id)?.intervals.delete(id); owner.get(id)?.timerOwners.delete(id); owner.delete(id); }
    clearIv(id);
  };
  clearIntervalNow = (id: number): void => { owner.delete(id); clearIv(id); };
  Object.defineProperty(window, 'setInterval', { value: scopedSet, configurable: true, writable: true });
  const setTo = window.setTimeout.bind(window), clearTo = window.clearTimeout.bind(window);
  const timeoutCaptures = new Map<number, { scope: LegacyCapture; forget: () => void }>();
  const scopedTimeout = (handler: TimerHandler, timeout?: number, ...args: unknown[]): number => {
    const s = current;
    if (typeof handler !== 'function') return setTo(handler, timeout, ...args);
    if (s === null) {
      const id = setTo(() => { engineTimers.delete(id); asShell(() => { Reflect.apply(handler, window, args); }); }, timeout);
      engineTimers.set(id, 'timeouts'); return id;
    }
    const resourceOwner = s.owner;
    if (resourceOwner.disposed) return 0;
    // the handler runs as its shard (a timeout chain — the surf scheduling its next swell — stays that shard's)
    const id: number = setTo(() => {
      timeoutCaptures.get(id)?.forget(); timeoutCaptures.delete(id); s.timeouts.delete(id); s.timerOwners.delete(id);
      if (!resourceOwner.disposed) runAs(s, () => withScopeOwner(resourceOwner, () => { Reflect.apply(handler, window, args); }));
    }, timeout);
    s.timeouts.add(id);
    s.timerOwners.set(id, { scope: resourceOwner, kind: 'timeouts' });
    timeoutCaptures.set(id, { scope: s, forget: resourceOwner.capture('timers', () => { clearTo(id); s.timeouts.delete(id); s.timerOwners.delete(id); timeoutCaptures.delete(id); }) });
    return id;
  };
  Object.defineProperty(window, 'setTimeout', { value: scopedTimeout, configurable: true, writable: true });
  Object.defineProperty(window, 'clearTimeout', { value: (id?: number): void => {
    if (id !== undefined) engineTimers.delete(id);
    if (id !== undefined) { const record = timeoutCaptures.get(id); record?.forget(); record?.scope.timeouts.delete(id); record?.scope.timerOwners.delete(id); timeoutCaptures.delete(id); }
    clearTo(id);
  }, configurable: true, writable: true });
  Object.defineProperty(window, 'clearInterval', { value: scopedClear, configurable: true, writable: true });
  observer = new MutationObserver(take);
  observer.observe(document.body, { childList: true, subtree: true });
}

/** claim an element that was in the page before the scope existed (index.html's canvas and #hud for the first shard) */
export function claim(scope: LegacyCapture, el: Element | null): void { if (el) scope.nodes.add(el); }

/** disposal: every listener removed, every element gone, the disposers run */
export function disposeScope(s: LegacyCapture): void {
  flush();
  s.resources.dispose();
  for (const r of s.regs) { origRemove.get(r.target)?.call(r.target, r.type, r.fn, r.capture); wrappers.get(r.listener)?.get(r.target)?.get(r.key)?.delete(s); }
  s.regs.length = 0;
  for (const id of s.intervals) clearIntervalNow(id);
  s.intervals.clear();
  for (const id of s.timeouts) clearTimeout(id);
  s.timeouts.clear();
  for (const el of s.nodes) el.remove();
  s.nodes.clear();
  observer?.takeRecords();
  for (const d of s.disposers.splice(0)) { try { d(); } catch (e) { console.warn('[shard] a disposer threw', e); } }
}

/** Whether legacy capture was installed before level construction. */
export function scopesInstalled(): boolean { return installed; }

/**
 * The page's own timers and listeners, never a shard's: for shell code whose async continuations can run while any
 * shard is current (the background prefetch's sleeps, an error report's retry). A shard's timers are cleared when it is
 * disposed; a shell flow must not lose its wake-up with it. (The browser's own functions, taken before the scoping.)
 */
const nativeTimeout: (fn: () => void, ms?: number) => number = typeof window === 'undefined' ? (fn, ms) => Number(setTimeout(fn, ms)) : window.setTimeout.bind(window); // Number(): with node's types in the program (vite's Plugin type, test/backdrop-prefix.test.ts) setTimeout returns a Timeout
export const shell = {
  setTimeout: (fn: () => void, ms?: number): number => {
    if (current?.owner.belongsTo(current.resources)) return window.setTimeout(fn, ms);
    const id = nativeTimeout(() => { engineTimers.delete(id); asShell(fn); }, ms);
    engineTimers.set(id, 'timeouts'); return id;
  },
  listen: (target: EventTarget, type: string, fn: EventListener, options?: boolean | AddEventListenerOptions): void => { nativeAdd?.call(target, type, fn, options); },
  unlisten: (target: EventTarget, type: string, fn: EventListener, options?: boolean | EventListenerOptions): void => { nativeRemove?.call(target, type, fn, options); },
};
