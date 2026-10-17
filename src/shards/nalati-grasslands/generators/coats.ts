import { readImagePixels, writeImagePixels } from '@wildshard/sdk/bake/image';
import { readRigRest } from '@wildshard/sdk/bake/rig';
import * as THREE from 'three';

/**
 * Nalati's creature coats, painted offline (scripts/bake-coats.mjs --shard=nalati-grasslands; SHARD-PLATFORM G226).
 * One rigged hull, every coat: the hull's atlas recoloured per variant, so a herd of bay, chestnut, grey and black mares,
 * or a pack of grey, tawny and dark wolves, all wear the generated model. The page loads the result and paints nothing.
 *
 * How: the species' palette names three coat keys: dark (a horse's points: legs, mane, tail; a wolf's saddle), body
 * (the coat) and light (the belly / chest). The atlas's own levels for those keys are measured: the luminance of texels
 * sampled over the mesh's triangles (so gutters don't count), at the 12th / 55th / 92nd percentiles. Every texel then
 * sits between two keys by its (log) luminance and is multiplied, in linear RGB, by the matching blend of
 * target ÷ source for those keys: target = the variant's palette (VariantDef.tint over the species default), source =
 * the palette of the variant the hull was generated as (the dun mare, the camp bay, the grey wolf). Multiplying keeps
 * every brush stroke of the atlas; only the tones move. A hull with tack (`tack`) keeps texels far in hue from its coat
 * (the red saddle cloth, the gold ornament) as they are.
 *
 * The painter is the page's former canvas painter on the decoded atlas (glTF orientation, unflipped), operation for
 * operation, so the stored lossless pages are unchanged.
 */

/** sRGB 0..1 */
type RGB = readonly [number, number, number];
type Tint = Readonly<Record<string, RGB>>;

/** How one hull's atlas is recoloured. */
export interface CoatSpec {
  /** the species default palette (the variant's `tint` overrides keys of it) */
  palette: Tint;
  /** the variant the hull was generated as: [kind, variant id] (its tint, over `palette`, is the atlas's coat) */
  source: readonly [string, string];
  /** the palette keys: [dark, body, light] */
  keys: readonly [string, string, string];
  /** keep texels whose hue is far from the coat's (tack) */
  tack?: boolean;
}

/** What the coats are painted from: the recoloured hulls, which hull each `kind:variant` wears, its tint and its page. */
export interface NalatiCoatInputs {
  readonly specs: Readonly<Record<string, CoatSpec>>;
  readonly hulls: Readonly<Record<string, string>>;
  readonly tint: (kind: string, variant: string) => Tint | undefined;
  readonly url: (hull: string, kind: string, variant: string) => string;
}

const toLin = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const LUT_N = 4096;
const toSrgb = new Uint8ClampedArray(LUT_N + 1).map((_, i) => { const c = i / LUT_N; return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)); });
const linOf = (c: RGB): [number, number, number] => { const k = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); return [k.r, k.g, k.b]; };
const hueOf = (r: number, g: number, b: number): number => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d <= 1e-6) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
};

/** true when `tint` changes none of the coat keys from the hull's own coat */
function isOwnCoat(spec: CoatSpec, tint: Tint | undefined, source: Tint | undefined): boolean {
  return spec.keys.every((k) => {
    const a = tint?.[k] ?? spec.palette[k], b = source?.[k] ?? spec.palette[k];
    return a !== undefined && b !== undefined && a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 1e-3);
  });
}

