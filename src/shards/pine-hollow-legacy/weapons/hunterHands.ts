import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lin } from '@wildshard/engine/math/color';
import { ARM_PAL, gloveFist } from '@wildshard/engine/player/nalatiArms';

/**
 * hunterHands — the Pine Hollow hunter's first-person hands: the Longbow's dark-tan leather gloves (nalatiArms.gloveFist in
 * the hunter's palette), here on the crossbow and the lever-action too (E322 F-M6, Jake's pick B: always on).
 *
 *   withHunterPalette(() => gloveFist(…))      build nalatiArms geometry in the hunter's colours (the Longbow's hands)
 *   handGeometry(spec)                          a gloved fist + a light forearm (gauntlet → knit cuff → waxed-canvas sleeve),
 *        in GRIP SPACE (nalatiArms': the grip along +Y through the origin, the back of a right hand toward +X, the forearm
 *        leaving toward +Z); one geometry, vertex-coloured, for the viewmodels' shared lit program
 *   gripQuat(pose, mirror, out)                 grip space → the weapon's model space, from where the fist closes (`at`),
 *        which way its index / thumb end points along the grip (`axis`) and which way the palm faces (`palm`)
 *   new WeaponHands(parent, material, left, right)   the two hands as two meshes (two draws) under a weapon's model: the left
 *        fixed on the weapon, the right posed every frame (`placeRight`) — the grip, the string, the lever, the gate
 *
 * Always on in Pine Hollow (Jake picked B over no hands). `userData['viewmodelOnly']` keeps them off the
 * world copies of the held weapon (Skins.crossbowDisplayModel) — the Model Explorer's Gear cards are built from
 * `buildCrossbow` / `leverSpecimen`, never from the held viewmodel, so they carry no hands either way.
 */

/** a hunter's dark-tan leather gloves, a grey knit cuff, the sleeve of a waxed-canvas coat with leather patches */
export const HUNTER_PAL: Partial<Record<keyof typeof ARM_PAL, THREE.Color>> = {
  leather: lin(0x6a4a30), leatherLight: lin(0x8a6646), leatherDark: lin(0x3a281a), leatherEdge: lin(0x4a3424), thread: lin(0xa89878),
  fleece: lin(0x6e685e), fleeceShade: lin(0x524c44), fleeceDeep: lin(0x3a352f),
  wool: lin(0x5e5038), woolShade: lin(0x3e3424), red: lin(0x4a3422), redDeep: lin(0x33251a), redLine: lin(0x2a1e14),
};
/** build with the hunter's palette, then put Nalati's back (the module's palette is shared) */
export function withHunterPalette<T>(build: () => T): T {
  const saved = new Map<keyof typeof ARM_PAL, THREE.Color>();
  for (const k of Object.keys(HUNTER_PAL) as (keyof typeof ARM_PAL)[]) { const c = HUNTER_PAL[k]; if (c === undefined) continue; saved.set(k, ARM_PAL[k].clone()); ARM_PAL[k].copy(c); }
  try { return build(); } finally { for (const [k, c] of saved) ARM_PAL[k].copy(c); }
}

// ───────────────────────────── the forearm ─────────────────────────────

