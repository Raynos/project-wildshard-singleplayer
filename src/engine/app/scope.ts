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

  listen<K extends string>(target: EventTarget, type: K,
    fn: (event: K extends keyof (GlobalEventHandlersEventMap & WindowEventMap) ? (GlobalEventHandlersEventMap & WindowEventMap)[K] : Event) => void,
    opts?: AddEventListenerOptions): void {
    if (this.closed || opts?.signal?.aborted) return;
    let forget = () => { /* Filled after the listener is registered. */ };
    const listener: EventListener = (event) => {
      if (opts?.once) { forget(); opts.signal?.removeEventListener('abort', abort); }
      fn(event as K extends keyof (GlobalEventHandlersEventMap & WindowEventMap) ? (GlobalEventHandlersEventMap & WindowEventMap)[K] : Event);
    };
    function abort(): void {
      target.removeEventListener(type, listener, opts?.capture);
      forget();
    }
    target.addEventListener(type, listener, opts);
    opts?.signal?.addEventListener('abort', abort, { once: true });
    forget = this.track('listeners', () => {
      target.removeEventListener(type, listener, opts?.capture);
      opts?.signal?.removeEventListener('abort', abort);
    });
  }

  timeout(ms: number, fn: () => void): ReturnType<typeof setTimeout> | 0 {
    if (this.closed) return 0;
    let forget = () => { /* Filled before the timer can fire. */ };
    const id = setTimeout(() => { forget(); if (!this.closed) fn(); }, ms);
    forget = this.track('timers', () => clearTimeout(id));
    return id;
  }
  interval(ms: number, fn: () => void): ReturnType<typeof setInterval> | 0 {
    if (this.closed) return 0;
    const id = setInterval(() => { if (!this.closed) fn(); }, ms);
    this.track('timers', () => clearInterval(id));
    return id;
  }
  raf(fn: FrameRequestCallback): number {
    if (this.closed) return 0;
    let forget = () => { /* Filled before the frame can fire. */ };
    const id = requestAnimationFrame((time) => { forget(); if (!this.closed) fn(time); });
    forget = this.track('rafs', () => cancelAnimationFrame(id));
    return id;
  }
  onDispose(fn: () => void): void { this.track('disposers', fn); }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    const cleanups = [...this.cleanups].reverse();
    this.cleanups.clear();
    const errors: unknown[] = [];
    for (const cleanup of cleanups) {
      try { cleanup.run(); } catch (error) { errors.push(error); }
    }
    this.children.clear();
    this.owned.clear();
    this.detach?.();
    this.detach = undefined;
    if (errors.length > 0) throw new AggregateError(errors,
      `Scope ${this.name} disposal failed: ${errors.flatMap(disposalErrorMessages).join('; ')}`);
  }
}
