import * as THREE from 'three';
import { loadRigFile, rigRoot } from '@wildshard/engine/anim/rig';
import { fetchImage } from '@wildshard/engine/boot/bytes';
import { isJsonData } from '@wildshard/format/json';
import type { RiggedHullFamilyRow, RiggedHullFiles, RiggedHullFlap, RiggedHullUrls } from '@wildshard/format/riggedHulls';
import { cacheUntilDisposed, retainCachedResources } from '@wildshard/engine/app/cachedAssets';
import { ktx2File, ktx2Texture, prepareCompressedTexture } from '@wildshard/engine/core/ktx2';
import type { RGB } from '@wildshard/engine/entities/species/loft';
import type { CreatureHull } from '@wildshard/engine/entities/species/look';
import type { BoneDef } from '@wildshard/engine/entities/species/registry';
import { TIER } from '@wildshard/engine/core/tier';

/**
 * Rigged creature hulls (SHARD-PLATFORM W2 C2, one generic family): generated hulls pre-skinned offline to the procedural
 * species' own skeletons, so the species' bones, gaits and AI drive them. A shard declares its family as a row
 * (`RiggedHullFamilyRow`, pure data) and says where its files are; nothing here knows a shard.
 *
 *   const family = riggedHulls(row, { files: { [hull]: { rig, base, normal } }, coats: {} });
 *   await family.preload();                                  // every rig, before a herd spawns (a look's `preload`)
 *   const h = family.skin(kind, variant, bones);              // null → keep the procedural mesh (a look's `skin`)
 *   h.geometry (position, normal, uv, color, skinIndex, skinWeight[, the extras' attributes]; one group)  h.map  h.normalMap
 *
 * Each rig (`<hull>[.phone].rigged.glb`) is a glTF skin whose joints are the species' bones by name and order, with the
 * hull's PBR base colour + normal map, or an image-free rig beside its separate
 * KTX2 base colour and normal maps, sampled exactly as the glTF maps were (`riggedHullMap`). A rig is only used when its joint names match the variant's bones (in order); the
 * model then takes the rig's joint positions. Every variant of a hull wears it, in its authored baked coat (a KTX2 key,
 * else its lossless image; a variant with no baked coat wears the hull's own atlas). A hull's generator flap (the row's
 * `flaps`, `pressFlap`) is pressed onto its body at load (positions + normals only). A variant can add baked rigid parts
 * to its hull in the same single draw (`parts`, merged once per variant and flagged `overgrown`), e.g. glowing eyes.
 */

const productFamilies = new Map<string, RiggedHulls>();
/** Client-only row admission shared by creature factories and cold specimens.
 * The API takes a product id and reads its typed look section; it installs no per-shard callbacks. */
export function productRiggedHulls(slug: string): RiggedHulls {
  const key = slug, cached = productFamilies.get(key);
  if (cached !== undefined) return cached;
  let family: RiggedHulls | undefined, loading: Promise<RiggedHulls> | undefined;
  const prepare = (): Promise<RiggedHulls> => {
    loading ??= (async () => {
      const { loadFirstPartyProduct } = await import('@wildshard/game/shardfile/runtimeProduct');
      const product = await loadFirstPartyProduct(slug), book = product.section('look/rigged-hulls');
      const source = book.tiers[TIER], resources = book.productFiles ? { ...source,
        files: Object.fromEntries(Object.entries(source.files).map(([name, entry]) => [name, typeof entry === 'string' ? product.url(entry)
          : { rig: product.url(entry.rig), base: product.url(entry.base), normal: product.url(entry.normal) }])),
        ...(source.parts === undefined ? {} : { parts: { ...source.parts, file: product.url(source.parts.file) } }) } : source;
      family = riggedHulls(book.family, resources); return family;
    })();
    return loading;
  };
  const ready = (): RiggedHulls => { if (family === undefined) throw new Error('Rigged hull book is not prepared'); return family; };
  const result: RiggedHulls = { load: async name => (await prepare()).load(name), preload: async () => (await prepare()).preload(),
    hullOf: (kind, variant) => ready().hullOf(kind, variant), skin: (kind, variant, bones) => ready().skin(kind, variant, bones) };
  productFamilies.set(key, result); return result;
}

