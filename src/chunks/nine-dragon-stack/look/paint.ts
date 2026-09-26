// Copied from the texture lab (src/dev/nd-lab/texture/paint.ts, round-9-lab-texture) into the clean room.
// P5 "texture" (E169, round-9-lab-texture): PAINTED SURFACE TEXTURES under the Jiehua ink.
//
// Nine codex image_gen swatches (art/nine-dragon-stack/round-9-lab-texture/tools/mkjobs.py), made seamless and turned
// into DETAIL RATIOS by tools/texprep.py (linear texel / its flattened local mean, stored as ratio / scale), loaded into
// ONE RGBA8 texture array (1024² × 9, mipmapped, anisotropic). The material multiplies its wash by the ratio before
// the ruled lines are composed, so the lines stay crisp, the palette stays the wash's (the deepest mip is exactly 1: a
// far surface is its flat wash, the round-8 ΔE fit survives), and the paint reads as painted grain, grime runs, carved
// relief, glaze and lacquer. Alpha carries a cavity map (flagstone puddles) or a coverage mask (posters).
//
// Surfaces pick a layer by their kind (flag 3 → flag/flag2 per stone, panel 5 → the carved frieze, tiles 2 → glazed
// tiles, facade 1 → concrete, stone 9 → stone) or explicitly by `Look.surf` (flag bits × 4096): see SURF.
// Cost: 1 sample (flags, panel field, tiles, lacquer, wood), 2 samples (concrete / stone: a second scale), 3 on a
// poster wall (concrete ×2 + the poster). GPU memory 1024² × 9 × 4 B × 4/3 = 50 MB as RGBA8 (the lab); ~12.6 MB as ASTC
// 4×4 / ETC2 in a KTX2 array for shipping. Download: the JPEGs, 3.65 MB. Findings: round-9-lab-texture/README.md.
import { Color, DataArrayTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, RGBAFormat, UnsignedByteType, Vector4 } from 'three';

/** the array layers, in order; `scale` = the ratio's storage scale (texprep.py spec.json `scale`) */
export const LAYERS = [
  { name: 'flag', scale: 2.5, alpha: true },
  { name: 'flag2', scale: 2.5, alpha: true },
  { name: 'stone', scale: 2, alpha: false },
  { name: 'panel', scale: 2, alpha: false },
  { name: 'concrete', scale: 2, alpha: false },
  { name: 'tiles', scale: 3, alpha: false },
  { name: 'lacquer', scale: 2, alpha: false },
  { name: 'wood', scale: 2.5, alpha: false },
  { name: 'poster', scale: 1, alpha: true },
] as const;

/** Look.surf: an explicit surface (flag bits × 4096); 0 = by kind */
export const SURF = { auto: 0, none: 1, stone: 2, concrete: 3, lacquer: 4, wood: 5, poster: 6 } as const;

export const PAINT_SIZE = 1024;

/**
 * The flagstone layout, shared by the ground's joints (style.ts STONES_GLSL `stone()`), the streak cards and the paint's
 * per-stone windows: courses `rh` deep, stones `l0 … l0 + lr` long in a running bond. Dome B's ask (round 10): the
 * square's slabs 0.6–0.9 m (they were 0.82 × 1.05–1.6 m).
 */
export const FLAG = { rh: 0.62, l0: 0.64, lr: 0.28, bond: 1.1 } as const;
const f = (x: number): string => x.toFixed(3);
/** GLSL: the stone a point lies in — xy = its id (column, course), zw = its local metres */
export const FLAG_GLSL = /* glsl */ `
vec4 flagCell(vec2 p) {
  float r = floor(p.y / ${f(FLAG.rh)});
  float off = h11(r * 3.7) * ${f(FLAG.bond)};
  float L = ${f(FLAG.l0)} + ${f(FLAG.lr)} * h11(r * 9.1 + 2.0);
  float cx = floor((p.x + off) / L);
  return vec4(cx, r, p.x + off - cx * L, p.y - r * ${f(FLAG.rh)});
}
float flagLen(float r) { return ${f(FLAG.l0)} + ${f(FLAG.lr)} * h11(r * 9.1 + 2.0); }
`;

async function loadImage(url: string): Promise<{ bmp: ImageBitmap; bytes: number }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`paint: ${url} failed to load (${res.status})`);
  const blob = await res.blob();
  return { bmp: await createImageBitmap(blob), bytes: blob.size };
}

/** the texels of an image, rows flipped so the image's top is v = 1 (grime runs fall toward −v, the kit's down) */
function pixels(img: ImageBitmap, size: number): Uint8ClampedArray {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const c2 = cv.getContext('2d', { willReadFrequently: true });
  if (c2 === null) throw new Error('paint: 2d canvas unavailable');
  c2.setTransform(1, 0, 0, -1, 0, size);
  c2.drawImage(img, 0, 0, size, size);
  return c2.getImageData(0, 0, size, size).data;
}

