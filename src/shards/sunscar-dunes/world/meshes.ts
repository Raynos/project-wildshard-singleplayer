import { loadRigFile } from '@wildshard/engine/anim/rig';
import { cacheUntilDisposed, retainCachedResources } from '@wildshard/engine/app/cachedAssets';
import { patchShader, PATCH_ORDER } from '@wildshard/engine/render/shaderPatches';
import { FIRE_LIGHTS } from './fireFx';
import { DUSK } from '../look/dusk';
import { DUNE_HD, DUNE_MESHES, DUNE_RIGS, DUNE_HD_URLS, DUNE_MESH_URLS, DUNE_RIG_URLS, type DuneHdName, type DuneMeshName, type DuneRigName } from '../data/files';
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Uint16BufferAttribute, Vector3, type BufferAttribute, type Object3D } from 'three';

/**
 * Signal Dunes' generated models (C6, E374): codex refs → Hunyuan3D-2 → faceted, vertex-coloured GLBs
 * (`art/sunscar-dunes/round-7-models/props.json`, built into `public/assets/sunscar-dunes/models/<name>/<name>.glb`).
 * Each is loaded once behind the loading screen (`preloadDuneMeshes`, the plugin's `world` hook) and kept as one flat
 * non-indexed geometry: position, the facet colour (rgb × the baked AO in COLOR_0's alpha) and flat normals. A model
 * that fails to load is a page fault (`console.error`: the boot smoke and the tests fail on it, SF72), never a silent
 * stand-in: the places and the tower stand undrawn without it.
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
    const gltf = await loadRigFile(DUNE_MESH_URLS[name]);
    gltf.scene.updateMatrixWorld(true);
    const pos: number[] = [], col: number[] = [];
    gltf.scene.traverse((o) => { if (isMesh(o)) { const f = flatten(o); pos.push(...f.pos); col.push(...f.col); } });
    if (pos.length === 0) throw new Error(`${name}: no mesh`);
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
    g.computeVertexNormals(); g.computeBoundingBox(); retainCachedResources(g); ready.set(name, g);
    cacheUntilDisposed(g, () => { if (ready.get(name) === g) { ready.delete(name); loading = null; } });
  } catch (e: unknown) { console.error(`[sunscar-dunes] the generated model ${name} did not load:`, e); }
}

const rigs = new Map<DuneRigName, BufferGeometry>();
/**
 * A baked creature body (SF72, `generators/species.ts`): one skinned geometry, its bone indices and weights in the
 * `_JOINTS` / `_WEIGHTS` attributes; each copy's flat normals are recomputed from the same positions the code built.
 */
async function loadRig(name: DuneRigName): Promise<void> {
  try {
    const gltf = await loadRigFile(DUNE_RIG_URLS[name]), meshes: Mesh[] = [];
    gltf.scene.traverse((o) => { if (isMesh(o)) meshes.push(o); });
    const loaded = meshes[0]?.geometry;
    if (meshes.length !== 1 || loaded === undefined) throw new Error(`${name}: ${String(meshes.length)} meshes, one baked`);
    const source = loaded.index === null ? loaded : loaded.toNonIndexed();
    for (const key of ['position', 'color', '_joints', '_weights']) if (!source.hasAttribute(key)) throw new Error(`${name}: no ${key}`);
    const p = source.getAttribute('position'), c = source.getAttribute('color'), j = source.getAttribute('_joints'), w = source.getAttribute('_weights');
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(p.array, 3)); g.setAttribute('color', new Float32BufferAttribute(c.array, 3));
    g.setAttribute('skinIndex', new Uint16BufferAttribute(Uint16Array.from(j.array), 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(w.array, 4));
    retainCachedResources(g); rigs.set(name, g); source.dispose(); loaded.dispose();
    cacheUntilDisposed(g, () => { if (rigs.get(name) === g) { rigs.delete(name); loading = null; } });
  } catch (e: unknown) { console.error(`[sunscar-dunes] the baked rig ${name} did not load:`, e); }
}
/** A copy of a baked creature body, or null (not loaded: its load was faulted). */
export function duneRig(name: DuneRigName): BufferGeometry | null {
  const g = rigs.get(name)?.clone() ?? null; g?.computeVertexNormals(); return g;
}
/** A creature that did not load stands undrawn: one zero-area triangle on bone 0 (a species needs a geometry part). */
export function undrawnRig(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(new Float32Array(9), 3)); g.setAttribute('color', new Float32BufferAttribute(new Float32Array(9), 3));
  g.setAttribute('normal', new Float32BufferAttribute(new Float32Array(9), 3));
  g.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(12), 4)); g.setAttribute('skinWeight', new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  return g;
}

