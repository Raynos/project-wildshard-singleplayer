import { BackSide, Box3, Color, DoubleSide, FrontSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3, type BufferAttribute, type BufferGeometry, type MeshStandardMaterial, type Texture } from 'three';
import type { SkyHdName } from '../boot/files';
import type { Isle } from '../data/layout';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { hdMaterial, skyHd } from './meshes';
import type { SkyIsle } from './skyIsles';
import { SKY, SUN_DIR } from '../look/sun';

/** A hex colour as a linear-space GLSL vec3 (the shader's output space before the post chain). */
function linear(hex: number): string { const c = new Color(hex); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; }

/**
 * The textured floating islands for the decorative sky isles (E392/E399, `art/far-reach/round-21-sky-isles/`): every
 * council seat read the code isles as "dark bare rock islands" from below, where the mockups' are lush (a thick mossy
 * turf spilling over the rim, warm sandy-grey stratified rock, long roots and moss trailing beneath). Three codex
 * references on white → BiRefNet cutout → Hunyuan3D-2 turbo shape + 2048 paint → decimated, a 1024 WebP map, meshopt.
 * Each model is brought to a unit frame once (its turf level at y 0, its rim's median radius 1, centred on its top),
 * then every isle that uses it is one instance, scaled to its rim radius and keel depth and turned to its own yaw.
 * No trees in the models: the card firs stand on the turf (`topAt`). A model that failed to load leaves its isles to
 * the code builder (`world/isle.ts`).
 */
/**
 * Top-10 row 1 (E407, `art/far-reach/round-25-isles/`): the mockups' islands, rounded rock masses with overhangs, bushy
 * canopies spilling over the rim and heavy root and vine curtains (the round-21 three were flat grassy tops over a keel:
 * 'pancakes'). Codex refs from crops of mockups A, C, D and proposal B, then BiRefNet, Hunyuan3D-2 turbo + paint, finish.sh.
 */
export const SKY_ISLE_MODELS = ['isle-mass-hd', 'isle-canopy-hd', 'isle-falls-hd', 'isle-spire-hd', 'isle-twin-hd', 'isle-shelf-hd'] as const satisfies readonly SkyHdName[];
export type SkyIsleModel = (typeof SKY_ISLE_MODELS)[number];

/**
 * Tuning: how much of its own paint a model feeds back as light (its shaded underside still reads warm), the map's tint (the
 * paint's lime turf read loud beside the playable meadows), how far off the turf level a fir may stand (unit frame), the keel
 * stretch's limits.
 */
// (row 1: the new models' paint is darker than round 21's; the mockups' crags read warm and hazed against the low sun)
/** `keelInset`: a playable island's keel is fitted so its widest rock under the cut stands at this share of the deck's radius. */
/** `shade`: the light on a face by its turn to the low sun, [turned away, facing it] (top-10 row 9). */
export const SKY_ISLE_HD = { selfLight: 0.14, shade: [0.7, 1.18], tint: 1.0, turf: 0.2, stretch: [0.8, 1.35], rimBins: 48, keelInset: 0.88 } as const;
/**
 * The aerial haze on the sky isles (E399 round 6, measured on mockup A's isle band, x 0.1-0.9, y 0.27-0.42: its darkest
 * isle rock is a hazed mauve, 107,81,77, where ours read dark brown, 75,58,38): toward the warm haze over `near`..`far` metres, at most `max`.
 */
export const SKY_ISLE_HAZE = { color: SKY.fog, near: 60, far: 320, max: 0.22 } as const;

