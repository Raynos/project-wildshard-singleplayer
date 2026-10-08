import { withOwner } from './ownership';
import { scopeEnvironment } from './scopeEnvironment';
import { scopedProperty } from './scopedProperty';

export interface Disposable3 { dispose: () => void }
export interface PhysicsHandle { remove: () => void }
export interface SoundHandle { stop: () => void; disconnect?: () => void }
export interface ScopeCensus {
  geometries: number;
  materials: number;
  textures: number;
  renderTargets: number;
  meshes: number;
  resources: number;
  bodies: number;
  sounds: number;
  listeners: number;
  timers: number;
  rafs: number;
  disposers: number;
  systems: number;
  colliders: number;
  nodes: number;
}
type Kind = keyof ScopeCensus;
interface Cleanup { kind: Kind; run: () => void }
export interface NativeCensus {
  listeners: { window: number; document: number; canvas: number; other: number };
  timers: { timeouts: number; intervals: number; raf: number };
}
interface Registration { scope: Scope; target?: EventTarget; timer?: ReturnType<typeof setTimeout>; kind: 'listeners' | 'timeouts' | 'intervals' | 'raf' }
const registrations = new Set<Registration>();
const nodeOwners = new WeakMap<Element, Scope>();
export function nodeOwner(node: Element): Scope | null { return nodeOwners.get(node) ?? null; }
/** Explicit registrations, compared with the independent harness's native counters. */
export function scopeRegistrations(include: (scope: Scope) => boolean): NativeCensus {
  const result: NativeCensus = { listeners: { window: 0, document: 0, canvas: 0, other: 0 }, timers: { timeouts: 0, intervals: 0, raf: 0 } };
  for (const r of registrations) {
    if (!include(r.scope)) continue;
    if (r.kind !== 'listeners') result.timers[r.kind]++;
    else if (r.target !== undefined) result.listeners[scopeEnvironment().targetKind(r.target)]++;
  }
  return result;
}
export function registrationTimerIds(): { timeouts: number[]; intervals: number[] } {
  const ids = { timeouts: [] as number[], intervals: [] as number[] };
  for (const r of registrations) if (r.timer !== undefined && (r.kind === 'timeouts' || r.kind === 'intervals')) ids[r.kind].push(Number(r.timer));
  return ids;
}
/** Preserve nested disposal failures across browser/JSON error boundaries. */
export function disposalErrorMessages(error: unknown): string[] {
  if (error instanceof AggregateError && error.errors.length > 0) return error.errors.flatMap((inner: unknown) => disposalErrorMessages(inner));
  return [error instanceof Error ? error.message : String(error)];
}
function emptyCensus(): ScopeCensus {
  return { geometries: 0, materials: 0, textures: 0, renderTargets: 0, meshes: 0, resources: 0,
    bodies: 0, sounds: 0, listeners: 0, timers: 0, rafs: 0, disposers: 0, systems: 0, colliders: 0, nodes: 0 };
}
function resourceKind(resource: Disposable3): Kind {
  if ('isBufferGeometry' in resource && resource.isBufferGeometry === true) return 'geometries';
  if ('isMaterial' in resource && resource.isMaterial === true) return 'materials';
  if ('isTexture' in resource && resource.isTexture === true) return 'textures';
  if ('isWebGLRenderTarget' in resource && resource.isWebGLRenderTarget === true) return 'renderTargets';
  if ('isInstancedMesh' in resource && resource.isInstancedMesh === true) return 'meshes';
  return 'resources';
}

export class Scope {
  private closed = false;
  private cleanups = new Set<Cleanup>();
  private children = new Set<Scope>();
  private owned = new Set<object>();
  private detach: (() => void) | undefined;
  readonly name: string;
  private readonly parent: Scope | undefined;

  constructor(name: string, parent?: Scope) {
    this.name = name;
    this.parent = parent;
    if (parent) {
      parent.children.add(this);
      const forget = parent.track('disposers', () => this.dispose());
      this.detach = () => { parent.children.delete(this); forget(); };
      if (parent.disposed) this.detach();
    }
  }

  get disposed(): boolean { return this.closed; }
  /** true only while `dispose()` runs this scope's cleanups (SF57: a lookup then is the teardown, not a new use) */
  get disposing(): boolean { return this.tearing; }
  private tearing = false;
  belongsTo(scope: Scope): boolean { return this === scope || (this.parent?.belongsTo(scope) ?? false); }
  get census(): ScopeCensus {
    const counts = emptyCensus();
    for (const cleanup of this.cleanups) counts[cleanup.kind]++;
    for (const child of this.children) {
      const childCounts = child.census;
      for (const kind of Object.keys(counts) as Kind[]) counts[kind] += childCounts[kind];
    }
    return counts;
  }
  child(name: string): Scope { return new Scope(name, this); }