/** smooth value noise (build-time only) */
function hash(x: number, y: number): number { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const GAUNT = 0.068, CUFF = 0.118;
/**
 * The forearm from the wrist along +Y, `len` m: the glove's flared gauntlet with a rolled, stitched edge, a ribbed grey
 * knit cuff, then the waxed-canvas coat sleeve (soft folds, a darker seam). 32 around, ~40 rings: ~2.5 k triangles (the
 * Longbow's `riderArm` is ~36 k — its sleeve ornament is Nalati's; here only a hand's length of it is ever in view).
 */
export function hunterSleeve(len = 0.55, seed = 1): THREE.BufferGeometry {
  const P = HUNTER_PAL, leather = P.leather ?? ARM_PAL.leather, leatherLight = P.leatherLight ?? ARM_PAL.leatherLight;
  const leatherDark = P.leatherDark ?? ARM_PAL.leatherDark, edge = P.leatherEdge ?? ARM_PAL.leatherEdge, thread = P.thread ?? ARM_PAL.thread;
  const knit = P.fleece ?? ARM_PAL.fleece, knitShade = P.fleeceShade ?? ARM_PAL.fleeceShade, knitDeep = P.fleeceDeep ?? ARM_PAL.fleeceDeep;
  const canvas = P.wool ?? ARM_PAL.wool, canvasShade = P.woolShade ?? ARM_PAL.woolShade;
  const RAD = 32;
  const ys: number[] = [];
  for (let y = 0; y < len;) { ys.push(y); y += y < GAUNT ? 0.0085 : y < CUFF + 0.01 ? 0.005 : y < 0.25 ? 0.02 : 0.045; }
  ys.push(len);
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const c = new THREE.Color();
  for (const y of ys) {
    for (let k = 0; k <= RAD; k++) {
      const a = k / RAD, ph = a * Math.PI * 2;
      let r: number;
      if (y < GAUNT) { // the gauntlet: flares, a rolled edge; a stitched seam down its outer side
        const t = y / GAUNT;
        r = 0.033 + 0.011 * t * t + 0.0022 * Math.exp(-(((t - 0.93) / 0.06) ** 2));
        c.copy(leather).lerp(leatherLight, 0.22 + 0.18 * Math.sin(ph + 0.4));
        if (t > 0.86) c.lerp(edge, 0.6);
        if (Math.abs(Math.sin(ph * 0.5 - 0.3)) < 0.05 && t > 0.15 && t < 0.85) c.lerp(thread, 0.45);
        c.multiplyScalar(0.9 + 0.1 * vnoise(ph * 4, y * 90 + seed));
        if (t < 0.12) c.lerp(leatherDark, 0.5 * (1 - t / 0.12));
      } else if (y < CUFF) { // the knit cuff: ribs round it, bunched
        const t = (y - GAUNT) / (CUFF - GAUNT), rib = Math.cos(ph * 12);
        r = 0.044 + 0.006 * Math.sin(t * Math.PI) ** 0.7 + 0.0011 * rib;
        c.copy(knit).lerp(knitShade, 0.35 * (0.5 - 0.5 * rib) + 0.2 * vnoise(ph * 9 + seed, y * 300)).lerp(knitDeep, 0.45 * (1 - Math.sin(t * Math.PI)) ** 2);
      } else { // the waxed-canvas sleeve
        const s = y - CUFF;
        const fold = Math.sin(ph * 3 + y * 7 + seed) * 0.6 + Math.sin(ph * 5 - y * 11 + seed * 2) * 0.4;
        r = 0.049 + Math.min(1, s / 0.3) * 0.012 + 0.0028 * fold * Math.min(1, s / 0.04);
        c.copy(canvas).lerp(canvasShade, 0.4 * Math.max(0, -fold) + 0.45 * Math.exp(-s * 45));
        if (Math.abs(Math.sin(ph * 0.5 + 1.1)) < 0.035) c.lerp(canvasShade, 0.7); // the sleeve's seam
        c.multiplyScalar(0.92 + 0.1 * vnoise(ph * 14, y * 60 + seed));
      }
      pos.push(Math.cos(ph) * r, y, Math.sin(ph) * r);
      col.push(c.r, c.g, c.b);
    }
  }
  const row = RAD + 1;
  for (let i = 0; i < ys.length - 1; i++) for (let k = 0; k < RAD; k++) {
    const a = i * row + k, b = a + 1, d = a + row, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ───────────────────────────── the coat sleeve (the crossbow's: E322 F-M6 polish) ─────────────────────────────

/** rings × (RAD + 1) vertices → an indexed tube with smooth normals (and a uv if given) */
function tube(rings: number, RAD: number, pos: number[], col: number[], uv: number[] | null): THREE.BufferGeometry {
  const idx: number[] = [], row = RAD + 1;
  for (let i = 0; i < rings - 1; i++) for (let k = 0; k < RAD; k++) { const a = i * row + k, b = a + 1, d = a + row, e = d + 1; idx.push(a, d, b, b, d, e); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** the glove's gauntlet alone, `len` m along +Y from the wrist: flared leather, a rolled edge (it tucks into the coat's cuff) */
export function hunterGauntlet(len = 0.06): THREE.BufferGeometry {
  const P = HUNTER_PAL, leather = P.leather ?? ARM_PAL.leather, light = P.leatherLight ?? ARM_PAL.leatherLight, dark = P.leatherDark ?? ARM_PAL.leatherDark, edge = P.leatherEdge ?? ARM_PAL.leatherEdge;
  const RAD = 24, ys: number[] = [];
  for (let y = 0; y < len; y += 0.008) ys.push(y);
  ys.push(len);
  const pos: number[] = [], col: number[] = [], c = new THREE.Color();
  for (const y of ys) for (let k = 0; k <= RAD; k++) {
    const ph = (k / RAD) * Math.PI * 2, t = y / len;
    const r = 0.033 + 0.007 * t + 0.0015 * Math.exp(-(((t - 0.92) / 0.07) ** 2));
    c.copy(leather).lerp(light, 0.22 + 0.18 * Math.sin(ph + 0.4));
    if (t > 0.85) c.lerp(edge, 0.55);
    if (t < 0.15) c.lerp(dark, 0.45 * (1 - t / 0.15));
    pos.push(Math.cos(ph) * r, y, Math.sin(ph) * r); col.push(c.r, c.g, c.b);
  }
  return tube(ys.length, RAD, pos, col, null);
}

/** where the coat's cuff starts past the glove's wrist (m, along the forearm): the gauntlet runs on inside it */
export const COAT_FROM = 0.02;
const CUFF_LEN = 0.075;
/**
 * The hunter's coat sleeve, along +Y from its cuff's edge (0) to `len`: a turned-back cuff (a rolled lip, two stitched
 * seams, a step down to the sleeve), then the sleeve — compression folds bunched above the cuff, long soft folds, the
 * seam along the underside, fuller toward the elbow. Vertex colours carry the shading (the fold valleys, the cuff's
 * shadow, the lip's wear); the uv (6 tiles round, a tile per 5 cm along) lays `coatTextures()`' waxed canvas over it.
 * 40 round, ~70 rings: ~5.5 k triangles.
 */
export function hunterCoatSleeve(len = 1, seed = 1): THREE.BufferGeometry {
  const P = HUNTER_PAL, cloth = P.wool ?? ARM_PAL.wool, shade = P.woolShade ?? ARM_PAL.woolShade;
  const RAD = 40, ys: number[] = [];
  for (let y = 0; y < len;) { ys.push(y); y += y < CUFF_LEN + 0.004 ? 0.004 : y < 0.3 ? 0.008 : 0.03; }
  ys.push(len);
  const pos: number[] = [], col: number[] = [], uv: number[] = [], c = new THREE.Color();
  const lip = lin(0x8a7650), stitch = lin(0x2e2618);
  for (const y of ys) for (let k = 0; k <= RAD; k++) {
    const a = k / RAD, ph = a * Math.PI * 2;
    let r: number;
    c.copy(cloth);
    if (y <= CUFF_LEN) { // the cuff: a band of the same canvas turned back, thicker, its lip rolled and worn pale
      const t = y / CUFF_LEN;
      r = 0.05 + 0.0035 * Math.exp(-((t / 0.12) ** 2)) - 0.0035 * (t < 0.03 ? 1 - t / 0.03 : 0) + 0.0012 * Math.sin(ph * 2 + seed) * t;
      for (const sy of [0.2, 0.86]) if (Math.abs(t - sy) < 0.03) { r -= 0.0007; c.lerp(stitch, 0.55); }
      c.lerp(lip, 0.5 * Math.exp(-((t / 0.1) ** 2)));
      c.lerp(shade, 0.25 * Math.max(0, -Math.sin(ph - 0.6))); // the cuff's underside
      if (t < 0.03) c.multiplyScalar(0.55); // the inside of the lip, in shadow
    } else { // the sleeve
      const s = y - CUFF_LEN;
      const bunch = Math.exp(-s * 16) * (0.5 + 0.5 * Math.sin(ph * 3 + seed + Math.sin(s * 60) * 1.5)) * Math.sin(s * 95);
      const fold = Math.sin(ph * 3 + y * 6 + seed) * 0.6 + Math.sin(ph * 5 - y * 9 + seed * 2) * 0.4;
      r = 0.046 + Math.min(1, s / 0.3) * 0.013 + 0.0026 * fold + 0.0022 * bunch - 0.002 * Math.exp(-((s / 0.006) ** 2));
      c.lerp(shade, 0.42 * Math.max(0, -fold) + 0.35 * Math.max(0, -bunch) + 0.5 * Math.exp(-s * 70)); // valleys, the cuff's shadow
      c.lerp(lip, 0.18 * Math.max(0, bunch));
      if (Math.abs(Math.sin(ph * 0.5 + 1.1)) < 0.04) c.lerp(stitch, 0.5); // the seam along the underside
    }
    pos.push(Math.cos(ph) * r, y, Math.sin(ph) * r);
    col.push(c.r, c.g, c.b);
    uv.push(a * 6, y * 20);
  }
  const g = tube(ys.length, RAD, pos, col, uv);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, len / 2, 0), len);
  return g;
}

/** tileable value noise on a `per`-cell lattice (build-time only) */
function tnoise(x: number, y: number, per: number, seed: number): number {
  const h = (i: number, j: number): number => hash((((i % per) + per) % per) + seed * 17, (((j % per) + per) % per) - seed * 13);
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
interface CoatTex { map: THREE.DataTexture; normalMap: THREE.DataTexture; arm: THREE.DataTexture }
let coatTex: CoatTex | null = null;
/**
 * The coat's waxed canvas, one 128² tile (drawn once, a few ms): a plain weave (16 threads a tile — it melts into the
 * mips at arm's length), slubs, mottled wax (the albedo × 0.8–1.1 over the vertex colour; the roughness 0.5–0.85: the wax
 * shines where the cloth is rubbed) and soft creases in the normal. Albedo sRGB; normal and ARM (ao · roughness · metal 0)
 * linear; repeat-wrapped, mipmapped.
 */
export function coatTextures(): CoatTex {
  if (coatTex) return coatTex;
  const S = 128, N = 16;
  const hgt = new Float32Array(S * S), col = new Uint8Array(S * S * 4), arm = new Uint8Array(S * S * 4), nrm = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    const cu = u * N, cv = v * N, over = (Math.floor(cu) + Math.floor(cv)) % 2 === 0;
    const warp = Math.sin((cu % 1) * Math.PI), weft = Math.sin((cv % 1) * Math.PI), th = over ? warp : weft;
    const slub = tnoise(u * 8, v * 32, 8, 3) * 0.5 + tnoise(u * 16, v * 16, 16, 5) * 0.5;
    const crease = tnoise(u * 4 + v * 2, v * 4, 4, 7);
    const mott = tnoise(u * 4, v * 4, 4, 11) * 0.6 + tnoise(u * 8, v * 8, 8, 2) * 0.4;
    hgt[y * S + x] = th * 0.55 + slub * 0.25 + crease * 0.9;
    const i = (y * S + x) * 4, a = Math.min(1, 0.8 + 0.3 * mott - 0.1 * (1 - th));
    col[i] = col[i + 1] = col[i + 2] = Math.round(a * 255); col[i + 3] = 255;
    arm[i] = Math.round((0.85 + 0.15 * th) * 255); arm[i + 1] = Math.round((0.5 + 0.35 * (1 - mott)) * 255); arm[i + 2] = 0; arm[i + 3] = 255;
  }
  const at = (xx: number, yy: number): number => hgt[(((yy + S) % S) * S) + ((xx + S) % S)] ?? 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 1.6, dy = (at(x, y + 1) - at(x, y - 1)) * 1.6;
    const l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
    nrm[i] = Math.round((-dx / l * 0.5 + 0.5) * 255); nrm[i + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255); nrm[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); nrm[i + 3] = 255;
  }
  const tex = (data: Uint8Array, srgb: boolean): THREE.DataTexture => {
    const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8; t.needsUpdate = true;
    return t;
  };
  coatTex = cacheUntilDisposed({ map: tex(col, true), normalMap: tex(nrm, false), arm: tex(arm, false) }, () => { coatTex = null; });
  return coatTex;
}
/** the coat sleeve's material parameters (the viewmodels' shared program: its five map slots all filled by the canvas) */
export function coatMaterialParams(): THREE.MeshPhysicalMaterialParameters {
  const t = coatTextures();
  return { map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), aoMap: t.arm, roughnessMap: t.arm, metalnessMap: t.arm, roughness: 1, metalness: 0, envMapIntensity: 0.5, specularIntensity: 0.5 };
}

// ───────────────────────────── a hand ─────────────────────────────

export interface HandSpec {
  /** radius of what the fist closes on (nalatiArms.gloveFist) */
  R: number;
  /** the left hand */
  mirror?: boolean;
  /** the finger stack's length (1 = 8.5 cm) */
  span?: number;
  /** how far the fingers close (1 = a fist, less = a cradle) */
  curl?: number;
  /** the thumb's (default: `curl`) */
  thumbCurl?: number;
  /** the wrist's bend: the forearm heads along +Z + bend[0]·(the back of the hand) + bend[1]·(+Y, toward the index) */
  bend?: readonly [number, number];
  /** the forearm's length from the wrist (m) */
  armLen?: number;
  /** × the palette (the viewmodel sits in the weapon's shade: 1 = the Longbow's gloves as they are) */
  tint?: number;
  /** the glove's own tint per channel (linear), over `tint` for the fist and gauntlet: a lighter buckskin that reads
   *  against the walnut */
  gloveTint?: V3;
  /** a free sleeve: the forearm is its own mesh, aimed every frame from the wrist at this point in CAMERA space (an elbow
   *  below the frame), so it keeps coming in from the bottom of the screen whatever the weapon's pose does */
  elbow?: V3;
  /** the coat sleeve (hunterCoatSleeve, its own mesh on the coat's textured material) over a short gauntlet, instead of
   *  the plain merged forearm */
  coat?: boolean;
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);
/** the vertex colours × `t` (per channel) */
function tintGeo(g: THREE.BufferGeometry, t: readonly [number, number, number]): THREE.BufferGeometry {
  if (t[0] === 1 && t[1] === 1 && t[2] === 1) return g;
  const c = g.getAttribute('color');
  for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * t[0], c.getY(i) * t[1], c.getZ(i) * t[2]);
  return g;
}
/** the attributes the viewmodel program reads: a zero uv beside the vertex colours (its map slots hold 1×1 fillers) */
function finish(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
  g.computeBoundingSphere();
  return g;
}
const onlyPNC = (g: THREE.BufferGeometry): THREE.BufferGeometry => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k); return g; };

