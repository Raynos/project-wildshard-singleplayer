// inkedRig — dressing a first-person rig in an inked toon look (SHARD-PLATFORM M3, ex Nine Dragon's vm/fpArms.ts): every
// GLB mesh is either an ink hull (the GLB's `hull` extra: back faces pushed out a pixel width, drawn first) or a toon body
// with its part's map pair (the `maps` extra) and asset rotation; a skinned body is an open tube (a sleeve, a cuff, a
// gauntlet) a swing looks into, so it is drawn double-sided. A living part the GLB can't hold is a body mesh paired with
// its own hull over one geometry. The programs are the caller's (`InkedRigLook`); nothing here knows a shard.
//
//   const look = { body: (maps, nrm, rot) => toon(u, maps, nrm, rot), hull: (k) => ink(u, k) };
//   new FpArmsRig(scene, clips, ROW, contract, bake, { mesh: (o, ud, rig) => dressInkedMesh(o, ud, rig, look, maps), dress });
import { type BufferGeometry, BufferAttribute, LinearMipmapLinearFilter, NoColorSpace, TextureLoader, DoubleSide, Matrix3, Mesh, type Object3D, type Material, SkinnedMesh, type Texture } from 'three';
import { phoneUrl } from '@wildshard/engine/boot/bytes';
import { ktx2Texture } from '@wildshard/engine/core/ktx2';

export interface FpMeshData { hull?: boolean; hullK?: number; maps?: string; assetRot?: number[] }
interface InkedMaterials { readonly materials: Material[] }

/** A rig's two programs: the toon body (a part's maps, normals and asset rotation, or none) and the ink hull at a width factor. */
export interface InkedRigLook {
  readonly body: (maps: Texture | null, nrm: Texture | null, assetRot: Matrix3 | null) => Material;
  readonly hull: (k: number) => Material;
}

/** A rig's part maps by name: each part's `[maps, normals]` pair (either may be missing). */
export type InkedRigMaps = Map<string, [Texture | null, Texture | null]>;

/** Dress one GLB mesh of a rig: its ink hull (drawn first) or its toon body with its part's maps; the material joins the rig's. */
export function dressInkedMesh(o: Mesh, ud: FpMeshData, rig: InkedMaterials, look: InkedRigLook, textures: InkedRigMaps): 'hull' | 'body' {
  if (ud.hull === true) {
    const m = look.hull(ud.hullK ?? 1);
    o.material = m;
    o.renderOrder = -1;
    rig.materials.push(m);
    return 'hull';
  }
  const tex = ud.maps === undefined ? undefined : textures.get(ud.maps);
  const rot = ud.assetRot === undefined ? null : new Matrix3().fromArray(ud.assetRot);
  const m = look.body(tex?.[0] ?? null, tex?.[1] ?? null, rot);
  // an open tube: a swing looks into it, so its inside is drawn too (single-sided, the hull's back faces showed through)
  if (o instanceof SkinnedMesh) m.side = DoubleSide;
  o.material = m;
  rig.materials.push(m);
  return 'body';
}

/** A body mesh and its ink hull over one geometry under `parent` (the hull drawn first, neither culled); `hullNormals` copies the normals the hull pushes along (`aHullN`). */
export function addInkedPair(parent: Object3D, g: BufferGeometry, body: Material, hull: Material, hullNormals: boolean): void {
  if (hullNormals) {
    const nor = g.getAttribute('normal');
    g.setAttribute('aHullN', nor.clone());
  }
  const b = new Mesh(g, body), h = new Mesh(g, hull);
  h.renderOrder = -1;
  b.frustumCulled = false;
  h.frustumCulled = false;
  parent.add(h, b);
}

/** A rig's part maps (`<base><name>-maps.webp` / `-nrm.webp`, shared with every rig reading them), by name. */
export async function loadInkedRigMaps(base: string, names: readonly string[]): Promise<InkedRigMaps> {
  const pairs = await Promise.all(names.map((n) => sharedRigMaps(base, n)));
  const textures: InkedRigMaps = new Map();
  for (let i = 0; i < names.length; i++) textures.set(names[i] ?? '', pairs[i] ?? [null, null]);
  return textures;
}

export function prepRigGeometry(g: BufferGeometry, rename: Readonly<Record<string, string>>): void {
  const names = Object.entries(rename);
  if (names.length > 8) throw new Error('Rig attribute rename bound exceeded');
  for (let i = 0; i < Math.min(names.length, 8); i++) {
    const entry = names[i]; if (entry === undefined) continue;
    const [from, to] = entry;
    const a = g.getAttribute(from) as BufferAttribute | undefined;
    if (a !== undefined) { g.setAttribute(to, a); g.deleteAttribute(from); }
  }
  const n = g.getAttribute('position').count;
  const nor = g.getAttribute('normal') as BufferAttribute | undefined;
  if (!g.hasAttribute('aNs') && nor !== undefined) g.setAttribute('aNs', nor);
  if (!g.hasAttribute('aFace')) g.setAttribute('aFace', new BufferAttribute(new Float32Array(n * 4), 4));
  if (!g.hasAttribute('color')) {
    const c = new Float32Array(n * 3);
    if (n > 1_000_000) throw new Error('Rig vertex bound exceeded');
    for (let i = 0; i < Math.min(n, 1_000_000); i++) { c[i * 3] = 1; c[i * 3 + 1] = 0.5; c[i * 3 + 2] = 0.5; }
    g.setAttribute('color', new BufferAttribute(c, 3));
  }
  if (!g.hasAttribute('uv')) g.setAttribute('uv', new BufferAttribute(new Float32Array(n * 2), 2));
}

const texLoader = new TextureLoader();

function mapPair(base: string, name: string): Promise<[Texture | null, Texture | null]> {
  const one = async (url: string): Promise<Texture | null> => {
    try {
      const t = await ktx2Texture(phoneUrl(url)) ?? await texLoader.loadAsync(url);
      t.colorSpace = NoColorSpace;
      t.flipY = false;
      t.minFilter = LinearMipmapLinearFilter;
      t.anisotropy = 4;
      return t;
    } catch {
      return null;
    }
  };
  return Promise.all([one(`${base}${name}-maps.webp`), one(`${base}${name}-nrm.webp`)]);
}

/** a part's maps (`<base><name>-maps.webp` and `-nrm.webp`, linear, no flip), loaded once: every rig reading them shares
 *  the textures (nothing writes them) */
const mapLoads = new Map<string, Promise<[Texture | null, Texture | null]>>();
export function sharedRigMaps(base: string, name: string): Promise<[Texture | null, Texture | null]> {
  const key = `${base}${name}`;
  let p = mapLoads.get(key);
  if (p === undefined) { p = mapPair(base, name); mapLoads.set(key, p); }
  return p;
}

