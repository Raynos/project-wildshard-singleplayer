import { BufferAttribute, Color, DoubleSide, type Texture, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial, Vector2, Vector3, Vector4 } from 'three';
import { DAIS, FALLEN_BRIDGE, ISLES, KNOLL_GLSL, MILL, NOTES, SPANS, UPDRAFT, VANES, WINCH, apothem, type Isle } from '../layout';
import { KEEPER_AT, KEEPER_STAND } from '../quest/keeper';
import { crownStones } from './crown';
import { NEST, SPIRES, spireAt } from './roost';
import { WINCH_HOUSE } from './winchHouse';
import { FOG, SKY } from '../look/sun';
import { SWARD_ATLAS, swardAtlas } from './swardAtlas';

/**
 * The near meadow (loop 4; the targets' foreground is knee-deep golden grass, not a green plane): a field of single blades
 * that travels with the camera. One 8 m tile of blades is drawn as a grid of instances around the camera (the vertex
 * shader snaps the grid to the tile lattice, so nothing is uploaded per frame); a blade survives only on an island top,
 * off the bridge landings, the worn paths and the structures, and it shortens to nothing at the field's edge so the
 * grid's border never shows. Unlit-by-the-rig, painted in the shader: olive roots to gold tips, a warm back-light glow
 * when you look toward the low sun, the shard's rose fog. No colliders; the island dressing's clumps carry the far view.
 */
export const MEADOW = {
  /** a tile's side (metres) */
  tile: 8,
  /** tiles across the field (odd, the camera's tile in the middle): 7 × 8 m = a 56 m square, blades out to `range` */
  across: 7,
  /** where the blades have shrunk to nothing (metres from the camera) */
  range: 24,
  /**
   * E392 foreground: the inner 3 × 3 tiles are drawn `layers` more times with the blades shuffled, so the near field is
   * (1 + layers) × as dense with no more blades in the buffer; the extra layers shrink away by `near` metres (inside
   * the inner tiles' 8 m reach), and a frustum test drops every blade off screen before its island and hole loops
   */
  layers: 3, near: 7.5,
  /** blade height range (metres) */
  low: 0.16, high: 0.74,
  /** an island's grass height scale (1 when absent): the crown's arena a little shorter, so the dais reads (E399: mockup D's meadow is lush to the dais) */
  grass: { crown: 0.72 } as Readonly<Record<string, number>>,
  /** the share of blades an island keeps (1 when absent): the crown a little thinner (round 2's carpet of chips was the old wide blades) */
  keep: { crown: 1 } as Readonly<Record<string, number>>,
} as const;

/** The sward's paint (sRGB) and size (E399): a tuft card's height scale, the root-to-tip ramp, the backlit glow, and how far toward grey the whole field is pulled. */
export const SWARD = { scale: 1.05, root: 0x1c1c0c, low: 0x3a3c18, green: 0x5c5e28, gold: 0x8c7c34, tip: 0xc8ac64, glow: 0xd8b860, grey: 0.0 } as const;

/** Where grass never grows: discs (x, z, radius) round the structures and pieces you stand at. */
export function meadowHoles(): Vector4[] {
  const holes: [number, number, number][] = [[MILL.x, MILL.z, 2.9], [WINCH.x, WINCH.z, 1.3], [NOTES.x, NOTES.z, 0.8], [KEEPER_AT.x, KEEPER_AT.z, 0.7], [KEEPER_STAND.x, KEEPER_STAND.z, 0.45], [DAIS.x, DAIS.z, DAIS.r + 0.4]];
  for (const v of VANES) holes.push([v.x, v.z, 1]);
  for (const st of crownStones()) holes.push([st.x, st.z, 0.85]);
  holes.push([NEST.x, NEST.z, NEST.r + 0.2], [WINCH_HOUSE.x, WINCH_HOUSE.z, WINCH_HOUSE.w * 0.75]);
  for (const sp of SPIRES) { const at = spireAt(sp); holes.push([at.x, at.z, sp.r + 0.2]); }
  return holes.map(([x, z, r]) => new Vector4(x, z, r, 0));
}

