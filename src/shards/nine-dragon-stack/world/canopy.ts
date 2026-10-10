// Copied from the organic lab (the dev labs (deleted in E357 F7), round-9-lab-organic) into the clean room by dome B
// (E169, round-10-dome-b): the banyan's painted leaf-card canopy. Dome B's banyan (banyan.ts) plans the lumps; the
// builder at the end of this file (`buildCanopy`) dresses them and is wired in main.ts after the spill bake.
// Lab P7 "organic" (E169): the banyan's leaf mass. The clean room's canopy is the hero lab's cloud-shelves: 7–9
// flattened ellipsoid lumps on every limb tip, which read as smooth blobs. The targets (round-6 style A, round-8
// look-loop targets) show a dense, layered, PAINTED leaf mass: clusters of outlined gongbi leaves in three flat greens,
// dark bellies, light breaking through between the clusters. Four ways to build it, all on the same lumps (`planLumps`):
//  - 'lumps'  the clean room's K.leaf ellipsoids (the baseline; drawn by the Jiehua program, not here);
//  - 'cards'  painted leaf-cluster cards (a codex gongbi atlas, 2×2 clusters) clustered over every lump's surface, lit
//             with the LUMP's normal (so a card is part of a volume, never a flat cut-out), alpha-to-coverage under the
//             MSAA ×4 target (no discard), then a depth-equal pass that writes the inverse depth into alpha so the post
//             silhouette inks the leafy edge (a2c alone would write the coverage there);
//  - 'leaves' real leaf geometry: every leaf a 7-vertex fan with its outline drawn from a rim distance attribute,
//             opaque (hidden-surface removal stays on); it needs ~10× the triangles for the same cover;
//  - 'shells' the lumps re-tessellated and displaced into scalloped cloud-shelves (a leafy bump per cluster), with the
//             Voronoi leaf pattern painted in the fragment program: the cheap opaque option.
// 'cards' and 'leaves' also draw the lumps shrunk (`inner` mode, darker) as the crown's core, so no view sees through
// the tree. Every foliage fragment reports its LUMP's front depth to the post silhouette (the plateau, see the VS), and
// the silk fog runs per vertex. The winner and its parameters: art/nine-dragon-stack/round-9-lab-organic/README.md.
import {
  AddEquation, type BufferGeometry, Color, CustomBlending, DoubleSide, EqualDepth, FrontSide, type IUniform,
  LinearFilter, LinearMipmapLinearFilter, Mesh, OneFactor, ShaderMaterial, type Texture, TextureLoader, Vector4, ZeroFactor,
} from 'three';
import { type Emitter, bakeSpill } from '../look/emitters';
import { FOG_GLSL, NOISE_GLSL, type Shared } from '../look/style';
import { phoneUrl } from '@wildshard/engine/boot/bytes';
import { ktx2Texture } from '@wildshard/engine/core/ktx2';

/** the canopy's baked geometry over a plan's lumps: the painted cards and the darker core under them */
export interface CanopyGeometry { readonly cards: BufferGeometry; readonly core: BufferGeometry }

// ── the foliage program ──
/** the vertex-stage subset of NOISE_GLSL that silkFog needs (the rest uses derivatives, fragment-only) */
const NOISE_VS = /* glsl */ `
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), f.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;
const VS = /* glsl */ `
attribute vec4 aUv;
attribute vec2 aTone;
attribute vec3 aSpill;
attribute vec4 aLump;
uniform float uPlate;
varying vec3 vWorld;
varying vec3 vN;
varying vec4 vUv;
varying vec2 vTone;
varying vec3 vSpill;
varying float vViewZ;
varying float vPlate;
varying vec4 vFog;
${NOISE_VS}
${FOG_GLSL}
invariant gl_Position;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
#ifndef DEPTH_ONLY
  // the silk fog per VERTEX: the crown is ~20 m across and the fog varies over tens of metres, and the cards overdraw
  // 2–4 layers deep, so the 9-band fog loop must not run per fragment (the phone's cost is the canopy's fill)
  vFog = silkFog(wp.xyz, 1.0);
#else
  vFog = vec4(0.0, 0.0, 0.0, 1.0);