/** a 1-texel stand-in (ratio 1 everywhere) until the real array has loaded */
export function paintPlaceholder(): DataArrayTexture {
  const n = LAYERS.length;
  const data = new Uint8Array(4 * n);
  LAYERS.forEach((l, i) => { const v = Math.round(255 / l.scale); data.set([v, v, v, 128], i * 4); });
  const t = new DataArrayTexture(data, 1, 1, n);
  t.format = RGBAFormat;
  t.type = UnsignedByteType;
  t.needsUpdate = true;
  return t;
}

/** load every layer (`base` = the folder URL) into one mipmapped RGBA8 array */
export async function loadPaint(base: string, anisotropy: number): Promise<{ tex: DataArrayTexture; bytes: number }> {
  const S = PAINT_SIZE;
  const n = LAYERS.length;
  const data = new Uint8Array(S * S * 4 * n);
  let bytes = 0;
  await Promise.all(LAYERS.map(async (l, i) => {
    const urls = [`${base}/${l.name}.jpg`, ...(l.alpha ? [`${base}/${l.name}-a.jpg`] : [])];
    const [rgb, a] = await Promise.all(urls.map(loadImage));
    if (rgb === undefined) throw new Error(`paint: ${l.name} missing`);
    bytes += rgb.bytes + (a?.bytes ?? 0);
    const p = pixels(rgb.bmp, S);
    const off = i * S * S * 4;
    data.set(p, off);
    if (a !== undefined) {
      const pa = pixels(a.bmp, S);
      for (let k = 0; k < S * S; k++) data[off + k * 4 + 3] = pa[k * 4] ?? 128;
    } else {
      for (let k = 0; k < S * S; k++) data[off + k * 4 + 3] = 128;
    }
  }));
  const t = new DataArrayTexture(data, S, S, n);
  t.format = RGBAFormat;
  t.type = UnsignedByteType;
  t.colorSpace = NoColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  return { tex: t, bytes };
}

/** the paint uniforms (merged into Shared.u so every world program sees one object) */
export function paintUniforms(): { uPaint: { value: DataArrayTexture }; uPaintK: { value: Vector4 }; uPaintK2: { value: Vector4 }; uPaintInk: { value: Color } } {
  return {
    uPaint: { value: paintPlaceholder() },
    /** x: master (0 = the round-8 flat washes), y: flagstones, z: walls (stone / concrete / panel), w: wood, lacquer, tiles */
    uPaintK: { value: new Vector4(1, 1, 1, 1) },
    /** x: 2nd-scale detail on walls, y: grime ink tint, z: posters, w: puddle depth from the flag cavity */
    uPaintK2: { value: new Vector4(0.5, 0.5, 1, 1) },
    /** the hue the paint's darks lean to: a slate blue-grey (the codex edits paint wet stone's darks blue, not brown) */
    uPaintInk: { value: new Color(0x2c3a52) },
  };
}

const scales = `float[${LAYERS.length}](${LAYERS.map((l) => l.scale.toFixed(2)).join(', ')})`;

/**
 * The paint GLSL (after NOISE_GLSL: uses h12 / vnoise; carries FLAG_GLSL). Include once in a program that has `uPaint` /
 * `uPaintK` / `uPaintK2` and `uInk0`. All helpers return a MULTIPLIER for the wash (mean 1) except `paintPoster`.
 */
