/**
 * The Blender-built island (DRIFTWOOD-REMASTER X2, E52): `?island=blender` (or Settings ▸ Graphics ▸ Island) swaps the
 * procedural spawn cove — terrain, palms, bushes, shore boulders, ground cover inside `area` (blenderArea.ts) — for the
 * one scripts/blender/ builds in Blender and bakes in Cycles. `?island=procedural` (the default) is the TypeScript island.
 *
 *   if (islandMode() === 'blender') island = await BlenderIsland.install({ game, sky, player, terrain, palms, … });
 *
 * What loads (public/assets/models/driftwood-blender/, written by `pnpm blender:island`):
 * - island.glb: the area's terrain in 2×2 tiles (vertex colour + a planar lightmap UV) and ~60 prototypes (palms, faceted
 *   rocks, ferns, hibiscus, bushes, flowers, grass, beach grass, shells, starfish, pebbles, driftwood) whose vertex colour
 *   alpha is their Cycles-baked AO; meshopt-compressed.
 * - placements.bin (f32 × 10: proto, x, y, z, quaternion, scale, tint) + island.json (colliders, extra palms, bake notes):
 *   the prototypes are merged here into 2×2 tiles × {casters, ground cover} — one draw per tile, culled per tile. The phone
 *   builds every palm / rock / log and 70 % of the small cover (the file is ordered so that is a prefix).
 * - lm-ao / lm-bounce (.phone).webp: the terrain's baked GI — sky AO (5 m) and the sun's one-to-three-bounce indirect light.
 *
 * Lighting (the decision, see scripts/blender/README.md): the sun and its shadows stay dynamic (the toon ramp + CSM on the
 * 24-min day/night clock); the bake supplies only what the clock does not move much — the AO multiplies the hemisphere fill
 * the clock tints, and the bounce is added in proportion to the live sun (colour × intensity × its elevation over the
 * bake's reference). One bake, right at every time of day, no per-preset textures.
 *
 * Gameplay does not change: the Blender terrain sits on the exact heights `heightAt` walks (sampled from the same bake), the
 * game's own palms and boulders in the area keep their colliders (the Blender ones stand on the same spots), and the new
 * palms and the reachable crag rocks add theirs. `palmSpecs` gains the new palms (the monkeys climb them).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { attachFogUniforms } from './Atmosphere';
import { area, inArea, CELL } from './blenderArea';
import { CHUNK_HALF, TERRAIN_RES } from '../core/config';
import { TIER } from '../core/tier';
import type { Sky } from './Sky';
import type { Collider } from '../player/Player';
import type { PalmSpec } from './Palms';

const BASE = '/assets/models/driftwood-blender/';
/** tiles per side: the casters (palms, rocks, logs; near + far copies) and the ground cover */
const CT = TIER === 'phone' ? 6 : 3, VT = TIER === 'phone' ? 8 : 4;
/** the phone's share of the small ground cover (the palms, rocks and logs always build) */
const PHONE_COVER = 0.7;
/** past this (m, camera to the tile's rect) a caster tile draws its far copy / a cover tile is not drawn */
/** how much of the terrain's baked AO reaches the direct sun (0 = physically only the fill) */
const AO_DIRECT = 0.45;
const LOD_D = TIER === 'phone' ? 24 : 110, COVER_D = TIER === 'phone' ? 32 : 150;

interface Tile { x0: number; x1: number; z0: number; z1: number; near: THREE.Mesh; far: THREE.Mesh | null; cover: boolean }

interface IslandMeta {
  version: number;
  protos: { name: string; kind: string; tris: number }[];
  placements: number;
  mustDraw: number;
  /** proto index → its far (LOD) proto */
  lod: Record<string, number>;
  colliders: Collider[];
  extraPalms: PalmSpec[];
  bake: { bounceGain: number; refSun: [number, number, number] };
}

export interface BlenderIslandCtx {
  scene: THREE.Scene;
  sky: Sky;
  colliders: Collider[];
  terrain: THREE.Mesh;
  palms: THREE.Mesh | null;
  palmSpecs: PalmSpec[];
  /** merged world-space meshes the area replaces (boulders, bushes) */
  replace: (THREE.Mesh | null)[];
  /** GroundCover's group: its instanced plants are hidden inside the area, its static logs dropped there */
  cover: THREE.Object3D | null;
}

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;
const isInstanced = (o: THREE.Object3D): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh;

