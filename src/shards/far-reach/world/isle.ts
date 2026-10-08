import { BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshStandardMaterial, type Texture } from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { apothem, type Isle } from '../layout';
import { onPaintedDispose } from '../look/image';

/**
 * A floating island, loop 4 (the targets: a rounded meadow top that rolls over a soil lip, a lumpy keel of warm
 * sandstone strata and lavender shade tapering to a jagged point, small spurs hanging under it). Smooth-shaded,
 * vertex-painted, one draw. The walkable top stays at local y 0 inside the collider's 12-gon: the rim is a soft noisy
 * curve never outside the 12-gon, so no visible ground is unbacked by a collider.
 *
 * Its `random` (the level's cosmetic stream) is drawn exactly as the old 12-gon island drew it (122 values), so every
 * piece built after the islands keeps its look; the shape itself grows from its own seeded generator.
 */
export const ISLE_SHAPE = { segments: 72, topRings: 10, keelRings: 16, spurs: 28, drawsOfOldIsland: 122 } as const;

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (x: number, y: number): number => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
const fbm = (x: number, y: number): number => vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 7.3, y * 2.1) * 0.3 + vnoise(x * 4.3 - 3.1, y * 4.3) * 0.15;
/** periodic noise round the island (angle a in radians), so the rim closes without a seam */
const ringNoise = (a: number, k: number, seed: number, y = 0): number => fbm(Math.cos(a) * k + seed, Math.sin(a) * k + y);
const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The island palette (sRGB): meadow ground under the grass, worn path dirt, soil, strata and shade. */
export const ISLE_PALETTE = {
  ground: 0x6d8433, groundGold: 0xa59a46, groundDeep: 0x51652a, path: 0x9a8468, soil: 0x6e4c35,
  sand: 0xbca78c, ochre: 0xa48a72, clay: 0x8c7466, rockGrey: 0x8f8890, mauve: 0x8a7385, violet: 0x5d4c67, moss: 0x6f7d3a,
} as const;

/** The 12-gon's radius at angle `a` (corners at multiples of 30°, as the colliders and the old top). */
function polyRadius(isle: Isle, a: number): number {
  const step = Math.PI / 6, t = ((a % step) + step) % step;
  return apothem(isle) / Math.cos(t - step / 2);
}

/**
 * The islands' painted textures (E392, toward the targets: moss-streaked grey cliffs, a flowered meadow): the keels' rock
 * sampled triplanar in world space (no UVs needed) and multiplied into the strata colours, the meadow ground projected
 * from above onto the green faces. The plugin loads them behind the loading screen and sets them before the world is
 * built; without them the islands keep their painted vertex colours.
 */
let TEX: { rock: Texture | null; meadow: Texture | null } = { rock: null, meadow: null };
export function setIsleTextures(tex: { rock: Texture | null; meadow: Texture | null }): void {
  TEX = tex;
  for (const key of ['rock', 'meadow'] as const) {
    const texture = tex[key];
    onPaintedDispose(texture, () => { if (TEX[key] === texture) TEX[key] = null; });
  }
}

