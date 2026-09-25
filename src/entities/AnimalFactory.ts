import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '../core/rng';
import type { Sky } from '../world/Sky';
import { attachFogUniforms, fogUniforms } from '../world/Atmosphere';
import { bakedTexture } from '../boot/bakedTextures';
import { speciesDef, variantDef, type SpeciesDef, type VariantDef, type AnimalDims, type BoneDef, type FurStyle } from './species/registry';
import { setLowPoly } from './species/loft';
import { facetGeometry, lowPolyMaterials, oneMaterial, patchEyeGlow } from './lowpoly';
import { preloadPineCreatures, skinPineHull, type EyeSpot } from './pineCreatures';

// every species file registers itself on import: drop `src/entities/species/<kind>.ts` in and it exists
import.meta.glob(['./species/*.ts', '!./species/registry.ts', '!./species/loft.ts'], { eager: true });

export { registerSpecies, speciesDef, hasSpecies, speciesKinds, variantDef, variantMods, rollVariant, RARITY_ORDER } from './species/registry';
export type { SpeciesDef, VariantDef, VariantMods, Rarity, AnimalDims, BoneDef, AnimalSpecies, FurStyle, RigAnimCtx, ThinkCtx, EnemyWorld } from './species/registry';
export type { Paint, Station } from './species/loft';

/**
 * AnimalFactory — procedural, code-built animals from a pluggable SPECIES REGISTRY.
 *
 *   const factory = new AnimalFactory(sky);               // or new AnimalFactory(sky, { style: 'lowpoly' })
 *   const model = factory.model('deer', 'white-stag');   // (kind, variant id) → cached AnimalModel
 *   const rig = factory.instantiate(model, tintSeed);    // { mesh, bones, materials }
 *
 * Style 'lowpoly' (Driftwood Isle, `ChunkDef.style`; AnimalManager reads it from the active chunk): the SAME
 * species build — stations, bones, dims — is lofted with 4–6 sides (species/loft.ts `setLowPoly`), de-indexed
 * into flat-shaded facets with flat pastel vertex colours, and drawn with a plain flat-shaded
 * MeshStandardMaterial: no fur texture, no fur shells (`model.shells` is empty, `createShells()` returns []).
 * See `src/entities/lowpoly.ts`. The default 'pbr' path is unchanged.
 *
 * ── Adding a species (bear, elk, …) ──────────────────────────────────────────────────────────────
 * Create `src/entities/species/<kind>.ts` and end it with `registerSpecies({...})` — this file globs the
 * folder, so nothing else needs an edit (not this file, not Animal.ts, not AnimalManager.ts). Import
 * helpers from `./species/loft` and types from `./species/registry`, NEVER from this file (cycle).
 *
 *   registerSpecies({
 *     kind: 'bear', label: 'Bear',
 *     fur: FurStyle,                        // texture seed/params, roughness, sheen, rim colour, shell length, shag
 *     variants: VariantDef[],               // weighted table: id, label, weight, rarity, scale [min,max], hp?, tint?, fur?, traits?, mods?
 *     build(variant, rng): AnimalSpecies,   // geometry parts + bones + dims for ONE variant (cached per kind:variant)
 *     aggressive?, walkSpeed?, chargeSpeed?, chargeDamage?, tuning?, sounds?, pose?   // AI flavour (see registry.ts)
 *   });
 *
 * `build(variant, rng)` returns { bones, furParts, hardParts, eyeParts, dims }:
 *   • Animal-local space: +Z forward (nose), +Y up, X left, metres, origin ON THE GROUND under the body
 *     centre. Scale 1 = the species' real size; VariantDef.scale multiplies the whole mesh at spawn.
 *   • bones: BoneDef[] with `pos` in animal space (identity rotation in the bind pose). Animal.ts drives
 *     these names with plain Euler angles, so they are REQUIRED: body, neck1, neck2, head, earL, earR, tail,
 *     belly (breathing), and per leg FL/FR: shoulder, carpus, fetlock; BL/BR: hip, stifle, hock
 *     (e.g. 'FL_shoulder'). Extra bones are fine. Index 0 must be 'body' (the root).
 *   • furParts: loft()/tube() geometries drawn with the fur material and the fur shells (they carry a
 *     per-vertex `furLen` from the part name: body/neck/head/ear/leg/tail/crest). hardParts: hooves, antlers,
 *     tusks, snout — vertex colours, no shells. eyeParts: skinPlain() spheres on the glossy eye material.
 *     Every geometry needs position/normal/uv/color/skinIndex/skinWeight/furLen — loft() gives you all of
 *     them; the factory merges them into ONE SkinnedMesh with three material groups and disposes the parts.
 *   • dims: hit volumes + animation numbers (AnimalDims in registry.ts): bodyY = body bone height, the body
 *     capsule (bodyHalfLen, bodyRadius) around the body bone along Z, headRadius around the head bone,
 *     legLen (stride frequency), feet (rest x,z per FL, FR, BL, BR — terrain foot IK), halfWidth (corpse).
 *   • Colours are VERTEX COLOURS written by your Paint callback (see loft.ts), multiplied by a grey strand
 *     texture: keep a palette object, let `variant.tint[key]` override any entry (that is how white deer /
 *     black boars work — shells share the geometry so they always agree with the skin), and read
 *     `variant.traits` for geometry knobs (antlerScale, tuskScale, scar…).
 *   • Fur shells: SHELL_LAYERS clones of the fur material push vertices out along the normal by
 *     furLen × FurStyle.shellLen × layer, alpha-tested through a strand texture. Nothing to do per species
 *     beyond the part names. `FurStyle.shag` = silhouette noise (call setShag() in build, reset to 0 after).
 *   • The fur SHADER is shared by every species (one program): per-kind differences must stay in
 *     uniforms, textures and vertex data — never in shader source or material defines. Keep sheen > 0 and
 *     provide no emissiveMap etc.; VariantDef.fur may override rim / emissive / sheen colour / roughness.
 *   • Textures: the strand albedo/normal is generated once per kind (seeded by FurStyle.texSeed) and baked
 *     as public/assets/baked/<slug>/tex/fur-<kind>-{map,normal}; a new kind draws it at runtime until
 *     `scripts/bake-textures.mjs` is re-run.
 *
 * Variants + rarity: AnimalManager rolls a VariantDef per spawn by `weight` (seeded), applies `scale`, `hp`
 * and `mods` (speed / chargeDist / damageTaken / chargeDamage / relentless — multipliers over the species'
 * HuntTuning, which stays the single baseline), and stores animal.variant / rarity / label. At most one
 * 'legendary' per kind is alive at a time (re-rolled to 'rare'). HerdPlan.variants restricts a herd's pool.
 */

