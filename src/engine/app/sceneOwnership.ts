import { BufferGeometry, Material, Texture, WebGLRenderTarget, Object3D, InstancedMesh, BatchedMesh } from 'three';
import type { Scope, Disposable3 } from './scope';
import type { AssetService } from './assets';

/** Walk resource containers, stopping at scene nodes so the whole scene is never mistaken for an asset. */
export function containerResources(container: unknown): Set<Disposable3> {
  const resources = new Set<Disposable3>(), visited = new Set<object>();
  const visit = (value: unknown): void => {
    if (typeof value !== 'object' || value === null || visited.has(value) || ArrayBuffer.isView(value)) return;
    visited.add(value);
    if (value instanceof BufferGeometry || value instanceof Material || value instanceof Texture || value instanceof WebGLRenderTarget) {
      resources.add(value);
      if (value instanceof Texture || value instanceof BufferGeometry) return;
    }
    if (value instanceof Object3D || Reflect.get(value, 'isWebGLRenderer') === true || (typeof Node !== 'undefined' && value instanceof Node)) return;
    if (value instanceof Map || value instanceof Set) { for (const child of value.values()) visit(child); return; }
    for (const child of Object.values(value)) visit(child);
  };
  visit(container);
  return resources;
}
export function sceneResources(root: Object3D): Set<Disposable3> {
  const resources = new Set<Disposable3>();
  root.traverse((node) => {
    if (node instanceof InstancedMesh || node instanceof BatchedMesh) resources.add(node);
    for (const key of ['geometry', 'material', 'customDepthMaterial', 'customDistanceMaterial', 'shadow', 'environment', 'background']) {
      for (const resource of containerResources(Reflect.get(node, key))) resources.add(resource);
    }
  });
  return resources;
}

export class SceneOwnership {
  private readonly engineNodes = new Set<Object3D>();
  private readonly acquired = new Set<Disposable3>();
  private readonly roots = new Set<Object3D>();
  constructor(private readonly scene: Object3D, private readonly level: Scope, private readonly assets: AssetService) {}
  retain(root: Object3D): void {
    root.traverse((node) => { this.engineNodes.add(node); });
    for (const resource of sceneResources(root)) this.acquire(resource);
  }
  retainContainer(container: unknown): void { for (const resource of containerResources(container)) this.acquire(resource); }
  retainedNodeCount(): number { return this.engineNodes.size; }
  private acquire(resource: Disposable3): void {
    if (this.acquired.has(resource)) return;
    const key = `scene:${String(Reflect.get(resource, 'uuid'))}`;
    if (!this.assets.has(key)) this.assets.register(key, resource, { retain: true });
    this.assets.acquire(key);
    this.acquired.add(resource);
    this.level.onDispose(() => { this.assets.release(key); });
  }
  capture(): void {
    if (this.level.disposed) return;
    const visit = (node: Object3D): void => {
      if (this.engineNodes.has(node)) { for (const child of node.children) visit(child); return; }
      if (!this.roots.has(node)) {
        this.roots.add(node);
        this.level.capture('nodes', () => { node.removeFromParent(); });
      }
      for (const resource of sceneResources(node)) {
        if (this.assets.isAcquired(resource)) this.acquire(resource);
        else this.level.own(resource);
      }
    };
    for (const child of this.scene.children) visit(child);
  }
}
