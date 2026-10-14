import * as THREE from 'three';
import { loadRigFile } from '@wildshard/engine/anim/rig';
import { cacheUntilDisposed, retainCachedResources } from '@wildshard/engine/app/cachedAssets';
import { ktx2Texture } from '@wildshard/engine/core/ktx2';
import type { RGB } from '@wildshard/engine/entities/species/loft';
import type { CreatureHull, EyeSpot } from '@wildshard/engine/entities/species/look';
import { variantDef, type BoneDef, type VariantDef } from '@wildshard/engine/entities/species/registry';

/**
 * Rigged creature hulls (SHARD-PLATFORM W2 C2, one generic family): generated hulls pre-skinned offline to the procedural
 * species' own skeletons, so the species' bones, gaits and AI drive them. A shard declares its family as a row
 * (`RiggedHullFamilyRow`, pure data) and says where its files are; nothing here knows a shard.
 *
 *   const family = riggedHulls(row, { rig: (hull) => url, coat: (hull, kind, variant) => key, coatImage: (key) => url });
 *   await family.preload();                                  // every rig, before a herd spawns (a look's `preload`)
 *   const h = family.skin(kind, variant, bones, eyes, def);  // null → keep the procedural mesh (a look's `skin`)
 *   h.geometry (position, normal, uv, color, skinIndex, skinWeight[, the extras' attributes]; one group)  h.map  h.normalMap
 *
 * Each rig (`<hull>[.phone].rigged.glb`) is a glTF skin whose joints are the species' bones by name and order, with the
 * hull's PBR base colour + normal map. A rig is only used when its joint names match the variant's bones (in order); the
 * model then takes the rig's joint positions. Every variant of a hull wears it, in its authored baked coat (a KTX2 key,
 * else its lossless image; a variant with no baked coat wears the hull's own atlas). A hull's generator flap (the row's
 * `flaps`, `pressFlap`) is pressed onto its body at load (positions + normals only). A variant can add rigid geometry to
 * its hull in the same single draw (`extras`, built once per variant and flagged `overgrown`), e.g. glowing eyes.
 */

/** A generator flap: the back plane z(y) = z0 + (y - y0) · slope; every vertex above `yMin` behind it is pressed onto it,
 *  keeping `keep` of its depth; `bulge` (m) rounds the pressed patch out into a dome (0 at its rim). */
export interface RiggedHullFlap {
  readonly yMin: number; readonly y0: number; readonly z0: number; readonly slope: number; readonly keep: number; readonly bulge: number;
}

/** A coat's fur sheen and backlit rim (sRGB 0..1) worn over its variant's own. */
export interface RiggedHullFur {
  readonly rim: readonly [number, number, number];
  readonly sheenColor: readonly [number, number, number];
}

/** A rigged-hull family as data. */
export interface RiggedHullFamilyRow {
  /** the log prefix (`[<label>] creature rig …`) */
  readonly label: string;
  /** every hull the family preloads, in order */
  readonly rigs: readonly string[];
  /** `kind:variant` → its hull; a variant missing here stays procedural */
  readonly hulls: Readonly<Record<string, string>>;
  /** per hull, the generator flap pressed onto its body */
  readonly flaps?: Readonly<Record<string, RiggedHullFlap>>;
  /** per hull, per variant id, the fur's sheen and rim */
  readonly fur?: Readonly<Record<string, Readonly<Record<string, RiggedHullFur>>>>;
}

/** Where a family's files are, and a variant's optional extra geometry. */
export interface RiggedHullUrls {
  /** a hull's rig for this tier */
  rig: (hull: string) => string;
  /** a baked coat's KTX2 table key */
  coat: (hull: string, kind: string, variant: string) => string;
  /** a baked coat's lossless image (undefined: no baked coat, the hull's own atlas) */
  coatImage: (key: string) => string | undefined;
  /** the hull geometry plus a variant's rigid extras (null: none); built once per variant */
  extras?: (hull: THREE.BufferGeometry, bones: readonly BoneDef[], eyes: readonly EyeSpot[], variant: VariantDef) => THREE.BufferGeometry | null;
}