/** A shard's live rigged-hull family. */
export interface RiggedHulls {
  /** One declared rest rig, including coats, borrowed by a specialised view. */
  load: (name: string) => Promise<RiggedHullAsset>;
  /** the hull for (kind, variant), or null */
  hullOf: (kind: string, variant: string) => string | null;
  /** Every declared rig and coat loaded; missing assets refuse. */
  preload: () => Promise<void>;
  /** The declared hull bound to `bones`; null only for a variant with no hull. */
  skin: (kind: string, variant: string, bones: readonly BoneDef[]) => CreatureHull | null;
}

export interface RiggedHullAsset {
  geometry: THREE.BufferGeometry; map: THREE.Texture | null; normalMap: THREE.Texture | null;
  joints: { name: string; pos: THREE.Vector3 }[];
}

const isSkinned = (o: THREE.Object3D): o is THREE.SkinnedMesh => (o as Partial<THREE.SkinnedMesh>).isSkinnedMesh === true;
const isMesh = (object: THREE.Object3D): object is THREE.Mesh => object instanceof THREE.Mesh;

function floatAttr(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): THREE.BufferAttribute {
  const n = a.count, k = a.itemSize, out = new Float32Array(n * k);
  for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) out[i * k + c] = a.getComponent(i, c);
  return new THREE.BufferAttribute(out, k);
}

/**
 * A separate hull map's sampler, as the rig's glTF map had it (glTF orientation, the rig's one repeat sampler, the
 * family's anisotropy 4): flipY false, repeat wrap, anisotropy 4; `base` is sRGB, `normal` keeps its file's colour space
 * (GLTFLoader sets none on a normal map). Named as the glTF image was (`<hull>-albedo` / `<hull>-normal`).
 */
export function riggedHullMap<T extends THREE.Texture>(texture: T, slot: 'base' | 'normal', hull: string): T {
  texture.flipY = false;
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  if (slot === 'base') texture.colorSpace = THREE.SRGBColorSpace;
  texture.name = `${hull}-${slot === 'base' ? 'albedo' : 'normal'}`;
  texture.needsUpdate = true;
  return texture;
}

/** a hull's separate maps, sampled and fenced before the rig publishes them (a failed one frees the other) */
async function loadHullMaps(hull: string, files: RiggedHullFiles): Promise<{ map: THREE.Texture; normalMap: THREE.Texture }> {
  const [base, normal] = await Promise.allSettled([ktx2File(files.base), ktx2File(files.normal)]);
  if (base.status === 'rejected' || normal.status === 'rejected') {
    if (base.status === 'fulfilled') base.value.dispose();
    if (normal.status === 'fulfilled') normal.value.dispose();
    const reason: unknown = base.status === 'rejected' ? base.reason : normal.status === 'rejected' ? normal.reason : null;
    throw reason instanceof Error ? reason : new Error(`creature rig ${hull}: its maps did not load`);
  }
  const [map, normalMap] = await Promise.all([prepareCompressedTexture(riggedHullMap(base.value, 'base', hull)), prepareCompressedTexture(riggedHullMap(normal.value, 'normal', hull))]);
  return { map, normalMap };
}

/** true when the rig's skin joints are `bones` by name, in order (their rest positions are the rig's) */
function jointsMatch(rig: RiggedHullAsset, bones: readonly BoneDef[]): boolean {
  return rig.joints.length === bones.length && bones.every((b, i) => rig.joints[i]?.name === b.name);
}

