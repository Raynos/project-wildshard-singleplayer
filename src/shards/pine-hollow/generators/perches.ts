import * as THREE from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';

const isMesh = (node: THREE.Object3D): node is THREE.Mesh => node instanceof THREE.Mesh;

interface Knot { y: number; cx: number; cz: number; r: number }
const STEP = 0.5;
const median = (a: number[]): number => { if (a.length === 0) return 0; const s = a.slice().sort((p, q) => p - q); return s[Math.floor(s.length / 2)] ?? 0; };

/** the spine of one trunk geometry (local space) */
function trunkSpine(g: THREE.BufferGeometry): Knot[] {
  const pos = g.getAttribute('position'), index = g.getIndex();
  const tri = index ? index.count / 3 : pos.count / 3;
  const vi = (k: number): number => (index ? index.getX(k) : k);
  let top = 0;
  for (let i = 0; i < pos.count; i++) top = Math.max(top, pos.getY(i));
  const spine: Knot[] = [];
  let cx = 0, cz = 0, r = 0.3;
  const xs: number[] = [], zs: number[] = [];
  for (let y = STEP; y < top; y += STEP) {
    xs.length = 0; zs.length = 0;
    const reach = Math.max(0.6, r * 2.5) + 0.25;
    for (let t = 0; t < tri; t++) {
      for (let e = 0; e < 3; e++) {
        const a = vi(t * 3 + e), b = vi(t * 3 + ((e + 1) % 3));
        const ya = pos.getY(a), yb = pos.getY(b);
        if ((ya - y) * (yb - y) > 0 || ya === yb) continue;
        const u = (y - ya) / (yb - ya), x = pos.getX(a) + (pos.getX(b) - pos.getX(a)) * u, z = pos.getZ(a) + (pos.getZ(b) - pos.getZ(a)) * u;
        if (Math.hypot(x - cx, z - cz) > reach) continue;
        xs.push(x); zs.push(z);
      }
    }
    if (xs.length < 4) break; // the bark near the spine ends here
    const mx = median(xs), mz = median(zs);
    const rr = median(xs.map((x, k) => Math.hypot(x - mx, (zs[k] ?? mz) - mz)));
    cx = mx; cz = mz; r = rr;
    spine.push({ y, cx, cz, r });
  }
  return spine;
}


/** Author the same half-metre trunk sections formerly sliced lazily by ambient perches. */
export async function pinePerches(bytes: Uint8Array, names: readonly string[]): Promise<{ step: number; spines: Knot[][] }> {
  const source = await readSourceModel(bytes), meshes = new Map<string, THREE.Mesh>();
  source.gltf.scene.traverse(node => { if (isMesh(node)) meshes.set(node.name, node); });
  try {
    return { step: STEP, spines: names.map(name => {
      const mesh = meshes.get(`${name}__trunk`);
      if (mesh === undefined) throw new Error(`Missing authored perch trunk ${name}`);
      mesh.updateWorldMatrix(true, false);
      const attribute = mesh.geometry.getAttribute('position'), values = new Float32Array(attribute.count * 3);
      for (let i = 0; i < attribute.count; i++) { values[i * 3] = attribute.getX(i); values[i * 3 + 1] = attribute.getY(i); values[i * 3 + 2] = attribute.getZ(i); }
      const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(values, 3));
      const index = mesh.geometry.getIndex();
      if (index !== null) geometry.setIndex(new THREE.BufferAttribute(index.array.slice(), 1));
      geometry.applyMatrix4(mesh.matrixWorld);
      try { return trunkSpine(geometry); } finally { geometry.dispose(); }
    }) };
  } finally { for (const mesh of meshes.values()) mesh.geometry.dispose(); }
}