/** The worn paths: a segment (x0, z0) → (x1, z1) from each bridge landing in toward its island's middle. */
export function meadowPaths(isles: readonly Isle[] = ISLES): Vector4[] {
  const out: Vector4[] = [];
  const ends: [number, number][] = [];
  for (const s of [...SPANS, FALLEN_BRIDGE]) { ends.push([s.x0, s.z0], [s.x1, s.z1]); }
  ends.push([UPDRAFT.x0, UPDRAFT.z0], [UPDRAFT.x1, UPDRAFT.z1]);
  for (const [x, z] of ends) {
    let best: Isle | null = null, bd = Infinity;
    for (const isle of isles) { const d = Math.hypot(x - isle.x, z - isle.z); if (d < bd) { bd = d; best = isle; } }
    if (best === null || bd > best.r + 2) continue;
    // a short worn apron in from each landing (E392: the mockups' meadow runs right up to the bridge)
    const k = Math.max(0, bd - 3.5) / Math.max(1e-3, bd);
    out.push(new Vector4(x, z, best.x + (x - best.x) * k, best.z + (z - best.z) * k));
  }
  return out;
}

/** The hash both the grass and the ground paint use for patchiness (GLSL). */
export const MEADOW_GLSL = /* glsl */`
  float mh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float mn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mh(i), mh(i + vec2(1.0, 0.0)), u.x), mix(mh(i + vec2(0.0, 1.0)), mh(i + vec2(1.0, 1.0)), u.x), u.y); }
  float mfbm(vec2 p){ return mn(p) * 0.55 + mn(p * 2.1 + 7.3) * 0.3 + mn(p * 4.3 - 3.1) * 0.15; }
  float segDist(vec2 p, vec2 a, vec2 b){ vec2 ab = b - a; float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0); return length(p - a - ab * t); }
`;

function glslColor(hex: number): string { const c = new Color(hex); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; }

export interface Meadow { readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>; readonly atlas: Texture; update: (camera: Vector3, t: number) => void }

/** Build the meadow with `blades` blades per tile (a tier knob), seeded so every load grows the same field. */
/**
 * `rocks`: discs (x, z, radius) where the grass only grows short, round the foreground boulders (E399: the 0.5 m rocks
 * hid in 0.6 m grass; the mockups' rocks stand out of a lower sward round them).
 */
