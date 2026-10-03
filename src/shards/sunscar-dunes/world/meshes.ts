import { loadRigFile, patchShader, PATCH_ORDER } from '#engine';
import { FIRE_LIGHTS } from './fireFx';
import { DUNE_HD, DUNE_MESHES, duneHdUrl, duneMeshUrl, type DuneHdName, type DuneMeshName } from '../boot/files';
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Uint16BufferAttribute, Vector3, type BufferAttribute, type Object3D } from 'three';

/**
 * Signal Dunes' generated models (C6, E374): codex refs → Hunyuan3D-2 → faceted, vertex-coloured GLBs
 * (`art/sunscar-dunes/round-7-models/props.json`, built into `public/assets/sunscar-dunes/models/<name>/<name>.glb`).
 * Each is loaded once behind the loading screen (`preloadDuneMeshes`, the plugin's `world` hook) and kept as one flat
 * non-indexed geometry: position, the facet colour (rgb × the baked AO in COLOR_0's alpha) and flat normals. A model
 * that fails to load leaves its code model in place.
 */

const ready = new Map<DuneMeshName, BufferGeometry>();
/** How much of the baked AO survives: a facet in full occlusion keeps this share of its colour. */
const AO_FLOOR = 0.55;
let loading: Promise<void> | null = null;
const isMesh = (o: Object3D): o is Mesh => o instanceof Mesh;

/** One mesh's triangles in world space, de-indexed, as plain float32 (meshopt quantizes the attributes). */
function flatten(mesh: Mesh): { pos: number[]; col: number[] } {
  const g = mesh.geometry, p = g.getAttribute('position'), c = g.hasAttribute('color') ? g.getAttribute('color') : null;
  const index = g.getIndex(), n = index ? index.count : p.count, pos: number[] = [], col: number[] = [], v = new Vector3();
  for (let k = 0; k < n; k++) {
    const i = index ? index.getX(k) : k;
    v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld); pos.push(v.x, v.y, v.z);
    const ao = c?.itemSize === 4 ? AO_FLOOR + (1 - AO_FLOOR) * c.getW(i) : 1;
    col.push((c ? c.getX(i) : 1) * ao, (c ? c.getY(i) : 1) * ao, (c ? c.getZ(i) : 1) * ao);
  }
  return { pos, col };
}

async function load(name: DuneMeshName): Promise<void> {
  try {
    const gltf = await loadRigFile(duneMeshUrl(name));
    gltf.scene.updateMatrixWorld(true);
    const pos: number[] = [], col: number[] = [];
    gltf.scene.traverse((o) => { if (isMesh(o)) { const f = flatten(o); pos.push(...f.pos); col.push(...f.col); } });
    if (pos.length === 0) throw new Error(`${name}: no mesh`);
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
    g.computeVertexNormals(); g.computeBoundingBox(); ready.set(name, g);
  } catch (e: unknown) { console.warn(`[sunscar-dunes] ${name} not loaded, the code model stands in:`, e); }
}

const hd = new Map<DuneHdName, Object3D>();
/** The brazier's texture warmed by each burning fire within ~4.5 m (fireFx.ts FIRE_LIGHTS): its own fire lights it. */
function warmByFire(m: MeshStandardMaterial): void {
  patchShader(m, 'sunscar.firelight', PATCH_ORDER.decorate, (shader) => {
    shader.uniforms['uFireLights'] = FIRE_LIGHTS;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFireW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vFireW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec4 uFireLights[4];\nvarying vec3 vFireW;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  for (int i = 0; i < 4; i++) {
    float fireD = length(vFireW - uFireLights[i].xyz);
    totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.45, 0.16) * uFireLights[i].w * pow(max(0.0, 1.0 - fireD / 4.5), 2.0) * 1.8;
  }`);
  });
}
/**
 * Worn leather on the hero glove and its coiled whip (E399, council round 1, D9: ours read as a smooth saturated red
 * mitten): the texture's light and dark kept, mapped onto a warm tan ramp. Round 2 dropped the crease bump (it read as
 * jagged edges and noise) and the dusk rim (`sunscarNoRim`: it drew an X-ray outline).
 */
function wornLeather(m: MeshStandardMaterial): void {
  patchShader(m, 'sunscar.leather', PATCH_ORDER.decorate, (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
  float leatherL = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
  // the texture's light and dark (braid, creases) kept, mapped onto a warm tan leather ramp (mockups A-C; the map is near-black red)
  diffuseColor.rgb = mix(vec3(0.07, 0.04, 0.025), vec3(0.62, 0.38, 0.2), smoothstep(0.015, 0.2, leatherL));`)
      // a warm self-fill, so the held glove never drops to a black cut-out against the dusk (mockup D: the fist still reads)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * vec3(0.16, 0.11, 0.08);');
  });
}
/** A textured hero model: its scene as loaded (its own map on its own UVs), normals smoothed, matte. */
async function loadHd(name: DuneHdName): Promise<void> {
  try {
    const gltf = await loadRigFile(duneHdUrl(name));
    gltf.scene.traverse((o) => {
      if (!isMesh(o)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m instanceof MeshStandardMaterial) {
          m.metalness = 0; m.roughness = 0.85; m.flatShading = false;
          // E399 (mockup D): the glove dark worn leather with a soft sheen, not a saturated red-brown
          if (name === 'glove-hd') {
            m.color.setRGB(1, 1, 1); m.roughness = 0.55; m.userData['sunscarNoRim'] = true; // council round 2: the rim drew an X-ray outline
            wornLeather(m);
          }
          if (name === 'brazier-hd') warmByFire(m);
          m.needsUpdate = true;
        }
      }
    });
    hd.set(name, gltf.scene);
  } catch (e: unknown) { console.warn(`[sunscar-dunes] ${name} not loaded, the flat model stands in:`, e); }
}

