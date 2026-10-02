import { BufferAttribute, Color, DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial, Vector2, Vector3, Vector4 } from 'three';
import { DAIS, FALLEN_BRIDGE, ISLES, MILL, NOTES, SPANS, UPDRAFT, VANES, WINCH, apothem, type Isle } from '../layout';
import { KEEPER_AT } from '../quest/keeper';
import { crownStones } from './crown';
import { FOG, SKY } from '../look/sun';

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
  /** blade height range (metres) */
  low: 0.32, high: 0.78,
  /** an island's grass height scale (1 when absent): the crown is a trodden arena, short enough that the dais reads */
  grass: { crown: 0.42 } as Readonly<Record<string, number>>,
} as const;

/** Where grass never grows: discs (x, z, radius) round the structures and pieces you stand at. */
export function meadowHoles(): Vector4[] {
  const holes: [number, number, number][] = [[MILL.x, MILL.z, 2.9], [WINCH.x, WINCH.z, 1.3], [NOTES.x, NOTES.z, 0.8], [KEEPER_AT.x, KEEPER_AT.z, 0.7], [DAIS.x, DAIS.z, DAIS.r + 0.4]];
  for (const v of VANES) holes.push([v.x, v.z, 1]);
  for (const st of crownStones()) holes.push([st.x, st.z, 0.85]);
  return holes.map(([x, z, r]) => new Vector4(x, z, r, 0));
}

