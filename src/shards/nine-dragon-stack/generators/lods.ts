import { type BufferGeometry, Color, Float32BufferAttribute, MeshStandardMaterial } from 'three';
import { hookGeometry } from './hookGeometry';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { castGeometry, packGeometry } from './casts';
import { lodReady, simplifiedCopy, clusterLod, PX_PER_M } from './meshLod';
import lodRows from '../data/lod.json' with { type: 'json' };
import hookRows from '../data/hookSpecimen.json' with { type: 'json' };

const { MID_FROM, MID_PX, SCULPT_PX, LOD_TRIS } = lodRows;


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
  const hook = await hookGeometry(read);
  rows.set('dragon-hook', staticGlb([{ name: 'dragon-hook', geometry: hook, material: new MeshStandardMaterial(), nativeAttributes: true, compactIndex: true }], 'nine-hook'));
  for (const d of hookRows.lods) mid('dragon-hook', hook, d, (d * PX_PER_M * SCULPT_PX) / hookRows.scale);
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