export type AnimalKind = string;
/** the built-in kinds (bear / elk register more at runtime) */
export type KnownAnimalKind = 'deer' | 'boar';
/** @deprecated variant ids are per species now — see SpeciesDef.variants */
export type AnimalVariant = string;

export type AnimalStyle = 'pbr' | 'lowpoly';

export interface AnimalModel {
  kind: AnimalKind;
  variant: string;
  style: AnimalStyle;
  species: SpeciesDef;
  variantDef: VariantDef;
  geometry: THREE.BufferGeometry;
  bones: BoneDef[];
  dims: AnimalDims;
  /** MeshPhysicalMaterial (fur) in 'pbr', a flat-shaded MeshStandardMaterial in 'lowpoly' */
  fur: THREE.MeshStandardMaterial;
  hard: THREE.MeshStandardMaterial;
  eye: THREE.MeshPhysicalMaterial;
  /** SHELL_LAYERS fur-shell materials, innermost first (shared by every animal of this kind:variant); empty in 'lowpoly' */
  shells: THREE.MeshPhysicalMaterial[];
  /** the fur's backlit rim colour (FurStyle.rim), needed to re-patch a cloned fur material; absent in 'lowpoly' */
  rim?: THREE.Color;
  /** 'pbr' on a generated hull (Pine Hollow, pineCreatures.ts): one group, the fur material over the hull's PBR atlas +
   *  normal map, no fur shells; `thrall` = its eyes glow and its fern clumps take their vertex colour (aThrall) */
  hull?: { thrall: boolean };
}