/** The worn paths: a segment (x0, z0) → (x1, z1) from each bridge landing in toward its island's middle. */
export function meadowPaths(isles: readonly Isle[] = ISLES): Vector4[] {
  const out: Vector4[] = [];
  const ends: [number, number][] = [];
  for (const s of [...SPANS, FALLEN_BRIDGE]) { ends.push([s.x0, s.z0], [s.x1, s.z1]); }
  ends.push([UPDRAFT.x, UPDRAFT.z0], [UPDRAFT.x, UPDRAFT.z1]);
  for (const [x, z] of ends) {
    let best: Isle | null = null, bd = Infinity;
    for (const isle of isles) { const d = Math.hypot(x - isle.x, z - isle.z); if (d < bd) { bd = d; best = isle; } }
    if (best === null || bd > best.r + 2) continue;
    // the path runs from just past the rim in to 35 % of the way from the centre
    const k = 0.35 * apothem(best) / Math.max(1e-3, bd);
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

export interface Meadow { readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>; update: (camera: Vector3, t: number) => void }

/** Build the meadow with `blades` blades per tile (a tier knob), seeded so every load grows the same field. */
export function meadow(sunDir: Vector3, blades: number, isles: readonly Isle[] = ISLES): Meadow {
  // one blade = 5 vertices (two pairs up the blade and the tip), 3 triangles
  const verts = blades * 5, root = new Float32Array(verts * 3), shape = new Float32Array(verts * 2), index = new Uint32Array(blades * 9);
  let a = 6417 >>> 0;
  const rnd = (): number => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const SHAPE: readonly (readonly [number, number])[] = [[-1, 0], [1, 0], [-0.62, 0.5], [0.62, 0.5], [0, 1]];
  for (let b = 0; b < blades; b++) {
    const x = rnd(), z = rnd(), r = rnd();
    for (let v = 0; v < 5; v++) {
      const i = b * 5 + v, s = SHAPE[v] ?? [0, 0];
      root[i * 3] = x; root[i * 3 + 1] = z; root[i * 3 + 2] = r; shape[i * 2] = s[0]; shape[i * 2 + 1] = s[1];
    }
    const o = b * 5;
    index.set([o, o + 1, o + 3, o, o + 3, o + 2, o + 2, o + 3, o + 4], b * 9);
  }
  const g = new InstancedBufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(verts * 3), 3));
  g.setAttribute('aRoot', new BufferAttribute(root, 3)); g.setAttribute('aShape', new BufferAttribute(shape, 2));
  g.setIndex(new BufferAttribute(index, 1));
  const n = MEADOW.across, half = (n - 1) / 2, tiles = new Float32Array(n * n * 2);
  for (let i = 0; i < n * n; i++) { tiles[i * 2] = (i % n) - half; tiles[i * 2 + 1] = Math.floor(i / n) - half; }
  g.setAttribute('aTile', new InstancedBufferAttribute(tiles, 2)); g.instanceCount = n * n;

  const isleU = isles.map((isle) => new Vector4(isle.x, isle.z, apothem(isle) * 0.97, isle.y));
  const holes = meadowHoles(), paths = meadowPaths(isles);
  const uniforms = {
    uOrigin: { value: new Vector2() }, uCam: { value: new Vector3() }, uTime: { value: 0 }, uSun: { value: sunDir },
    uIsles: { value: isleU }, uIsleGrass: { value: isles.map((isle) => MEADOW.grass[isle.id] ?? 1) }, uHoles: { value: holes }, uPaths: { value: paths },
  };
  const material = new ShaderMaterial({ uniforms, side: DoubleSide,
    vertexShader: /* glsl */`
      #define TILE ${MEADOW.tile.toFixed(1)}
      #define RANGE ${MEADOW.range.toFixed(1)}
      #define NI ${isleU.length}
      #define NH ${holes.length}
      #define NP ${paths.length}
      uniform vec2 uOrigin; uniform vec3 uCam; uniform float uTime;
      uniform vec4 uIsles[NI]; uniform float uIsleGrass[NI]; uniform vec4 uHoles[NH]; uniform vec4 uPaths[NP];
      attribute vec3 aRoot; attribute vec2 aShape; attribute vec2 aTile;
      varying float vH; varying float vTone; varying vec3 vWorld; varying float vShade; varying float vFlower;
      ${MEADOW_GLSL}
      void main(){
        vec2 p = uOrigin + (aTile + aRoot.xy) * TILE;
        float r = aRoot.z, y = -1.0e4, rim = 1.0, tall = 1.0;
        for (int i = 0; i < NI; i++) { vec4 s = uIsles[i]; float d = distance(p, s.xy);
          // a ragged edge: the meadow stops a little short of the rim, by noise
          float edge = s.z * (0.9 + 0.08 * mn(p * 0.6));
          if (d < edge) { y = s.w; rim = d / edge; tall = uIsleGrass[i]; } }
        float clear = 1.0;
        for (int i = 0; i < NH; i++) { vec4 h = uHoles[i]; clear = min(clear, smoothstep(h.z, h.z + 0.6, distance(p, h.xy))); }
        for (int i = 0; i < NP; i++) { vec4 s = uPaths[i]; clear = min(clear, smoothstep(0.3, 0.85, segDist(p, s.xy, s.zw) + 0.3 * mn(p * 1.7))); }
        float dist = distance(p, uCam.xz);
        float pt = mfbm(p * 0.23);
        // tall drifts and short lawn by noise; shorter toward the rim and the paths; shrinks to nothing at RANGE
        float h = mix(${MEADOW.low.toFixed(2)}, ${MEADOW.high.toFixed(2)}, smoothstep(0.25, 0.8, pt) * 0.7 + r * 0.3);
        h *= tall * (1.0 - 0.55 * smoothstep(0.82, 1.0, rim)) * clear * (1.0 - smoothstep(RANGE * 0.55, RANGE, dist));
        if (y < -1.0e3 || h < 0.04) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
        // the blade faces half toward the camera so it never vanishes edge-on
        float ang = r * 40.0; vec2 dir = vec2(cos(ang), sin(ang));
        vec2 toCam = normalize(uCam.xz - p + 1e-3); vec2 face = normalize(mix(dir, toCam, 0.55));
        vec2 side = vec2(-face.y, face.x);
        // a few blades in the drifts are daisies: a short stem with a wide pale head (white, some yellow)
        float flower = step(fract(r * 91.7), 0.05 * smoothstep(0.35, 0.7, mfbm(p * 0.11 + 4.0)));
        h *= mix(1.0, 0.7, flower);
        float t = aShape.y, w = mix(0.035, 0.06, fract(r * 13.7)) * mix(1.0, 2.6, flower * step(0.4, t));
        // wind: a slow swell along the prevailing wind with a quick flutter, more at the tip
        vec2 wind = normalize(vec2(0.6, 0.8));
        float sway = (0.18 + 0.12 * sin(uTime * 1.3 + dot(p, wind) * 0.35)) + 0.05 * sin(uTime * 4.1 + r * 30.0);
        vec2 lean = dir * (0.12 + 0.18 * fract(r * 7.1)) + wind * sway;
        vec3 world = vec3(p.x, y, p.y);
        world.xz += side * aShape.x * w * (1.0 - t * 0.35) + lean * h * t * t;
        world.y += h * t * (1.0 - 0.15 * t * t);
        vH = t; vTone = pt; vWorld = world; vFlower = flower * (fract(r * 17.3) < 0.7 ? 1.0 : 2.0);
        vShade = 0.72 + 0.28 * fract(r * 3.3);
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCam; uniform vec3 uSun;
      varying float vH; varying float vTone; varying vec3 vWorld; varying float vShade; varying float vFlower;
      void main(){
        // olive roots, a fresh-green to golden body by patch, warm straw tips
        vec3 rootC = ${glslColor(0x3a4f1e)}, greenC = ${glslColor(0x7a9a36)}, goldC = ${glslColor(0xa9a745)}, tipC = ${glslColor(0xdcd27c)};
        vec3 body = mix(greenC, goldC, smoothstep(0.5, 0.85, vTone));
        vec3 c = mix(rootC, body, smoothstep(0.0, 0.55, vH));
        c = mix(c, tipC, smoothstep(0.72, 1.0, vH) * 0.45);
        if (vFlower > 0.5) c = mix(c, vFlower > 1.5 ? ${glslColor(0xf3cf4e)} : ${glslColor(0xf7f2e6)}, smoothstep(0.45, 0.6, vH));
        // the light: a warm sky fill, plus a back-light glow through the blades when you look toward the low sun
        vec3 view = normalize(vWorld - uCam);
        float back = pow(max(dot(view, uSun), 0.0), 3.0);
        vec3 lit = c * (0.55 + 0.4 * vH) * vShade + ${glslColor(SKY.sun)} * back * vH * 0.45;
        lit *= ${glslColor(0xfff1e2)} * 1.15;
        float f = clamp((length(vWorld - uCam) - ${FOG.near.toFixed(1)}) / ${(FOG.far - FOG.near).toFixed(1)}, 0.0, 1.0) * 0.85;
        gl_FragColor = vec4(mix(lit, ${glslColor(SKY.fog)}, f), 1.0);
      }` });
  const mesh = new Mesh(g, material); mesh.frustumCulled = false; mesh.name = 'far.meadow';
  return { mesh, update: (camera, t) => {
    uniforms.uCam.value.copy(camera); uniforms.uTime.value = t;
    uniforms.uOrigin.value.set(Math.floor(camera.x / MEADOW.tile) * MEADOW.tile, Math.floor(camera.z / MEADOW.tile) * MEADOW.tile);
  } };
}