/** The hull's atlas pixels (RGBA, glTF orientation) repainted in place in the coat `tint`; `geometry` (uv + index) says which texels the mesh uses. */
function paintCoatPixels(spec: CoatSpec, geometry: THREE.BufferGeometry, px: Uint8ClampedArray, W: number, H: number,
  tint: Tint | undefined, source: Tint | undefined): void {
  const texel = (u: number, v: number): number => {
    const x = Math.min(W - 1, Math.max(0, Math.floor((u - Math.floor(u)) * W)));
    const y = Math.min(H - 1, Math.max(0, Math.floor((v - Math.floor(v)) * H)));
    return (y * W + x) * 4;
  };

  // ── the atlas's own key levels: texels sampled over the mesh ──
  const uv = geometry.getAttribute('uv'), idx = geometry.getIndex();
  const nTri = idx ? idx.count / 3 : uv.count / 3;
  const lums: number[] = [], hues: number[] = [], sats: number[] = [];
  let seed = 1234567;
  const rnd = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const SAMPLES = 24000;
  for (let s = 0; s < SAMPLES; s++) {
    const t = Math.floor(rnd() * nTri);
    const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    let a = rnd(), b = rnd(); if (a + b > 1) { a = 1 - a; b = 1 - b; }
    const u = uv.getX(i0) + (uv.getX(i1) - uv.getX(i0)) * a + (uv.getX(i2) - uv.getX(i0)) * b;
    const v = uv.getY(i0) + (uv.getY(i1) - uv.getY(i0)) * a + (uv.getY(i2) - uv.getY(i0)) * b;
    const o = texel(u, v);
    const r = toLin[px[o] ?? 0] ?? 0, g = toLin[px[o + 1] ?? 0] ?? 0, bl = toLin[px[o + 2] ?? 0] ?? 0;
    lums.push(0.2126 * r + 0.7152 * g + 0.0722 * bl);
    hues.push(hueOf(r, g, bl)); sats.push(Math.max(r, g, bl) > 0 ? 1 - Math.min(r, g, bl) / Math.max(r, g, bl) : 0);
  }
  const sorted = [...lums].sort((p, q) => p - q);
  const pct = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0.1;
  const Ls = [Math.log(Math.max(1e-4, pct(0.12))), Math.log(Math.max(1e-4, pct(0.55))), Math.log(Math.max(1e-4, pct(0.92)))];
  // the coat's hue: the circular mean over the mid-luminance samples
  let hx = 0, hy = 0, satM = 0, nM = 0;
  const lo = pct(0.35), hi = pct(0.8);
  for (let s = 0; s < lums.length; s++) {
    const L = lums[s] ?? 0;
    if (L < lo || L > hi) continue;
    const h = ((hues[s] ?? 0) * Math.PI) / 180;
    hx += Math.cos(h); hy += Math.sin(h); satM += sats[s] ?? 0; nM++;
  }
  const coatHue = ((Math.atan2(hy, hx) * 180) / Math.PI + 360) % 360;
  satM = nM > 0 ? satM / nM : 0.5;

  // ── target ÷ source per key, linear RGB ──
  const ratios = spec.keys.map((k) => {
    const tgt = tint?.[k] ?? spec.palette[k] ?? [1, 1, 1], src = source?.[k] ?? spec.palette[k] ?? [1, 1, 1];
    const a = linOf(tgt), b = linOf(src);
    return a.map((v, i) => Math.min(14, v / Math.max(1e-3, b[i] ?? 1)));
  });
  // chroma: a multiply keeps the source's saturation, so a grey from a dun needs the colour taken out: per key, the
  // target's saturation ÷ the source's (≤ 1.3)
  const satOf = (c: [number, number, number]): number => { const mx = Math.max(...c); return mx > 0 ? 1 - Math.min(...c) / mx : 0; };
  const sats2 = spec.keys.map((k) => {
    const tgt = tint?.[k] ?? spec.palette[k] ?? [1, 1, 1], src = source?.[k] ?? spec.palette[k] ?? [1, 1, 1];
    return Math.min(1.3, satOf(linOf(tgt)) / Math.max(0.05, satOf(linOf(src))));
  });

  // ── every texel ──
  for (let o = 0; o < px.length; o += 4) {
    const r = toLin[px[o] ?? 0] ?? 0, g = toLin[px[o + 1] ?? 0] ?? 0, b = toLin[px[o + 2] ?? 0] ?? 0;
    const L = Math.log(Math.max(1e-4, 0.2126 * r + 0.7152 * g + 0.0722 * b));
    const l0 = Ls[0] ?? 0, l1 = Ls[1] ?? 0, l2 = Ls[2] ?? 0;
    const k0 = L < l1 ? 0 : L < l2 ? 1 : 2, k1 = L <= l0 ? 0 : L < l2 ? k0 + 1 : 2;
    let f = L <= l0 || L >= l2 ? 0 : L < l1 ? (L - l0) / Math.max(1e-6, l1 - l0) : (L - l1) / Math.max(1e-6, l2 - l1);
    f = f * f * (3 - 2 * f);
    const ra = ratios[k0] ?? [1, 1, 1], rb = ratios[k1] ?? [1, 1, 1];
    let mr = (ra[0] ?? 1) + ((rb[0] ?? 1) - (ra[0] ?? 1)) * f, mg = (ra[1] ?? 1) + ((rb[1] ?? 1) - (ra[1] ?? 1)) * f, mb = (ra[2] ?? 1) + ((rb[2] ?? 1) - (ra[2] ?? 1)) * f;
    const sa = sats2[k0] ?? 1, sk = sa + ((sats2[k1] ?? 1) - sa) * f;
    if (sk < 0.999 || sk > 1.001) {
      const lr = r * mr, lg = g * mg, lb = b * mb, Lm = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
      const d = (x: number): number => (Lm + (x - Lm) * sk) / Math.max(1e-5, x);
      mr *= d(lr); mg *= d(lg); mb *= d(lb);
    }
    if (spec.tack === true) {
      // tack: a saturated texel off the coat's hue keeps its colour (the dark straps and the points still recolour)
      const mx = Math.max(r, g, b), sat = mx > 0 ? 1 - Math.min(r, g, b) / mx : 0;
      let dh = Math.abs(hueOf(r, g, b) - coatHue); if (dh > 180) dh = 360 - dh;
      const off = THREE.MathUtils.smoothstep(dh, 7, 16) * THREE.MathUtils.smoothstep(sat, satM * 0.6, satM * 0.9) * THREE.MathUtils.smoothstep(mx, 0.03, 0.08);
      mr += (1 - mr) * off; mg += (1 - mg) * off; mb += (1 - mb) * off;
    }
    px[o] = toSrgb[Math.min(LUT_N, Math.round(Math.min(1, r * mr) * LUT_N))] ?? 0;
    px[o + 1] = toSrgb[Math.min(LUT_N, Math.round(Math.min(1, g * mg) * LUT_N))] ?? 0;
    px[o + 2] = toSrgb[Math.min(LUT_N, Math.round(Math.min(1, b * mb) * LUT_N))] ?? 0;
  }
}

