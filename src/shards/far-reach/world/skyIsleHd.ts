import { Box3, Color, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3, type BufferAttribute, type BufferGeometry, type MeshStandardMaterial, type Texture } from 'three';
import type { SkyHdName } from '../boot/files';
import type { Isle } from '../layout';
import { PATCH_ORDER, patchShader } from '#engine';
import { hdMaterial, skyHd } from './meshes';
import type { SkyIsle } from './skyIsles';
import { SKY } from '../look/sun';

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
export const SKY_ISLE_MODELS = ['isle-cone-hd', 'isle-spurs-hd', 'isle-crag-hd'] as const satisfies readonly SkyHdName[];
export type SkyIsleModel = (typeof SKY_ISLE_MODELS)[number];

/**
 * Tuning: how much of its own paint a model feeds back as light (its shaded underside still reads warm), the map's tint (the
 * paint's lime turf read loud beside the playable meadows), how far off the turf level a fir may stand (unit frame), the keel
 * stretch's limits.
 */
export const SKY_ISLE_HD = { selfLight: 0.08, tint: 0.8, turf: 0.2, stretch: [0.8, 1.35], rimBins: 48 } as const;
/**
 * The aerial haze on the sky isles (E399 round 6, measured on mockup A's isle band, x 0.1-0.9, y 0.27-0.42: its darkest
 * isle rock is a hazed mauve, 107,81,77, where ours read dark brown, 75,58,38): toward the warm haze over `near`..`far` metres, at most `max`.
 */
export const SKY_ISLE_HAZE = { color: SKY.fog, near: 60, far: 320, max: 0.22 } as const;

/** Which model each sky isle wears, and its yaw (radians): every model in each view, none turned the same way twice. */
const WEAR: Readonly<Record<string, readonly [SkyIsleModel, number]>> = {
  'sky.l1': ['isle-cone-hd', 0.4], 'sky.l2': ['isle-spurs-hd', 2.1], 'sky.l3': ['isle-crag-hd', 4.0], 'sky.l4': ['isle-cone-hd', 5.3], 'sky.l5': ['isle-spurs-hd', 1.0],
  'sky.r1': ['isle-crag-hd', 2.8], 'sky.r2': ['isle-cone-hd', 3.5], 'sky.r3': ['isle-spurs-hd', 4.6], 'sky.r4': ['isle-crag-hd', 0.9], 'sky.r5': ['isle-cone-hd', 1.7],
  'sky.o1': ['isle-spurs-hd', 0.2], 'sky.o2': ['isle-cone-hd', 3.0], 'sky.o3': ['isle-crag-hd', 2.2], 'sky.o4': ['isle-cone-hd', 4.4],
  'sky.b1': ['isle-crag-hd', 5.6], 'sky.b2': ['isle-spurs-hd', 3.9], 'sky.b3': ['isle-cone-hd', 2.5], 'sky.b4': ['isle-spurs-hd', 4.9],
};
const FALLBACK: readonly SkyIsleModel[] = SKY_ISLE_MODELS;

/** A model in its unit frame, with a probe of its turf and its rim radius per angle. */
interface Unit { readonly geometry: BufferGeometry; readonly map: Texture; readonly depth: number; readonly rim: Float32Array; readonly probe: Mesh }

const median = (v: number[]): number => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };

/** Bring a loaded model to the unit frame (see the module note). */
function unit(geometry: BufferGeometry, map: Texture): Unit {
  const ray = new Raycaster(), down = new Vector3(0, -1, 0), probe = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
  const p = geometry.getAttribute('position') as BufferAttribute, box = new Box3().setFromBufferAttribute(p);
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, half = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
  // the turf: the median first hit straight down over the middle of the top (bushes and the crag's outcrop are outliers)
  const hits: number[] = [];
  for (let i = -3; i <= 3; i++) for (let k = -3; k <= 3; k++) {
    ray.set(new Vector3(cx + (i / 3) * half * 0.45, box.max.y + 1, cz + (k / 3) * half * 0.45), down);
    const hit = ray.intersectObject(probe, false)[0]; if (hit !== undefined) hits.push(hit.point.y);
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
  geometry.translate(-tx, -deck, -tz); geometry.scale(k, k, k);
  for (let b = 0; b < bins; b++) rim[b] = (rim[b] ?? 0) * k;
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const depth = -(geometry.boundingBox?.min.y ?? -1);
  return { geometry, map, depth, rim, probe };
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
export function skyIsleModels(isles: readonly SkyIsle[]): SkyIsleHd {
  const units = new Map<SkyIsleModel, Unit>();
  for (const name of SKY_ISLE_MODELS) { const m = skyHd(name); if (m !== null) units.set(name, unit(m.geometry, m.map)); }
  const group = new Group(), fallback: SkyIsle[] = [], placed = new Map<string, { u: Unit; yaw: number; sy: number }>();
  const byModel = new Map<SkyIsleModel, SkyIsle[]>();
  isles.forEach((s, i) => {
    const name = WEAR[s.id]?.[0] ?? FALLBACK[i % FALLBACK.length] ?? 'isle-cone-hd';
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
    float turf = smoothstep(0.02, 0.12, c.g - max(c.r, c.b) * 0.92);
    vec3 stone = vec3(l) * vec3(1.02, 0.96, 0.88) * (0.75 + 0.35 * smoothstep(0.15, 0.6, l));
    diffuseColor.rgb = mix(stone, c * vec3(0.82, 0.95, 0.72), turf); }`).replace('#include <dithering_fragment>', `#include <dithering_fragment>
  // the low sun behind them catches their edges gold (round 9, the seats: 'pale flat mesas'; mockup A's crags are dark
  // masses with sunlit gold rims)
  { float farRim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0);
    gl_FragColor.rgb = gl_FragColor.rgb * 0.82 + vec3(1.0, 0.7, 0.36) * farRim * 0.55; }
  gl_FragColor.rgb = mix(gl_FragColor.rgb, ${linear(SKY_ISLE_HAZE.color)}, clamp((length(vViewPosition) - ${SKY_ISLE_HAZE.near.toFixed(1)}) / ${(SKY_ISLE_HAZE.far - SKY_ISLE_HAZE.near).toFixed(1)}, 0.0, 1.0) * ${SKY_ISLE_HAZE.max.toFixed(2)});`);
    }, { key: (prior) => `${prior}|far.sky-isle-rock|haze|rim` });
    const mesh = new InstancedMesh(u.geometry, material, list.length); mesh.name = `far.sky-isles.${name}`;
    list.forEach((s, k) => {
      const yaw = WEAR[s.id]?.[1] ?? k * 2.39996, [lo, hi] = SKY_ISLE_HD.stretch, sy = Math.min(hi, Math.max(lo, s.keel / (s.r * u.depth)));
      q.setFromAxisAngle(up, yaw); m.compose(new Vector3(s.x, s.y, s.z), q, new Vector3(s.r, s.r * sy, s.r)); mesh.setMatrixAt(k, m);
      placed.set(s.id, { u, yaw, sy });
    });
    mesh.computeBoundingSphere(); group.add(mesh);
  }
  const ray = new Raycaster(), down = new Vector3(0, -1, 0), local = new Vector3();
  return {
    group, fallback,
    topAt: (isle, x, z) => {
      const at = placed.get(isle.id); if (at === undefined) return null;
      local.set((x - isle.x) / isle.r, 0, (z - isle.z) / isle.r).applyAxisAngle(up, -at.yaw);
      ray.set(new Vector3(local.x, 5, local.z), down);
      const hit = ray.intersectObject(at.u.probe, false)[0];
      // off the turf (a lip, a bush top, a root): no tree there
      if (hit === undefined || Math.abs(hit.point.y) > SKY_ISLE_HD.turf) return null;
      return isle.y + hit.point.y * isle.r * at.sy;
    },
    lipAt: (isle, a) => {
      const at = placed.get(isle.id); if (at === undefined) return null;
      local.set(Math.cos(a), 0, Math.sin(a)).applyAxisAngle(up, -at.yaw);
      return rimAt(at.u, Math.atan2(local.z, local.x)) * isle.r;
    },
  };
}