/** A hand's geometry: `geometry` = the gloved fist in grip space, with its forearm merged in along the bent wrist — or,
 *  with a separate sleeve (`free`: aimed every frame; `spec.coat`: the coat, on its own material), the fist (+ the coat's
 *  gauntlet) and `sleeve` = the forearm along +Y from its origin, `wrist` = where that origin sits in grip space and `dir`
 *  = the wrist's bend there (grip space). */
export interface HandGeometry { geometry: THREE.BufferGeometry; sleeve: THREE.BufferGeometry | null; wrist: THREE.Vector3; dir: THREE.Vector3 }
export function handGeometry(spec: HandSpec, free = false): HandGeometry {
  const mirror = spec.mirror === true, sx = mirror ? -1 : 1, k = spec.tint ?? 1, tint: V3 = [k, k, k], glove = spec.gloveTint ?? tint;
  return withHunterPalette(() => {
    const fist = gloveFist({ R: spec.R, mirror, span: spec.span ?? 1, curl: spec.curl ?? 1, thumbCurl: spec.thumbCurl ?? spec.curl ?? 1 });
    const bend = spec.bend ?? [0.12, 0];
    const d = new THREE.Vector3(sx * bend[0], bend[1], 1).normalize(), toD = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, d);
    const start = fist.wrist.clone().addScaledVector(d, -0.016); // the gauntlet laps over the back of the hand
    if (spec.coat === true) {
      const g = onlyPNC(hunterGauntlet(0.06)).applyQuaternion(toD).translate(start.x, start.y, start.z);
      const out = mergeGeometries([onlyPNC(fist.geometry), g], false);
      fist.geometry.dispose(); g.dispose();
      const coat = tintGeo(hunterCoatSleeve(spec.armLen ?? 1, mirror ? 2 : 1), tint);
      return { geometry: finish(tintGeo(out, glove)), sleeve: coat, wrist: start.clone().addScaledVector(d, COAT_FROM), dir: d };
    }
    const arm = tintGeo(onlyPNC(hunterSleeve(spec.armLen ?? 0.55, mirror ? 2 : 1)), tint);
    tintGeo(onlyPNC(fist.geometry), glove);
    if (free) return { geometry: finish(fist.geometry), sleeve: finish(arm), wrist: start, dir: d };
    arm.applyQuaternion(toD);
    arm.translate(start.x, start.y, start.z);
    const out = mergeGeometries([fist.geometry, arm], false);
    fist.geometry.dispose(); arm.dispose();
    return { geometry: finish(out), sleeve: null, wrist: start, dir: d };
  });
}

