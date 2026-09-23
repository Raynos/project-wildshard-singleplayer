#!/usr/bin/env node
// nalati-models-color.mjs — colour-match the Nalati image-to-3D GLBs to their reference images, then re-optimize.
//
// In-engine the generated models read too dark and muddy (wolf black, snow leopard a panther, Golden King bronze,
// balbal brown). This takes each model's base-colour atlas and moves its palette onto the codex reference it was made
// from (`~/ml/img2mesh/refs/cut/<name>.png`, alpha = the object):
//   - L (CIE Lab lightness) and chroma: histogram match, texels used by the mesh (UV-rasterised mask) → the
//     reference's object pixels. That fixes the tonal distribution (lifted darks, the felt's white, the stone's pale
//     grey) and the saturation without flattening.
//   - then per hue sector (see makeMap): L, chroma and hue pulled to the reference's same sector, so a multi-colour
//     object (crimson cape + gold armour) keeps its separate colours.
//   - a soft toe lift on the darkest L after the match.
// Every step is blended by a per-model strength. Unused atlas texels get the same per-pixel map (no seams at gutters).
// Output: public/assets/nalati/models/<name>.glb (1024² WebP) + <name>.phone.glb (512² WebP), meshopt, via the
// gltf-transform CLI; spruce's impostor card gets the same per-pixel map.
//
//   node scripts/nalati-models-color.mjs                    # every model
//   node scripts/nalati-models-color.mjs --only=wolf,yurt   # some
// Sources are the untouched generator outputs (never the repo copies, so re-runs don't compound):
//   ~/ml/img2mesh/final/<name>.glb (TRELLIS.2) or ~/ml/img2mesh/final-hy/<name>.glb (Hunyuan3D-2), per SRC below.
import { createRequire } from 'node:module';
import { realpathSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve as resolvePath, join } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const req = createRequire(realpathSync(join(ROOT, 'node_modules/@gltf-transform/cli/package.json')));
const { NodeIO } = req('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTMeshoptCompression } = req('@gltf-transform/extensions');
const { MeshoptDecoder } = req('meshoptimizer');
const sharp = req('sharp');

const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const only = flag('only', '').split(',').filter(Boolean);
const M = join(homedir(), 'ml/img2mesh');
const OUT = join(ROOT, 'public/assets/nalati/models');
const TMP = flag('tmp', '/tmp/nalati-color');
mkdirSync(TMP, { recursive: true });
const GT = join(ROOT, 'node_modules/.bin/gltf-transform');

// name → source generator + per-model knobs. k = blend 0..1 of the match; lift = L units added at L = 0 (toe);
// sat = extra chroma multiplier.
/** @type {Record<string, {src: 'trellis'|'hy', k?: number, lift?: number, sat?: number}>} */
const MODELS = {
  yurt: { src: 'hy', k: 1, lift: 6 },
  'horse-saddled': { src: 'hy', k: 0.75 },
  'horse-wild': { src: 'hy', k: 0.75 },
  spruce: { src: 'hy', k: 0.8 },
  wolf: { src: 'trellis', k: 0.95, lift: 10 },
  sheep: { src: 'trellis', k: 0.85 },
  'snow-leopard': { src: 'trellis', k: 1, lift: 18 },
  eagle: { src: 'trellis', k: 0.8 },
  'golden-king': { src: 'trellis', k: 1, sat: 1.25 },
  balbal: { src: 'trellis', k: 1, lift: 6, sat: 0.6 },
  'boulder-1': { src: 'hy', k: 0.9 },
  'boulder-2': { src: 'hy', k: 0.9 },
  'boulder-3': { src: 'hy', k: 0.9 },
  'kumis-churn': { src: 'trellis', k: 0.8 },
  cauldron: { src: 'trellis', k: 0.8 },
  saddle: { src: 'trellis', k: 0.8 },
  firewood: { src: 'trellis', k: 0.85 },
  chest: { src: 'trellis', k: 0.8 },
};

// ---- colour ----
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const LUT_LIN = new Float64Array(256).map((_, i) => lin(i / 255));
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
const fi = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
const XN = 0.95047, ZN = 1.08883;
/** sRGB bytes → Lab (Float32Array of 3·n) */
function toLab(rgba, n) {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = LUT_LIN[rgba[i * 4]], g = LUT_LIN[rgba[i * 4 + 1]], b = LUT_LIN[rgba[i * 4 + 2]];
    const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / XN, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / ZN;
    const fx = f(x), fy = f(y), fz = f(z);
    out[i * 3] = 116 * fy - 16; out[i * 3 + 1] = 500 * (fx - fy); out[i * 3 + 2] = 200 * (fy - fz);
  }
  return out;
}
function labToRgb(L, a, b) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const x = fi(fx) * XN, y = fi(fy), z = fi(fz) * ZN;
  const r = 3.2406 * x - 1.5372 * y - 0.4986 * z, g = -0.9689 * x + 1.8758 * y + 0.0415 * z, bb = 0.0557 * x - 0.204 * y + 1.057 * z;
  const c = (v) => Math.round(255 * gam(Math.min(1, Math.max(0, v))));
  return [c(r), c(g), c(bb)];
}
function stats(lab, idx) {
  const m = [0, 0, 0], s = [0, 0, 0];
  for (const i of idx) for (let c = 0; c < 3; c++) m[c] += lab[i * 3 + c];
  for (let c = 0; c < 3; c++) m[c] /= idx.length;
  for (const i of idx) for (let c = 0; c < 3; c++) s[c] += (lab[i * 3 + c] - m[c]) ** 2;
  for (let c = 0; c < 3; c++) s[c] = Math.sqrt(s[c] / idx.length);
  return { m, s };
}
/** a histogram (CDF) match LUT for one scalar channel sampled by fn(i) over 0..max, 10 bins per unit, smoothed */
function cdfLut(fnS, srcIdx, fnR, refIdx, max) {
  const B = max * 10 + 1, hs = new Float64Array(B), hr = new Float64Array(B);
  const bin = (v) => Math.min(B - 1, Math.max(0, Math.round(v * 10)));
  for (const i of srcIdx) hs[bin(fnS(i))]++;
  for (const i of refIdx) hr[bin(fnR(i))]++;
  for (let i = 1; i < B; i++) { hs[i] += hs[i - 1]; hr[i] += hr[i - 1]; }
  const ns = hs[B - 1], nr = hr[B - 1], lut = new Float32Array(B);
  let j = 0;
  for (let i = 0; i < B; i++) { const q = hs[i] / ns; while (j < B - 1 && hr[j] / nr < q) j++; lut[i] = j / 10; }
  const sm = new Float32Array(B); // a 1.5-unit box so no banding
  for (let i = 0; i < B; i++) { let t = 0, c = 0; for (let d = -15; d <= 15; d++) { const q = i + d; if (q >= 0 && q < B) { t += lut[q]; c++; } } sm[i] = t / c; }
  return (v) => sm[Math.min(B - 1, Math.max(0, Math.round(v * 10)))];
}

