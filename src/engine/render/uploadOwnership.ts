import { BufferGeometry, Material, Texture, WebGLRenderTarget, InstancedMesh, BatchedMesh, type Object3D, type WebGLRenderer } from 'three';
import { ownSceneResource, sceneObjectOwner, sceneResourceOwner } from '../app/sceneOwnership';
import type { Scope } from '../app/scope';
import type { AssetService } from '../app/assets';

function eventMethod(resource: object, method: 'addEventListener' | 'removeEventListener', listener: () => void): void {
  const fn: unknown = Reflect.get(resource, method);
  if (typeof fn === 'function') Reflect.apply(fn, resource, ['dispose', listener]);
}

type Resource = BufferGeometry | Material | Texture | WebGLRenderTarget | InstancedMesh | BatchedMesh;
const isResource = (value: unknown): value is Resource => value instanceof BufferGeometry || value instanceof Material ||
  value instanceof Texture || value instanceof WebGLRenderTarget || value instanceof InstancedMesh || value instanceof BatchedMesh;
/** The resources a material's program and samplers upload with: the material, its maps and its uniform samplers. */
function materialUploads(material: Resource): Resource[] {
  const out: Resource[] = [material];
  for (const value of Object.values(material)) if (value instanceof Texture) out.push(value);
  const uniforms: unknown = Reflect.get(material, 'uniforms');
  if (typeof uniforms === 'object' && uniforms !== null) {
    for (const uniform of Object.values(uniforms)) {
      const value: unknown = typeof uniform === 'object' && uniform !== null ? Reflect.get(uniform, 'value') : undefined;
      if (value instanceof Texture) out.push(value);
    }
  }
  return out;
}

/** Renderer-local ownership of uploaded resources, including generated and detached resources.
 * No EventDispatcher prototype changes: this renderer reports its own property lookups and draws.
 *
 * SF57 round 4 (every GPU upload has an owner): an upload is attributed to its owner when it is made: the drawn object's
 * scene owner, or, for a `compile()` (the shader warm-up's detached stand-ins), the owner of each compiled object (a
 * stand-in resolves to the mesh it stands in for, `linkStandIn`). An owned upload is freed with that owner. What has no
 * owner at upload (an engine-global resource, or a build's resource whose scene owner is not known yet) is held weakly:
 * the page level still frees it at its end, and a later owned draw adopts it, but this set never keeps it alive. One
 * collected without a dispose is counted (`orphansCollected`), so an unowned allocation stays visible.
 */