/** Where a fist closes on a weapon, in its model space: the grip's centre, the grip's direction toward the index / thumb
 *  end of the finger stack, and the palm's facing (from the back of the hand toward the grip). */
export interface GripPose { at: THREE.Vector3; axis: THREE.Vector3; palm: THREE.Vector3 }
export const gripPose = (at: readonly [number, number, number], axis: readonly [number, number, number], palm: readonly [number, number, number]): GripPose =>
  ({ at: new THREE.Vector3(...at), axis: new THREE.Vector3(...axis).normalize(), palm: new THREE.Vector3(...palm).normalize() });

const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4();
const _w = new THREE.Vector3(), _e = new THREE.Vector3(), _inv = new THREE.Matrix4();
/** grip space → model space: +Y along `axis`, the back of the hand (+X on a right hand, −X on a left) against `palm`, +Z (the
 *  forearm's side) completing the frame */
export function gripQuat(p: GripPose, mirror: boolean, out: THREE.Quaternion): THREE.Quaternion {
  _y.copy(p.axis).normalize();
  _x.copy(p.palm).multiplyScalar(mirror ? 1 : -1);
  _x.addScaledVector(_y, -_x.dot(_y)).normalize();
  _z.crossVectors(_x, _y);
  return out.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
}

/** `a` → `b` by t (0..1), into `out` (the directions re-normalised) */
export function blendGrip(a: GripPose, b: GripPose, t: number, out: GripPose): GripPose {
  out.at.lerpVectors(a.at, b.at, t);
  out.axis.lerpVectors(a.axis, b.axis, t).normalize();
  out.palm.lerpVectors(a.palm, b.palm, t).normalize();
  return out;
}

