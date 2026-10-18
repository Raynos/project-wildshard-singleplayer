import { BufferAttribute, BufferGeometry, Matrix4, Mesh, type Object3D } from 'three';
import authored from '../data/timberWorld.generated.json' with { type: 'json' };
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };

function triangleGeometry(value: unknown): value is BufferGeometry { return value instanceof BufferGeometry; }

/** Retain the native GLB-node projection, Float32 rounding and complete world transform. */
export function cragNodeGeometry(scene: Object3D): Map<string, BufferGeometry> {
  scene.updateMatrixWorld(true);
  const result = new Map<string, BufferGeometry>();
  const attributes = { position: { source: 'position', size: 3, fill: undefined }, normal: { source: 'normal', size: 3, fill: undefined },
    aCdata: { source: 'color', size: 4, fill: 1 }, aCtint: { source: 'uv', size: 2, fill: 0 } };
  scene.traverse(node => {
    if (!(node instanceof Mesh)) return;
    const source: unknown = node.geometry;
    if (!triangleGeometry(source)) throw new Error('Crag node needs triangle geometry');
    const original = source;
    const geometry = new BufferGeometry(), count = original.getAttribute('position').count;
    for (const [name, row] of Object.entries(attributes)) {
      const channel = original.hasAttribute(row.source) ? original.getAttribute(row.source) : undefined;
      if (channel === undefined && row.fill === undefined || channel !== undefined && channel.count !== count) throw new Error('Crag source channel differs');
      const values = new Float32Array(count * row.size);
      for (let i = 0; i < count; i++) for (let k = 0; k < row.size; k++) values[i * row.size + k] = channel === undefined ? row.fill ?? 0 : k < channel.itemSize ? channel.getComponent(i, k) : 1;
      geometry.setAttribute(name, new BufferAttribute(values, row.size));
    }
    const index = original.getIndex();
    if (index !== null) geometry.setIndex(new BufferAttribute(Uint32Array.from({ length: index.count }, (_, i) => index.getX(i)), 1));
    geometry.applyMatrix4(node.matrixWorld); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    result.set(node.name, geometry);
  });
  return result;
}

interface FixedRows {
  geometry: { library: string; model: string }[];
  fixed: { lod0: number; lod1: number; near: number; far: number; sphere: number[]; matrix: number[] }[];
  capacity: { instances: number; vertices: number; indices: number };
}
/** Keep final atlas names and fixed-instance order separate from the native reservations. */
export function cragFixedRows(tier: 'phone' | 'desktop'): FixedRows {
  const assembly = authored.cragAssembly.tiers[tier];
  const geometry = assembly.slots.map(slot => ({ library: 'crags', model: slot.skin >= 0
    ? `${tier}-skin-${String(slot.skin >> 1)}-${slot.skin % 2 === 1 ? 'far' : 'near'}` : slot.cave }));
  const frame = new Matrix4().makeRotationY(LAYOUT.BEAR_CAVE.rot).setPosition(LAYOUT.BEAR_CAVE.x, 0, LAYOUT.BEAR_CAVE.z);
  const fixed = assembly.plans.map(row => ({ lod0: row.lod0, lod1: row.lod1, near: row.near, far: row.far,
    sphere: [row.x, row.y, row.z, row.r], matrix: row.cave ? frame.elements : new Matrix4().elements }));
  return { geometry, fixed, capacity: assembly.reserve };
}