/** A shard's live rigged-hull family. */
export interface RiggedHulls {
  /** the hull for (kind, variant), or null */
  hullOf: (kind: string, variant: string) => string | null;
  /** every rig loaded (failures are logged: those species stay procedural); every baked coat adopted */
  preload: () => Promise<void>;
  /** the rigged hull for (kind, variant) bound to `bones`, or null (no hull, not loaded, or baked against other bones) */
  skin: (kind: string, variant: string, bones: readonly BoneDef[], eyes: readonly EyeSpot[], definition?: VariantDef) => CreatureHull | null;
}

interface Rig {
  geometry: THREE.BufferGeometry; map: THREE.Texture | null; normalMap: THREE.Texture | null;
  joints: { name: string; pos: THREE.Vector3 }[];
}

const isSkinned = (o: THREE.Object3D): o is THREE.SkinnedMesh => (o as Partial<THREE.SkinnedMesh>).isSkinnedMesh === true;

function floatAttr(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): THREE.BufferAttribute {
  const n = a.count, k = a.itemSize, out = new Float32Array(n * k);
  for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) out[i * k + c] = a.getComponent(i, c);
  return new THREE.BufferAttribute(out, k);
}

/** true when the rig's skin joints are `bones` by name, in order (their rest positions are the rig's) */
function jointsMatch(rig: Rig, bones: readonly BoneDef[]): boolean {
  return rig.joints.length === bones.length && bones.every((b, i) => rig.joints[i]?.name === b.name);
}

