import { BufferGeometry, Material, Texture, WebGLRenderTarget, Object3D, InstancedMesh, BatchedMesh } from 'three';
import type { Scope, Disposable3 } from './scope';
import type { AssetService } from './assets';

/** Walk resource containers, stopping at scene nodes so the whole scene is never mistaken for an asset. */
export function containerResources(container: unknown, excludeNodes?: ReadonlySet<object>): Set<Disposable3> {
  const resources = new Set<Disposable3>(), visited = new Set<object>();
  const visit = (value: unknown): void => {
    if (typeof value !== 'object' || value === null || visited.has(value) || ArrayBuffer.isView(value)) return;
    visited.add(value);
    if (value instanceof BufferGeometry || value instanceof Material || value instanceof Texture || value instanceof WebGLRenderTarget) {
      resources.add(value);
      if (value instanceof Texture || value instanceof BufferGeometry) return;
    }
    if (value instanceof Object3D) {
      if (!excludeNodes || excludeNodes.has(value)) return;
      value.traverse((node) => {
        for (const key of ['geometry', 'material', 'customDepthMaterial', 'customDistanceMaterial', 'shadow']) visit(Reflect.get(node, key));
      });
      return;
    }
    if (Reflect.get(value, 'isWebGLRenderer') === true || (typeof Node !== 'undefined' && value instanceof Node)) return;
    if (value instanceof Map || value instanceof Set) { for (const child of value.values()) visit(child); return; }
    for (const child of Object.values(value)) visit(child);
  };
  visit(container);
  return resources;
}
interface DelegatedScene { scope: Scope; capture: () => void }
const delegatedScenes = new WeakMap<Object3D, DelegatedScene>();
const resourceOwners = new WeakMap<object, Scope>();

/** Explicit owner of a captured scene resource; renderer observers keep counting it but never free it again. */
export function sceneResourceOwner(resource: object): Scope | null { return resourceOwners.get(resource) ?? null; }

function markResourceOwner(resource: Disposable3, scope: Scope): void {
  resourceOwners.set(resource, scope);
  if (resource instanceof BatchedMesh) {
    // The batch frees these private allocations itself; renderer observations must not free them separately.
    for (const key of ['geometry', '_matricesTexture', '_indirectTexture', '_colorsTexture']) {
      const part: unknown = Reflect.get(resource, key);
      if (part instanceof BufferGeometry || part instanceof Texture) resourceOwners.set(part, scope);
    }
  }
}

/** Give a subtree one explicit resource owner. Parent scene captures retain its census under that owner and never
 * take or free its resources. Nested delegated roots are independent; disposing them in either order is safe. */
export function ownSceneTree(root: Object3D, scope: Scope, assets: Pick<AssetService, 'isAcquired'>): void {
  if (scope.disposed || delegatedScenes.has(root)) throw new Error('Scene subtree requires one live owner');
  const capture = (): void => {
    for (const resource of sceneResources(root, scope)) if (!assets.isAcquired(resource)) {
      markResourceOwner(resource, scope); scope.own(resource);
    }
    for (const child of root.children) captureDelegatedScenes(child);
  };
  delegatedScenes.set(root, { scope, capture });
  scope.onDispose(() => {
    capture(); root.removeFromParent(); root.clear(); delegatedScenes.delete(root);
  });
}
function captureDelegatedScenes(root: Object3D): void {
  const delegated = delegatedScenes.get(root);
  if (delegated !== undefined) { delegated.capture(); return; }
  for (const child of root.children) captureDelegatedScenes(child);
}

/** Resources a caller may own; explicit subtree owners are respected even when passed as the root. */
export function sceneResources(root: Object3D, owner?: Scope): Set<Disposable3> {
  const resources = new Set<Disposable3>();
  const visit = (node: Object3D): void => {
    const delegated = delegatedScenes.get(node);
    if (delegated !== undefined && (node !== root || delegated.scope !== owner)) return;
    if (node instanceof InstancedMesh || node instanceof BatchedMesh) resources.add(node);
    for (const key of ['geometry', 'material', 'customDepthMaterial', 'customDistanceMaterial', 'shadow', 'environment', 'background', 'skeleton']) {
      // BatchedMesh.dispose owns its private aggregate geometry and internal textures.
      if (node instanceof BatchedMesh && key === 'geometry') continue;
      for (const resource of containerResources(Reflect.get(node, key))) resources.add(resource);
    }
    for (const child of node.children) visit(child);
  };
  visit(root);
  return resources;
}

export class SceneOwnership {
  private readonly engineNodes = new Set<Object3D>();
  private readonly acquired = new Set<Disposable3>();
  private readonly roots = new Set<Object3D>();
  private readonly scene: Object3D;
  private readonly level: Scope;
  private readonly assets: AssetService;
  constructor(scene: Object3D, level: Scope, assets: AssetService) { this.scene = scene; this.level = level; this.assets = assets; }
  retain(root: Object3D): void {
    root.traverse((node) => { this.engineNodes.add(node); });
    for (const resource of sceneResources(root)) this.acquire(resource);
  }
  retainContainer(container: unknown): void {
    for (const resource of containerResources(container, this.engineNodes)) this.acquire(resource);
    // Shadow targets and bone textures are allocated lazily after the engine nodes were first retained.
    for (const node of this.engineNodes) for (const key of ['geometry', 'material', 'customDepthMaterial', 'customDistanceMaterial', 'shadow', 'environment', 'background', 'skeleton']) {
      for (const resource of containerResources(Reflect.get(node, key))) this.acquire(resource);
    }
  }
  retainedNodeCount(): number {
    let count = 0; this.scene.traverse((node) => { if (this.engineNodes.has(node)) count++; }); return count;
  }
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
      const delegated = delegatedScenes.get(node);
      if (delegated !== undefined) { delegated.capture(); return; }
      captureDelegatedScenes(node);
      if (this.engineNodes.has(node)) { for (const child of node.children) visit(child); return; }
      if (!this.roots.has(node)) {
        this.roots.add(node);
        this.level.capture('nodes', () => { node.removeFromParent(); });
      }
      for (const resource of sceneResources(node)) {
        if (this.assets.isAcquired(resource)) this.acquire(resource);
        else { markResourceOwner(resource, this.level); this.level.own(resource); }
      }
    };
    for (const child of this.scene.children) visit(child);
  }
}