/** per hue sector (12 × 30°, chroma > 6): share, mean chroma, mean L and the circular-mean hue */
const SECT = 12;
const sectorOf = (a, b) => Math.floor(((Math.atan2(b, a) / (2 * Math.PI) + 1) % 1) * SECT) % SECT;
function hueStats(lab, idx, mapL, mapC) {
  const n = new Float64Array(SECT), c = new Float64Array(SECT), l = new Float64Array(SECT), sx = new Float64Array(SECT), sy = new Float64Array(SECT);
  for (const i of idx) {
    const a = lab[i * 3 + 1], b = lab[i * 3 + 2], C = Math.hypot(a, b);
    if (C < 6) continue;
    const s = sectorOf(a, b);
    n[s] += 1; c[s] += mapC(C); l[s] += mapL(lab[i * 3]); sx[s] += a / C; sy[s] += b / C;
  }
  const tot = idx.length;
  return Array.from({ length: SECT }, (_, s) => ({ share: n[s] / tot, C: n[s] ? c[s] / n[s] : 0, L: n[s] ? l[s] / n[s] : 0, h: Math.atan2(sy[s], sx[s]) }));
}

/** build the per-pixel colour map for this model: (L,a,b) → (L',a',b').
 *  Global: L and chroma each histogram-matched to the reference (the tonal / saturation distribution: nothing black,
 *  the grey stone greyer, the gold brighter). Then per hue sector (chromatic texels only): the sector's mean L and
 *  mean chroma pulled to the reference's same sector, and its hue nudged toward it (±20°) — so a crimson cape stays
 *  crimson and dark while bronze turns bright gold (a global shift would pull every hue toward the average). */