export class UploadOwnership {
  /** Uploads with an owner (or a named acquisition): their owner keeps them alive and frees them. */
  private readonly owned = new Set<Resource>();
  /** Uploads with no owner yet, held weakly. */
  private readonly orphans = new Set<WeakRef<Resource>>();
  private readonly orphanRefs = new WeakMap<Resource, WeakRef<Resource>>();
  /** Every observed upload's lifetime hooks, registered once. */
  private readonly tracked = new WeakSet<Resource>();
  private collected = 0;
  /** Each tracked resource's release (its dispose listener), so a render target releases its attachments with it. */
  private readonly releases = new WeakMap<Resource, () => void>();
  /** A compiled object's samplers and geometry, with that object's owner: their own upload (the warm-up's texture pass,
   *  a later draw) is attributed to it when no drawn owner is known then. A hint never observes a resource by itself. */
  private readonly hints = new WeakMap<Resource, Scope>();
  /** Resources whose dispose is being dispatched now: three's own dispose handler looks them up after ours ran
   *  (deallocateTexture / deallocateMaterial call properties.get), which is not an upload. Cleared after the task. */
  private readonly releasing = new WeakSet<Resource>();
  private readonly finalizer = new FinalizationRegistry<{ ref: WeakRef<Resource>; forget: () => void }>((held) => {
    if (this.orphans.delete(held.ref)) this.collected++;
    held.forget();
  });
  private readonly level: Scope;
  private readonly assets: AssetService;
  private drawOwner: Scope | null = null;
  constructor(level: Scope, assets: AssetService) { this.level = level; this.assets = assets; }
  /** A snapshot of the live uploads (owned, and the unowned ones not yet collected). */
  resources(): ReadonlySet<object> {
    const out = new Set<object>(this.owned);
    for (const ref of this.orphans) { const resource = ref.deref(); if (resource !== undefined) out.add(resource); }
    return out;
  }
  has(resource: object): boolean {
    return isResource(resource) && (this.owned.has(resource) || this.isOrphan(resource));
  }
  /** Live unowned uploads, and how many were garbage collected without a dispose (their GPU allocation was never freed). */
  orphanCensus(): { readonly live: number; readonly collected: number } {
    let live = 0; for (const ref of this.orphans) if (ref.deref() !== undefined) live++;
    return { live, collected: this.collected };
  }
  private isOrphan(resource: Resource): boolean {
    const ref = this.orphanRefs.get(resource);
    return ref !== undefined && this.orphans.has(ref);
  }
  observe(value: unknown): void {
    if (this.level.disposed || !isResource(value)) return;
    const resource = value;
    // Uniform samplers and lazily allocated targets need not be reachable from the material's public properties.
    // Their actual draw still identifies the subtree owner, even if an asynchronous build uploaded them earlier.
    if (!this.assets.isAcquired(resource)) {
      if (this.drawOwner !== null && !this.drawOwner.disposed) ownSceneResource(resource, this.drawOwner);
      else if (sceneResourceOwner(resource)?.disposed === true) {
        // SF57: three's own dispose handlers look the resource up (deallocateMaterial / deallocateTexture call
        // properties.get) while its owner is tearing it down. That lookup is not a use: adopting there made the page's
        // level own every retired resident's materials and textures for the page's life.
        if (sceneResourceOwner(resource)?.disposing === true) return;
        // A CPU-backed sampler can be uploaded again outside its former subtree. Its expired owner cannot
        // retire that new allocation; adopt it into this live renderer lifetime before the property lookup.
        ownSceneResource(resource, this.level);
      } else if (sceneResourceOwner(resource) === null) {
        const hint = this.hints.get(resource);
        if (hint !== undefined && !hint.disposed) ownSceneResource(resource, hint);
      }
    }
    const owner = sceneResourceOwner(resource);
    this.assets.observeResidency(resource, owner ?? this.drawOwner);
    if (owner !== null || this.assets.isAcquired(resource)) this.hold(resource);
    else this.holdWeakly(resource);
  }
  private hold(resource: Resource): void {
    if (this.owned.has(resource)) return;
    const ref = this.orphanRefs.get(resource);
    if (ref !== undefined) { this.orphans.delete(ref); this.orphanRefs.delete(resource); this.finalizer.unregister(ref); }
    this.owned.add(resource);
    this.track(resource);
  }
  private holdWeakly(resource: Resource): void {
    if (this.owned.has(resource) || this.isOrphan(resource)) return;
    const ref = new WeakRef(resource);
    this.orphans.add(ref); this.orphanRefs.set(resource, ref);
    const forget = this.track(resource);
    this.finalizer.register(resource, { ref, forget }, ref);
  }
  /** The dispose listener and the level's end-of-life capture, once per resource; neither keeps the resource alive.
   *  SF57 leak5: the two closures are made in separate functions. Made in one, they shared one closure context, and the
   *  level's capture (and the finalizer's `forget`) then held the resource through the listener's binding: every weakly
   *  held upload stayed alive until the page level ended. */
  private track(resource: Resource): () => void {
    if (this.tracked.has(resource)) return () => { /* Already tracked. */ };
    this.tracked.add(resource);
    const forget = this.captureAtLevelEnd(new WeakRef(resource));
    this.listenForRelease(resource, forget);
    return forget;
  }
  /** The page level's end of life frees what is still live, unowned and not acquired. Holds only a WeakRef. */
  private captureAtLevelEnd(ref: WeakRef<Resource>): () => void {
    return this.level.capture('resources', () => {
      const live = ref.deref();
      if (live === undefined) return;
      const owner = sceneResourceOwner(live);
      if ((this.owned.has(live) || this.isOrphan(live)) && !this.assets.isAcquired(live) && owner === null) live.dispose();
      // Engine/acquired resources remain visible to the independent GPU census after level disposal.
    });
  }
  /** The resource's own dispose event forgets it. Reachable only from the resource's listeners. */
  private listenForRelease(resource: Resource, forget: () => void): void {
    const released = (): void => {
      this.releasing.add(resource); queueMicrotask(() => { this.releasing.delete(resource); });
      this.retire(resource);
      eventMethod(resource, 'removeEventListener', released); forget();
      this.releases.delete(resource);
      // SF57 leak5: a render target's dispose frees its attachments (three's deallocateRenderTarget) without dispatching
      // their own dispose, so each one is released here with it, or a freed attachment stayed in the live set
      if (resource instanceof WebGLRenderTarget) for (const texture of resource.textures) this.releases.get(texture)?.();
    };
    this.releases.set(resource, released);
    eventMethod(resource, 'addEventListener', released);
  }
  private retire(resource: Resource): void {
    this.tracked.delete(resource);
    this.owned.delete(resource);
    const weak = this.orphanRefs.get(resource);
    if (weak !== undefined) { this.orphans.delete(weak); this.orphanRefs.delete(resource); this.finalizer.unregister(weak); }
  }
  /** A `compile()` is a draw of every object in it: each object's material program is that object's owner's upload, and its
   *  samplers and geometry carry that owner as a hint for their own upload. */
  private compiled(root: Object3D): void {
    root.traverse((node) => {
      const material: unknown = Reflect.get(node, 'material');
      if (material === undefined || material === null) return;
      const owner = sceneObjectOwner(node);
      if (owner === null || owner.disposed) return;
      const prior = this.drawOwner; this.drawOwner = owner;
      try {
        const materials: unknown[] = Array.isArray(material) ? material : [material];
        const geometry: unknown = Reflect.get(node, 'geometry');
        for (const m of materials) {
          if (!isResource(m)) continue;
          // three's compile builds the material's program now: that upload is this object's
          this.observe(m);
          for (const r of materialUploads(m)) if (r !== m && sceneResourceOwner(r) === null) this.hints.set(r, owner);
        }
        if (isResource(geometry) && sceneResourceOwner(geometry) === null) this.hints.set(geometry, owner);
      } finally { this.drawOwner = prior; }
    });
  }
  attach(renderer: WebGLRenderer): void {
    const get = renderer.properties.get.bind(renderer.properties);
    renderer.properties.get = (object) => {
      // a lookup outside any draw while the resource's dispose is dispatched is three's own teardown, not an upload
      if (this.drawOwner !== null || !(isResource(object) && this.releasing.has(object))) this.observe(object);
      return get(object);
    };
    const draw = renderer.renderBufferDirect.bind(renderer);
    renderer.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
      const prior = this.drawOwner; this.drawOwner = sceneObjectOwner(object);
      try {
        // A batch must claim its private aggregate geometry/textures before renderer property reads observe them.
        this.observe(object); this.observe(geometry); this.observe(material);
        draw(camera, scene, geometry, material, object, group);
      } finally { this.drawOwner = prior; }
    };
    // Test doubles carry only the draw path.
    if (Reflect.has(renderer, 'compile')) {
      const compile = renderer.compile.bind(renderer);
      renderer.compile = (scene, camera, target) => { this.compiled(scene); return compile(scene, camera, target); };
    }
    if (Reflect.has(renderer, 'compileAsync')) {
      const compileAsync = renderer.compileAsync.bind(renderer);
      renderer.compileAsync = (scene, camera, target) => { this.compiled(scene); return compileAsync(scene, camera, target); };
    }
  }
}