/** Which model each sky isle wears, and its yaw (radians): every model in each view, none turned the same way twice. */
const WEAR: Readonly<Record<string, readonly [SkyIsleModel, number]>> = {
  'sky.l1': ['isle-falls-hd', 0.4], 'sky.l2': ['isle-canopy-hd', 2.1], 'sky.l3': ['isle-shelf-hd', 4.0], 'sky.l4': ['isle-mass-hd', 5.3], 'sky.l5': ['isle-twin-hd', 1.0],
  'sky.r1': ['isle-spire-hd', 2.8], 'sky.r2': ['isle-falls-hd', 3.5], 'sky.r3': ['isle-shelf-hd', 4.6], 'sky.r4': ['isle-canopy-hd', 0.9], 'sky.r5': ['isle-mass-hd', 1.7],
  // the cluster over the mill (the lead's ruling): the big masses and the twin, overlapping
  'sky.o1': ['isle-mass-hd', 0.2], 'sky.o2': ['isle-shelf-hd', 3.0], 'sky.o3': ['isle-twin-hd', 2.2], 'sky.o4': ['isle-canopy-hd', 4.4], 'sky.o5': ['isle-spire-hd', 5.1], 'sky.o6': ['isle-falls-hd', 0.7],
  'sky.b1': ['isle-twin-hd', 5.6], 'sky.b2': ['isle-spire-hd', 3.9], 'sky.b3': ['isle-mass-hd', 2.5], 'sky.b4': ['isle-canopy-hd', 4.9],
  // the playable islands' keels (clipped under their decks): the rock masses with root curtains
  'keel.sunrest': ['isle-mass-hd', 1.1], 'keel.windmill': ['isle-mass-hd', 0.3], 'keel.grove': ['isle-twin-hd', 2.4], 'keel.roost': ['isle-spire-hd', 4.0],
  'keel.keeper': ['isle-shelf-hd', 5.0], 'keel.ruin': ['isle-mass-hd', 3.3], 'keel.step': ['isle-falls-hd', 0.9], 'keel.crown': ['isle-spire-hd', 2.0],
};
const FALLBACK: readonly SkyIsleModel[] = SKY_ISLE_MODELS;
/** The model a sky isle (or a playable keel) wears: its `WEAR` row, else the `i`-th model in turn. */
export const skyIsleWear = (s: Isle, i: number): SkyIsleModel => WEAR[s.id]?.[0] ?? FALLBACK[i % FALLBACK.length] ?? 'isle-mass-hd';

/**
 * The playable islands' keels (world/build.ts; E399 round 2): a model under each island, its turf `keelTop` under the
 * walkable top, its rim `keelScale` of the deck's; `cut` is where the code top's own rock is cut away. Shared with the far
 * proxy's bake (look/far.ts), so the neighbour view hangs the same keels.
 */
export const ISLE_CUT = 1.4, KEEL_TOP = 1.0;
export const ISLE_KEEL_CUT: Readonly<Record<string, { cut: number; keelTop: number; keelScale: number }>> = { windmill: { cut: 0.8, keelTop: 0.6, keelScale: 0.78 } };
export const keelIsles = (isles: readonly Isle[]): SkyIsle[] => isles.map((isle) => ({ ...isle, id: `keel.${isle.id}`, y: isle.y - (ISLE_KEEL_CUT[isle.id]?.keelTop ?? KEEL_TOP), r: isle.r * (ISLE_KEEL_CUT[isle.id]?.keelScale ?? 0.97), pines: 0, fall: null }));

/** A model in its unit frame, with a probe of its turf and its rim radius per angle. */
/** `bulge`: the model's widest horizontal reach under its turf (deck radii), where its overhangs and bushes spill out. */
export interface SkyIsleUnit { readonly geometry: BufferGeometry; readonly depth: number; readonly rim: Float32Array; readonly probe: Mesh; readonly bulge: number }
interface Unit extends SkyIsleUnit { readonly map: Texture }

const median = (v: number[]): number => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };

/**
 * A probe's straight-down rays without walking every triangle (rt3-crossing2). Three's Mesh.raycast tests all of a model's
 * triangles for each ray: 49 rays a model (twice: the isles and the keels) and one per pine cost Sky Reach's entry a 4.8 s
 * task at 4x CPU. This bins the triangles by their x / z extent once (per position version) and runs three's own
 * ray-triangle test, in index order, on the triangles under the ray: the nearest hit's height, as
 * `new Raycaster(origin, down).intersectObject(probe, false)[0]?.point.y` returns it (a vertical ray meets only triangles
 * whose x / z extent holds it). Any other ray or a moved probe takes three's raycast.
 */
interface DownGrid { readonly version: number; readonly x0: number; readonly z0: number; readonly step: number; readonly cells: readonly (number[] | undefined)[] }
const DOWN_GRID = 64;
const downGrids = new WeakMap<BufferGeometry, DownGrid>();
const downA = new Vector3(), downB = new Vector3(), downC = new Vector3(), downHit = new Vector3(), downRay = new Raycaster(), DOWN = new Vector3(0, -1, 0), IDENTITY = new Matrix4();
function downRange(geometry: BufferGeometry): { readonly start: number; readonly end: number; readonly corner: (i: number) => number } {
  const index = geometry.getIndex(), count = index === null ? geometry.getAttribute('position').count : index.count, range = geometry.drawRange;
  return { start: Math.max(0, range.start), end: Math.min(count, range.start + range.count), corner: index === null ? (i) => i : (i) => index.getX(i) };
}
function downGrid(geometry: BufferGeometry): DownGrid {
  const p = geometry.getAttribute('position') as BufferAttribute, held = downGrids.get(geometry);
  if (held !== undefined && held.version === p.version) return held;
  const { start, end, corner } = downRange(geometry);
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = start; i < end; i++) { const v = corner(i), x = p.getX(v), z = p.getZ(v); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const step = Math.max(x1 - x0, z1 - z0, 1e-6) / DOWN_GRID, cells = Array.from<number[] | undefined>({ length: DOWN_GRID * DOWN_GRID });
  const cell = (v: number, o: number): number => Math.min(DOWN_GRID - 1, Math.max(0, Math.floor((v - o) / step)));
  for (let i = start; i + 2 < end; i += 3) {
    const a = corner(i), b = corner(i + 1), c = corner(i + 2);
    const ax = p.getX(a), bx = p.getX(b), cx = p.getX(c), az = p.getZ(a), bz = p.getZ(b), cz = p.getZ(c);
    const i0 = cell(Math.min(ax, bx, cx), x0), i1 = cell(Math.max(ax, bx, cx), x0), k0 = cell(Math.min(az, bz, cz), z0), k1 = cell(Math.max(az, bz, cz), z0);
    for (let k = k0; k <= k1; k++) for (let j = i0; j <= i1; j++) { const at = k * DOWN_GRID + j; (cells[at] ??= []).push(i); }
  }
  const grid = { version: p.version, x0, z0, step, cells };
  downGrids.set(geometry, grid);
  return grid;
}
/** The height of the first hit of a ray from `origin` straight down onto `probe` (undefined: a miss). */
export function skyIsleHitDown(probe: Mesh, origin: Vector3): number | undefined {
  const geometry = probe.geometry, material = probe.material;
  downRay.set(origin, DOWN);
  if (Array.isArray(material) || !probe.matrixWorld.equals(IDENTITY) || probe.morphTargetInfluences !== undefined) return downRay.intersectObject(probe, false)[0]?.point.y;
  // three's early-outs, in its order: the bounding sphere (computed if absent), then the box if the geometry has one
  if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere;
  if (sphere === null || !downRay.ray.intersectsSphere(sphere) || (geometry.boundingBox !== null && !downRay.ray.intersectsBox(geometry.boundingBox))) return undefined;
  const grid = downGrid(geometry), p = geometry.getAttribute('position') as BufferAttribute, { corner } = downRange(geometry);
  const j = Math.floor((origin.x - grid.x0) / grid.step), k = Math.floor((origin.z - grid.z0) / grid.step);
  if (j < 0 || k < 0 || j >= DOWN_GRID || k >= DOWN_GRID) {
    // past the outermost cell edge only by the clamp's rounding: three's walk decides
    if (origin.x < grid.x0 || origin.z < grid.z0 || origin.x > grid.x0 + grid.step * DOWN_GRID || origin.z > grid.z0 + grid.step * DOWN_GRID) return undefined;
    return downRay.intersectObject(probe, false)[0]?.point.y;
  }
  const backface = material.side === FrontSide, flip = material.side === BackSide;
  let best = Infinity, y: number | undefined;
  for (const i of grid.cells[k * DOWN_GRID + j] ?? []) {
    downA.fromBufferAttribute(p, corner(i)); downB.fromBufferAttribute(p, corner(i + 1)); downC.fromBufferAttribute(p, corner(i + 2));
    const hit = flip ? downRay.ray.intersectTriangle(downC, downB, downA, true, downHit) : downRay.ray.intersectTriangle(downA, downB, downC, backface, downHit);
    if (hit === null) continue;
    const distance = origin.distanceTo(hit);
    if (distance < best) { best = distance; y = hit.y; }
  }
  return y;
}