function makeMap(srcLab, srcIdx, refLab, refIdx, knobs) {
  const k = knobs.k ?? 0.85, lift = knobs.lift ?? 4, sat = knobs.sat ?? 1;
  const S = stats(srcLab, srcIdx), R = stats(refLab, refIdx);
  const Cof = (lab) => (i) => Math.hypot(lab[i * 3 + 1], lab[i * 3 + 2]);
  const mapL = cdfLut((i) => srcLab[i * 3], srcIdx, (i) => refLab[i * 3], refIdx, 100);
  const mapC = cdfLut(Cof(srcLab), srcIdx, Cof(refLab), refIdx, 130);
  const hs = hueStats(srcLab, srcIdx, mapL, mapC), hr = hueStats(refLab, refIdx, (v) => v, (v) => v);
  const wrap = (d) => Math.atan2(Math.sin(d), Math.cos(d));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const sect = hs.map((s, i) => {
    const r = hr[i];
    if (s.share < 0.003 || r.share < 0.003) return { cr: 1, dl: 0, dh: 0 };
    return { cr: clamp(r.C / Math.max(1e-3, s.C), 0.7, 1.4), dl: clamp(r.L - s.L, -15, 15), dh: clamp(wrap(r.h - s.h), -0.35, 0.35) };
  });
  return {
    S, R,
    map(L, a, b) {
      const C = Math.hypot(a, b), h = Math.atan2(b, a);
      const u = ((h / (2 * Math.PI) + 1) % 1) * SECT - 0.5, i0 = (Math.floor(u) + SECT) % SECT, i1 = (i0 + 1) % SECT, t = u - Math.floor(u);
      const lerp = (key) => sect[i0][key] * (1 - t) + sect[i1][key] * t;
      const w = clamp((C - 6) / 14, 0, 1); // chromatic weight
      let L2 = mapL(L) + lerp('dl') * w;
      L2 += lift * Math.max(0, 1 - L2 / 55) ** 2; // toe lift: nothing black
      // chroma hist-match as a ratio; near-grey texels are never pushed up (their hue is noise)
      const up = mapC(C) / Math.max(C, 1e-3), rc = up > 1 ? 1 + (up - 1) * clamp((C - 3) / 7, 0, 1) : up;
      const C2 = C * rc * (1 + (lerp('cr') - 1) * w) * sat, h2 = h + lerp('dh') * w * 0.8;
      const a2 = C2 * Math.cos(h2), b2 = C2 * Math.sin(h2);
      return [L + (L2 - L) * k, a + (a2 - a) * k, b + (b2 - b) * k];
    },
  };
}