/** one fur-shell layer's uniforms (see patchFur) */
interface ShellLayer { layer: number; len: number; threshold: number; dark: number; strand: THREE.Texture }

export interface AnimalRig {
  mesh: THREE.SkinnedMesh;
  bones: Record<string, THREE.Bone>;
  materials: THREE.MeshStandardMaterial[];
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Procedural fur textures
// ─────────────────────────────────────────────────────────────────────────────────────────


/** periodic value noise on a (px × py) lattice, sampled at (u,v) in [0,1) */
function lattice(px: number, py: number, rng: Rng): (u: number, v: number) => number {
  const grid = new Float32Array(px * py);
  for (let i = 0; i < grid.length; i++) grid[i] = rng.next();
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (u: number, v: number) => {
    const x = (u * px) % px, y = (v * py) % py;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = sm(x - x0), fy = sm(y - y0);
    const x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const a = grid[y0 * px + x0] ?? 0, b = grid[y0 * px + x1] ?? 0, c = grid[y1 * px + x0] ?? 0, d = grid[y1 * px + x1] ?? 0;
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
  };
}

function makeFurTextures(seed: number, opts: FurStyle['tex'], kind: string): { map: THREE.Texture; normalMap: THREE.Texture } {
  // baked to public/assets/baked/<slug>/tex/fur-<kind>-{map,normal} by scripts/bake-textures.mjs: the two 512² fields
  // below are ~350 ms of phone CPU per kind; `gen` runs them once only when a file is missing
  let gen: { ca: HTMLCanvasElement; cn: HTMLCanvasElement } | null = null;
  const build = () => (gen ??= makeFurCanvases(seed, opts));
  const map = bakedTexture(`fur-${kind}-map`, () => new THREE.CanvasTexture(build().ca));
  map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8;
  const normalMap = bakedTexture(`fur-${kind}-normal`, () => new THREE.CanvasTexture(build().cn), { lossless: true });
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping; normalMap.anisotropy = 8;
  return { map, normalMap };
}

function makeFurCanvases(seed: number, opts: FurStyle['tex']): { ca: HTMLCanvasElement; cn: HTMLCanvasElement } {
  const S = 512;
  const rng = new Rng(seed);
  // fur strands: narrow across (x, ~2-3 mm at TEX_M), long along (y)
  const f0 = lattice(30, 5, rng), f1 = lattice(112, 14, rng), f2 = lattice(224, 28, rng), f3 = lattice(448, 56, rng); // f0 = 1 cm tufts, visible at 5 m
  const m1 = lattice(6, 6, rng), m2 = lattice(12, 12, rng), m3 = lattice(24, 24, rng);
  const ph = lattice(128, 8, rng);       // per-strand phase so root/tip breaks don't line up
  const height = new Float32Array(S * S);
  const albedo = new Float32Array(S * S);
  const L = opts.strandLen;              // strand segments per texture repeat along v
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    // wobble the strands so they aren't perfectly parallel
    const wob = (m3(u, v) - 0.5) * 0.03;
    const fur = f0(u + wob * 3, v) * 0.35 + f1(u + wob, v) * 0.35 + f2(u + wob * 2, v) * 0.2 + f3(u, v) * 0.1;
    const mott = m1(u, v) * 0.55 + m2(u, v) * 0.3 + m3(u, v) * 0.15;
    // root → tip: each strand segment is dark at its root and pale at its tip
    const seg = (v * L + ph(u, v) * 1.7) % 1;
    const tip = seg * seg;
    const i = y * S + x;
    height[i] = fur * 0.7 + tip * 0.3;
    // grizzle: sparse pale guard-hair tips
    const g = opts.grizzle > 0 ? Math.max(0, f1(u, v) * 0.6 + f0(u, v) * 0.4 - 0.58) * 1.6 * opts.grizzle * (0.4 + tip) : 0;   // pale guard-hair streaks, not sparkles
    albedo[i] = 1 - opts.contrast * (0.55 - fur) - 0.2 * (mott - 0.5) * (1 + opts.bristle) - opts.root * (1 - tip) + g;
  }
  // albedo canvas (values ≤ 1 → material colour is carried by vertex colours)
  const ca = document.createElement('canvas'); ca.width = S; ca.height = S;
  const ga = canvas2d(ca);
  const ia = ga.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const a = Math.min(1, Math.max(0.2, (albedo[i] ?? 0) + 0.12));
    const v = Math.round(a * 255);
    ia.data[i * 4] = v; ia.data[i * 4 + 1] = Math.round(v * 0.985); ia.data[i * 4 + 2] = Math.round(v * 0.96); ia.data[i * 4 + 3] = 255;
  }
  ga.putImageData(ia, 0, 0);
  // normal map from the strand height field
  const cn = document.createElement('canvas'); cn.width = S; cn.height = S;
  const gn = canvas2d(cn);
  const inn = gn.createImageData(S, S);
  const k = opts.normalStrength * 18;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const l = height[y * S + ((x - 1 + S) % S)] ?? 0, r = height[y * S + ((x + 1) % S)] ?? 0;
    const d = height[((y - 1 + S) % S) * S + x] ?? 0, u = height[((y + 1) % S) * S + x] ?? 0;
    let nx = -(r - l) * k, ny = -(u - d) * k * 0.7, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * S + x) * 4;
    inn.data[i] = Math.round((nx * 0.5 + 0.5) * 255); inn.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255); inn.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255); inn.data[i + 3] = 255;
  }
  gn.putImageData(inn, 0, 0);
  return { ca, cn };
}

