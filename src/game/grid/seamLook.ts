/**
 * The seams' look (SHARD-PLATFORM SF17b look, phase 2: G74 / G90 / G91 / G99 / G101): the materials the platform's
 * generated deck and seams wear. The generator (`@wildshard/engine/sim/strips`) returns ONE triangle mesh per strip, the
 * same triangles the world collides with, plus ordered feature ranges naming what each run of triangles is (the deck, the
 * neutral buffer, the gradient, a retaining wall, a cliff and its talus, a parapet, Driftwood's dike, a culvert, the road
 * wall and its rail). This look never rebuilds that geometry: it copies the vertices once into the home frame, sorts the
 * index ranges by material and draws each material as one geometry group, so the whole platform is a handful of draws.
 *
 * - **ground** (deck, neutral buffer, gradient, the quarter-metre overlap, turn-ins): the generator's vertex colours, the
 *   neutral platform grey easing into each shard's own edge colour, under a fine gravel grain.
 * - **stone** (retaining walls, parapets, the culvert): neutral dressed stone, the same for every shard (G90).
 * - **rock** (a shard's cliff and its talus apron): the shard's own surface (G90): its `sourceSurface` colour when the
 *   reader resolves one, else the shard's edge colour sampled from the gradient row beside it, under rock strata.
 * - **dike** (G91): the dike's stone revetment, rounded rip-rap boulders.
 * - **curtain** (the road wall at an edge that can't blend, G99 / G101): a faint cyan grid, unlit and additive, no glass.
 * - **rail** (its top bar): the thin glowing cyan rail, unlit, past tone mapping like the void's rail (G89).
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, LinearMipmapLinearFilter, type Material, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, RepeatWrapping, SRGBColorSpace, ShaderMaterial,
} from 'three';

/** The material a feature kind wears. */
export type SeamBucket = 'ground' | 'stone' | 'rock' | 'dike' | 'curtain' | 'rail';
/** Draw order: opaque first, the additive curtain last. */
export const SEAM_BUCKETS: readonly SeamBucket[] = ['ground', 'stone', 'rock', 'dike', 'rail', 'curtain'];
const BUCKET_OF: Readonly<Record<string, SeamBucket>> = {
  'deck': 'ground', 'neutral-buffer': 'ground', 'gradient': 'ground', 'overlap': 'ground', 'turn-in': 'ground',
  'retaining-wall': 'stone', 'parapet': 'stone', 'culvert': 'stone', 'cliff': 'rock', 'talus': 'rock', 'dike': 'dike',
  'road-wall': 'curtain', 'guard-rail': 'rail',
};
/** A feature kind's material; an unknown kind (a newer generator) draws as ground rather than vanishing. */
export function seamBucket(kind: string): SeamBucket { return BUCKET_OF[kind] ?? 'ground'; }
/** A `sourceSurface` name to a linear colour (the reader's terrain palette); undefined: sample the shard's edge colour. */
export type SeamSurfaces = (name: string) => readonly [number, number, number] | undefined;
/** The readout: triangles and draws per material (the road's tight budget, G101). */
export interface SeamLookState { readonly triangles: number; readonly draws: number; readonly buckets: Readonly<Partial<Record<SeamBucket, number>>> }

/** What the look reads from a generated strip (`GeneratedStrip` fits it): its mesh and its ordered feature ranges. */
export interface SeamPiece {
  readonly mesh: { readonly origin: { readonly x: number; readonly z: number }; readonly positions: Float32Array; readonly colours: Float32Array; readonly indices: Uint32Array };
  readonly features: readonly { readonly kind: string; readonly firstIndex: number; readonly indexCount: number; readonly sourceSurface?: string }[];
}
const CYAN = new Color(0x38e6ff);
const ROCK_GREY: readonly [number, number, number] = [0.32, 0.3, 0.28];

/**
 * Merge every strip into one home-frame geometry whose index buffer is grouped by material. Pure (no GPU): the vertices are
 * the generator's own, translated; `uv` is world-planar (top faces xz, walls along × height) so textures tile across strips.
 */