export const PAINT_GLSL = /* glsl */ `
${FLAG_GLSL}
uniform highp sampler2DArray uPaint;
uniform vec4 uPaintK;
uniform vec4 uPaintK2;
uniform vec3 uPaintInk;
const float PAINT_SCALE[${LAYERS.length}] = ${scales};
// a texel's ratio (mean 1) at strength k
vec3 pRatio(vec4 t, int L, float k) { return mix(vec3(1.0), t.rgb * PAINT_SCALE[L], k); }
// grime as a darker INK wash, not photo dirt: what the ratio darkens leans toward the ink's hue
vec3 pInk(vec3 m, vec3 ink) {
  float d = clamp(1.0 - dot(m, vec3(0.3333)), 0.0, 1.0);
  vec3 inkM = ink / max(dot(ink, vec3(0.3333)), 1e-3);
  return m * mix(vec3(1.0), inkM, d * uPaintK2.y);
}
// 2-scale wall paint in face metres q (u along, v up): layer L as a big tile at S m (v unshifted, so its painted slab
// seams keep to the storeys), and layer L2 (seamless dabs) at S × 0.383 (an irrational ratio: the product never
// repeats visibly), plus a slow world-noise swing of the strength (patches of heavier grime)
vec3 paintWall(int L, int L2, vec2 q, float S, float seed, float k) {
  vec2 o = vec2(h12(vec2(seed, 1.7)) * 17.0, 0.0);
  vec4 a = texture(uPaint, vec3(q / S + o, float(L)));
  vec3 m = pRatio(a, L, 1.0);
  if (uPaintK2.x > 0.0) {
    vec4 b = texture(uPaint, vec3(q / (S * 0.383) + vec2(0.37, 0.61) + o.x * 1.37, float(L2)));
    m *= mix(vec3(1.0), pRatio(b, L2, 1.0), uPaintK2.x * 0.55);
  }
  float swing = 0.55 + 0.9 * vnoise(q * 0.07 + o);
  return mix(vec3(1.0), m, clamp(k * swing, 0.0, 1.0));
}
// one sample of a layer at face metres q / S (lacquer, wood, the stone of a small face)
vec3 paintFace(int L, vec2 q, float S, float seed, float k) {
  vec2 o = vec2(h12(vec2(seed, 2.1)), h12(vec2(seed, 5.7))) * 13.0;
  return pRatio(texture(uPaint, vec3(q / S + o, float(L))), L, k);
}
// flagstones: each stone takes one of two granite layers, a random 2.4 m window and a quarter turn, sampled with the
// CONTINUOUS world gradients (no mip seam on the joints, which the ink covers anyway). rgb = ratio, a = cavity (0.5 flat)
vec4 paintFlag(vec2 p, float k) {
  vec4 fc = flagCell(p);
  vec2 cid = fc.xy;
  vec2 loc = fc.zw;
  float h = h12(cid + 31.7);
  int L = h < 0.5 ? 0 : 1;
  float rot = floor(h12(cid + 7.1) * 4.0);
  vec2 uv = (loc + vec2(h12(cid + 3.3), h12(cid + 5.9)) * 9.0) / 2.4;
  vec2 dx = dFdx(p) / 2.4, dy = dFdy(p) / 2.4;
  if (rot > 0.5) { uv = vec2(-uv.y, uv.x); dx = vec2(-dx.y, dx.x); dy = vec2(-dy.y, dy.x); }
  if (rot > 1.5) { uv = -uv; dx = -dx; dy = -dy; }
  if (rot > 2.5) { uv = vec2(uv.y, -uv.x); dx = vec2(dx.y, -dx.x); dy = vec2(dy.y, -dy.x); }
  vec4 t = textureGrad(uPaint, vec3(uv, float(L)), dx, dy);
  return vec4(pRatio(t, L, k), t.a);
}
// the carved frieze in a panel's field (fuv 0..1 across the field)
vec3 paintPanel(vec2 fuv, float k) { return pRatio(texture(uPaint, vec3(fuv, 3.0)), 3, k); }
// glazed tiles: the layer holds 7 × 7 tiles at pitch uTilePitch (the rulings use the same pitch, so joints align)
vec3 paintTiles(vec2 q, vec2 pitch, float k) { return pRatio(texture(uPaint, vec3(q / (pitch * 7.0), 5.0)), 5, k); }
// rain rivulets on a wet vertical face: thin threads of sheen running down, world-anchored and wavering; they fade
// out before they would go sub-pixel (no shimmer). q = face metres (v up), vert = 1 - |n.y|
float pRivulet(vec2 q, float vert) {
  float x = q.x * 7.0 + (vnoise(vec2(q.x * 2.3, q.y * 1.1)) - 0.5) * 1.2;
  float cell = floor(x);
  float d = abs(fract(x) - 0.5);
  float w = max(length(vec2(dFdx(x), dFdy(x))), 1e-4);
  float thread = 1.0 - smoothstep(0.035, 0.035 + w * 1.2, d);
  float on = step(0.66, h12(vec2(cell, 3.1)));
  float along = smoothstep(0.35, 0.75, vnoise(vec2(cell * 1.7, q.y * 0.8)));
  return thread * on * along * smoothstep(0.6, 0.9, vert) * (1.0 - smoothstep(0.12, 0.35, w));
}
// the wet-ground reflections (streak cards) break on the paint: the dark wet dabs mirror, the pale dry ones don't
float paintWetDapple(vec2 p) {
  vec3 r = paintFlag(p, 1.0).rgb;
  float l = dot(r, vec3(0.2126, 0.7152, 0.0722));
  return mix(1.0, clamp(2.1 - 1.15 * l, 0.15, 1.8), uPaintK.x * uPaintK.y * uPaintK2.w);
}
// posters: rgb = linear paper colour, a = coverage (ragged band between y0 and y1 face metres)
vec4 paintPoster(vec2 q, vec2 uv, float seed, float y0, float y1) {
  vec2 o = vec2(h12(vec2(seed, 4.4)), h12(vec2(seed, 8.8))) * 7.0;
  vec4 t = texture(uPaint, vec3(q / 2.2 + o, 8.0));
  float rag = vnoise(vec2(q.x * 1.3, seed)) * 0.5;
  float band = smoothstep(y0 - 0.05, y0 + 0.05, uv.y + rag * 0.4) * (1.0 - smoothstep(y1 - 0.3 + rag, y1 - 0.2 + rag, uv.y));
  return vec4(t.rgb * t.rgb, t.a * band * uPaintK2.z);
}
`;