// ───────────────────────────── a weapon's two hands ─────────────────────────────

export interface HandDef { spec: HandSpec; pose: GripPose }
export type V3 = [number, number, number];
/** the gloves' tint over the hunter palette (linear, per channel): a pale buckskin that reads against the walnut stocks */
export const BUCKSKIN: V3 = [3.2, 4.2, 6.0];
/** a hold as a weapon declares it (a dev knob: edit, then the weapon's `rebuildHands()`) */
export interface HandHold { spec: HandSpec; at: V3; axis: V3; palm: V3 }
export const holdDef = (h: HandHold): HandDef => ({ spec: h.spec, pose: gripPose(h.at, h.axis, h.palm) });
/** the hands' material parameters (the Longbow's: the viewmodels' shared lit program, vertex colours × the 1×1 fillers) */
export const HANDS_MATERIAL: THREE.MeshPhysicalMaterialParameters = { roughness: 0.62, metalness: 0, envMapIntensity: 0.55, specularIntensity: 0.5 };

/**
 * A weapon's two gloved hands under its model (they move, scale and hide with it): the left fixed where `left.pose` puts
 * it, the right re-posed by `placeRight` (the weapon's own animation drives it). Two meshes on one material — two draws,
 * the viewmodel's queue (transparent, render order 1000, after the depth clear), no shadow cast.
 */