export function meadow(sunDir: Vector3, blades: number, isles: readonly Isle[] = ISLES, rocks: readonly (readonly [number, number, number])[] = []): Meadow {
  const atlas = swardAtlas();
  // one blade = 7 vertices (three pairs up the blade and the tip), 5 triangles: it tapers and bends (council R1C-15 / R1A-7);
  // a flower reuses the same 7: a thin stem (the root pair to the head's bottom pair), then a kite head whose round middle is the flower (its corners are drawn as green sepals)
  const verts = blades * 7, root = new Float32Array(verts * 3), shape = new Float32Array(verts * 2), index = new Uint32Array(blades * 15);
  let a = 6417 >>> 0;
  const rnd = (): number => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const SHAPE: readonly (readonly [number, number])[] = [[-1, 0], [1, 0], [-0.82, 0.34], [0.82, 0.34], [-0.52, 0.68], [0.52, 0.68], [0, 1]];
  for (let b = 0; b < blades; b++) {
    const x = rnd(), z = rnd(), r = rnd();
    for (let v = 0; v < 7; v++) {
      const i = b * 7 + v, s = SHAPE[v] ?? [0, 0];
      root[i * 3] = x; root[i * 3 + 1] = z; root[i * 3 + 2] = r; shape[i * 2] = s[0]; shape[i * 2 + 1] = s[1];
    }
    const o = b * 7;
    index.set([o, o + 1, o + 3, o, o + 3, o + 2, o + 2, o + 3, o + 5, o + 2, o + 5, o + 4, o + 4, o + 5, o + 6], b * 15);
  }
  const g = new InstancedBufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(verts * 3), 3));
  g.setAttribute('aRoot', new BufferAttribute(root, 3)); g.setAttribute('aShape', new BufferAttribute(shape, 2));
  g.setIndex(new BufferAttribute(index, 1));
  // the tiles: every tile once (layer 0), then the inner 3 × 3 again per extra layer
  const n = MEADOW.across, half = (n - 1) / 2, count = n * n + 9 * MEADOW.layers, tiles = new Float32Array(count * 3);
  for (let i = 0; i < n * n; i++) { tiles[i * 3] = (i % n) - half; tiles[i * 3 + 1] = Math.floor(i / n) - half; }
  for (let l = 1; l <= MEADOW.layers; l++) for (let k = 0; k < 9; k++) {
    const i = n * n + (l - 1) * 9 + k; tiles[i * 3] = (k % 3) - 1; tiles[i * 3 + 1] = Math.floor(k / 3) - 1; tiles[i * 3 + 2] = l;
  }
  g.setAttribute('aTile', new InstancedBufferAttribute(tiles, 3)); g.instanceCount = count;

  const isleU = isles.map((isle) => new Vector4(isle.x, isle.z, apothem(isle) * 0.97, isle.y));
  const holes = [...meadowHoles(), ...rocks.map(([x, z, r]) => new Vector4(x, z, r, 1))], paths = meadowPaths(isles);
  const uniforms = {
    uOrigin: { value: new Vector2() }, uCam: { value: new Vector3() }, uTime: { value: 0 }, uSun: { value: sunDir },
    uAtlas: { value: atlas }, uIsles: { value: isleU }, uIsleGrass: { value: isles.map((isle) => MEADOW.grass[isle.id] ?? 1) }, uIsleKeep: { value: isles.map((isle) => MEADOW.keep[isle.id] ?? 1) }, uHoles: { value: holes }, uPaths: { value: paths },
  };
  const material = new ShaderMaterial({ uniforms, side: DoubleSide,
    vertexShader: /* glsl */`
      #define TILE ${MEADOW.tile.toFixed(1)}
      #define RANGE ${MEADOW.range.toFixed(1)}
      #define NEAR ${MEADOW.near.toFixed(1)}
      #define NI ${isleU.length}
      #define NH ${holes.length}
      #define NP ${paths.length}
      uniform vec2 uOrigin; uniform vec3 uCam; uniform float uTime;
      uniform vec4 uIsles[NI]; uniform float uIsleGrass[NI]; uniform float uIsleKeep[NI]; uniform vec4 uHoles[NH]; uniform vec4 uPaths[NP];
      attribute vec3 aRoot; attribute vec2 aShape; attribute vec3 aTile;
      varying float vH; varying float vTone; varying vec3 vWorld; varying float vShade; varying float vFlower; varying vec2 vPetal; varying float vAcross; varying vec2 vUv; varying float vDist;
      ${MEADOW_GLSL}
      ${KNOLL_GLSL}
      void cull(){ gl_Position = vec4(0.0, 0.0, 2.0, 1.0); vH = 0.0; vTone = 0.0; vWorld = vec3(0.0); vShade = 0.0; vFlower = 0.0; vPetal = vec2(0.0); vAcross = 0.0; vUv = vec2(0.0); vDist = 0.0; }
      void main(){
        // a layer above 0 is the same tile's blades shuffled (offset, mirrored), so the near field thickens without a seam
        float layer = aTile.z; vec2 j = aRoot.xy; float r = aRoot.z;
        if (layer > 0.5) { j = fract((mod(layer, 2.0) > 0.5 ? j.yx : j) + vec2(0.6180, 0.3819) * layer); r = fract(r + 0.2718 * layer); }
        vec2 p = uOrigin + (aTile.xy + j) * TILE;
        // tufts (E399, every seat: 'even upright blades'; the mockups' sward grows in clumps of mixed height with darker gaps):
        // three blades in four lean in toward their cell's tuft centre, and each tuft has its own height
        vec2 tCell = floor(p * 1.4); vec2 tCentre = (tCell + 0.25 + 0.5 * vec2(mh(tCell), mh(tCell + 7.1))) / 1.4;
        p = mix(p, tCentre, step(0.25, fract(r * 61.3)) * 0.45);
        float tuftK = 0.7 + 0.7 * mh(tCell + 3.3);
        float dist = distance(p, uCam.xz);
        // off screen (behind, or a metre past either side) or out of reach: drop it before the loops
        vec4 probe = projectionMatrix * viewMatrix * vec4(p.x, uCam.y - 1.5, p.y, 1.0);
        if (dist > (layer > 0.5 ? NEAR : RANGE) || probe.w < -1.0 || abs(probe.x) > probe.w + 3.0) { cull(); return; }
        float y = -1.0e4, rim = 1.0, tall = 1.0, keep = 1.0;
        for (int i = 0; i < NI; i++) { vec4 s = uIsles[i]; float d = distance(p, s.xy);
          // a ragged edge: the meadow stops a little short of the rim, by noise (E392 foreground: close enough that no bare
          // band shows between the blades and the grassy lip)
          float edge = s.z * (0.925 + 0.05 * mn(p * 0.6));
          // an island's trodden arena (the crown) is trodden only in its middle: the outer ring stays a full meadow
          if (d < edge) { y = s.w; rim = d / edge; float wild = smoothstep(0.55, 0.8, rim); tall = mix(uIsleGrass[i], 1.0, wild); keep = mix(uIsleKeep[i], 1.0, wild); } }
        // the grassy rise at the spawn bridge head (layout KNOLL)
        if (y > -1.0e3) y += farKnoll(p);
        float clear = 1.0, worn = 1.0;
        for (int i = 0; i < NH; i++) { vec4 h = uHoles[i]; float o = smoothstep(h.z, h.z + 0.6, distance(p, h.xy)); clear = min(clear, h.w > 0.5 ? mix(0.3, 1.0, o) : o); }
        // a worn path keeps a short, thin sward (E392 foreground: a cleared path showed the bare ground as a grey band)
        for (int i = 0; i < NP; i++) { vec4 s = uPaths[i]; worn = min(worn, smoothstep(0.15, 0.7, segDist(p, s.xy, s.zw) + 0.3 * mn(p * 1.7))); }
        float pt = mfbm(p * 0.23);
        // varied heights (E392: the mockups' meadow is tall drifts and short lawn, a few stalks over it, never one even wall)
        float h = mix(${MEADOW.low.toFixed(2)}, ${MEADOW.high.toFixed(2)}, smoothstep(0.2, 0.8, pt) * 0.55 + r * 0.45) * mix(0.4, 1.25, mn(p * 0.37 + 11.0));
        h *= 1.0 + 0.55 * step(0.9, fract(r * 23.3));
        h *= tall * tuftK * (1.0 - 0.55 * smoothstep(0.82, 1.0, rim)) * clear * mix(0.4, 1.0, worn);
        h *= 1.0 - smoothstep(layer > 0.5 ? NEAR - 2.5 : RANGE * 0.55, layer > 0.5 ? NEAR : RANGE, dist + (layer > 0.5 ? 1.5 * mn(p * 0.9) : 0.0));
        if (y < -1.0e3 || h < 0.04 || fract(r * 53.1) > keep * mix(0.7, 1.0, worn)) { cull(); return; }
        float ang = r * 40.0; vec2 dir = vec2(cos(ang), sin(ang));
        vec2 toCam = normalize(uCam.xz - p + 1e-3);
        // flowers: clustered drifts (daisies, buttercup patches), a few strays; never on a path
        // tight drifts (council round 3: 'scattered evenly where the mockups cluster daisies'): patches a metre or two across
        float drift = smoothstep(0.55, 0.72, mfbm(p * 0.16 + 4.0)) * smoothstep(0.45, 0.65, mn(p * 0.9 + 2.0));
        // (E399 seat: 'an even field of large white daisies'; the mockups' flowers are sparse, small, white and yellow)
        float flower = step(fract(r * 91.7), (0.002 + 0.24 * drift) * worn) * step(0.6, dist);
        float kind = (mn(p * 0.45 + 20.0) + 0.35 * fract(r * 17.3)) > 0.64 ? 2.0 : 1.0;
        vec2 wind = normalize(vec2(0.6, 0.8));
        float sway = (0.16 + 0.1 * sin(uTime * 1.3 + dot(p, wind) * 0.35)) + 0.05 * sin(uTime * 4.1 + r * 30.0);
        vec3 world = vec3(p.x, y, p.y);
        float t = aShape.y;
        vShade = 0.55 + 0.45 * fract(r * 3.3); vTone = pt; vFlower = 0.0; vPetal = vec2(0.0, -3.0); vAcross = aShape.x; vUv = vec2(0.0); vDist = dist;
        if (flower > 0.5) {
          // a stem in the grass, the head a kite tilted half up, half to you (a daisy reads round, a buttercup a cup)
          float stem = mix(0.14, 0.36, fract(r * 5.7));
          float R = (kind > 1.5 ? 0.022 : 0.03) * mix(0.8, 1.2, fract(r * 7.9)) * clamp(dist / 6.0, 1.0, 1.4);
          vec3 sideV = vec3(-toCam.y, 0.0, toCam.x), upV = normalize(mix(vec3(0.0, 1.0, 0.0), vec3(-toCam.x, 0.0, -toCam.y), 0.5));
          vec2 nod = dir * stem * 0.12 + wind * sway * stem * 0.3;
          vec3 head = world + vec3(nod.x, stem, nod.y);
          vec2 q = t < 0.2 ? vec2(aShape.x * 0.1, -3.0) : t < 0.5 ? vec2(sign(aShape.x) * 0.16, -0.97) : t < 0.9 ? vec2(sign(aShape.x) * 1.05, -0.05) : vec2(0.0, 1.05);
          world = t < 0.2 ? world + sideV * q.x * R : head + sideV * q.x * R + upV * q.y * R;
          vH = t; vPetal = q; vFlower = kind;
        } else {
          // a tuft card (E399, the council every round: 'a flat lit plane under dark tufts'): a quad of the sward atlas
          // (world/swardAtlas.ts), seventy fine strands each, facing you, so the blades overlap into a carpet. The 7-vertex
          // blade maps onto it: its pairs at 0 / 0.34 / 0.68 become the card's bottom, middle and top, the tip folds onto
          // the top right corner (a degenerate triangle)
          float cy = t < 0.2 ? 0.0 : t < 0.5 ? 0.5 : 1.0, cx = t > 0.9 ? 1.0 : sign(aShape.x);
          float wCard = mix(0.45, 0.7, fract(r * 13.7)) * mix(0.9, 1.25, smoothstep(2.0, 12.0, dist));
          vec2 face = normalize(mix(dir, toCam, 0.85)), side = vec2(-face.y, face.x);
          float bend = 0.1 + 0.25 * fract(r * 7.1);
          vec2 lean = dir * bend + wind * sway;
          h *= ${SWARD.scale.toFixed(2)} * mix(0.8, 1.0, smoothstep(0.5, 3.0, dist));
          world.xz += side * cx * wCard * 0.5 + lean * h * cy * cy;
          world.y += h * cy - 0.04;
          vUv = vec2(floor(fract(r * 29.3) * ${SWARD_ATLAS.variants.toFixed(1)}) + (cx * 0.5 + 0.5) * (fract(r * 5.1) > 0.5 ? 1.0 : -1.0) + (fract(r * 5.1) > 0.5 ? 0.0 : 1.0), cy);
          vH = cy; vAcross = 0.0;
        }
        vWorld = world;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCam; uniform vec3 uSun; uniform sampler2D uAtlas;
      varying float vH; varying float vTone; varying vec3 vWorld; varying float vShade; varying float vFlower; varying vec2 vPetal; varying float vAcross; varying vec2 vUv; varying float vDist;
      void main(){
        vec3 view = normalize(vWorld - uCam);
        float back = pow(max(dot(view, uSun), 0.0), 3.0);
        vec3 lit;
        if (vFlower > 0.5 && (vPetal.y < -0.96 || length(vPetal) > 0.74)) {
          // a flower's stem, and the kite's corners round the round head: a thin dark green, lit like the blades round it
          lit = ${glslColor(0x5a7a26)} * (0.55 + 0.25 * vH) * vShade + ${glslColor(0xc9dc5c)} * back * 0.2;
        } else if (vFlower > 0.5) {
          // the head: a daisy's white petal ring round a gold eye, or a buttercup's glossy yellow cup
          float d = length(vPetal) / 0.74, a = atan(vPetal.y, vPetal.x);
          vec3 petal = vFlower > 1.5 ? ${glslColor(0xf4c21f)} : ${glslColor(0xfbf7ee)};
          petal *= 0.82 + 0.18 * cos(a * (vFlower > 1.5 ? 5.0 : 13.0)) * smoothstep(0.25, 0.6, d);
          petal *= 1.0 - 0.25 * smoothstep(0.75, 1.05, d);
          vec3 eye = vFlower > 1.5 ? ${glslColor(0xe0a114)} : ${glslColor(0xe8b52a)};
          vec3 c = mix(eye, petal, smoothstep(0.24, 0.34, d));
          lit = c * (0.95 + 0.2 * back);
        } else {
          // the tuft: each strand's own shade (R) and how far along it this texel is (G); thin strands thin out in the far
          // mips, so the cut-off eases with distance
          vec4 tx = texture2D(uAtlas, vec2(vUv.x / ${SWARD_ATLAS.variants.toFixed(1)}, vUv.y));
          if (tx.a < mix(0.5, 0.22, smoothstep(3.0, 16.0, vDist))) discard;
          float along = tx.g, sh = tx.r;
          // shaded roots deep in the sward, olive-green bodies by patch, straw-gold lit tips (the mockups' backlit meadow)
          vec3 rootC = ${glslColor(SWARD.root)}, lowC = ${glslColor(SWARD.low)}, greenC = ${glslColor(SWARD.green)}, goldC = ${glslColor(SWARD.gold)}, tipC = ${glslColor(SWARD.tip)};
          vec3 body = mix(greenC, goldC, smoothstep(0.3, 0.8, vTone + (vShade - 0.8) * 0.5 + (sh - 0.75) * 0.4));
          float up = along * mix(0.55, 1.0, vH);
          vec3 c = mix(rootC, lowC, smoothstep(0.0, 0.25, up));
          c = mix(c, body, smoothstep(0.2, 0.6, up));
          c = mix(c, tipC, smoothstep(0.65, 1.0, up) * 0.55);
          lit = c * (0.35 + 0.65 * up) * (0.55 + 0.45 * sh) * (0.8 + 0.4 * vTone);
          // the sun through the blades: the tips and the upper strands glow gold when you look toward it
          float glow = back * smoothstep(0.35, 1.0, up);
          lit += ${glslColor(SWARD.glow)} * glow * 0.5 * sh + ${glslColor(SKY.sun)} * back * up * up * up * 0.3;
        }
        lit *= ${glslColor(0xfff6ec)} * 1.1;
        // olive-gold, not lime (council round 3: the meadow's blue measured 16-27 of 255 against the mockups' 39-47):
        // toward a warm grey of the same brightness, a shade darker
        if (vFlower < 0.5) lit = mix(lit, vec3(dot(lit, vec3(0.2126, 0.7152, 0.0722))) * vec3(1.0, 0.94, 0.8), ${SWARD.grey.toFixed(2)});
        float f = clamp((length(vWorld - uCam) - ${FOG.near.toFixed(1)}) / ${(FOG.far - FOG.near).toFixed(1)}, 0.0, 1.0) * ${FOG.max.toFixed(2)};
        gl_FragColor = vec4(mix(lit, ${glslColor(SKY.fog)}, f), 1.0);
      }` });
  const mesh = new Mesh(g, material); mesh.frustumCulled = false; mesh.name = 'far.meadow';
  return { mesh, atlas, update: (camera, t) => {
    uniforms.uCam.value.copy(camera); uniforms.uTime.value = t;
    uniforms.uOrigin.value.set(Math.floor(camera.x / MEADOW.tile) * MEADOW.tile, Math.floor(camera.z / MEADOW.tile) * MEADOW.tile);
  } };
}