export function seamLookGeometry(pieces: readonly SeamPiece[], home: { readonly origin: { readonly x: number; readonly z: number } }, surfaces?: SeamSurfaces): { geometry: BufferGeometry; state: SeamLookState } {
  let vertices = 0;
  for (const { mesh } of pieces) vertices += mesh.positions.length / 3;
  const position = new Float32Array(vertices * 3), colour = new Float32Array(vertices * 3), bucketOf = new Int8Array(vertices).fill(-1);
  const lists = new Map<SeamBucket, number[]>(SEAM_BUCKETS.map((b) => [b, []]));
  let base = 0;
  for (const { mesh, features } of pieces) {
    const dx = mesh.origin.x - home.origin.x, dz = mesh.origin.z - home.origin.z, count = mesh.positions.length / 3;
    for (let k = 0; k < count; k++) {
      position[(base + k) * 3] = (mesh.positions[k * 3] ?? 0) + dx; position[(base + k) * 3 + 1] = mesh.positions[k * 3 + 1] ?? 0; position[(base + k) * 3 + 2] = (mesh.positions[k * 3 + 2] ?? 0) + dz;
      for (let c = 0; c < 3; c++) colour[(base + k) * 3 + c] = mesh.colours[k * 3 + c] ?? 0;
    }
    // every index in a feature range goes to its material's list; triangles no range names draw as ground
    const named = new Uint8Array(mesh.indices.length);
    const rockSurface = new Map<number, readonly [number, number, number] | undefined>();
    for (const feature of features) {
      const bucket = seamBucket(feature.kind), list = lists.get(bucket) ?? [], bi = SEAM_BUCKETS.indexOf(bucket);
      const surface = feature.sourceSurface === undefined ? undefined : surfaces?.(feature.sourceSurface);
      for (let i = feature.firstIndex; i < feature.firstIndex + feature.indexCount; i++) {
        const n = mesh.indices[i]; if (n === undefined || named[i] === 1) continue;
        named[i] = 1; list.push(n + base); bucketOf[n + base] = bi;
        if (bucket === 'rock') rockSurface.set(n, surface);
      }
    }
    const ground = lists.get('ground') ?? [];
    for (let i = 0; i < mesh.indices.length; i++) if (named[i] !== 1) { const n = mesh.indices[i] ?? 0; ground.push(n + base); if (bucketOf[n + base] === -1) bucketOf[n + base] = 0; }
    rockColours(mesh.positions, mesh.colours, bucketOf.subarray(base, base + count), rockSurface, colour.subarray(base * 3, (base + count) * 3));
    base += count;
  }
  const index: number[] = [], groups: { start: number; count: number; bucket: SeamBucket }[] = [];
  for (const bucket of SEAM_BUCKETS) {
    const list = lists.get(bucket) ?? [];
    if (list.length === 0) continue;
    groups.push({ start: index.length, count: list.length, bucket });
    for (const n of list) index.push(n);
  }
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(position, 3)).setAttribute('color', new BufferAttribute(colour, 3))
    .setIndex(new BufferAttribute(new Uint32Array(index), 1));
  geometry.computeVertexNormals();
  geometry.setAttribute('uv', new BufferAttribute(planarUv(position, geometry.getAttribute('normal').array, bucketOf), 2));
  groups.forEach((g) => { geometry.addGroup(g.start, g.count, SEAM_BUCKETS.indexOf(g.bucket)); });
  geometry.computeBoundingSphere();
  const buckets: Partial<Record<SeamBucket, number>> = {};
  for (const g of groups) buckets[g.bucket] = g.count / 3;
  return { geometry, state: { triangles: index.length / 3, draws: groups.length, buckets } };
}

/** Texture metres per uv unit for each material (the uv is world metres divided by this). */
const UV_METRES: Readonly<Record<SeamBucket, number>> = { ground: 4, stone: 2.4, rock: 7, dike: 2, curtain: 1, rail: 1 };
function planarUv(position: Float32Array, normal: ArrayLike<number>, bucketOf: Int8Array): Float32Array {
  const uv = new Float32Array((position.length / 3) * 2);
  for (let k = 0; k < position.length / 3; k++) {
    const x = position[k * 3] ?? 0, y = position[k * 3 + 1] ?? 0, z = position[k * 3 + 2] ?? 0, nx = normal[k * 3] ?? 0, ny = normal[k * 3 + 1] ?? 0, nz = normal[k * 3 + 2] ?? 0;
    const metres = UV_METRES[SEAM_BUCKETS[Math.max(0, bucketOf[k] ?? 0)] ?? 'ground'];
    const top = Math.abs(ny) > 0.75, along = Math.abs(nx) > Math.abs(nz) ? z : x;
    uv[k * 2] = (top ? x : along) / metres; uv[k * 2 + 1] = (top ? z : y) / metres;
  }
  return uv;
}

/**
 * A cliff or talus vertex wears the shard's own surface: the resolved `sourceSurface` colour, else the colour of the
 * nearest ground vertex of the same strip (the gradient's outer row is the shard's own edge colour), drawn toward rock.
 */