/** Bring a loaded model to the unit frame (see the module note); moves the geometry in place. Node-safe (the far bake). */
export function skyIsleUnit(geometry: BufferGeometry): SkyIsleUnit {
  const probe = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
  const p = geometry.getAttribute('position') as BufferAttribute, box = new Box3().setFromBufferAttribute(p);
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, half = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
  // the turf: the median first hit straight down over the middle of the top (bushes and the crag's outcrop are outliers)
  const hits: number[] = [];
  for (let i = -3; i <= 3; i++) for (let k = -3; k <= 3; k++) {
    const hit = skyIsleHitDown(probe, new Vector3(cx + (i / 3) * half * 0.45, box.max.y + 1, cz + (k / 3) * half * 0.45)); if (hit !== undefined) hits.push(hit);
  }
  const deck = median(hits), lip = deck - (box.max.y - box.min.y) * 0.06;
  // the top's footprint: its centre, and its radius per angle (the farthest vertex near the turf level in each bin)
  const top = new Box3();
  for (let i = 0; i < p.count; i++) if (p.getY(i) > lip) top.expandByPoint(new Vector3(p.getX(i), p.getY(i), p.getZ(i)));
  const tx = (top.min.x + top.max.x) / 2, tz = (top.min.z + top.max.z) / 2, bins = SKY_ISLE_HD.rimBins, rim = new Float32Array(bins);
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) <= lip) continue;
    const dx = p.getX(i) - tx, dz = p.getZ(i) - tz, b = Math.floor(((Math.atan2(dz, dx) / (Math.PI * 2)) + 1) * bins) % bins;
    rim[b] = Math.max(rim[b] ?? 0, Math.hypot(dx, dz));
  }
  const k = 1 / Math.max(1e-6, median([...rim].filter((r) => r > 0)));
  let bulge = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) <= deck) bulge = Math.max(bulge, Math.hypot(p.getX(i) - tx, p.getZ(i) - tz) * k);
  geometry.translate(-tx, -deck, -tz); geometry.scale(k, k, k);
  for (let b = 0; b < bins; b++) rim[b] = (rim[b] ?? 0) * k;
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const depth = -(geometry.boundingBox?.min.y ?? -1);
  return { geometry, depth, rim, probe, bulge };
}

/**
 * Where an isle's model instance stands: its yaw (radians), its rim scale and its keel stretch (`sy`, applied on top of
 * the rim scale to y). `k` is its place among the isles wearing the same model (the yaw fallback). A playable keel
 * (`clipTop`) tapers INSIDE its deck (round 13, seat C: the mill's keel bulged past its deck, a thin disc on a mossy
 * bun): its widest rock under the cut fitted to keelInset of the deck's radius; its depth kept.
 */
