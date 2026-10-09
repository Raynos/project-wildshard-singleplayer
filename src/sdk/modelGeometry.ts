import { BufferGeometry, Material, Mesh, type Object3D } from 'three';

function isGeometryMesh(node: Object3D): node is Mesh {
  if (!(node instanceof Mesh)) return false;
  const geometry: unknown = node.geometry, material: unknown = node.material;
  return geometry instanceof BufferGeometry && (material instanceof Material || (Array.isArray(material) && material.every((item: unknown) => item instanceof Material)));
}

/** Offline model geometry intake. Load once before synchronous model placement, then take independent mutable copies.
 * Materials, animation and colliders stay with their existing runtime owners. No services are installed on import. */
export interface ModelGeometry {
  /** Load the immutable GLB; explicit bytes let a Node baker/test use the identical intake without fetch. */
  load: (bytes?: Uint8Array) => Promise<void>;
  /** A deep attribute copy, safe to scale, merge, change collectible slots or release after GPU upload. */
  copy: () => BufferGeometry;
}

/** A single identity-space, unquantized baked triangle mesh. Custom GLB channels map back to authored shader names. */
export function modelGeometry(url: string, channels: Readonly<Record<string, string>> = {}): ModelGeometry {
  let template: BufferGeometry | undefined, pending: Promise<void> | undefined;
  const load = async (bytes?: Uint8Array): Promise<void> => {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    let input = bytes;
    if (input === undefined) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Baked model load failed: ${url} (${response.status})`);
      input = new Uint8Array(await response.arrayBuffer());
    }
    const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(input).buffer, '');
    const meshes: Mesh[] = [];
    gltf.scene.traverse(node => { if (isGeometryMesh(node)) meshes.push(node); });
    try {
      const [mesh] = meshes;
      if (mesh === undefined || meshes.length !== 1) throw new Error(`Baked model needs one mesh: ${url}`);
      gltf.scene.updateMatrixWorld(true);
      if (mesh.matrixWorld.elements.some((value, i) => value !== (i % 5 === 0 ? 1 : 0))) throw new Error(`Baked model needs identity space: ${url}`);
      const geometry = mesh.geometry.clone();
      const index = geometry.getIndex();
      // The deterministic GLB writer emits identity indices for an authored triangle soup; restore its original draw.
      if (index !== null && index.count === geometry.getAttribute('position').count && Array.from(index.array).every((value, i) => value === i)) geometry.setIndex(null);
      for (const [from, to] of Object.entries(channels)) {
        if (!geometry.hasAttribute(from)) { geometry.dispose(); throw new Error(`Baked model is missing ${from}: ${url}`); }
        geometry.setAttribute(to, geometry.getAttribute(from)); geometry.deleteAttribute(from);
      }
      template = geometry;
    } finally {
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
      }
    }
  };
  const start = async (bytes?: Uint8Array): Promise<void> => {
    try { await load(bytes); } catch (error: unknown) { pending = undefined; throw error; }
  };
  return {
    load: (bytes) => {
      pending ??= start(bytes);
      return pending;
    },
    copy: () => { if (template === undefined) throw new Error(`Baked model was not loaded: ${url}`); return template.clone(); },
  };
}