export class WeaponHands {
  readonly group = new THREE.Group();
  readonly left: THREE.Mesh; readonly right: THREE.Mesh;
  readonly rightSpec: HandSpec;
  /** the free sleeves (HandSpec.elbow): mesh, its start in the fist's grip space, the elbow in camera space */
  private readonly sleeves: { fist: THREE.Mesh; mesh: THREE.Mesh; wrist: THREE.Vector3; elbow: THREE.Vector3 }[] = [];
  private readonly q = new THREE.Quaternion();
  /** every sleeve mesh (free or riding its fist) */
  private readonly extra: THREE.Mesh[] = [];

  /** `coatMaterial`: the coat sleeves' (HandSpec.coat), else they fall back to `material` */
  constructor(parent: THREE.Object3D, material: THREE.Material, left: HandDef, right: HandDef, coatMaterial: THREE.Material = material) {
    this.group.name = 'weapon-hands';
    this.group.userData['viewmodelOnly'] = true;
    for (const m of [material, coatMaterial]) { m.transparent = true; m.depthWrite = true; }
    const lg = handGeometry({ ...left.spec, mirror: true }, left.spec.elbow !== undefined), rg = handGeometry({ ...right.spec, mirror: false }, right.spec.elbow !== undefined);
    this.left = new THREE.Mesh(lg.geometry, material);
    this.right = new THREE.Mesh(rg.geometry, material);
    this.rightSpec = right.spec;
    const meshes = [this.left, this.right];
    this.left.name = 'hand-left'; this.right.name = 'hand-right';
    for (const [fist, g, spec] of [[this.left, lg, left.spec], [this.right, rg, right.spec]] as const) {
      if (g.sleeve === null) continue;
      const mesh = new THREE.Mesh(g.sleeve, spec.coat === true ? coatMaterial : material);
      mesh.name = `${fist.name}-sleeve`;
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.renderOrder = 1000;
      mesh.userData['viewmodelOnly'] = true;
      if (spec.elbow !== undefined) { this.sleeves.push({ fist, mesh, wrist: g.wrist, elbow: new THREE.Vector3(...spec.elbow) }); this.group.add(mesh); }
      else { mesh.position.copy(g.wrist); mesh.quaternion.setFromUnitVectors(Y_AXIS, g.dir); fist.add(mesh); } // rigid: rides its fist
      this.extra.push(mesh);
    }
    for (const m of meshes) {
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; m.renderOrder = 1000;
      m.userData['viewmodelOnly'] = true;
      this.group.add(m);
    }
    this.placeLeft(left.pose);
    this.placeRight(right.pose);
    parent.add(this.group);
  }