/** A family of rigged hulls from its row. */
export function riggedHulls(row: RiggedHullFamilyRow, urls: RiggedHullUrls): RiggedHulls {
  const adopting = new WeakMap<Rig, Promise<void>>();
  const loading = new Map<string, Promise<Rig>>();
  const ready = new Map<string, Rig>();
  const extraGeo = new Map<string, THREE.BufferGeometry | null>();
  const coats = new Map<string, THREE.Texture>();

  const hullOf = (kind: string, variant: string): string | null => row.hulls[`${kind}:${variant}`] ?? null;

  /** load one rig (cached): its geometry in the skeleton's rest space, its textures, the joints' rest positions */
  const loadRig = (name: string): Promise<Rig> => {
    let p = loading.get(name);
    if (!p) {
      p = loadRigFile(urls.rig(name)).then((gltf) => {
        gltf.scene.updateMatrixWorld(true);
        const found: THREE.SkinnedMesh[] = [];
        gltf.scene.traverse((o) => { if (isSkinned(o)) found.push(o); });
        const sm = found[0];
        if (!sm) throw new Error(`creature rig ${name}: no skinned mesh`);
        const src = sm.geometry;
        const geometry = new THREE.BufferGeometry();
        for (const key of ['position', 'normal', 'uv', 'skinWeight'] as const) if (src.hasAttribute(key)) geometry.setAttribute(key, floatAttr(src.getAttribute(key)));
        const si = src.getAttribute('skinIndex');
        const idx16 = new Uint16Array(si.count * 4);
        for (let i = 0; i < si.count; i++) for (let c = 0; c < 4; c++) idx16[i * 4 + c] = si.getComponent(i, c);
        geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx16, 4));
        const index = src.getIndex();
        if (index) geometry.setIndex(Array.from(index.array));
        // a generator flap pressed onto the body — positions + normals only, the skin untouched
        const trim = row.flaps?.[name];
        if (trim !== undefined) {
          const pa = geometry.getAttribute('position').array, na = geometry.getAttribute('normal').array, ia = geometry.getIndex()?.array;
          if (pa instanceof Float32Array && na instanceof Float32Array && ia !== undefined) pressFlap(pa, na, ia, trim);
        }
        const n = geometry.getAttribute('position').count;
        // the fur material reads vertex colours: white (the atlas carries the coat)
        geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
        geometry.clearGroups(); geometry.addGroup(0, index ? index.count : n, 0);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        if (geometry.boundingSphere !== null) geometry.boundingSphere.radius += 0.6; // animated legs / neck / corpse roll never leave this (as the procedural)
        const mat = Array.isArray(sm.material) ? sm.material[0] : sm.material;
        const std = mat instanceof THREE.MeshStandardMaterial ? mat : null;
        const map = std?.map ?? null, normalMap = std?.normalMap ?? null;
        if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; }
        if (normalMap) normalMap.anisotropy = 4;
        const joints = sm.skeleton.bones.map((b) => ({ name: b.name, pos: new THREE.Vector3().setFromMatrixPosition(b.matrixWorld) }));
        const out: Rig = { geometry, map, normalMap, joints };
        retainCachedResources(out);
        cacheUntilDisposed(out, () => {
          if (ready.get(name) === out) { ready.delete(name); loading.delete(name); }
          adopting.delete(out);
        });
        ready.set(name, out);
        return out;
      });
      loading.set(name, p);
    }
    return p;
  };

  /** Every repaint is an authored, hash-checked image; the compressed path retains its original KTX2 identity. */
  const adoptBakedCoats = async (name: string, rig: Rig): Promise<void> => {
    const map = rig.map;
    if (map === null) return;
    await Promise.all(Object.entries(row.hulls).filter(([, hull]) => hull === name).map(async ([kv]) => {
      const [kind = '', variant = ''] = kv.split(':');
      const key = urls.coat(name, kind, variant);
      const image = urls.coatImage(key);
      if (image === undefined) return; // this hull's unchanged own atlas needs no repaint
      const tex = await ktx2Texture(key) ?? await new THREE.TextureLoader().loadAsync(image);
      tex.flipY = map.flipY; tex.anisotropy = map.anisotropy; tex.wrapS = map.wrapS; tex.wrapT = map.wrapT;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.name = `${map.name}:${name}:${kv}`;
      const identity = `${name}:${kv}`;
      coats.set(identity, retainCachedResources(tex));
      cacheUntilDisposed(tex, () => { if (coats.get(identity) === tex) coats.delete(identity); adopting.delete(rig); });
    }));
  };

  /** each loaded rig's coats are adopted once: a later visit's preload reuses them instead of retaining a fresh set */
  const adoptOnce = (name: string, rig: Rig): Promise<void> => {
    let p = adopting.get(rig);
    if (p === undefined) { p = adoptBakedCoats(name, rig); adopting.set(rig, p); }
    return p;
  };

  const preload = async (): Promise<void> => {
    await Promise.all(row.rigs.map((n) => loadRig(n).then((rig) => adoptOnce(n, rig))
      .catch((e: unknown) => { console.warn(`[${row.label}] creature rig ${n} failed`, e); })));
  };

  const skin = (kind: string, variant: string, bones: readonly BoneDef[], eyes: readonly EyeSpot[], definition?: VariantDef): CreatureHull | null => {
    const name = hullOf(kind, variant);
    if (name === null) return null;
    const rig = ready.get(name);
    if (!rig) return null;
    if (!jointsMatch(rig, bones)) { console.warn(`[${row.label}] creature rig ${name}: baked against other bones than ${kind}:${variant} — re-bake its rig`); return null; }
    const out: BoneDef[] = bones.map((b, i) => { const p = rig.joints[i]?.pos; return { name: b.name, parent: b.parent, pos: p ? [p.x, p.y, p.z] : b.pos }; });
    const key = `${name}:${kind}:${variant}`;
    const map = coats.get(key) ?? rig.map;
    let extra = extraGeo.get(key);
    if (extra === undefined) {
      extra = urls.extras?.(rig.geometry, out, eyes, definition ?? variantDef(kind, variant)) ?? null;
      extraGeo.set(key, extra);
    }
    const f = row.fur?.[name]?.[variant];
    const fur = f === undefined ? undefined : { rim: [f.rim[0], f.rim[1], f.rim[2]] satisfies RGB, sheenColor: [f.sheenColor[0], f.sheenColor[1], f.sheenColor[2]] satisfies RGB };
    return { geometry: extra ?? rig.geometry, map, normalMap: rig.normalMap, bones: out, overgrown: extra !== null, ...(fur !== undefined ? { fur } : {}) };
  };

  return { hullOf, preload, skin };
}

/**
 * Collapse a generator's flap in place. A flap is not a separate part — it IS the surface pulled back and down (deleting
 * its triangles leaves a hole), so it is collapsed, not cut: every vertex above `yMin` behind the back plane is pressed
 * onto that plane, keeping `keep` of its depth (the flap's outer surface stays outermost, so the pressed layers never
 * fight). Topology, uvs, skin indices and weights are untouched — only positions move, and the moved vertices' normals are
 * re-derived from their faces. Returns the pressed vertices (1 = moved), or null when none moved.
 */