export function skyIslePose(s: Isle, u: SkyIsleUnit, k: number, clipTop: boolean): { readonly yaw: number; readonly r: number; readonly sy: number } {
  const r = clipTop ? s.r * Math.min(1, SKY_ISLE_HD.keelInset / Math.max(1e-3, u.bulge)) : s.r;
  const yaw = WEAR[s.id]?.[1] ?? k * 2.39996, [lo, hi] = SKY_ISLE_HD.stretch, sy = Math.min(hi * s.r / r, Math.max(lo, s.keel / (r * u.depth)));
  return { yaw, r, sy };
}

/** A unit model's rim radius at a local angle (radians from +x), bins without a vertex borrowing the median. */
const rimAt = (u: Unit, a: number): number => {
  const bins = SKY_ISLE_HD.rimBins, b = Math.floor(((a / (Math.PI * 2)) % 1 + 1) * bins) % bins, r = u.rim[b] ?? 0;
  return r > 0 ? r : 1;
};

export interface SkyIsleHd {
  /** One instanced draw per model. */
  readonly group: Group;
  /** The isles no model covers (their model did not load): the code builder makes them. */
  readonly fallback: readonly SkyIsle[];
  /** The turf's height at a world point on an isle the models cover (null: off its top, or a code isle). */
  readonly topAt: (isle: Isle, x: number, z: number) => number | null;
  /** The rim's radius at a world angle round an isle the models cover (null: a code isle): where its waterfall hangs. */
  readonly lipAt: (isle: Isle, a: number) => number | null;
}