#endif
  vN = normalize(mat3(modelMatrix) * normal);
  vUv = aUv;
  vTone = aTone;
  vSpill = aSpill;
  vec4 vp = viewMatrix * wp;
  vViewZ = -vp.z;
  // the silhouette plateau: every fragment of a lump (its cards, leaves, core) reports ONE depth, the lump's front,
  // so the post inks the clump's outline and the step to the next clump, not every card edge and pin-hole
  vec4 lc = viewMatrix * modelMatrix * vec4(aLump.xyz, 1.0);
  vPlate = aLump.w > 0.0 ? mix(-vp.z, max(-lc.z - aLump.w * 0.85, 0.2), uPlate) : -vp.z;
  gl_Position = projectionMatrix * vp;
}
`;
const FS = /* glsl */ `
uniform float uTime;
uniform float uNear;
uniform float uSutra;
uniform float uDpr;
uniform vec3 uLightDir;
uniform vec3 uInk0;
uniform vec3 uInk1;
uniform float uInkMid;
uniform vec2 uLineFade;
uniform vec3 uGold;
uniform vec3 uPaper;
uniform vec3 uLeaf[5];
uniform vec4 uWash;    // x: band contrast, y: inner darkening, z: per-cluster tone spread, w: painted value weight
uniform vec4 uLeafInk; // x: outline px (at 3×), y: outline strength, z: midrib strength, w: sky rim light
uniform sampler2D uAtlas;
varying vec3 vWorld;
varying vec3 vN;
varying vec4 vUv;
varying vec2 vTone;
varying vec3 vSpill;
varying float vViewZ;
varying float vPlate;
varying vec4 vFog;
uniform vec3 uCam;
${NOISE_GLSL}
vec3 ramp(float v) {
  v = clamp(v, 0.0, 1.0) * 4.0;
  float i = floor(v), f = v - i;
  vec3 a = uLeaf[0], b = uLeaf[1];
  if (i >= 3.0) { a = uLeaf[3]; b = uLeaf[4]; } else if (i >= 2.0) { a = uLeaf[2]; b = uLeaf[3]; } else if (i >= 1.0) { a = uLeaf[1]; b = uLeaf[2]; }
  // painted washes: flat steps with a narrow soft edge, not a gradient
  return mix(a, b, smoothstep(0.35, 0.65, f));
}
void main() {
#ifdef DEPTH_ONLY
  gl_FragColor = vec4(0.0, 0.0, 0.0, uNear / max(vPlate, uNear));
  return;
#else
  vec3 n = normalize(vN);
  vec3 V = normalize(uCam - vWorld);
  float dist = length(uCam - vWorld);
  float ndl = dot(n, uLightDir);
  // three hard washes: the belly, the body, the lit top (the sky screens light the crown from above)
  float band = smoothstep(-0.34, -0.26, ndl) * 0.5 + smoothstep(0.3, 0.38, ndl) * 0.5;
  float v = 0.06 + band * uWash.x - vTone.y * uWash.y + (vTone.x - 0.5) * uWash.z;
  float ink = 0.0;
  float a = 1.0;
#ifdef CARD
  vec4 tx = texture2D(uAtlas, vUv.xy);
  float L = dot(tx.rgb, vec3(0.2126, 0.7152, 0.0722));
  // the painted leaves keep their own light / dark and their ink; the hue is ours
  v += (smoothstep(0.18, 0.62, L) - 0.4) * uWash.w;
  ink = (1.0 - smoothstep(0.07, 0.2, L)) * uLeafInk.y;
  // alpha to coverage, sharpened to a crisp leaf edge at any mip (the MSAA resolve antialiases it)
  // (mip-level coverage kept: the mips average the clear gaps in, so a far cluster would thin out and vanish)
  vec2 tsz = vec2(textureSize(uAtlas, 0));
  vec2 dx = dFdx(vUv.xy * tsz), dy = dFdy(vUv.xy * tsz);
  float mip = 0.5 * log2(max(max(dot(dx, dx), dot(dy, dy)), 1e-8));
  float ta = tx.a * (1.0 + max(mip, 0.0) * 0.25);
  a = clamp((ta - 0.5) / max(fwidth(ta), 1e-4) + 0.5, 0.0, 1.0);
#endif
#ifdef LEAF
  // the leaf's outline from its rim distance (aUv.z: 1 at the centre, 0 on the rim), a thin midrib
  float px = uLeafInk.x * uDpr;
  float fr = max(fwidth(vUv.z), 1e-5);
  float big = smoothstep(0.02, 0.2, 1.0 / (fr * 12.0));   // outlines only while the leaf is ≥ ~12 px
  ink = clamp(px * 0.5 + 0.5 - vUv.z / fr, 0.0, 1.0) * uLeafInk.y * big;
  float fs = max(fwidth(vUv.x), 1e-5);
  ink = max(ink, clamp(0.5 - abs(vUv.x) / fs, 0.0, 1.0) * step(0.08, vUv.y) * step(vUv.y, 0.85) * uLeafInk.z * big);
  v += (vTone.x - 0.5) * 0.15;
#endif
#ifdef SHELL
  // gongbi leaves painted on the shell: a Voronoi of leaves, each outlined and tinted (the K.leaf pattern, finer)
  vec3 an = abs(n);
  vec2 lp = (an.y > max(an.x, an.z) ? vWorld.xz : (an.x > an.z ? vWorld.zy : vWorld.xy)) / 0.2;
  vec2 cc = floor(lp), fc = fract(lp);
  float d1 = 9.0, d2 = 9.0, idv = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 rr = o + vec2(h12(cc + o), h12(cc + o + 17.3)) - fc;
      float dd = dot(rr, rr);
      if (dd < d1) { d2 = d1; d1 = dd; idv = h12(cc + o + 3.1); } else if (dd < d2) { d2 = dd; }
    }
  }
  float flw = max(fwidth(lp.x), fwidth(lp.y)) * 0.2;
  float det = smoothstep(2.5, 6.0, 0.2 / flw);
  float ed = (sqrt(d2) - sqrt(d1)) * 0.5 * 0.2;
  ink = clamp(uLeafInk.x * uDpr * 0.3 + 0.5 - ed / flw, 0.0, 1.0) * det * uLeafInk.y * 0.7;
  v += (idv - 0.5) * 0.35 * det;