export function pressFlap(pos: Float32Array, nrm: Float32Array, index: ArrayLike<number>, t: RiggedHullFlap): Uint8Array | null {
  const n = pos.length / 3;
  const moved = new Uint8Array(n);
  const plane = (y: number): number => t.z0 + (y - t.y0) * t.slope;
  let count = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3] ?? 0, y = pos[i * 3 + 1] ?? 0, z = pos[i * 3 + 2] ?? 0;
    if (y < t.yMin || z >= plane(y)) continue;
    moved[i] = 1;
    count++;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (count === 0) return null;
  // the patch's ellipse (its x / y extent): the dome is `bulge` at the centre, 0 at the rim
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = Math.max(0.02, (x1 - x0) / 2), hy = Math.max(0.02, (y1 - y0) / 2);
  for (let i = 0; i < n; i++) {
    if (moved[i] !== 1) continue;
    const x = pos[i * 3] ?? 0, y = pos[i * 3 + 1] ?? 0, z = pos[i * 3 + 2] ?? 0, zp = plane(y);
    const r2 = ((x - cx) / hx) ** 2 + ((y - cy) / hy) ** 2;
    pos[i * 3 + 2] = zp - (zp - z) * t.keep - t.bulge * Math.max(0, 1 - r2);
  }
  // welded ids (positions to 0.1 mm), so a seam's split vertices share one normal
  const ids = weldIds(pos);
  let nWeld = 0;
  for (let i = 0; i < n; i++) nWeld = Math.max(nWeld, (ids[i] ?? 0) + 1);
  const hit = new Uint8Array(nWeld);
  for (let i = 0; i < n; i++) if (moved[i] === 1) hit[ids[i] ?? 0] = 1;
  const acc = new Float64Array(nWeld * 3);
  for (let f = 0; f + 2 < index.length; f += 3) {
    const a = index[f] ?? 0, b = index[f + 1] ?? 0, c = index[f + 2] ?? 0;
    if (hit[ids[a] ?? 0] !== 1 && hit[ids[b] ?? 0] !== 1 && hit[ids[c] ?? 0] !== 1) continue;
    const ax = pos[a * 3] ?? 0, ay = pos[a * 3 + 1] ?? 0, az = pos[a * 3 + 2] ?? 0;
    const ux = (pos[b * 3] ?? 0) - ax, uy = (pos[b * 3 + 1] ?? 0) - ay, uz = (pos[b * 3 + 2] ?? 0) - az;
    const vx = (pos[c * 3] ?? 0) - ax, vy = (pos[c * 3 + 1] ?? 0) - ay, vz = (pos[c * 3 + 2] ?? 0) - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;   // area-weighted
    for (const v of [a, b, c]) { const o = (ids[v] ?? 0) * 3; acc[o] = (acc[o] ?? 0) + nx; acc[o + 1] = (acc[o + 1] ?? 0) + ny; acc[o + 2] = (acc[o + 2] ?? 0) + nz; }
  }
  for (let i = 0; i < n; i++) {
    const id = ids[i] ?? 0;
    if (hit[id] !== 1) continue;
    const x = acc[id * 3] ?? 0, y = acc[id * 3 + 1] ?? 0, z = acc[id * 3 + 2] ?? 0, l = Math.hypot(x, y, z);
    if (l < 1e-12) continue;
    nrm[i * 3] = x / l; nrm[i * 3 + 1] = y / l; nrm[i * 3 + 2] = z / l;
  }
  return moved;
}

/** per vertex, an id shared by every vertex at the same position (to 0.1 mm): the uv seams' split copies weld */
function weldIds(pos: ArrayLike<number>): Int32Array {
  const n = Math.floor(pos.length / 3), ids = new Int32Array(n), weld = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round((pos[i * 3] ?? 0) * 1e4)},${Math.round((pos[i * 3 + 1] ?? 0) * 1e4)},${Math.round((pos[i * 3 + 2] ?? 0) * 1e4)}`;
    let id = weld.get(k);
    if (id === undefined) { id = weld.size; weld.set(k, id); }
    ids[i] = id;
  }
  return ids;
}