function rockColours(positions: Float32Array, colours: Float32Array, bucketOf: Int8Array, surface: ReadonlyMap<number, readonly [number, number, number] | undefined>, out: Float32Array): void {
  if (surface.size === 0) return;
  const cell = 2, key = (x: number, z: number): string => `${String(Math.round(x / cell))},${String(Math.round(z / cell))}`;
  const ground = new Map<string, number[]>();
  for (let k = 0; k < bucketOf.length; k++) if (bucketOf[k] === 0) {
    const id = key(positions[k * 3] ?? 0, positions[k * 3 + 2] ?? 0), list = ground.get(id) ?? [];
    list.push(k); ground.set(id, list);
  }
  for (const [k, resolved] of surface) {
    let rgb: readonly [number, number, number] | undefined = resolved;
    if (rgb === undefined) {
      const x = positions[k * 3] ?? 0, z = positions[k * 3 + 2] ?? 0, cx = Math.round(x / cell), cz = Math.round(z / cell);
      let best = Infinity, found = -1;
      for (let r = 0; r <= 3 && found < 0; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
        for (const g of ground.get(`${String(cx + i)},${String(cz + j)}`) ?? []) {
          const d = ((positions[g * 3] ?? 0) - x) ** 2 + ((positions[g * 3 + 2] ?? 0) - z) ** 2 + ((positions[g * 3 + 1] ?? 0) - (positions[k * 3 + 1] ?? 0)) ** 2 * 0.01;
          if (d < best) { best = d; found = g; }
        }
      }
      rgb = found < 0 ? undefined : [colours[found * 3] ?? 0, colours[found * 3 + 1] ?? 0, colours[found * 3 + 2] ?? 0];
    }
    const own = rgb ?? ROCK_GREY;
    for (let c = 0; c < 3; c++) out[k * 3 + c] = ((own[c] ?? 0) * 0.6 + (ROCK_GREY[c] ?? 0) * 0.4) * 0.9;
  }
}

/** A deterministic hash in [0, 1) (the look is identical every run). */
function hash(n: number): number { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function canvasTexture(size: number, paint: (g: CanvasRenderingContext2D, size: number) => void): CanvasTexture {
  const el = document.createElement('canvas'); el.width = size; el.height = size;
  const g = el.getContext('2d'); if (g === null) throw new Error('No 2D canvas for the seam look');
  paint(g, size);
  const t = new CanvasTexture(el); t.colorSpace = SRGBColorSpace; t.anisotropy = 8; t.minFilter = LinearMipmapLinearFilter; t.wrapS = RepeatWrapping; t.wrapT = RepeatWrapping;
  return t;
}
/** Light grain over white, so the vertex colour (the shard's edge colour) keeps its value. */
function gravel(g: CanvasRenderingContext2D, s: number): void {
  g.fillStyle = '#ececec'; g.fillRect(0, 0, s, s);
  for (let k = 0; k < s * s / 10; k++) {
    const r = hash(k * 1.7), l = Math.round(200 + r * 55), x = hash(k * 3.3) * s, y = hash(k * 5.9) * s;
    g.fillStyle = `rgb(${String(l)},${String(l)},${String(l - 4)})`; g.fillRect(x, y, 1 + (r > 0.8 ? 1 : 0), 1 + (r > 0.9 ? 1 : 0));
  }
}
/** Dressed stone courses: offset blocks with dark mortar (2.4 m per tile: four courses). */
function stone(g: CanvasRenderingContext2D, s: number): void {
  g.fillStyle = '#5c5a55'; g.fillRect(0, 0, s, s);
  const rows = 4, h = s / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 === 0 ? 0 : -s / 6;
    while (x < s) {
      const w = s / 3 * (0.7 + hash(r * 31 + x) * 0.6), l = Math.round(150 + hash(r * 7 + x * 3) * 40);
      g.fillStyle = `rgb(${String(l)},${String(l - 4)},${String(l - 12)})`; g.fillRect(x + 3, r * h + 3, w - 6, h - 6);
      for (let k = 0; k < 40; k++) { const q = hash(r * 97 + x + k); g.fillStyle = `rgba(0,0,0,${String(0.04 + q * 0.06)})`; g.fillRect(x + 3 + hash(k + x) * (w - 8), r * h + 3 + hash(k * 2 + r) * (h - 8), 3, 2); }
      x += w;
    }
  }
}
/** Rock strata: soft horizontal bands with cracks, near white so the shard's colour leads. */
function strata(g: CanvasRenderingContext2D, s: number): void {
  for (let y = 0; y < s; y++) { const l = Math.round(170 + 50 * hash(Math.floor(y / 6)) + 25 * Math.sin(y * 0.09)); g.fillStyle = `rgb(${String(l)},${String(l)},${String(l)})`; g.fillRect(0, y, s, 1); }
  g.strokeStyle = 'rgba(40,36,32,0.35)'; g.lineWidth = 2;
  for (let k = 0; k < 18; k++) { let x = hash(k * 13) * s, y = hash(k * 17) * s; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (hash(k * 5 + j) - 0.5) * 30; y += 12 + hash(k + j * 3) * 20; g.lineTo(x, y); } g.stroke(); }
}
/** The dike's revetment: rounded rip-rap boulders packed in dark joints. */
function riprap(g: CanvasRenderingContext2D, s: number): void {
  g.fillStyle = '#3b3833'; g.fillRect(0, 0, s, s);
  for (let k = 0; k < 70; k++) {
    const x = hash(k * 2.1) * s, y = hash(k * 4.7) * s, r = s * (0.05 + hash(k * 8.3) * 0.05), l = Math.round(120 + hash(k * 6.1) * 60);
    for (const [ox, oy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]] as const) {
      const grad = g.createRadialGradient(x + ox - r * 0.3, y + oy - r * 0.3, r * 0.1, x + ox, y + oy, r);
      grad.addColorStop(0, `rgb(${String(l + 30)},${String(l + 26)},${String(l + 18)})`); grad.addColorStop(1, `rgb(${String(l - 40)},${String(l - 42)},${String(l - 46)})`);
      g.fillStyle = grad; g.beginPath(); g.ellipse(x + ox, y + oy, r, r * 0.8, hash(k) * 3, 0, Math.PI * 2); g.fill();
    }
  }
}

