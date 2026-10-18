import { type BufferGeometry, Color, Float32BufferAttribute, Mesh, type Object3D } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { castGeometry, packGeometry } from './casts';
import { lodReady, simplifiedCopy, clusterLod, PX_PER_M } from './meshLod';
import { MID_FROM, MID_PX, SCULPT_PX, LOD_TRIS } from '../data/lod';

export function tintAbove(src: BufferGeometry, color: number, above = 1.8): BufferGeometry {
  const g = src.clone();
  const pos = g.getAttribute('position'), col = g.getAttribute('color');
  const tint = new Color(color);
  let lmax = 1e-4;
  for (let i = 0; i < col.count; i++) if (pos.getY(i) > above) lmax = Math.max(lmax, 0.2126 * col.getX(i) + 0.7152 * col.getY(i) + 0.0722 * col.getZ(i));
  const out = new Float32Array(col.count * 3);
  for (let i = 0; i < col.count; i++) {
    const r = col.getX(i), gg = col.getY(i), b = col.getZ(i);
    if (pos.getY(i) > above) {
      const k = 0.7 + 0.45 * ((0.2126 * r + 0.7152 * gg + 0.0722 * b) / lmax);
      out[i * 3] = tint.r * k;
      out[i * 3 + 1] = tint.g * k;
      out[i * 3 + 2] = tint.b * k;
    } else {
      out[i * 3] = r;
      out[i * 3 + 1] = gg;
      out[i * 3 + 2] = b;
    }
  }
  g.setAttribute('color', new Float32BufferAttribute(out, 3));
  return g;
}

/** Exact native LOD index streams; middle levels borrow the original vertex buffers. */
export async function bakeLods(read: (url: string) => Uint8Array): Promise<Map<string, Uint8Array>> {
  if (!await lodReady()) throw new Error('Nine LOD author requires meshoptimizer');
  const rows = new Map<string, Uint8Array>();
  const mid = (key: string, base: BufferGeometry, distance: number, error: number): void => {
    const geometry = simplifiedCopy(base, error);
    rows.set(`${key}-mid${distance}`, packGeometry(`${key}-mid${distance}`, geometry));
    geometry.dispose();
  };
  const lion = await castGeometry('lion', read);
  for (const d of [10, 30]) mid('lion', lion, d, d * PX_PER_M * SCULPT_PX);
  const { gltf } = await readSourceModel(read('/assets/nine-dragon/lab/grapple/dragon-hook.glb'));
  gltf.scene.updateMatrixWorld(true);
  const meshes: Mesh[] = [];
  const isMesh = (object: Object3D): object is Mesh => object instanceof Mesh;
  gltf.scene.traverse(object => { if (isMesh(object)) meshes.push(object); });
  const source = meshes[0];
  if (source === undefined) throw new Error('Nine hook author has no mesh');
  const hook = source.geometry.clone();
  for (const name of ['position', 'normal', 'tangent']) {
    if (!hook.hasAttribute(name)) continue;
    const a = hook.getAttribute(name);
    if (a.array instanceof Float32Array && !a.normalized) continue;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c);
    hook.setAttribute(name, new Float32BufferAttribute(out, a.itemSize));
  }
  hook.applyMatrix4(source.matrixWorld);
  for (const d of [15, 40]) mid('dragon-hook', hook, d, (d * PX_PER_M * SCULPT_PX) / 0.62);
  for (const name of ['walker-dark', 'walker-light', 'sitter-dark', 'sitter-light'] as const) {
    const base = await castGeometry(name, read);
    const variants: [string, BufferGeometry][] = [[name, base]];
    if (name === 'walker-dark') for (const [pick, color] of [['oxblood', 0x9a2e1c], ['blue', 0x34507e]] as const) variants.push([`walker-${pick}`, tintAbove(base, color)]);
    if (name === 'walker-light') variants.push(['walker-paper', tintAbove(base, 0xb07a34)]);
    for (const [key, geometry] of variants) {
      if (key !== name) rows.set(key, packGeometry(key, geometry));
      for (const d of MID_FROM) mid(key, geometry, d, d * PX_PER_M * MID_PX);
      const far = clusterLod(geometry, LOD_TRIS);
      rows.set(`${key}-far`, packGeometry(`${key}-far`, far));
      far.dispose();
    }
    for (const [, geometry] of variants) geometry.dispose();
  }
  lion.dispose(); hook.dispose();
  return rows;
}