export function islandMesh(isle: Isle, random: () => number): Mesh<BufferGeometry, MeshStandardMaterial> {
  let draw = 0; for (let i = 0; i < ISLE_SHAPE.drawsOfOldIsland; i++) draw = random();
  const rnd = seeded(Math.floor(draw * 4294967296) ^ Math.round(isle.x * 131 + isle.z * 17));
  const S = ISLE_SHAPE.segments, seed = rnd() * 50, pos: number[] = [], col: number[] = [], idx: number[] = [];
  const c = new Color(), c2 = new Color();
  const vert = (x: number, y: number, z: number, hex: number, mix?: { hex: number; k: number }): number => {
    c.setHex(hex); if (mix) c.lerp(c2.setHex(mix.hex), Math.min(1, Math.max(0, mix.k)));
    pos.push(x, y, z); col.push(c.r, c.g, c.b); return pos.length / 3 - 1;
  };
  // the rim: a soft noisy curve inside the 12-gon
  const rim = Array.from({ length: S }, (_, i) => { const a = (i / S) * Math.PI * 2;
    // loop 5 (council R1C-9): a broken lip, a few sharp bites out of the soft curve
    const notch = 0.09 * Math.max(0, Math.sin(a * 5 + seed * 3)) ** 8 + 0.05 * Math.max(0, Math.sin(a * 11 - seed)) ** 10;
    return Math.min(polyRadius(isle, a) * 0.995, apothem(isle) * (0.94 + 0.08 * ringNoise(a, 1.6, seed) - notch)); });
  const rows: number[][] = [];
  // the meadow top: rings out to the rim, a faint swell inside (≤ 6 cm, under the capsule's tolerance)
  const centre = vert(0, 0.04, 0, ISLE_PALETTE.ground);
  for (let k = 1; k <= ISLE_SHAPE.topRings; k++) {
    const f = Math.sqrt(k / ISLE_SHAPE.topRings), row: number[] = [];
    for (let i = 0; i < S; i++) {
      const a = (i / S) * Math.PI * 2, r = (rim[i] ?? 0) * f, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const wx = x + isle.x, wz = z + isle.z, n = fbm(wx * 0.18, wz * 0.18), n2 = fbm(wx * 0.6 + 9, wz * 0.6);
      c2.setHex(ISLE_PALETTE.groundGold);
      const base = new Color(ISLE_PALETTE.groundDeep).lerp(new Color(ISLE_PALETTE.ground), smooth(0.2, 0.55, n2)).lerp(c2, smooth(0.45, 0.8, n) * 0.8);
      const id = vert(x, 0.05 * (n - 0.5) * (1 - f * f), z, base.getHex()); // no path paint (E392: brownish path faces failed the paint's green test and took the grey cliff rock; the meadow blades clear the paths)
      row.push(id);
    }
    rows.push(row);
  }
  // the lip: the meadow rolls over, soil shows, then the dirt band under it
  const lip: [number, number, number][] = [[1.02, -0.18, 0], [1.035, -0.55, 0.55], [1.0, -1.1, 1], [0.97, -1.7, 1]];
  for (const [rs, y, soil] of lip) {
    const row: number[] = [];
    for (let i = 0; i < S; i++) {
      const a = (i / S) * Math.PI * 2, n = ringNoise(a, 3, seed + 3, y), r = (rim[i] ?? 0) * (rs + 0.03 * (n - 0.5));
      row.push(vert(Math.cos(a) * r, y - 0.25 * n * soil, Math.sin(a) * r, ISLE_PALETTE.groundDeep, { hex: ISLE_PALETTE.soil, k: soil }));
    }
    rows.push(row);
  }
  // the keel: strata bands by depth, lumpy outcrops, warm in its upper half, lavender-violet shade toward the point
  const tipX = (rnd() - 0.5) * isle.r * 0.18, tipZ = (rnd() - 0.5) * isle.r * 0.18;
  for (let k = 1; k <= ISLE_SHAPE.keelRings; k++) {
    const f = k / (ISLE_SHAPE.keelRings + 1), y = -1.7 - (isle.keel - 1.7) * f, row: number[] = [];
    // a crag, not a cone (council R1C-9): full under the lip, ledged where the strata are, then tapering fast to the point
    const ledge = 1 + 0.05 * (((y * 0.42) % 1 + 1) % 1 > 0.7 ? 1 : 0);
    const profile = (1 - f) ** 0.6 * (1 + 0.12 * Math.sin(f * Math.PI)) * ledge;
    for (let i = 0; i < S; i++) {
      const a = (i / S) * Math.PI * 2, lump = ringNoise(a, 2.4, seed + 11, f * 3.5), fine = ringNoise(a, 7, seed + 19, f * 9);
      // vertical crag ridges (fluting) cut through the lumps
      const ridge = Math.abs(Math.sin(a * 9 + lump * 3.2 + seed)) ** 0.6;
      const r = (rim[i] ?? 0) * profile * (0.78 + 0.3 * lump + 0.1 * fine + 0.1 * ridge);
      const x = Math.cos(a) * r + tipX * f * f, z = Math.sin(a) * r + tipZ * f * f;
      // strata: thin warm bands, wavy with the rock
      const band = Math.sin((y + 1.3 * lump) * 1.9) * 0.5 + 0.5, band2 = Math.sin((y + 0.8 * fine) * 4.7) * 0.5 + 0.5;
      const warm = new Color(ISLE_PALETTE.sand).lerp(new Color(ISLE_PALETTE.ochre), band).lerp(new Color(ISLE_PALETTE.clay), band2 * 0.45);
      const shade = smooth(0.25, 0.95, f);
      // moss and vines streak down from the lip (E392: the mockups' keels are grey rock streaked green)
      const moss = (k <= 2 ? smooth(0.55, 0.8, fine) * 0.7 : 0) + smooth(0.62, 0.9, Math.sin(a * 13 + seed) * 0.5 + 0.5) * Math.max(0, 1 - f * 2.2) * 0.55;
      // grey-lavender rock bands between the warm strata, crevices darker than the ridges (council R1C-9 / R1A-1)
      const rock = warm.lerp(new Color(ISLE_PALETTE.rockGrey), smooth(0.55, 0.85, band2) * 0.7)
        .lerp(new Color(ISLE_PALETTE.mauve), shade * 0.75).lerp(new Color(ISLE_PALETTE.violet), smooth(0.6, 1, f) * 0.6)
        .multiplyScalar(0.62 + 0.38 * ridge);
      row.push(vert(x, y, z, rock.getHex(), { hex: ISLE_PALETTE.moss, k: moss }));
    }
    rows.push(row);
  }
  const tip = vert(tipX, -isle.keel, tipZ, ISLE_PALETTE.violet);
  // stitch: centre fan, ring strips, tip fan
  const r0 = rows[0] ?? [];
  for (let i = 0; i < S; i++) idx.push(centre, r0[(i + 1) % S] ?? 0, r0[i] ?? 0);
  for (let k = 0; k + 1 < rows.length; k++) {
    const a = rows[k] ?? [], b = rows[k + 1] ?? [];
    for (let i = 0; i < S; i++) { const j = (i + 1) % S; const ai = a[i] ?? 0, aj = a[j] ?? 0, bi = b[i] ?? 0, bj = b[j] ?? 0; idx.push(ai, aj, bj, ai, bj, bi); }
  }
  const last = rows[rows.length - 1] ?? [];
  for (let i = 0; i < S; i++) idx.push(last[i] ?? 0, last[(i + 1) % S] ?? 0, tip);
  // spurs: little rock fingers hanging from the keel's middle
  for (let s = 0; s < ISLE_SHAPE.spurs; s++) {
    const a = rnd() * Math.PI * 2, f = 0.25 + rnd() * 0.55, y = -1.7 - (isle.keel - 1.7) * f;
    const r = apothem(isle) * (1 - f) ** 0.6 * 0.72, x = Math.cos(a) * r, z = Math.sin(a) * r, len = isle.keel * (0.12 + rnd() * 0.3), w = 0.5 + rnd() * 1.4;
    const ring = [0, 1, 2, 3, 4].map((q) => { const b = (q / 5) * Math.PI * 2; return vert(x + Math.cos(b) * w, y + 0.6, z + Math.sin(b) * w, ISLE_PALETTE.mauve, { hex: ISLE_PALETTE.ochre, k: 0.3 }); });
    const point = vert(x * 0.9, y - len, z * 0.9, ISLE_PALETTE.violet);
    for (let q = 0; q < 5; q++) idx.push(ring[q] ?? 0, ring[(q + 1) % 5] ?? 0, point);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  // faceted: the crags read as cut rock, the meadow top as a low-poly painted lawn
  const material = paintIsleMaterial(new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true }));
  return new Mesh(g, material);
}