const curtainVertex = /* glsl */ `
varying vec3 vWorld;
void main() { vec4 world = modelMatrix * vec4(position, 1.0); vWorld = world.xyz; gl_Position = projectionMatrix * viewMatrix * world; }`;
const curtainFragment = /* glsl */ `
uniform vec3 uLine;
uniform vec2 uOrigin;
varying vec3 vWorld;
void main() {
  // the faint grid on the curtain: 0.5 m squares along the wall, brighter toward its top and fading with distance
  vec2 p = vec2(vWorld.x + vWorld.z + uOrigin.x + uOrigin.y, vWorld.y) / 0.5;
  vec2 w = max(fwidth(p), vec2(1e-4));
  vec2 d = abs(fract(p - 0.5) - 0.5) / w;
  float line = 1.0 - min(min(d.x, d.y), 1.0);
  float fade = exp(-length(vWorld.xz - cameraPosition.xz) / 90.0);
  float rise = 0.35 + 0.65 * clamp(vWorld.y / 1.8, 0.0, 1.0);
  gl_FragColor = vec4(uLine * (0.05 + line * 0.55) * rise * fade, 1.0);
}`;

/** The materials, in `SEAM_BUCKETS` order (a geometry group's material index is its bucket's index). */
function seamMaterials(home: { readonly origin: { readonly x: number; readonly z: number } }): Material[] {
  const tex = (paint: (g: CanvasRenderingContext2D, s: number) => void, size = 256): CanvasTexture => canvasTexture(size, paint);
  const curtain = new ShaderMaterial({ vertexShader: curtainVertex, fragmentShader: curtainFragment, uniforms: { uLine: { value: CYAN.clone() }, uOrigin: { value: [home.origin.x, home.origin.z] } },
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false, lights: false });
  curtain.name = 'grid-seam-curtain';
  const byBucket: Readonly<Record<SeamBucket, Material>> = {
    ground: new MeshLambertMaterial({ vertexColors: true, map: tex(gravel) }),
    stone: new MeshLambertMaterial({ color: 0xc9c4b8, map: tex(stone) }),
    rock: new MeshLambertMaterial({ vertexColors: true, map: tex(strata) }),
    dike: new MeshLambertMaterial({ color: 0xe0dcd2, map: tex(riprap) }),
    rail: new MeshBasicMaterial({ color: CYAN.clone().multiplyScalar(1.6), toneMapped: false }),
    curtain,
  };
  for (const [name, material] of Object.entries(byBucket)) if (material.name === '') material.name = `grid-seam-${name}`;
  return SEAM_BUCKETS.map((b) => byBucket[b]);
}

/** The deck and seams as one mesh in the home frame: one draw per material present. Dispose with the returned function. */
export function seamMesh(pieces: readonly SeamPiece[], home: { readonly origin: { readonly x: number; readonly z: number } }, surfaces?: SeamSurfaces): { mesh: Mesh; state: SeamLookState; dispose: () => void } {
  const { geometry, state } = seamLookGeometry(pieces, home, surfaces), materials = seamMaterials(home);
  const mesh = new Mesh(geometry, materials);
  mesh.name = 'grid-deck'; mesh.receiveShadow = true; mesh.castShadow = false; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  return { mesh, state, dispose: () => {
    geometry.dispose();
    for (const material of materials) { if (material instanceof MeshLambertMaterial) material.map?.dispose(); material.dispose(); }
  } };
}
