import type { Mesh, InstancedMesh, Object3D } from 'three';
import { installScopeEnvironment } from '../scopeEnvironment';

/** Install browser scheduling before entry; the rendered host supplies its native mesh classes after download. */
export function installBrowserScopeEnvironment(classes?: { Mesh: typeof Mesh; InstancedMesh: typeof InstancedMesh }): void {
  const isPrimitive = (node: Object3D): node is Mesh => classes !== undefined && node instanceof classes.Mesh;
  installScopeEnvironment({
    ...(classes === undefined ? {} : { primitives: (root: Object3D, own: (resource: { dispose: () => void }) => void, instances: boolean) => {
      root.traverse(node => {
        if (!isPrimitive(node)) return;
        own(node.geometry);
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) own(material);
        if (instances && node instanceof classes.InstancedMesh) own(node);
      });
    } }),
    targetKind: (target) => typeof window !== 'undefined' && target === window ? 'window'
      : typeof document !== 'undefined' && target === document ? 'document'
        : typeof HTMLCanvasElement !== 'undefined' && target instanceof HTMLCanvasElement ? 'canvas' : 'other',
    frame: (render) => requestAnimationFrame(render), cancelFrame: (id) => cancelAnimationFrame(id),
  });
}
