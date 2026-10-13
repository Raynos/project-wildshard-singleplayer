import { Mesh, InstancedMesh, type Object3D } from 'three';
import { installScopeEnvironment } from '../scopeEnvironment';

const isPrimitive = (node: Object3D): node is Mesh => node instanceof Mesh;

/** Called by the page composition root before a scope registers browser work. */
export function installBrowserScopeEnvironment(): void {
  installScopeEnvironment({
    primitives: (root, own, instances) => {
      root.traverse(node => {
        if (!isPrimitive(node)) return;
        own(node.geometry);
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) own(material);
        if (instances && node instanceof InstancedMesh) own(node);
      });
    },
    targetKind: (target) => typeof window !== 'undefined' && target === window ? 'window'
      : typeof document !== 'undefined' && target === document ? 'document'
        : typeof HTMLCanvasElement !== 'undefined' && target instanceof HTMLCanvasElement ? 'canvas' : 'other',
    frame: (render) => requestAnimationFrame(render), cancelFrame: (id) => cancelAnimationFrame(id),
  });
}