#endif
#ifdef INNER
  v = 0.14 + band * 0.22 - vTone.y * 0.12;
#endif
  vec3 col = ramp(v);
  // light through the crown's edge: a cool sky rim where the lump turns away from the eye on its upper side
  float rim = pow(1.0 - clamp(abs(dot(n, V)), 0.0, 1.0), 3.0) * smoothstep(-0.1, 0.5, n.y) * (1.0 - vTone.y);
  col += uLeaf[4] * rim * uLeafInk.w;
  // warm lantern / neon spill, baked per vertex like the kits
  col += col * vSpill * 1.6;
  vec3 inkC = mix(uInk0, uInk1, smoothstep(4.0, uInkMid, dist));
  inkC = mix(inkC, uGold, uSutra);
  float fade = 1.0 - smoothstep(uLineFade.x, uLineFade.y, dist);
  col = mix(col, uPaper * (0.5 + v * 0.7), uSutra * 0.8);
  vec4 fg = vFog;
  col = mix(col, inkC, ink * fade * pow(max(fg.a, 1e-4), 0.7));
#ifdef CARD
  // alpha = coverage (a2c); the blend keeps the target's alpha, the depth pass writes the plateau after
  gl_FragColor = vec4(col * fg.a + fg.rgb, a);
#else
  // alpha = inverse view depth (the post silhouette reads it), the lump's plateau
  gl_FragColor = vec4(col * fg.a + fg.rgb, uNear / max(vPlate, uNear));