/** A family of rigged hulls from its row. */
export function riggedHulls(row: RiggedHullFamilyRow, urls: RiggedHullUrls): RiggedHulls {
  if (!isJsonData(row) || !isJsonData(urls)) throw new Error('Rigged hull resources require plain data');
  const adopting = new WeakMap<RiggedHullAsset, Promise<void>>();
  const loading = new Map<string, Promise<RiggedHullAsset>>();
  const ready = new Map<string, RiggedHullAsset>();
  const extraGeo = new Map<string, THREE.BufferGeometry | null>();
  const coats = new Map<string, THREE.Texture>();
  const parts = new Map<string, THREE.BufferGeometry>();
  let partsLoading: Promise<void> | undefined;
  const prepareParts = (): Promise<void> => {
    const source = urls.parts;
    if (source === undefined) return Promise.resolve();
    partsLoading ??= loadRigFile(source.file).then(gltf => {
      rigRoot(gltf).traverse(object => { if (isMesh(object)) parts.set(object.name, object.geometry); });
      for (const name of Object.values(source.nodes)) if (!parts.has(name)) throw new Error(`Missing hull part: ${name}`);
      return undefined;
    });
    return partsLoading;
  };

  const hullOf = (kind: string, variant: string): string | null => row.hulls[`${kind}:${variant}`] ?? null;

  /** load one rig (cached): its geometry in the skeleton's rest space, its textures, the joints' rest positions */
  const loadRig = (name: string): Promise<RiggedHullAsset> => {
    let p = loading.get(name);
    if (!p) {
      const entry = urls.files[name], files = typeof entry === 'string' ? undefined : entry;
      const url = typeof entry === 'string' ? entry : files?.rig;
      if (url === undefined) return Promise.reject(new Error(`creature rig ${name}: no rig file`));
      const maps = files === undefined ? Promise.resolve(null) : loadHullMaps(name, files);
      p = Promise.allSettled([loadRigFile(url), maps]).then(([file, separateMaps]) => {
        if (file.status === 'rejected' || separateMaps.status === 'rejected') {
          if (separateMaps.status === 'fulfilled') { separateMaps.value?.map.dispose(); separateMaps.value?.normalMap.dispose(); }
          const reason: unknown = file.status === 'rejected' ? file.reason : separateMaps.status === 'rejected' ? separateMaps.reason : null;
          throw reason instanceof Error ? reason : new Error(`creature rig ${name}: ${String(reason)}`);
        }
        const gltf = file.value, separate = separateMaps.value;
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
        const rgb = new Float32Array(n * 3).fill(1);
        if (urls.vertexColours === true && src.hasAttribute('color')) {
          const color = src.getAttribute('color');
          for (let i = 0; i < n; i++) { const ao = color.itemSize === 4 ? 0.4 + 0.6 * color.getW(i) : 1;
            rgb[i * 3] = color.getX(i) * ao; rgb[i * 3 + 1] = color.getY(i) * ao; rgb[i * 3 + 2] = color.getZ(i) * ao; }
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
        geometry.clearGroups(); geometry.addGroup(0, index ? index.count : n, 0);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        if (geometry.boundingSphere !== null) geometry.boundingSphere.radius += 0.6; // animated legs / neck / corpse roll never leave this (as the procedural)
        const mat = Array.isArray(sm.material) ? sm.material[0] : sm.material;
        const std = mat instanceof THREE.MeshStandardMaterial ? mat : null;
        const map = separate?.map ?? std?.map ?? null, normalMap = separate?.normalMap ?? std?.normalMap ?? null;
        if (map && separate === null) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; }
        if (normalMap && separate === null) normalMap.anisotropy = 4;
        const joints = sm.skeleton.bones.map((b) => ({ name: b.name, pos: new THREE.Vector3().setFromMatrixPosition(b.matrixWorld) }));
        const out: RiggedHullAsset = { geometry, map, normalMap, joints };
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
  const adoptBakedCoats = async (name: string, rig: RiggedHullAsset): Promise<void> => {
    const map = rig.map;
    if (map === null) return;
    await Promise.all(Object.entries(row.hulls).filter(([, hull]) => hull === name).map(async ([kv]) => {
      const [kind = '', variant = ''] = kv.split(':');
      const coat = urls.coats[`${name}:${kind}:${variant}`];
      if (coat === undefined) return;
      const tex = await ktx2Texture(coat.key) ?? (urls.coatDecode === 'bitmap'
        ? new THREE.Texture(await fetchImage(coat.image, Infinity, false)) : await new THREE.TextureLoader().loadAsync(coat.image));
      tex.flipY = map.flipY; tex.anisotropy = map.anisotropy; tex.wrapS = map.wrapS; tex.wrapT = map.wrapT;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.name = `${map.name}:${name}:${kv}`;
      if (urls.coatDecode === 'bitmap') tex.needsUpdate = true;
      const identity = `${name}:${kv}`;
      coats.set(identity, retainCachedResources(tex));
      cacheUntilDisposed(tex, () => { if (coats.get(identity) === tex) coats.delete(identity); adopting.delete(rig); });
    }));
  };

  /** each loaded rig's coats are adopted once: a later visit's preload reuses them instead of retaining a fresh set */
  const adoptOnce = (name: string, rig: RiggedHullAsset): Promise<void> => {
    let p = adopting.get(rig);
    if (p === undefined) { p = adoptBakedCoats(name, rig); adopting.set(rig, p); }
    return p;
  };

  const load = async (name: string): Promise<RiggedHullAsset> => {
    const rig = await loadRig(name); await adoptOnce(name, rig); return rig;
  };
  const preload = async (): Promise<void> => { await prepareParts(); await Promise.all(row.rigs.map(load)); };

  const skin = (kind: string, variant: string, bones: readonly BoneDef[]): CreatureHull | null => {
    const name = hullOf(kind, variant);
    if (name === null) return null;
    const rig = ready.get(name);
    if (!rig) throw new Error(`Creature rig ${name} is not prepared`);
    if (!jointsMatch(rig, bones)) throw new Error(`Creature rig ${name} does not match ${kind}:${variant} bones`);
    const out: BoneDef[] = bones.map((b, i) => { const p = rig.joints[i]?.pos; return { name: b.name, parent: b.parent, pos: p ? [p.x, p.y, p.z] : b.pos }; });
    const key = `${name}:${kind}:${variant}`;
    const map = coats.get(key) ?? rig.map;
    let extra = extraGeo.get(key);
    if (extra === undefined) {
      const node = urls.parts?.nodes[`${kind}:${variant}`], geometry = node === undefined ? undefined : parts.get(node);
      if (node !== undefined && geometry === undefined) throw new Error(`Missing hull part: ${node}`);
      extra = geometry === undefined ? null : withParts(rig.geometry, geometry);
      extraGeo.set(key, extra);
    }
    const f = row.fur?.[name]?.[variant];
    const fur = f === undefined ? undefined : { rim: [f.rim[0], f.rim[1], f.rim[2]] satisfies RGB, sheenColor: [f.sheenColor[0], f.sheenColor[1], f.sheenColor[2]] satisfies RGB };
    return { geometry: extra ?? rig.geometry, map, normalMap: rig.normalMap, bones: out, overgrown: extra !== null, ...(fur !== undefined ? { fur } : {}), ...(urls.doubleSided === undefined ? {} : { doubleSided: urls.doubleSided.includes(name) }) };
  };

  return { hullOf, load, preload, skin };
}

/** the hull geometry + baked rigid parts (`RiggedHullUrls.parts`), `aOvergrown` = (own colour, glow) per vertex */
function withParts(hull: THREE.BufferGeometry, parts: THREE.BufferGeometry): THREE.BufferGeometry {
  const n0 = hull.getAttribute('position').count, extra = parts.getAttribute('position').count, n = n0 + extra;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3).fill(1);
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), thr = new Float32Array(n * 2);
  const copy = (src: THREE.BufferGeometry, name: string, dst: Float32Array | Uint16Array, k: number, at: number): void => {
    if (!src.hasAttribute(name)) return;
    const a = src.getAttribute(name), count = a.count;
    for (let i = 0; i < count; i++) for (let c = 0; c < k; c++) dst[(at + i) * k + c] = a.getComponent(i, c);
  };
  copy(hull, 'position', pos, 3, 0); copy(hull, 'normal', nrm, 3, 0); copy(hull, 'uv', uv, 2, 0); copy(hull, 'skinIndex', si, 4, 0); copy(hull, 'skinWeight', sw, 4, 0);
  copy(parts, 'position', pos, 3, n0); copy(parts, 'normal', nrm, 3, n0); copy(parts, 'uv', uv, 2, n0); copy(parts, 'color', col, 3, n0);
  const bone = parts.getAttribute('_bone'), glow = parts.getAttribute('_glow');
  for (let i = 0; i < extra; i++) {
    const j = n0 + i;
    si[j * 4] = bone.getX(i); sw[j * 4] = 1;
    thr[j * 2] = 1; thr[j * 2 + 1] = glow.getX(i);
  }
  const idx: number[] = Array.from(hull.getIndex()?.array ?? []);
  for (const t of parts.getIndex()?.array ?? []) idx.push(n0 + t);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setAttribute('aOvergrown', new THREE.BufferAttribute(thr, 2));
  g.setIndex(idx);
  g.addGroup(0, idx.length, 0);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  if (g.boundingSphere !== null) g.boundingSphere.radius += 0.6;
  return g;
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