/** The sky isles as textured models (see the module note). */
/** `clipTop` (the playable islands' keels): everything above the model's turf is cut away, so its canopy never pokes through a deck. */
export function skyIsleModels(isles: readonly SkyIsle[], clipTop = false): SkyIsleHd {
  const units = new Map<SkyIsleModel, Unit>();
  for (const name of SKY_ISLE_MODELS) { const m = skyHd(name); if (m !== null) units.set(name, { ...skyIsleUnit(m.geometry), map: m.map }); }
  const group = new Group(), fallback: SkyIsle[] = [], placed = new Map<string, { u: Unit; yaw: number; sy: number }>();
  const byModel = new Map<SkyIsleModel, SkyIsle[]>();
  isles.forEach((s, i) => {
    const name = skyIsleWear(s, i);
    if (!units.has(name)) { fallback.push(s); return; }
    byModel.set(name, [...(byModel.get(name) ?? []), s]);
  });
  const m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0);
  for (const [name, list] of byModel) {
    const u = units.get(name); if (u === undefined) continue;
    const material: MeshStandardMaterial = hdMaterial(u.map);
    material.color.setScalar(SKY_ISLE_HD.tint); material.emissiveMap = u.map; material.emissive.setScalar(1); material.emissiveIntensity = SKY_ISLE_HD.selfLight;
    // the rock grey-brown, the turf kept green (E399: from below the paint read olive-yellow; the mockups' undersides are
    // sandy-grey stone with darker crevices)
    patchShader(material, 'far.sky-isle-rock', PATCH_ORDER.decorate, (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  { vec3 c = diffuseColor.rgb; float l = dot(c, vec3(0.3, 0.59, 0.11));
    float turf = ${clipTop ? '0.0' : 'smoothstep(0.02, 0.12, c.g - max(c.r, c.b) * 0.92)'};
    vec3 stone = vec3(l) * vec3(1.02, 0.96, 0.88) * (0.75 + 0.35 * smoothstep(0.15, 0.6, l));
    // (row 1, the lead: the canopies read olive-grey; the mockups' crowns are lush green lit warm by the low sun)
    vec3 leaf = mix(vec3(l), c, 1.35) * vec3(1.02, 1.12, 0.78) * 1.15;
    diffuseColor.rgb = mix(stone, clamp(leaf, 0.0, 1.0), turf); }`).replace('#include <dithering_fragment>', `#include <dithering_fragment>
  // the low sun behind them catches their edges gold (round 9, the seats: 'pale flat mesas'; mockup A's crags are dark
  // masses with sunlit gold rims)
  // strongest on the sun's side (round 10, seat B: every edge lit alike), a share on the rest (round 12: sun-side only
  // left the crags facing the spawn dark)
  { float farRim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0) * (0.4 + 0.6 * smoothstep(-0.1, 0.5, dot(normalize(normal), normalize((viewMatrix * vec4(${SUN_DIR.x.toFixed(4)}, ${SUN_DIR.y.toFixed(4)}, ${SUN_DIR.z.toFixed(4)}, 0.0)).xyz))));
    // (top-10 row 9: the mockups light their isles from behind: the masses turned from the low sun fall into a soft
    // shade, the faces toward it brighten, so each reads as a lit volume, not a flat beige cut-out)
    float farSunTurn = smoothstep(-0.45, 0.65, dot(normalize(normal), normalize((viewMatrix * vec4(${SUN_DIR.x.toFixed(4)}, ${SUN_DIR.y.toFixed(4)}, ${SUN_DIR.z.toFixed(4)}, 0.0)).xyz)));
    gl_FragColor.rgb *= mix(${SKY_ISLE_HD.shade[0].toFixed(2)}, ${SKY_ISLE_HD.shade[1].toFixed(2)}, farSunTurn);
    gl_FragColor.rgb = gl_FragColor.rgb * 0.95 + vec3(1.0, 0.7, 0.36) * farRim * 0.55; }
  gl_FragColor.rgb = mix(gl_FragColor.rgb, ${linear(SKY_ISLE_HAZE.color)}, clamp((length(vViewPosition) - ${SKY_ISLE_HAZE.near.toFixed(1)}) / ${(SKY_ISLE_HAZE.far - SKY_ISLE_HAZE.near).toFixed(1)}, 0.0, 1.0) * ${SKY_ISLE_HAZE.max.toFixed(2)});`);
      if (clipTop) {
        shader.vertexShader = `varying float farLocalY;\n${shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  farLocalY = position.y;')}`;
        shader.fragmentShader = `varying float farLocalY;\n${shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if (farLocalY > 0.02) discard;')}`;
      }
    }, { key: (prior) => `${prior}|far.sky-isle-rock|haze|rim-sun${clipTop ? '|clip' : ''}` });
    const mesh = new InstancedMesh(u.geometry, material, list.length); mesh.name = `far.sky-isles.${name}`;
    list.forEach((s, k) => {
      const { yaw, r, sy } = skyIslePose(s, u, k, clipTop);
      q.setFromAxisAngle(up, yaw); m.compose(new Vector3(s.x, s.y, s.z), q, new Vector3(r, r * sy, r)); mesh.setMatrixAt(k, m);
      placed.set(s.id, { u, yaw, sy });
    });
    mesh.computeBoundingSphere(); group.add(mesh);
  }
  const local = new Vector3();
  return {
    group, fallback,
    topAt: (isle, x, z) => {
      const at = placed.get(isle.id); if (at === undefined) return null;
      local.set((x - isle.x) / isle.r, 0, (z - isle.z) / isle.r).applyAxisAngle(up, -at.yaw);
      const hit = skyIsleHitDown(at.u.probe, new Vector3(local.x, 5, local.z));
      // off the turf (a lip, a bush top, a root): no tree there
      if (hit === undefined || Math.abs(hit) > SKY_ISLE_HD.turf) return null;
      return isle.y + hit * isle.r * at.sy;
    },
    lipAt: (isle, a) => {
      const at = placed.get(isle.id); if (at === undefined) return null;
      local.set(Math.cos(a), 0, Math.sin(a)).applyAxisAngle(up, -at.yaw);
      return rimAt(at.u, Math.atan2(local.z, local.x)) * isle.r;
    },
  };
}
