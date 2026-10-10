// inkedRig — dressing a first-person rig in an inked toon look (SHARD-PLATFORM M3, ex Nine Dragon's vm/fpArms.ts): every
// GLB mesh is either an ink hull (the GLB's `hull` extra: back faces pushed out a pixel width, drawn first) or a toon body
// with its part's map pair (the `maps` extra) and asset rotation; a skinned body is an open tube (a sleeve, a cuff, a
// gauntlet) a swing looks into, so it is drawn double-sided. A living part the GLB can't hold is a body mesh paired with
// its own hull over one geometry. The programs are the caller's (`InkedRigLook`); nothing here knows a shard.
//
//   const look = { body: (maps, nrm, rot) => toon(u, maps, nrm, rot), hull: (k) => ink(u, k) };
//   new FpArmsRig(scene, clips, ROW, contract, bake, { mesh: (o, ud, rig) => dressInkedMesh(o, ud, rig, look, maps), dress });
import { type BufferGeometry, DoubleSide, Matrix3, Mesh, type Object3D, type ShaderMaterial, SkinnedMesh, type Texture } from 'three';
import { type FpArmsRig, type FpMeshData, sharedRigMaps } from './fpArmsRig';

/** A rig's two programs: the toon body (a part's maps, normals and asset rotation, or none) and the ink hull at a width factor. */
export interface InkedRigLook {
  readonly body: (maps: Texture | null, nrm: Texture | null, assetRot: Matrix3 | null) => ShaderMaterial;
  readonly hull: (k: number) => ShaderMaterial;
}

/** A rig's part maps by name: each part's `[maps, normals]` pair (either may be missing). */
export type InkedRigMaps = Map<string, [Texture | null, Texture | null]>;

/** Dress one GLB mesh of a rig: its ink hull (drawn first) or its toon body with its part's maps; the material joins the rig's. */
export function dressInkedMesh(o: Mesh, ud: FpMeshData, rig: FpArmsRig, look: InkedRigLook, textures: InkedRigMaps): 'hull' | 'body' {
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
export function addInkedPair(parent: Object3D, g: BufferGeometry, body: ShaderMaterial, hull: ShaderMaterial, hullNormals: boolean): void {
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