  /** Publish a borrowed property until this owner retires. Nested/out-of-order owners never resurrect retired values. */
  expose(target: object, key: PropertyKey, value: unknown): () => void {
    if (this.closed) return () => undefined;
    const release = scopedProperty(target, key, value);
    let forget = () => { /* Assigned after the cleanup is registered. */ };
    const remove = (): void => { release(); forget(); };
    forget = this.track('disposers', remove);
    return remove;
  }

  private track(kind: Kind, run: () => void): () => void {
    if (this.closed) { run(); return () => { /* Already released. */ }; }
    const cleanup = { kind, run };
    this.cleanups.add(cleanup);
    return () => { this.cleanups.delete(cleanup); };
  }
  /** Bridge for legacy registrations; forget when a one-shot ends or a handle is removed early. */
  capture(kind: Kind, cleanup: () => void): () => void { return this.track(kind, cleanup); }

  private ownHandle<T extends object>(resource: T, kind: Kind, dispose: () => void): T {
    if (!this.owned.has(resource)) {
      this.owned.add(resource);
      this.track(kind, dispose);
    }
    return resource;
  }
  own<T extends Disposable3>(resource: T): T {
    return this.ownHandle(resource, resourceKind(resource), () => resource.dispose());
  }
  ownBody<T extends PhysicsHandle>(body: T): T {
    return this.ownHandle(body, 'bodies', () => body.remove());
  }
  ownSound<T extends SoundHandle>(sound: T): T {
    return this.ownHandle(sound, 'sounds', () => {
      try { sound.stop(); } finally { sound.disconnect?.(); }
    });
  }

  ownNode<T extends Element>(node: T): T {
    nodeOwners.set(node, this);
    this.capture('nodes', () => { nodeOwners.delete(node); node.remove(); });
    return node;
  }

  private registration(r: Omit<Registration, 'scope'>, kind: Kind, cleanup: () => void): () => void {
    const record = { ...r, scope: this }; registrations.add(record);
    const forget = this.track(kind, () => { registrations.delete(record); cleanup(); });
    return () => { registrations.delete(record); forget(); };
  }

  private readonly domListeners = new WeakMap<EventTarget, Map<string, Map<object, () => void>>>();
  unlisten(target: EventTarget, type: string, fn: object, options?: boolean | EventListenerOptions): void {
    const capture = typeof options === 'boolean' ? options : options?.capture === true;
    this.domListeners.get(target)?.get(`${type}|${String(capture)}`)?.get(fn)?.();
  }

  listen<K extends string>(target: EventTarget, type: K,
    fn: (event: K extends keyof (GlobalEventHandlersEventMap & WindowEventMap) ? (GlobalEventHandlersEventMap & WindowEventMap)[K] : Event) => void,
    opts?: AddEventListenerOptions): () => void {
    if (this.closed || opts?.signal?.aborted) return () => undefined;
    const key = `${type}|${String(opts?.capture === true)}`;
    let targetListeners = this.domListeners.get(target);
    if (!targetListeners) { targetListeners = new Map(); this.domListeners.set(target, targetListeners); }
    let listeners = targetListeners.get(key);
    if (!listeners) { listeners = new Map(); targetListeners.set(key, listeners); }
    const existing = listeners.get(fn); if (existing) return existing;
    const entries = listeners;
    const signalRegistration: Registration | undefined = opts?.signal ? { scope: this, target: opts.signal, kind: 'listeners' } : undefined;
    const clearSignal = (): void => {
      opts?.signal?.removeEventListener('abort', abort);
      if (signalRegistration) registrations.delete(signalRegistration);
    };
    let forget = () => { /* Filled after the listener is registered. */ };
    const listener: EventListener = (event) => {
      if (opts?.once) { forget(); entries.delete(fn); clearSignal(); }
      withOwner(this, () => fn(event as K extends keyof (GlobalEventHandlersEventMap & WindowEventMap) ? (GlobalEventHandlersEventMap & WindowEventMap)[K] : Event));
    };
    function abort(): void {
      target.removeEventListener(type, listener, opts?.capture);
      clearSignal();
      entries.delete(fn); forget();
    }
    target.addEventListener(type, listener, opts);
    if (signalRegistration) registrations.add(signalRegistration);
    opts?.signal?.addEventListener('abort', abort, { once: true });
    forget = this.registration({ target, kind: 'listeners' }, 'listeners', () => {
      target.removeEventListener(type, listener, opts?.capture);
      clearSignal(); entries.delete(fn);
    });
    entries.set(fn, abort);
    return abort;
  }

