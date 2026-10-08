import { BufferGeometry, Material, Texture, WebGLRenderTarget, InstancedMesh, BatchedMesh, type WebGLRenderer } from 'three';
import { sceneResourceOwner } from '../app/sceneOwnership';
import type { Scope } from '../app/scope';
import type { AssetService } from '../app/assets';

function eventMethod(resource: object, method: 'addEventListener' | 'removeEventListener', listener: () => void): void {
  const fn: unknown = Reflect.get(resource, method);
  if (typeof fn === 'function') Reflect.apply(fn, resource, ['dispose', listener]);
}

type Resource = BufferGeometry | Material | Texture | WebGLRenderTarget | InstancedMesh | BatchedMesh;
/** Renderer-local ownership of uploaded resources, including generated and detached resources.
 * No EventDispatcher prototype changes: this renderer reports its own property lookups and draws.
 */
export class UploadOwnership {
  private readonly live = new Set<Resource>();
  private readonly level: Scope;
  private readonly assets: AssetService;
  constructor(level: Scope, assets: AssetService) { this.level = level; this.assets = assets; }
  resources(): ReadonlySet<object> { return this.live; }
  observe(value: unknown): void {
    if (this.level.disposed || !(value instanceof BufferGeometry || value instanceof Material || value instanceof Texture ||
      value instanceof WebGLRenderTarget || value instanceof InstancedMesh || value instanceof BatchedMesh) || this.live.has(value)) return;
    const resource = value;
    this.live.add(resource);
    let forget = () => { /* Bound after registration. */ };
    const released = (): void => { this.live.delete(resource); eventMethod(resource, 'removeEventListener', released); forget(); };
    eventMethod(resource, 'addEventListener', released);
    forget = this.level.capture('resources', () => {
      const owner = sceneResourceOwner(resource);
      if (this.live.has(resource) && !this.assets.isAcquired(resource) && owner === null) resource.dispose();
      // Engine/acquired resources remain visible to the independent GPU census after level disposal.
    });
  }
  attach(renderer: WebGLRenderer): void {
    const get = renderer.properties.get.bind(renderer.properties);
    renderer.properties.get = (object) => { this.observe(object); return get(object); };
    const draw = renderer.renderBufferDirect.bind(renderer);
    renderer.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
      this.observe(geometry); this.observe(material); this.observe(object);
      draw(camera, scene, geometry, material, object, group);
    };
  }
}