/** keep only the triangles `keep(cx, cz)` accepts (centroid, world xz — the merged meshes are built in world space) */
function dropTriangles(geo: THREE.BufferGeometry, keep: (x: number, z: number) => boolean): number {
  const pos = geo.getAttribute('position');
  const src = geo.getIndex();
  const n = src ? src.count : pos.count;
  const out: number[] = [];
  let dropped = 0;
  for (let t = 0; t < n; t += 3) {
    const a = src ? src.getX(t) : t, b = src ? src.getX(t + 1) : t + 1, c = src ? src.getX(t + 2) : t + 2;
    const x = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, z = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    if (keep(x, z)) out.push(a, b, c); else dropped++;
  }
  if (dropped > 0) geo.setIndex(out);
  return dropped / 3;
}

/** the procedural terrain loses the area's whole cells (its index is (iz·(res−1) + ix)·6, Terrain.buildLowPolyGeometry) */
function clipTerrain(mesh: THREE.Mesh): void {
  const idx = mesh.geometry.getIndex();
  if (idx === null) return;
  const n = TERRAIN_RES - 1;
  if (idx.count !== n * n * 6) { dropTriangles(mesh.geometry, (x, z) => !inArea(x, z)); return; }
  const cx0 = Math.round((area.x0 + CHUNK_HALF) / CELL), cx1 = Math.round((area.x1 + CHUNK_HALF) / CELL);
  const cz0 = Math.round((area.z0 + CHUNK_HALF) / CELL), cz1 = Math.round((area.z1 + CHUNK_HALF) / CELL);
  const out = new Uint32Array(idx.count - (cx1 - cx0) * (cz1 - cz0) * 6);
  let k = 0;
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
    if (ix >= cx0 && ix < cx1 && iz >= cz0 && iz < cz1) continue;
    const o = (iz * n + ix) * 6;
    for (let j = 0; j < 6; j++) out[k++] = idx.getX(o + j);
  }
  mesh.geometry.setIndex(new THREE.BufferAttribute(out, 1));
}

