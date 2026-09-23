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
 *   builds every palm / rock / log and 55 % of the small cover (the file is ordered so that is a prefix).
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
/** tiles per side for the merged props */
const PT = 2;
/** the phone's share of the small ground cover (the palms, rocks and logs always build) */
const PHONE_COVER = 0.55;

interface Bucket { items: number[]; verts: number; indices: number }

interface IslandMeta {
  version: number;
  protos: { name: string; kind: string; tris: number }[];
  placements: number;
  mustDraw: number;
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
    terrainMat.onBeforeCompile = (s) => { attachFogUniforms(s); };
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
        // a terrain tile: keep its node transform (meshopt's dequantisation lives there)
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

    // ── merge the placements into tiles ──
    const f = new Float32Array(place);
    const count = f.length / 10;
    const cover = phone ? Math.round((count - meta.mustDraw) * PHONE_COVER) : count - meta.mustDraw;
    const used = meta.mustDraw + cover;
    const buckets: Bucket[] = [];
    for (let i = 0; i < PT * PT * 2; i++) buckets.push({ items: [], verts: 0, indices: 0 });
    const caster = (kind: string) => kind === 'palm' || kind === 'rock' || kind === 'prop';
    for (let i = 0; i < used; i++) {
      const pi = f[i * 10] ?? 0, x = f[i * 10 + 1] ?? 0, z = f[i * 10 + 3] ?? 0;
      const pr = protos[pi], kind = meta.protos[pi]?.kind ?? 'small';
      if (pr === undefined) continue;
      const tx = Math.min(PT - 1, Math.max(0, Math.floor((x - area.x0) / (area.x1 - area.x0) * PT)));
      const tz = Math.min(PT - 1, Math.max(0, Math.floor((z - area.z0) / (area.z1 - area.z0) * PT)));
      const b = buckets[((tz * PT + tx) * 2) + (caster(kind) ? 0 : 1)];
      if (b === undefined) continue;
      b.items.push(i); b.verts += pr.pos.length / 3; b.indices += pr.index.length;
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3();
    const e = m.elements;
    for (const [bi, b] of buckets.entries()) {
      if (b.items.length === 0) continue;
      const pos = new Float32Array(b.verts * 3), col = new Uint8Array(b.verts * 4), index = new Uint32Array(b.indices);
      let vo = 0, io = 0;
      for (const i of b.items) {
        const o = i * 10, pr = protos[f[o] ?? 0];
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
      const mesh = new THREE.Mesh(geo, propsMat);
      mesh.name = `island-props-${bi >> 1}-${bi & 1 ? 'cover' : 'casters'}`;
      mesh.castShadow = (bi & 1) === 0; mesh.receiveShadow = true;
      this.group.add(mesh);
      this.stats.propTris += b.indices / 3;
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
  }
}