async function readRgba(pathOrBuf) {
  const { data, info } = await sharp(pathOrBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
async function applyMap(img, mapper) {
  const { data, w, h } = await readRgba(img);
  const n = w * h, lab = toLab(data, n), out = Buffer.from(data);
  for (let i = 0; i < n; i++) {
    if (data[i * 4 + 3] === 0) continue;
    const [L, a, b] = mapper.map(lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]);
    const [r, g, bb] = labToRgb(L, a, b);
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = bb;
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

/** texels covered by the mesh's UV triangles */
function uvMask(doc, w, h) {
  const mask = new Uint8Array(w * h);
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const uv = prim.getAttribute('TEXCOORD_0'); if (!uv) continue;
    const ind = prim.getIndices(); const nIdx = ind ? ind.getCount() : uv.getCount();
    const at = (i) => (ind ? ind.getScalar(i) : i);
    const p = [0, 0];
    for (let t = 0; t < nIdx; t += 3) {
      const P = [0, 1, 2].map((o) => { uv.getElement(at(t + o), p); return [p[0] * w, p[1] * h]; });
      const x0 = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0]))), x1 = Math.min(w - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])));
      const y0 = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1]))), y1 = Math.min(h - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])));
      const d = (P[1][1] - P[2][1]) * (P[0][0] - P[2][0]) + (P[2][0] - P[1][0]) * (P[0][1] - P[2][1]);
      if (Math.abs(d) < 1e-9) continue;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const l0 = ((P[1][1] - P[2][1]) * (px - P[2][0]) + (P[2][0] - P[1][0]) * (py - P[2][1])) / d;
        const l1 = ((P[2][1] - P[0][1]) * (px - P[2][0]) + (P[0][0] - P[2][0]) * (py - P[2][1])) / d;
        if (l0 >= -0.01 && l1 >= -0.01 && 1 - l0 - l1 >= -0.01) mask[y * w + x] = 1;
      }
    }
  }
  return mask;
}

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const [name, knobs] of Object.entries(MODELS)) {
  if (only.length > 0 && !only.includes(name)) continue;
  const srcDir = join(M, knobs.src === 'hy' ? 'final-hy' : 'final');
  const doc = await io.read(join(srcDir, `${name}.glb`));
  const tex = doc.getRoot().listTextures()[0];
  const img = tex.getImage(); if (!img) throw new Error(`${name}: no texture`);
  const atlas = await readRgba(Buffer.from(img));
  const mask = uvMask(doc, atlas.w, atlas.h);
  const srcIdx = []; for (let i = 0; i < mask.length; i++) if (mask[i]) srcIdx.push(i);
  const srcLab = toLab(atlas.data, atlas.w * atlas.h);
  const ref = await readRgba(join(M, 'refs/cut', `${name}.png`));
  const refLab = toLab(ref.data, ref.w * ref.h);
  const refIdx = []; for (let i = 0; i < ref.w * ref.h; i++) if (ref.data[i * 4 + 3] > 200) refIdx.push(i);
  const mapper = makeMap(srcLab, srcIdx, refLab, refIdx, knobs);
  const png = await applyMap(Buffer.from(img), mapper);
  tex.setImage(new Uint8Array(png)).setMimeType('image/png');
  // drop meshopt on the intermediate (the CLI re-applies it)
  for (const ext of doc.getRoot().listExtensionsUsed()) if (ext instanceof EXTMeshoptCompression) ext.dispose();
  const mid = join(TMP, `${name}.glb`);
  await io.write(mid, doc);
  for (const [out, size] of [[`${name}.glb`, 1024], [`${name}.phone.glb`, 512]]) {
    execFileSync(GT, ['optimize', mid, join(OUT, out), '--compress', 'meshopt', '--texture-compress', 'webp',
      '--texture-size', String(size), '--simplify', 'false', '--instance', 'false'], { stdio: 'pipe' });
  }
  // the spruce impostor card: the same per-pixel map (its texture was rendered from the same mesh)
  const imp = join(srcDir, `${name}.impostor.glb`);
  if (existsSync(imp)) {
    const idoc = await io.read(imp);
    for (const t of idoc.getRoot().listTextures()) { const b = t.getImage(); if (b) t.setImage(new Uint8Array(await applyMap(Buffer.from(b), mapper))).setMimeType('image/png'); }
    const imid = join(TMP, `${name}.impostor.glb`);
    await io.write(imid, idoc);
    execFileSync(GT, ['optimize', imid, join(OUT, `${name}.impostor.glb`), '--texture-compress', 'webp', '--simplify', 'false', '--compress', 'false'], { stdio: 'pipe' });
  }
  const r = (v) => v.map((x) => x.toFixed(1)).join('/');
  console.log(`${name.padEnd(13)} ${knobs.src.padEnd(7)} Lab src ${r(mapper.S.m)} -> ref ${r(mapper.R.m)}  ` +
    `${(statSync(join(OUT, `${name}.glb`)).size / 1e3).toFixed(0)} KB / ${(statSync(join(OUT, `${name}.phone.glb`)).size / 1e3).toFixed(0)} KB`);
}