#endif
#endif
}
`;

export type FoliageMode = 'cards' | 'cards-depth' | 'leaves' | 'shells' | 'inner';

/** the gongbi banyan greens (display sRGB), sampled from the targets' canopy (k-means of style A's crown) */
export const LEAF_PALETTE = [0x131d19, 0x20322a, 0x31483c, 0x566a4d, 0xa4a674] as const;

export interface FoliageUniforms { uLeaf: IUniform<Color[]>; uWash: IUniform<Vector4>; uLeafInk: IUniform<Vector4>; uPlate: IUniform<number> }
export function foliageUniforms(): FoliageUniforms {
  return {
    uLeaf: { value: LEAF_PALETTE.map((h) => new Color(h)) },
    uWash: { value: new Vector4(0.32, 0.45, 0.26, 1.0) },
    uLeafInk: { value: new Vector4(1.6, 0.9, 0.5, 0.35) },
    uPlate: { value: 1 },
  };
}

/**
 * One program, five modes. 'cards' is alpha-to-coverage with the target's alpha KEPT (blend: rgb = src, a = dst);
 * 'cards-depth' re-draws the same cards depth-EQUAL writing only alpha = near / viewZ (the post silhouette's inverse
 * depth), so it must render right after 'cards' (renderOrder). Everything else is plain opaque.
 */
export function foliageMaterial(shared: Shared, mode: FoliageMode, fu: FoliageUniforms, atlas: Texture | null): ShaderMaterial {
  const defines: Record<string, string> = {};
  if (mode === 'cards') defines['CARD'] = '';
  if (mode === 'cards-depth') defines['DEPTH_ONLY'] = '';
  if (mode === 'leaves') defines['LEAF'] = '';
  if (mode === 'shells') defines['SHELL'] = '';
  if (mode === 'inner') defines['INNER'] = '';
  const m = new ShaderMaterial({
    // the foliage uniform objects are shared by every mode: one write reaches them all
    uniforms: { ...shared.u, uLeaf: fu.uLeaf, uWash: fu.uWash, uLeafInk: fu.uLeafInk, uPlate: fu.uPlate, uAtlas: { value: atlas } },
    vertexShader: VS, fragmentShader: FS, defines,
    side: mode === 'cards' || mode === 'cards-depth' || mode === 'leaves' ? DoubleSide : FrontSide,
  });
  if (mode === 'cards') {
    m.alphaToCoverage = true;
    m.blending = CustomBlending;
    m.blendEquation = AddEquation;
    m.blendSrc = OneFactor;
    m.blendDst = ZeroFactor;
    m.blendEquationAlpha = AddEquation;
    m.blendSrcAlpha = ZeroFactor;
    m.blendDstAlpha = OneFactor;
  }
  if (mode === 'cards-depth') {
    m.depthFunc = EqualDepth;
    m.depthWrite = false;
    m.blending = CustomBlending;
    m.blendEquation = AddEquation;
    m.blendSrc = ZeroFactor;
    m.blendDst = OneFactor;
    m.blendEquationAlpha = AddEquation;
    m.blendSrcAlpha = OneFactor;
    m.blendDstAlpha = ZeroFactor;
  }
  return m;
}

/** dome B's ramp (display sRGB), darker than the lab's LEAF_PALETTE */
export const DOME_B_LEAVES = [0x0c1310, 0x142019, 0x1e2e25, 0x2d3d31, 0x3f4e38] as const;

/** the painted leaf atlas (the codex gongbi 2×2 sheet), mipmapped, anisotropic */
async function loadAtlas(url: string): Promise<Texture> {
  const compressed = await ktx2Texture(phoneUrl(url));
  const t = compressed ?? await new TextureLoader().loadAsync(url);
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.anisotropy = 4;
  if (compressed === null) { t.generateMipmaps = true; t.needsUpdate = true; }
  return t;
}


/**
 * Dome B: dress the banyan's lumps with the painted cards (G285: their geometry is baked, ../generators/canopyGeometry.ts
 * `canopyGeometries` over the layout's plan; null when the plan has no lumps) (alpha to coverage, then the depth-equal pass that writes the
 * lumps' plateau depth into the colour target's alpha for the post's ink) over a darker core. Returns the meshes to add
 * (none when the atlas fails: the tree then stands bare, which shows at once). Spill is baked like the kits'.
 */
export async function buildCanopy(shared: Shared, crown: CanopyGeometry | null, emitters: readonly Emitter[]): Promise<Mesh[]> {
  if (crown === null) return [];
  try {
    const atlas = await loadAtlas('/assets/nine-dragon/lab/organic/leaf-atlas.webp');
    const fu = foliageUniforms();
    // dome B's night crown (ΔE vs its targets: the lab's palette read #4c5742 against #343b32, the lit tops khaki from
    // above): the ramp a step darker and less yellow, the lit band narrower
    fu.uLeaf.value = DOME_B_LEAVES.map((h) => new Color(h));
    fu.uWash.value.x = 0.18;
    fu.uLeafInk.value.w = 0.15; // the sky rim: from above every card edge caught it and the crown went pale
    const { cards: gCards, core: gCore } = crown;
    await bakeSpill([gCards, gCore], emitters);
    const cards = new Mesh(gCards, foliageMaterial(shared, 'cards', fu, atlas));
    const cardsDepth = new Mesh(gCards, foliageMaterial(shared, 'cards-depth', fu, atlas));
    cards.renderOrder = 1;
    cardsDepth.renderOrder = 2;
    const core = new Mesh(gCore, foliageMaterial(shared, 'inner', fu, null));
    return [core, cards, cardsDepth];
  } catch (e: unknown) {
    console.warn('nine-dragon: the leaf atlas failed to load, the banyan has no canopy', e);
    return [];
  }
}