const hd = new Map<DuneHdName, Object3D>();
/** The brazier's texture warmed by each burning fire within ~4.5 m (fireFx.ts FIRE_LIGHTS): its own fire lights it. */
export function warmByFire(m: MeshStandardMaterial): void {
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
 * The held leather's viewer-side light (the glove's, above) for a code-built part of the viewmodel: faces turned to the
 * eye lit, edges falling off, more as the dusk deepens, so the backlit fist and coil never read as a cut-out.
 */
export function viewerLit(m: MeshStandardMaterial, gain: readonly [number, number, number], sheen = 0): void {
  patchShader(m, 'sunscar.viewerLit', PATCH_ORDER.decorate, (shader) => {
    shader.uniforms['uDusk'] = DUSK;
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uDusk;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += diffuseColor.rgb * vec3(${gain.map((g) => g.toFixed(3)).join(', ')}) * (0.2 + 0.8 * saturate(dot(normal, normalize(vViewPosition)))) * (1.0 + 0.7 * uDusk);
  // a glancing sheen where the surface (with its relief) turns from the eye: each plaited strand's edge catches it
  totalEmissiveRadiance += vec3(0.9, 0.62, 0.4) * ${sheen.toFixed(3)} * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0) * (1.0 - roughnessFactor * 0.6);`);
  });
}
/**
 * Round 19 (seat C after round 18: glove-hd4's leather detail 2.1 against mockup D's 8.3; its paint is one 1024 map): fine
 * leather in the model's own space, creases and a pebbled grain, as albedo and as a bump on the normal (screen-space
 * derivatives, so no tangents). The model spans ~2 units across a 0.14 m hand: creases ~5 mm, grain ~1.5 mm.
 */
function leatherDetail(m: MeshStandardMaterial): void {
  patchShader(m, 'sunscar.leatherDetail', PATCH_ORDER.decorate, (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLeatherP;').replace('#include <begin_vertex>', '#include <begin_vertex>\n  vLeatherP = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vLeatherP;
float lHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float lNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(lHash(i), lHash(i + vec3(1, 0, 0)), f.x), mix(lHash(i + vec3(0, 1, 0)), lHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(lHash(i + vec3(0, 0, 1)), lHash(i + vec3(1, 0, 1)), f.x), mix(lHash(i + vec3(0, 1, 1)), lHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float leatherH() {
  float crease = 1.0 - abs(lNoise(vLeatherP * vec3(9.0, 22.0, 9.0)) * 2.0 - 1.0);
  return 0.55 * pow(crease, 6.0) + 0.45 * lNoise(vLeatherP * 46.0);
}`).replace('#include <map_fragment>', `#include <map_fragment>
  float leatherA = leatherH();
  diffuseColor.rgb *= 0.8 + 0.36 * (1.0 - leatherA);`).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
    float dhx = dFdx(leatherA), dhy = dFdy(leatherA);
    vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
    float det = dot(dpx, r1);
    // the height in view-space metres: the creases ~0.6 mm deep on the held hand
    normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2) * 0.0006);
  }`);
  });
}
/**
 * The waymark's plinth a fieldstone drum (round 11; the seats since round 7: a clean pale brick block; mockup C: a dark
 * drum of rough fieldstones): below the post (model y < -0.55; the model spans -1..1) the texture is replaced by rows
 * of irregular stones, each its own grey-brown, with dark mortar between.
 */
function fieldstoneBase(m: MeshStandardMaterial): void {
  patchShader(m, 'sunscar.fieldstone', PATCH_ORDER.decorate, (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vStoneP;').replace('#include <begin_vertex>', '#include <begin_vertex>\n  vStoneP = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vStoneP;
float stoneH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`).replace('#include <map_fragment>', `#include <map_fragment>
  {
    float base = 1.0 - smoothstep(-0.6, -0.52, vStoneP.y);
    float row = floor((vStoneP.y + 1.0) * 11.0 + sin(atan(vStoneP.z, vStoneP.x) * 5.0) * 0.25), ang = atan(vStoneP.z, vStoneP.x) / 6.2831853 + 0.5;
    vec2 cell = vec2(ang * (9.0 + stoneH(vec2(row, 3.0)) * 4.0) + stoneH(vec2(row, 7.0)), (vStoneP.y + 1.0) * 11.0 + sin(atan(vStoneP.z, vStoneP.x) * 5.0) * 0.25);
    vec2 id = floor(cell), f = fract(cell);
    float edge = min(min(f.x, 1.0 - f.x) * 1.6, min(f.y, 1.0 - f.y));
    float mortar = 1.0 - smoothstep(0.04, 0.12, edge);
    float tone = stoneH(id + row * 1.7);
    vec3 stone = mix(vec3(0.07, 0.06, 0.05), vec3(0.17, 0.14, 0.115), tone) * (0.8 + 0.4 * stoneH(floor(cell * 5.0))); // (the greying patch after this keeps it grey)
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(stone, vec3(0.05, 0.04, 0.035), mortar), base);
  }`);
  });
}
/** A texture's colour pulled `amount` of the way to its own grey (the wagon's canvas: sun-bleached cloth, not orange). */
function greyed(m: MeshStandardMaterial, amount: number): void {
  patchShader(m, 'sunscar.greyed', PATCH_ORDER.decorate, (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), ${amount.toFixed(2)});`);
  });
}
/** A textured hero model: its scene as loaded (its own map on its own UVs), normals smoothed, matte. */
async function loadHd(name: DuneHdName): Promise<void> {
  try {
    const gltf = await loadRigFile(DUNE_HD_URLS[name]);
    gltf.scene.traverse((o) => {
      if (!isMesh(o)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m instanceof MeshStandardMaterial) {
          m.metalness = 0; m.roughness = 0.85; m.flatShading = false;
          // E399 (mockup D): the glove dark worn leather with a soft sheen, not a saturated red-brown
          // E407 row 4: the new glove keeps its own painted leather (no discard, no hd2 seams): matte with a soft sheen, the
          // viewer-side light so the backlit fist never reads as a cut-out
          // round 16 (seat C after round 15: the smaller fist's leather flatter than round 14's, p95 47 against 83.5): lighter, glossier, more viewer light
          if (name === 'glove-hd4') { m.color.setRGB(0.92, 0.84, 0.76); m.roughness = 0.34; m.fog = false; m.userData['sunscarNoRim'] = true; viewerLit(m, [0.58, 0.47, 0.38], 0.22); leatherDetail(m); }
          // round 8 (the council since round 5: the wagon's canvas one even self-lit orange with blown white patches; mockup B:
          // a backlit wagon, its cloth grey-beige, the lantern's light inside): its texture taken down to the cloth's value
          // round 8 (the council since round 4: a copper bowl and twisted copper post on a clean tan plinth; mockup C: soot-dark
          // iron and weathered stone, warm only where the fire lights it)
          if (name === 'brazier-hd') { m.color.setRGB(0.5, 0.46, 0.44); greyed(m, 0.8); fieldstoneBase(m); } // round 10 (R9B-7: the post still red copper, R/G 8.4 against 2.3)
          if (name === 'brazier-hd' || name === 'wagon-hd2' || name === 'crates-hd' || name === 'sacks-hd') warmByFire(m); // the camp: the lantern and the cookfire light it
          m.needsUpdate = true;
        }
      }
    });
    retainCachedResources(gltf.scene); hd.set(name, gltf.scene);
    cacheUntilDisposed(gltf.scene, () => { if (hd.get(name) === gltf.scene) { hd.delete(name); loading = null; } });
  } catch (e: unknown) { console.error(`[sunscar-dunes] the generated model ${name} did not load:`, e); }
}

/** Load every generated model and baked rig once (a failed one is skipped and faulted). */
export function preloadDuneMeshes(): Promise<void> {
  loading ??= Promise.all([...DUNE_MESHES.filter(name => !ready.has(name)).map(load), ...DUNE_HD.filter(name => !hd.has(name)).map(loadHd),
    ...DUNE_RIGS.filter(name => !rigs.has(name)).map(loadRig)]).then(() => undefined);
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