  placeLeft(p: GripPose): void { this.left.position.copy(p.at); gripQuat(p, true, this.q); this.left.quaternion.copy(this.q); }
  placeRight(p: GripPose): void { this.right.position.copy(p.at); gripQuat(p, false, this.q); this.right.quaternion.copy(this.q); }

  /** aim the free sleeves: each from its fist's wrist at its elbow (camera space). `model` = the weapon's model, a child of
   *  the camera, its pose for this frame set (its local matrix is refreshed here). */
  aim(model: THREE.Object3D): void {
    if (this.sleeves.length === 0 || !this.group.visible) return;
    model.updateMatrix();
    _inv.copy(model.matrix).invert();
    for (const s of this.sleeves) {
      const w = _w.copy(s.wrist).applyQuaternion(s.fist.quaternion).add(s.fist.position);
      const d = _e.copy(s.elbow).applyMatrix4(_inv).sub(w).normalize();
      s.mesh.position.copy(w);
      s.mesh.quaternion.setFromUnitVectors(Y_AXIS, d);
      s.mesh.visible = s.fist.visible;
    }
  }

  /** the triangles and vertices the two hands add (a draw each) */
  get cost(): { draws: number; tris: number; verts: number; bytes: number } {
    let tris = 0, verts = 0, bytes = 0;
    const meshes = [this.left, this.right, ...this.extra];
    for (const m of meshes) {
      const g = m.geometry, idx = g.getIndex();
      tris += (idx ? idx.count : g.getAttribute('position').count) / 3;
      verts += g.getAttribute('position').count;
      for (const a of Object.values(g.attributes)) if (a instanceof THREE.BufferAttribute) bytes += a.array.byteLength;
      if (idx) bytes += idx.array.byteLength;
    }
    return { draws: meshes.length, tris, verts, bytes };
  }

  dispose(): void {
    this.group.removeFromParent();
    this.left.geometry.dispose(); this.right.geometry.dispose();
    for (const m of this.extra) m.geometry.dispose();
  }
}