/** instanced plants: collapse an instance whose origin is inside the area (vertex shader, no discard, no CPU per frame) */
function clipInstanced(mat: THREE.Material): void {
  const prev = mat.onBeforeCompile.bind(mat);
  const f = (v: number) => v.toFixed(3);
  mat.onBeforeCompile = (shader, renderer) => {
    prev(shader, renderer);
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
#ifdef USE_INSTANCING
	{ vec4 io = modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
	  if ( io.x > ${f(area.x0)} && io.x < ${f(area.x1)} && io.z > ${f(area.z0)} && io.z < ${f(area.z1)} ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); }
#endif`);
  };
  const key = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${key()}|island-clip`;
  mat.needsUpdate = true;
}

function load<T>(f: (ok: (v: T) => void, bad: (e: unknown) => void) => void): Promise<T> { return new Promise<T>((resolve, reject) => { f(resolve, reject); }); }

export class BlenderIsland {
  group = new THREE.Group();
  stats = { terrainTris: 0, propTris: 0, placements: 0, draws: 0 };
  private terrainMat!: THREE.MeshStandardMaterial;
  private meta!: IslandMeta;
  private sunLum = 0;
  private tiles: Tile[] = [];

  static async install(ctx: BlenderIslandCtx): Promise<BlenderIsland> {
    const island = new BlenderIsland();
    await island.build(ctx);
    return island;
  }

  private async build(ctx: BlenderIslandCtx): Promise<void> {
    const phone = TIER === 'phone';
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const tex = new THREE.TextureLoader();
    const lm = (name: string) => load<THREE.Texture>((ok, bad) => { tex.load(`${BASE}${name}${phone ? '.phone' : ''}.webp`, ok, undefined, bad); });
    const [gltf, meta, place, ao, bounce] = await Promise.all([
      load<{ scene: THREE.Group }>((ok, bad) => { loader.load(`${BASE}island.glb`, ok, undefined, bad); }),
      fetch(`${BASE}island.json`).then((r) => r.json() as Promise<IslandMeta>),
      fetch(`${BASE}placements.bin`).then((r) => r.arrayBuffer()),
      lm('lm-ao'), lm('lm-bounce'),
    ]);
    this.meta = meta;
    for (const t of [ao, bounce]) { t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.channel = 0; t.anisotropy = 4; t.needsUpdate = true; }

    // ── materials: the shard's toon lighting (stylize.ts), fog, CSM — plus the bake ──
    const terrainMat = this.terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0, aoMap: ao, aoMapIntensity: 1, lightMap: bounce, lightMapIntensity: 0 });
    terrainMat.onBeforeCompile = (sh) => {
      attachFogUniforms(sh);
      // the baked AO also grounds the direct light a little: contact shade under the palms, the rocks, the pier
      sh.fragmentShader = sh.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
	reflectedLight.directDiffuse *= mix( 1.0, ambientOcclusion, ${AO_DIRECT.toFixed(2)} );`);
    };
    terrainMat.customProgramCacheKey = () => 'island-terrain';
    ctx.sky.setupMaterial(terrainMat);
    const propsMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    propsMat.onBeforeCompile = (s) => {
      attachFogUniforms(s);
      // the colour's alpha is the prototype's Cycles AO: all of the fill, a little of the sun (the crown's inner fronds)
      s.fragmentShader = s.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= vColor.a;
	reflectedLight.directDiffuse *= mix( 1.0, vColor.a, 0.35 );`);
    };
    propsMat.customProgramCacheKey = () => 'island-props';
    ctx.sky.setupMaterial(propsMat);

    // ── terrain tiles ──
    gltf.scene.updateMatrixWorld(true);
    const protos: { pos: Float32Array; col: Uint8Array; index: Uint32Array }[] = [];
    const protoIndex = new Map<string, number>(meta.protos.map((p, i) => [`proto_${p.name}`, i]));
    const v = new THREE.Vector3();
    const found: THREE.Mesh[] = [];
    gltf.scene.traverse((o) => { if (isMesh(o)) found.push(o); });
    for (const o of found) {
      const pi = protoIndex.get(o.name);
      if (pi === undefined) {
        // a terrain tile — the 1 m grid on desktop, the 2 m one (terrainlo_*) on the phone; keep its node transform (meshopt's
        // dequantisation lives there)
        if (o.name.startsWith('terrainlo') !== phone) continue;
        const m = new THREE.Mesh(o.geometry, terrainMat);
        m.matrixAutoUpdate = false; m.matrix.copy(o.matrixWorld); m.matrixWorld.copy(o.matrixWorld);
        m.name = `island-${o.name}`; m.castShadow = true; m.receiveShadow = true;
        if (!o.geometry.hasAttribute('normal')) o.geometry.computeVertexNormals(); // lighting is flat (derivatives); the normals are the shadows' normal bias
        o.geometry.computeBoundingSphere();
        this.group.add(m);
        this.stats.terrainTris += (o.geometry.getIndex()?.count ?? o.geometry.getAttribute('position').count) / 3;
        continue;
      }
      const g = o.geometry, p = g.getAttribute('position'), c = g.getAttribute('color'), idx = g.getIndex();
      const pos = new Float32Array(p.count * 3), col = new Uint8Array(p.count * 4);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
        col[i * 4] = Math.round(THREE.MathUtils.clamp(c.getX(i), 0, 1) * 255);
        col[i * 4 + 1] = Math.round(THREE.MathUtils.clamp(c.getY(i), 0, 1) * 255);
        col[i * 4 + 2] = Math.round(THREE.MathUtils.clamp(c.getZ(i), 0, 1) * 255);
        col[i * 4 + 3] = c.itemSize > 3 ? Math.round(THREE.MathUtils.clamp(c.getW(i), 0, 1) * 255) : 255;
      }
      const index = new Uint32Array(idx ? idx.count : p.count);
      for (let i = 0; i < index.length; i++) index[i] = idx ? idx.getX(i) : i;
      protos[pi] = { pos, col, index };
    }

    // ── merge the placements into tiles: casters (palms, rocks, logs) 4×4, each with a far copy (the LOD palms);
    //    ground cover 8×8, drawn only near the camera ──
    const f = new Float32Array(place);
    const count = f.length / 10;
    const cover = Math.round((count - meta.mustDraw) * (phone ? PHONE_COVER : 1));
    const used = meta.mustDraw + cover;
    const lodOf = new Map<number, number>(Object.entries(meta.lod).map(([k, lo]) => [Number(k), lo]));
    const tileOf = (x: number, z: number, n: number) => {
      const tx = Math.min(n - 1, Math.max(0, Math.floor((x - area.x0) / (area.x1 - area.x0) * n)));
      const tz = Math.min(n - 1, Math.max(0, Math.floor((z - area.z0) / (area.z1 - area.z0) * n)));
      return tz * n + tx;
    };
    const casters: number[][] = Array.from({ length: CT * CT }, () => []), covers: number[][] = Array.from({ length: VT * VT }, () => []);
    for (let i = 0; i < used; i++) {
      const pi = f[i * 10] ?? 0, kind = meta.protos[pi]?.kind ?? 'small';
      const x = f[i * 10 + 1] ?? 0, z = f[i * 10 + 3] ?? 0;
      if (kind === 'palm' || kind === 'rock' || kind === 'prop') casters[tileOf(x, z, CT)]?.push(i); else covers[tileOf(x, z, VT)]?.push(i);
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3();
    const e = m.elements;
    const merge = (items: number[], far: boolean): THREE.BufferGeometry | null => {
      let verts = 0, indices = 0;
      const pick = (i: number) => { const pi = f[i * 10] ?? 0; return protos[far ? lodOf.get(pi) ?? pi : pi]; };
      for (const i of items) { const pr = pick(i); if (pr) { verts += pr.pos.length / 3; indices += pr.index.length; } }
      if (indices === 0) return null;
      const pos = new Float32Array(verts * 3), col = new Uint8Array(verts * 4), index = new Uint32Array(indices);
      let vo = 0, io = 0;
      for (const i of items) {
        const o = i * 10, pr = pick(i);
        if (pr === undefined) continue;
        t.set(f[o + 1] ?? 0, f[o + 2] ?? 0, f[o + 3] ?? 0); q.set(f[o + 4] ?? 0, f[o + 5] ?? 0, f[o + 6] ?? 0, f[o + 7] ?? 1);
        const sc = f[o + 8] ?? 1, tint = f[o + 9] ?? 1;
        m.compose(t, q, s.set(sc, sc, sc));
        const n = pr.pos.length / 3;
        for (let k = 0; k < n; k++) {
          const px = pr.pos[k * 3] ?? 0, py = pr.pos[k * 3 + 1] ?? 0, pz = pr.pos[k * 3 + 2] ?? 0, d = (vo + k) * 3;
          pos[d] = e[0] * px + e[4] * py + e[8] * pz + e[12];
          pos[d + 1] = e[1] * px + e[5] * py + e[9] * pz + e[13];
          pos[d + 2] = e[2] * px + e[6] * py + e[10] * pz + e[14];
          const c = (vo + k) * 4, sc4 = k * 4;
          col[c] = Math.min(255, (pr.col[sc4] ?? 0) * tint); col[c + 1] = Math.min(255, (pr.col[sc4 + 1] ?? 0) * tint);
          col[c + 2] = Math.min(255, (pr.col[sc4 + 2] ?? 0) * tint); col[c + 3] = pr.col[sc4 + 3] ?? 255;
        }
        for (let k = 0; k < pr.index.length; k++) index[io + k] = (pr.index[k] ?? 0) + vo;
        vo += n; io += pr.index.length;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 4, true));
      geo.setIndex(new THREE.BufferAttribute(index, 1));
      geo.computeVertexNormals(); // the CSM normal bias (flat lighting ignores them): without them the facets streak with acne
      geo.computeBoundingSphere();
      return geo;
    };
    const rect = (k: number, n: number) => {
      const w = (area.x1 - area.x0) / n, d = (area.z1 - area.z0) / n, tx = k % n, tz = Math.floor(k / n);
      return { x0: area.x0 + tx * w, x1: area.x0 + (tx + 1) * w, z0: area.z0 + tz * d, z1: area.z0 + (tz + 1) * d };
    };
    const add = (geo: THREE.BufferGeometry, name: string, cast: boolean) => {
      const mesh = new THREE.Mesh(geo, propsMat);
      mesh.name = name; mesh.castShadow = cast; mesh.receiveShadow = true;
      this.group.add(mesh);
      return mesh;
    };
    for (const [k, items] of casters.entries()) {
      const hi = merge(items, false), lo = merge(items, true);
      if (!hi || !lo) continue;
      this.tiles.push({ ...rect(k, CT), near: add(hi, `island-casters-${k}`, true), far: add(lo, `island-casters-${k}-far`, !phone), cover: false }); // the phone's 80 m cascade: far palms cast none
      this.stats.propTris += (hi.getIndex()?.count ?? 0) / 3;
    }
    for (const [k, items] of covers.entries()) {
      const g = merge(items, false);
      if (!g) continue;
      this.tiles.push({ ...rect(k, VT), near: add(g, `island-cover-${k}`, false), far: null, cover: true });
      this.stats.propTris += (g.getIndex()?.count ?? 0) / 3;
    }
    this.stats.placements = used;
    this.stats.draws = this.group.children.length;
    this.group.name = 'blender-island';
    ctx.scene.add(this.group);

    // ── hide what the area replaces ──
    clipTerrain(ctx.terrain);
    if (ctx.palms) {
      // a triangle belongs to the nearest palm (its fronds reach 5 m out); drop the palms standing in the area
      const cellOf = (x: number, z: number) => `${Math.floor(x / 8)},${Math.floor(z / 8)}`;
      const grid = new Map<string, PalmSpec[]>();
      for (const p of ctx.palmSpecs) { const k = cellOf(p.x, p.z); const l = grid.get(k); if (l) l.push(p); else grid.set(k, [p]); }
      dropTriangles(ctx.palms.geometry, (x, z) => {
        let best: PalmSpec | null = null, bd = Infinity;
        const cx = Math.floor(x / 8), cz = Math.floor(z / 8);
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (const p of grid.get(`${cx + dx},${cz + dz}`) ?? []) {
          const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = p; }
        }
        return best === null || !inArea(best.x, best.z, 1);
      });
    }
    for (const r of ctx.replace) if (r) dropTriangles(r.geometry, (x, z) => !inArea(x, z));
    if (ctx.cover) {
      const clipped = new Set<THREE.Material>();
      ctx.cover.traverse((o) => {
        if (isInstanced(o)) { for (const mm of Array.isArray(o.material) ? o.material : [o.material]) if (!clipped.has(mm)) { clipped.add(mm); clipInstanced(mm); } }
        else if (isMesh(o)) dropTriangles(o.geometry, (x, z) => !inArea(x, z));
      });
    }

    // ── gameplay ──
    ctx.colliders.push(...meta.colliders);
    ctx.palmSpecs.push(...meta.extraPalms);
    this.update(ctx.sky);
    console.info(`[island] blender: terrain ${this.stats.terrainTris} tris, props ${this.stats.propTris} tris in ${this.stats.draws} meshes, ${used}/${count} placements (${TIER})`);
  }

  /** per frame: the baked bounce follows the live sun (colour × intensity × elevation over the bake's reference) */
  update(sky: Sky): void {
    const l = sky.csm.lights[0];
    if (!l) return;
    const lum = l.intensity * (0.2126 * l.color.r + 0.7152 * l.color.g + 0.0722 * l.color.b);
    const elev = Math.max(0, sky.sunDir.y) / Math.max(0.2, this.meta.bake.refSun[1]);
    this.sunLum = lum * elev;
    this.terrainMat.lightMapIntensity = this.sunLum / this.meta.bake.bounceGain;
    const cam = sky.viewCamera.position;
    for (const t of this.tiles) {
      const dx = Math.max(t.x0 - cam.x, 0, cam.x - t.x1), dz = Math.max(t.z0 - cam.z, 0, cam.z - t.z1), d = Math.hypot(dx, dz);
      if (t.cover) t.near.visible = d < COVER_D;
      else { t.near.visible = d < LOD_D; if (t.far) t.far.visible = !t.near.visible; }
    }
  }
}