/**
 * The islands' paint (E392), on any vertex-coloured material (the islands, the boulders): green faces get the painted
 * meadow, tonal patches and daisies; the rest the painted cliff rock, triplanar in world space. `rockMix` is how much of
 * the rock texture replaces the vertex colour (the boulders and the islands 0.85).
 */
export function paintIsleMaterial(material: MeshStandardMaterial, rockMix = 0.85): MeshStandardMaterial {
  // the meadow from above (E392, the aerial targets): tonal patches and scattered daisies painted in world space on the
  // green faces, so a top reads as a flowered meadow, not one smooth green
  const { rock, meadow } = TEX;
  patchShader(material, 'far.isle-meadow', PATCH_ORDER.decorate, (shader) => {
    if (rock !== null) shader.uniforms['farRock'] = { value: rock };
    if (meadow !== null) shader.uniforms['farMeadow'] = { value: meadow };
    shader.fragmentShader = `#ifndef FAR_MEADOW_PAINT
#define FAR_MEADOW_PAINT
${rock !== null ? '#define FAR_ROCK_TEX\nuniform sampler2D farRock;\n' : ''}${meadow !== null ? '#define FAR_MEADOW_TEX\nuniform sampler2D farMeadow;\n' : ''}float farMH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float farMN(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(farMH(i), farMH(i + vec2(1.0, 0.0)), u.x), mix(farMH(i + vec2(0.0, 1.0)), farMH(i + vec2(1.0, 1.0)), u.x), u.y); }
#endif
${shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  // the fragment's world position (the fog's varying is not in every program: computed from the view position)
  vec3 farWP = (inverse(viewMatrix) * vec4(-vViewPosition, 1.0)).xyz;
  if (diffuseColor.g > diffuseColor.r * 1.05 && diffuseColor.g > diffuseColor.b * 1.3) {
    vec2 q = farWP.xz;
    diffuseColor.rgb *= 0.8 + 0.38 * farMN(q * 0.22) + 0.12 * farMN(q * 1.3);
#ifdef FAR_MEADOW_TEX
    // the painted meadow, a 5 m tile, keeping the vertex colour's broad tone
    // two scales of the painted meadow (3 m and 11 m tiles) so no repeat reads from above; sunlit swells and shaded hollows
    vec3 mt = texture2D(farMeadow, q * 0.33).rgb * 0.6 + texture2D(farMeadow, q * 0.09 + 0.37).rgb * 0.4;
    float swell = farMN(q * 0.12) * 0.7 + farMN(q * 0.4) * 0.3;
    // loop 20 (the aerial targets: lumpy sunlit tops, warm yellow-green, dark tuft shadows): stronger swells, a warmer tint
    float tuft = farMN(q * 3.1);
    // E399 (the council: 'sparse blades on a flat yellow plane'): the ground between the blades is the shade down in the
    // sward, a deeper green, so the gaps read as depth in the grass, not bare yellow ground
    // (round 6: between the tufts its pale patches read as the crudest surface at the bottom of C, D and proposal B)
    diffuseColor.rgb = mix(diffuseColor.rgb, mt * (0.5 + 0.45 * swell) * (0.85 + 0.2 * tuft) * vec3(0.5, 0.58, 0.4), 0.9);
#endif
    // the ground lies in the sward's shade, so its gaps read as depth in the grass (the mockups' dark roots): one shade
    // at every distance (round 13, seat C: row 4's darkening by distance from the camera was round 12's glowNear again)
    diffuseColor.rgb *= 0.86;
    vec2 cell = floor(q * 2.2); float pick = farMH(cell);
    float dot2 = 1.0 - smoothstep(0.12, 0.3, length(fract(q * 2.2) - 0.5));
    // painted daisies for the far view only: near the camera the meadow draws real flowers, and these read as bare tan discs
    float farDots = smoothstep(14.0, 26.0, length(farWP - cameraPosition));
    if (pick > 0.93) diffuseColor.rgb = mix(diffuseColor.rgb, pick > 0.975 ? vec3(0.95, 0.78, 0.25) : vec3(0.95, 0.94, 0.9), dot2 * 0.85 * farDots);
  } else {
    // the rock: toward a cool grey-brown (E392 targets), keeping a little of its warm strata
    float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * vec3(1.0, 0.96, 0.93), 0.45);
#ifdef FAR_ROCK_TEX
    // triplanar mossy rock, its facet normal from the world position's derivatives (flat shading)
    vec3 fn = normalize(cross(dFdx(farWP), dFdy(farWP)));
    vec3 tw = pow(abs(fn), vec3(4.0)); tw /= (tw.x + tw.y + tw.z);
    vec3 wq = farWP * 0.13;
    vec3 tex = texture2D(farRock, wq.zy).rgb * tw.x + texture2D(farRock, wq.xz).rgb * tw.y + texture2D(farRock, wq.xy).rgb * tw.z;
    diffuseColor.rgb = mix(diffuseColor.rgb, tex * (0.55 + 1.3 * dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), ${rockMix.toFixed(2)});
    // grey-green cliff (the targets): less brown, moss on every ledge that faces up
    float rl = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(rl) * vec3(0.98, 1.0, 0.97), 0.55);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.33, 0.42, 0.2) * (0.7 + 0.6 * rl), smoothstep(0.2, 0.65, fn.y) * 0.65);
#endif
  }`)}`;
  // its own program key: three caches programs by the last patch's text, and the scene-wide fog patch (look/render.ts)
  // is the same text on every material, so without a key the islands reuse an unpatched program
  }, { key: (prior) => `${prior}|far.isle-meadow:${rock !== null ? 'r' : ''}${meadow !== null ? 'm' : ''}:${rockMix}` });
  return material;
}