/** the 2d context of a canvas we just created (getContext is typed nullable; it only fails when the browser is out of contexts) */
function canvas2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d');
  if (g === null) throw new Error('AnimalFactory: could not get a 2d canvas context');
  return g;
}

/** Tileable strand cross-section for fur shells: each dot is one hair; its value is the hair's length. */
function makeStrandTexture(seed: number): THREE.CanvasTexture {
  const S = 256;
  const rng = new Rng(seed);
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = canvas2d(c);
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  const wrap: [number, number][] = [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]];
  for (let i = 0; i < 5200; i++) {
    const x = rng.next() * S, y = rng.next() * S, r = 0.9 + rng.next() * 1.4;
    const v = Math.round((0.18 + rng.next() ** 0.7 * 0.82) * 255);
    g.fillStyle = `rgb(${v},${v},${v})`;
    for (const [ox, oy] of wrap) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, Math.PI * 2); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

export const SHELL_LAYERS = 8;

// ─────────────────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────────────────

/** small string hash → Rng seed, so a species' build() gets the same rng for the same kind:variant */
// oxlint-disable-next-line unicorn/prefer-code-point -- FNV-1a over UTF-16 code units: codePointAt would change the seed for any non-BMP id
function hashSeed(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const col3 = (c: [number, number, number]): THREE.Color => new THREE.Color(c[0], c[1], c[2]);

export class AnimalFactory {
  private models = new Map<string, AnimalModel>();
  private tex = new Map<string, { map: THREE.Texture; normalMap: THREE.Texture }>();
  private strandTex?: THREE.Texture;

  readonly style: AnimalStyle;
  /** resolves once the generated hulls this factory may use have loaded (Pine Hollow's rigs; at once elsewhere): a model
   *  made before it is the procedural one for good, so AnimalManager.buildAsync waits for it before the first herd */
  readonly ready: Promise<void>;

  constructor(private readonly sky: Sky, opts: { style?: AnimalStyle | undefined } = {}) {
    this.style = opts.style ?? 'pbr';
    this.ready = this.style === 'pbr' ? preloadPineCreatures() : Promise.resolve();
  }

  /** The cached model for (kind, variant id). An unknown variant id falls back to the species' first variant. */
  model(kind: AnimalKind, variant?: string): AnimalModel {
    const species = speciesDef(kind);
    const v = variantDef(kind, variant);
    const key = `${kind}:${v.id}`;
    let m = this.models.get(key);
    if (m !== undefined) return m;
    const lowPoly = this.style === 'lowpoly';
    setLowPoly(lowPoly);
    const sp = species.build(v, new Rng(hashSeed(key)));
    setLowPoly(false);
    if (sp.bones[0]?.name !== 'body') throw new Error(`species '${kind}': bones[0] must be 'body'`);
    // the procedural eyes, where a thrall's glowing eyes go on a generated hull
    const eyes: EyeSpot[] = [];
    for (const g of sp.eyeParts) { g.computeBoundingSphere(); const bs = g.boundingSphere; if (bs !== null) eyes.push({ centre: bs.center.clone(), radius: bs.radius }); }
    const furGeo = mergeGeometries(sp.furParts, false);
    const hardGeo = mergeGeometries(sp.hardParts, false);
    const eyeGeo = mergeGeometries(sp.eyeParts, false);
    let geometry = mergeGeometries([furGeo, hardGeo, eyeGeo], true);
    for (const g of [...sp.furParts, ...sp.hardParts, ...sp.eyeParts, furGeo, hardGeo, eyeGeo]) g.dispose();
    geometry.computeBoundingSphere();
    if (geometry.boundingSphere !== null) geometry.boundingSphere.radius += 0.6; // animated legs / neck / corpse roll never leave this
    geometry.computeBoundingBox();

    if (lowPoly) {
      // faceted: flat per-face normals, flat-shaded untextured materials, no fur shells
      geometry = facetGeometry(geometry, sp.facetJitter);
      const lp = lowPolyMaterials();
      // one material, one draw per rig (M3): the hard parts + eyes fold into the body group; glowing eyes ride aGlow
      const glow = oneMaterial(geometry, species.eyeGlow !== undefined ? 2 : null);
      if (species.eyeGlow !== undefined) { lp.eye.emissive = col3(species.eyeGlow); lp.eye.emissiveIntensity = species.eyeGlowIntensity ?? 1; }   // the sailor's cyan eyes
      if (glow) patchEyeGlow(lp.fur, lp.eye.emissive, lp.eye.emissiveIntensity);
      if (sp.map) { // a generated model's own paint (the Drowned Captain), set before the program compiles
        lp.fur.map = sp.map;
        if (sp.selfLight !== undefined && sp.selfLight > 0) { lp.fur.emissiveMap = sp.map; lp.fur.emissive.setRGB(1, 1, 1); lp.fur.emissiveIntensity = sp.selfLight; }
      }
      this.sky.setupMaterial(lp.fur); this.sky.setupMaterial(lp.hard); this.sky.setupMaterial(lp.eye);
      m = { kind, variant: v.id, style: 'lowpoly', species, variantDef: v, geometry, bones: sp.bones, dims: sp.dims, fur: lp.fur, hard: lp.hard, eye: lp.eye, shells: [] };
      this.models.set(key, m);
      return m;
    }

    const style: FurStyle = { ...species.fur, ...v.fur };
    // a generated hull skinned to this skeleton (Pine Hollow PH-M1, pineCreatures.ts; `?creatures=proc` = the procedural
    // animal): one group drawn with the same fur material over the hull's photoreal atlas (the variant's coat) + normal
    // map, so the program is the procedural fur's own; no fur shells
    const hull = skinPineHull(kind, v.id, sp.bones, eyes);
    if (hull !== null && hull.map !== null) {
      geometry.dispose();
      const fur = new THREE.MeshPhysicalMaterial({
        map: hull.map, normalMap: hull.normalMap, normalScale: new THREE.Vector2(1.0, -1.0),   // glTF's normal map, derivative tangents (as GLTFLoader); every rig ships one
        roughness: style.roughness, metalness: 0, vertexColors: true, color: new THREE.Color(1.0, 1.0, 1.0),
        sheen: Math.max(0.01, style.sheen), sheenRoughness: 0.7, sheenColor: col3(style.sheenColor), envMapIntensity: style.envMapIntensity,
      });
      if (style.emissive !== undefined) { fur.emissive = col3(style.emissive); fur.emissiveIntensity = style.emissiveIntensity ?? 1; }
      // traits.selfLight: the coat fed back as emissive (the Antler King reads in his night fight, as the Drowned Captain's
      // selfLight) — its own program, only on that variant
      const selfLight = Number(v.traits?.['selfLight'] ?? 0);
      if (selfLight > 0) { fur.emissiveMap = hull.map; fur.emissive.setRGB(1, 1, 1); fur.emissiveIntensity = selfLight; }
      const rim = col3(style.rim);
      this.patchFur(fur, rim, undefined, -1, hull.thrall);
      this.sky.setupMaterial(fur);
      m = { kind, variant: v.id, style: 'pbr', species, variantDef: v, geometry: hull.geometry, bones: hull.bones, dims: sp.dims, fur, hard: fur, eye: new THREE.MeshPhysicalMaterial(), shells: [], rim, hull: { thrall: hull.thrall } };
      this.models.set(key, m);
      return m;
    }
    let tex = this.tex.get(kind);
    if (tex === undefined) { tex = makeFurTextures(species.fur.texSeed, species.fur.tex, kind); this.tex.set(kind, tex); }
    // MeshPhysicalMaterial for the sheen term (soft velvet), plus a backlit Fresnel rim patched in below.
    // Everything species-specific here is a uniform: the compiled program is shared by every kind.
    const fur = new THREE.MeshPhysicalMaterial({
      map: tex.map, normalMap: tex.normalMap, normalScale: new THREE.Vector2(1.0, 1.0),
      roughness: style.roughness, metalness: 0, vertexColors: true, color: new THREE.Color(1.0, 1.0, 1.0),
      sheen: Math.max(0.01, style.sheen), sheenRoughness: 0.7, sheenColor: col3(style.sheenColor),
      envMapIntensity: style.envMapIntensity, // less IBL fill so the sun side / shadow side contrast survives (fur self-shadows)
    });
    if (style.emissive !== undefined) { fur.emissive = col3(style.emissive); fur.emissiveIntensity = style.emissiveIntensity ?? 1; }
    const rim = col3(style.rim);
    this.patchFur(fur, rim);
    const hard = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, vertexColors: true, color: new THREE.Color(1, 1, 1), normalMap: tex.normalMap, normalScale: new THREE.Vector2(0.35, 0.35) });
    const eye = new THREE.MeshPhysicalMaterial({ roughness: 0.1, metalness: 0, vertexColors: true, color: new THREE.Color(1, 1, 1), clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.5 });
    if (species.eyeGlow !== undefined) { eye.emissive = col3(species.eyeGlow); eye.emissiveIntensity = species.eyeGlowIntensity ?? 1; }
    this.sky.setupMaterial(fur); this.sky.setupMaterial(hard); this.sky.setupMaterial(eye);
    // fur shells: the same material with the vertex offset + strand alpha test, one per layer
    const shells: THREE.MeshPhysicalMaterial[] = [];
    const strand = (this.strandTex ??= makeStrandTexture(303));
    const baseLen = style.shellLen;   // metres at the outermost layer for furLen = 1
    for (let i = 0; i < SHELL_LAYERS; i++) {
      const sm = fur.clone();
      const k = (i + 1) / SHELL_LAYERS;
      this.patchFur(sm, rim, { layer: k, len: baseLen * k, threshold: 0.1 + 0.82 * k * k, dark: 0.8 + 0.3 * k, strand }, i);
      this.sky.setupMaterial(sm);
      shells.push(sm);
    }
    m = { kind, variant: v.id, style: 'pbr', species, variantDef: v, geometry, bones: sp.bones, dims: sp.dims, fur, hard, eye, shells, rim };
    this.models.set(key, m);
    return m;
  }

  /**
   * Fur shader patch: Fresnel-lit tip colour that glows when the sun is behind the animal (backlit
   * edges). With `shellIndex` the material becomes a fur-shell layer: vertices are pushed out along the
   * skinned normal by furLen x layer length (combed down/back by gravity), a strand cross-section is
   * alpha-tested so hairs thin out toward the outer layers, and inner layers are darkened (root AO).
   * The patched source has no per-species text, so one program serves every kind (see customProgramCacheKey).
   * `thrall` (a generated hull's thrall, PH-M2): the `aThrall` attribute's x takes the vertex colour instead of the atlas
   * and its normal map (the fern clumps), y glows cyan (the glass eyes) — one more program, only while a thrall exists.
   */
  private patchFur(fur: THREE.MeshPhysicalMaterial, rim: THREE.Color, shell?: ShellLayer, shellIndex = -1, thrall = false): void {
    fur.onBeforeCompile = (shader) => {
      if (thrall) {
        shader.vertexShader = shader.vertexShader
          .replace('#include <clipping_planes_pars_vertex>', `#include <clipping_planes_pars_vertex>
            attribute vec2 aThrall; varying vec2 vThrall;`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            vThrall = aThrall;`);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <clipping_planes_pars_fragment>', `#include <clipping_planes_pars_fragment>
            varying vec2 vThrall;`)
          .replace('#include <map_fragment>', `#include <map_fragment>
            diffuseColor.rgb = mix( diffuseColor.rgb, diffuse, vThrall.x );`)
          .replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * ( 1.0 - vThrall.x );')
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
            totalEmissiveRadiance += vec3( 0.45, 0.95, 1.1 ) * 2.6 * vThrall.y;`);
      }
      attachFogUniforms(shader);
      shader.uniforms['furRimColor'] = { value: rim };
      shader.uniforms['furSunDir'] = fogUniforms.fogSunDir;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <clipping_planes_pars_fragment>', `#include <clipping_planes_pars_fragment>
          uniform vec3 furRimColor; uniform vec3 furSunDir;`)
        .replace('#include <opaque_fragment>', `
          {
            vec3 V = normalize( vViewPosition );
            float ndv = saturate( dot( normal, V ) );
            vec3 sunV = normalize( ( viewMatrix * vec4( furSunDir, 0.0 ) ).xyz );
            float back = saturate( dot( sunV, -V ) );                // looking toward the sun: the coat's tips light up
            float fres = pow( 1.0 - ndv, 3.2 );
            // the backlit glow is a close-up detail: past ~10 m it washes the whole silhouette into the haze and a
            // deer at 25 m becomes a pale ghost you cannot aim at, so it fades to a third by 40 m
            float rimDist = 1.0 - 0.67 * smoothstep( 10.0, 40.0, length( vViewPosition ) );
            float rimAmt = fres * ( 0.02 + 1.2 * back * back ) * rimDist;
            outgoingLight += furRimColor * rimAmt * ( 0.15 + 0.85 * diffuseColor.rgb * 2.2 );
          }
          #include <opaque_fragment>`);
      if (shell !== undefined) {
        shader.uniforms['shellLen'] = { value: shell.len };
        shader.uniforms['shellComb'] = { value: new THREE.Vector3(0, -0.45, -0.25).multiplyScalar(shell.len * shell.layer) };
        shader.uniforms['shellT'] = { value: shell.threshold };
        shader.uniforms['shellDark'] = { value: shell.dark };
        shader.uniforms['strandMap'] = { value: shell.strand };
        shader.vertexShader = shader.vertexShader
          .replace('#include <clipping_planes_pars_vertex>', `#include <clipping_planes_pars_vertex>
            attribute float furLen; uniform float shellLen; uniform vec3 shellComb; varying float vFurLen; varying vec2 vStrandUv;`)
          .replace('#include <skinning_vertex>', `#include <skinning_vertex>
            vFurLen = furLen; vStrandUv = uv * 6.0;
            transformed += objectNormal * ( furLen * shellLen ) + shellComb * furLen;`);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <clipping_planes_pars_fragment>', `#include <clipping_planes_pars_fragment>
            uniform float shellT; uniform float shellDark; uniform sampler2D strandMap; varying float vFurLen; varying vec2 vStrandUv;`)
          .replace('#include <map_fragment>', `#include <map_fragment>
            if ( vFurLen < 0.04 ) discard;
            float strand = texture2D( strandMap, vStrandUv ).r;
            if ( strand < shellT ) discard;
            diffuseColor.rgb *= shellDark;`);
      }
    };
    fur.customProgramCacheKey = () => `animal-fur${shell !== undefined ? `-shell${shellIndex}` : ''}${thrall ? '-thrall' : ''}`;
  }

  /** Fur-shell meshes for one rig: SHELL_LAYERS SkinnedMeshes sharing geometry + skeleton, parented to the body mesh, all hidden. [] in 'lowpoly'. */
  createShells(rig: AnimalRig, model: AnimalModel): THREE.SkinnedMesh[] {
    const out: THREE.SkinnedMesh[] = [];
    for (const mat of model.shells) {
      const sh = new THREE.SkinnedMesh(model.geometry, mat);
      sh.castShadow = false; sh.receiveShadow = true;
      sh.frustumCulled = false; sh.visible = false;
      rig.mesh.add(sh);
      sh.bind(rig.mesh.skeleton, rig.mesh.bindMatrix);
      out.push(sh);
    }
    return out;
  }

  /**
   * The far herd's material for `model` (farHerd.ts, PINE-HOLLOW PH-P2): the rig's own fur (cloned, patched and set up
   * exactly as `instantiate` does — the same program) in white, the per-animal tint going into the batch's vertex
   * colours. null where a batch would not draw the rig's pixels: low-poly rigs and thralls (their shader reads the colour).
   */
  farMaterial(model: AnimalModel): THREE.Material | null {
    if (model.style !== 'pbr' || model.rim === undefined || model.hull?.thrall === true) return null;
    const fur = model.fur.clone();
    if (!(fur instanceof THREE.MeshPhysicalMaterial)) return null;
    this.patchFur(fur, model.rim, undefined, -1, false);
    fur.color.setRGB(1, 1, 1);
    this.sky.setupMaterial(fur);
    return fur;
  }

  /** Build a SkinnedMesh + skeleton for one animal. `tint` (0..1) slightly varies the fur colour per individual. */
  instantiate(model: AnimalModel, tint = 0.5): AnimalRig {
    const bones: Record<string, THREE.Bone> = {};
    const list: THREE.Bone[] = [];
    for (const d of model.bones) {
      const b = new THREE.Bone();
      b.name = d.name;
      let parent: BoneDef | null = null;
      if (d.parent) {
        parent = model.bones.find((p) => p.name === d.parent) ?? null;
        if (parent === null) throw new Error(`species '${model.kind}': bone '${d.name}' has an unknown parent '${d.parent}'`);
      }
      b.position.set(d.pos[0] - (parent !== null ? parent.pos[0] : 0), d.pos[1] - (parent !== null ? parent.pos[1] : 0), d.pos[2] - (parent !== null ? parent.pos[2] : 0));
      bones[d.name] = b; list.push(b);
      if (parent !== null) {
        const pb = bones[parent.name];
        if (pb === undefined) throw new Error(`species '${model.kind}': bone '${d.name}' is listed before its parent '${parent.name}'`);
        pb.add(b);
      }
    }
    const fur = model.fur.clone();
    if (model.style === 'pbr' && model.rim !== undefined) {
      this.patchFur(fur as THREE.MeshPhysicalMaterial, model.rim, undefined, -1, model.hull?.thrall ?? false);   // clone() does not carry onBeforeCompile
    }
    if (model.style === 'lowpoly' && model.geometry.hasAttribute('aGlow')) patchEyeGlow(fur, model.eye.emissive, model.eye.emissiveIntensity);
    const v = (tint - 0.5) * (model.style === 'lowpoly' ? 0.3 : 0.2);
    fur.color.setRGB(0.9 + v, 0.9 + v * 0.9, 0.9 + v * 0.7);
    this.sky.setupMaterial(fur);
    // low-poly rigs are one group (oneMaterial): one draw, and the per-animal body clone is the whole body (the hit flash)
    // a generated hull (Pine Hollow) is one group too: one draw, and one shadow draw without animalShadow's caster
    const mesh = new THREE.SkinnedMesh(model.geometry, model.style === 'lowpoly' || model.hull !== undefined ? [fur] : [fur, model.hard, model.eye]);
    const root = bones['body'];
    if (root === undefined) throw new Error(`species '${model.kind}': no 'body' bone`);
    mesh.add(root);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(list));
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    // Cull against the model's padded bind-pose sphere (radius + 0.6 m: legs / neck / corpse roll never leave it).
    // Left null, SkinnedMesh.computeBoundingSphere skins every vertex on the CPU the first time the frustum test
    // sees the rig — ~260 ms of the first frame at 4× CPU for the herds (project/archive/2026-09-22-load-perf.md Status).
    const bs = model.geometry.boundingSphere;
    if (bs !== null) mesh.boundingSphere = bs.clone();
    return { mesh, bones, materials: [fur, model.hard, model.eye] };
  }
}