/** Load every generated model once (a failed one is skipped). */
export function preloadDuneMeshes(): Promise<void> {
  loading ??= Promise.all([...DUNE_MESHES.map(load), ...DUNE_HD.map(loadHd)]).then(() => undefined);
  return loading;
}

/**
 * A textured hero model, fitted like `fit` (turned `yaw`, centred on x / z, its lowest point at `floor`, `size` metres
 * by span or height), as a group sharing the loaded geometry and maps; null when it did not load.
 */
export function duneHd(name: DuneHdName, o: { size: number; by: 'span' | 'height'; floor?: number; yaw?: number }): Group | null {
  const src = hd.get(name); if (!src) return null;
  const inner = src.clone(true), holder = new Group(), turn = new Group();
  turn.rotation.y = o.yaw ?? 0; turn.add(inner); holder.add(turn); holder.updateMatrixWorld(true);
  const b = new Box3().setFromObject(holder);
  const span = o.by === 'height' ? b.max.y - b.min.y : Math.max(b.max.x - b.min.x, b.max.z - b.min.z), k = o.size / Math.max(1e-6, span);
  turn.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  const out = new Group(); out.add(holder); holder.scale.setScalar(k); holder.position.y = o.floor ?? 0;
  return out;
}

/** A copy of a loaded model's geometry, or null (not loaded: use the code model). */
export function duneMesh(name: DuneMeshName): BufferGeometry | null { return ready.get(name)?.clone() ?? null; }

/** The generated models' material: the facet colours, matte (one per model: the level scope owns and disposes it). */
export const duneMaterial = (): MeshStandardMaterial => new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true });

/**
 * Fit a loaded model into a frame (turned `yaw` radians about +Y first): centred on x / z, its lowest point at `floor`,
 * scaled so its largest horizontal extent (or its height) is `size` metres.
 */
export function fit(g: BufferGeometry, o: { size: number; by: 'span' | 'height'; floor?: number; yaw?: number }): BufferGeometry {
  if (o.yaw !== undefined) g.rotateY(o.yaw);
  const b = new Box3().setFromBufferAttribute(g.getAttribute('position') as BufferAttribute);
  const span = o.by === 'height' ? b.max.y - b.min.y : Math.max(b.max.x - b.min.x, b.max.z - b.min.z), k = o.size / Math.max(1e-6, span);
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  g.scale(k, k, k); g.translate(0, o.floor ?? 0, 0); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/** Drop the triangles whose centroid `cut` says to remove (a part the code model animates instead). */
export function without(g: BufferGeometry, cut: (x: number, y: number, z: number) => boolean): BufferGeometry {
  const p = g.getAttribute('position'), c = g.getAttribute('color'), pos: number[] = [], col: number[] = [];
  for (let t = 0; t + 2 < p.count; t += 3) {
    if (cut((p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3)) continue;
    for (let v = t; v < t + 3; v++) { pos.push(p.getX(v), p.getY(v), p.getZ(v)); col.push(c.getX(v), c.getY(v), c.getZ(v)); }
  }
  const r = new BufferGeometry(); r.setAttribute('position', new Float32BufferAttribute(pos, 3)); r.setAttribute('color', new Float32BufferAttribute(col, 3));
  r.computeVertexNormals(); r.computeBoundingBox(); r.computeBoundingSphere(); g.dispose(); return r;
}

/** Bind every triangle rigidly to the bone `boneOf` names for its centroid (bone indices in `build().bones` order). */
export function bindRigid(g: BufferGeometry, boneOf: (x: number, y: number, z: number) => number): BufferGeometry {
  const p = g.getAttribute('position'), n = p.count, index = new Uint16Array(n * 4), weight = new Float32Array(n * 4);
  for (let t = 0; t + 2 < n; t += 3) {
    const bone = boneOf((p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3);
    for (let v = t; v < t + 3; v++) { index[v * 4] = bone; weight[v * 4] = 1; }
  }
  g.setAttribute('skinIndex', new Uint16BufferAttribute(index, 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(weight, 4));
  return g;
}

/**
 * Averages a generated model's painted colour per vertex position (round 2, R1A-2 / R1A-5): each facet painted its own
 * shade, so the triangles showed as patches; averaged, the paint reads as continuous leather, cloth and timber.
 */
export function smoothColors(g: BufferGeometry, amount = 1): void {
  if (!g.hasAttribute('color')) return;
  const p = g.getAttribute('position'), c = g.getAttribute('color'), sum = new Map<string, [number, number, number, number]>();
  const key = (i: number): string => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
  for (let i = 0; i < p.count; i++) { const k = key(i), v = sum.get(k) ?? [0, 0, 0, 0]; v[0] += c.getX(i); v[1] += c.getY(i); v[2] += c.getZ(i); v[3]++; sum.set(k, v); }
  for (let i = 0; i < p.count; i++) {
    const v = sum.get(key(i)); if (!v) continue;
    c.setXYZ(i, c.getX(i) + (v[0] / v[3] - c.getX(i)) * amount, c.getY(i) + (v[1] / v[3] - c.getY(i)) * amount, c.getZ(i) + (v[2] / v[3] - c.getZ(i)) * amount);
  }
  c.needsUpdate = true;
}