/**
 * The page painted on a 2D canvas, whose premultiplied storage rounds every translucent texel on the way in (drawImage,
 * getImageData) and again on the way out (putImageData, the PNG): Skia's MulDiv255Round premultiply, then a float
 * un-premultiply (bytes × f32(1/255), times the reciprocal alpha, × 255, ties to even). Kept here so the pages stay exact.
 */
function canvasRoundTrip(px: Uint8ClampedArray): void {
  const f = Math.fround, k = f(1 / 255);
  const even = (x: number): number => { const fl = Math.floor(x), d = x - fl; return d > 0.5 ? fl + 1 : d < 0.5 ? fl : fl % 2 === 0 ? fl : fl + 1; };
  for (let o = 0; o < px.length; o += 4) {
    const a = px[o + 3] ?? 255;
    if (a === 255) continue;
    const inv = f(1 / f(a * k));
    for (let c = o; c < o + 3; c++) {
      const t = (px[c] ?? 0) * a + 128, p = (t + (t >> 8)) >> 8;
      px[c] = a === 0 ? 0 : Math.min(255, even(f(f(f(p * k) * inv) * 255)));
    }
  }
}

/** One lossless coat page: its table name (the page's `nalatiCoatUrl`, per tier) and its exact pixels. */
export interface NalatiCoat { readonly url: string; readonly png: Uint8Array; readonly pixels: Uint8ClampedArray; readonly width: number; readonly height: number }

/** Every coat that repaints a hull's atlas, for one tier, read from the committed rig files (`readAsset(url)`). */
export async function produceNalatiCoats(readAsset: (url: string) => Promise<Uint8Array>, tier: 'phone' | 'desktop', inputs: NalatiCoatInputs): Promise<NalatiCoat[]> {
  const out: NalatiCoat[] = [];
  for (const [name, spec] of Object.entries(inputs.specs)) {
    const rest = await readRigRest(await readAsset(`/assets/nalati/models/${name}${tier === 'phone' ? '.phone' : ''}.rigged.glb`));
    const atlas = await readImagePixels(rest.colourImage), source = inputs.tint(spec.source[0], spec.source[1]);
    for (const [key, hull] of Object.entries(inputs.hulls)) {
      if (hull !== name) continue;
      const [kind = '', variant = ''] = key.split(':'), tint = inputs.tint(kind, variant);
      if (isOwnCoat(spec, tint, source)) continue;
      const pixels = new Uint8ClampedArray(atlas.pixels);
      canvasRoundTrip(pixels);
      paintCoatPixels(spec, rest.geometry, pixels, atlas.width, atlas.height, tint, source);
      canvasRoundTrip(pixels);
      const url = inputs.url(name, kind, variant);
      out.push({ url: tier === 'phone' ? url.replace(/\.webp$/u, '.phone.webp') : url, png: await writeImagePixels({ pixels, width: atlas.width, height: atlas.height }), pixels, width: atlas.width, height: atlas.height });
    }
    rest.geometry.dispose();
  }
  return out;
}