  private readonly timerCancels = new Map<ReturnType<typeof setTimeout>, () => void>();
  cancelTimer(id: ReturnType<typeof setTimeout> | 0 | undefined): void { if (id !== 0 && id !== undefined) this.timerCancels.get(id)?.(); }

  /** THREE-style persistent emitter subscription, with no DOM casts. */
  listenEmitter<K extends string, E>(target: {
    addEventListener: (type: K, fn: (event: E) => void) => void;
    removeEventListener: (type: K, fn: (event: E) => void) => void;
  }, type: K, fn: (event: E) => void): void {
    if (this.closed) return;
    const listener = (event: E): void => { withOwner(this, () => fn(event)); };
    target.addEventListener(type, listener);
    this.track('listeners', () => { target.removeEventListener(type, listener); });
  }

  /** One emitter event, released on delivery or owner disposal (including renderer resource events). */
  listenOnceEmitter<K extends string>(target: {
    addEventListener: (type: K, fn: () => void) => void;
    removeEventListener: (type: K, fn: () => void) => void;
  }, type: K, fn: () => void): void {
    if (this.closed) return;
    let forget = () => { /* Filled after registration. */ };
    const listener = (): void => { target.removeEventListener(type, listener); forget(); withOwner(this, fn); };
    target.addEventListener(type, listener);
    forget = this.track('listeners', () => { target.removeEventListener(type, listener); forget(); });
  }

  timeout(ms: number, fn: () => void): ReturnType<typeof setTimeout> | 0 {
    if (this.closed) return 0;
    let forget = () => { /* Filled before the timer can fire. */ };
    const id = setTimeout(() => { forget(); this.timerCancels.delete(id); if (!this.closed) withOwner(this, fn); }, ms);
    const cancel = (): void => { clearTimeout(id); this.timerCancels.delete(id); forget(); };
    forget = this.registration({ kind: 'timeouts', timer: id }, 'timers', cancel); this.timerCancels.set(id, cancel);
    return id;
  }
  interval(ms: number, fn: () => void): ReturnType<typeof setInterval> | 0 {
    if (this.closed) return 0;
    const id = setInterval(() => { if (!this.closed) withOwner(this, fn); }, ms);
    let forget = () => { /* Assigned after registration. */ };
    const cancel = (): void => { clearInterval(id); this.timerCancels.delete(id); forget(); };
    forget = this.registration({ kind: 'intervals', timer: id }, 'timers', cancel); this.timerCancels.set(id, cancel);
    return id;
  }
  private readonly rafCancels = new Map<number, () => void>();
  cancelRaf(id: number): void { this.rafCancels.get(id)?.(); }
  raf(fn: FrameRequestCallback): number {
    if (this.closed) return 0;
    let forget = () => { /* Filled before the frame can fire. */ };
    const native = scopeEnvironment();
    const id = native.frame((time) => { forget(); this.rafCancels.delete(id); if (!this.closed) withOwner(this, () => fn(time)); });
    const cancel = (): void => { native.cancelFrame(id); this.rafCancels.delete(id); forget(); };
    forget = this.registration({ kind: 'raf' }, 'rafs', cancel); this.rafCancels.set(id, cancel);
    return id;
  }
  onDispose(fn: () => void): void { this.track('disposers', fn); }
  /** Run `fn` now with this scope as the construction owner (`withOwner`): what it registers ends with this scope. For code
   *  after an `await`, where the owner has fallen back to the page's ambient one (SF57). */
  run<T>(fn: () => T): T { return withOwner(this, fn); }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    const cleanups = [...this.cleanups].reverse();
    this.cleanups.clear();
    const errors: unknown[] = [];
    this.tearing = true;
    try {
      for (const cleanup of cleanups) {
        try { cleanup.run(); } catch (error) { errors.push(error); }
      }
    } finally { this.tearing = false; }
    this.children.clear();
    this.owned.clear();
    this.detach?.();
    this.detach = undefined;
    if (errors.length > 0) throw new AggregateError(errors,
      `Scope ${this.name} disposal failed: ${errors.flatMap(disposalErrorMessages).join('; ')}`);
  }
}
