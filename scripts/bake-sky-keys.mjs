#!/usr/bin/env node
// bake-sky-keys.mjs — Pine Hollow's day / night sky keys (PINE-HOLLOW-REMASTER PH-L2) as gain-mapped pairs.
//
// For every key in src/world/pineSkyKeys.ts: take `public/assets/hdri/<id>_2k.hdr` when the repo has it, else fetch the
// 2k .hdr from Poly Haven (CC0) into the OS temp dir (the .hdr is not committed), paint the HDRI's own sun (or moon) disc
// out, and write `public/assets/hdri/<id>_2k.key.jpg` + `<id>_2k.key.gain.png` — the pair src/world/BakedSky.ts decodes
// (~0.3 MB instead of a 4–5 MB RGBE file).
//
// Why the disc goes: the clock moves the sun, and PineDayNight turns each key about the vertical so its sun sits on the
// clock's azimuth — but it cannot move it up or down, so a key's disc would hang a few degrees off the drawn sun (a second
// sun). The clock draws its own disc (Sky.sunDisc, the god-ray source) and aureole (PineDayNight's dome), and the CSM light
// is the direct sun, so the key keeps only the sky: `paintOutSun` below replaces everything within the key's `paint` radius
// (the disc, the aureole and the lens's star spikes). Keys without a disc (dawn, dusk: `paint` 0) are left whole. The fixed
// sunset (Sky.ts's pre-remaster path) keeps its own untouched `<id>_2k.sky.jpg` pair.
//
// The encoder is scripts/bake-sky.mjs's `encodeSky` (keep GAIN_MAX and the maths in step with both files; bake-sky.mjs is
// left alone so its hash, and every shard's sky.json, do not change). A key whose pair exists is skipped.
//
//   node --import ./scripts/bake-loader.mjs scripts/bake-sky-keys.mjs [--force] [--only=night,day]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { DataUtils } from 'three';
import { PINE_SKY_KEYS } from '../src/world/pineSkyKeys.ts';

const ROOT = resolve(import.meta.dirname, '..');
const force = process.argv.includes('--force');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice(7).split(',') : null;
const CACHE = resolve(tmpdir(), 'wildshard-hdri');

async function hdrFile(id) {
  const repo = resolve(ROOT, `public/assets/hdri/${id}_2k.hdr`);
  if (existsSync(repo)) return repo;
  const cached = resolve(CACHE, `${id}_2k.hdr`);
  if (existsSync(cached)) return cached;
  const meta = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
  const url = meta?.hdri?.['2k']?.hdr?.url;
  if (typeof url !== 'string') throw new Error(`no 2k hdr for ${id} on Poly Haven`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(cached, Buffer.from(await res.arrayBuffer()));
  return cached;
}

for (const [name, key] of Object.entries(PINE_SKY_KEYS)) {
  if (only && !only.includes(name)) continue;
  const stem = resolve(ROOT, `public/assets/hdri/${key.id}_2k`);
  const out = { color: `${stem}.key.jpg`, gain: `${stem}.key.gain.png` };
  if (!force && existsSync(out.color) && existsSync(out.gain)) { console.log(`bake-sky-keys: ${name} (${key.id}) up to date`); continue; }
  const t0 = performance.now();
  const hdr = readFileSync(await hdrFile(key.id));
  const img = new HDRLoader().parse(hdr.buffer.slice(hdr.byteOffset, hdr.byteOffset + hdr.byteLength));
  const { width: W, height: H, data } = img;
  const isHalf = data instanceof Uint16Array;
  const src = new Float32Array(W * H * 3);
  for (let p = 0; p < W * H; p++) for (let c = 0; c < 3; c++) src[p * 3 + c] = isHalf ? DataUtils.fromHalfFloat(data[p * 4 + c]) : data[p * 4 + c];
  const note = paintOutSun(src, W, H, key.paint);
  encodeSky(W, H, (p, c) => src[p * 3 + c], out);
  console.log(`bake-sky-keys: ${name} (${key.id}) ${W}x${H} ${note} in ${Math.round(performance.now() - t0)} ms`);
}

// ── the disc ──
/**
 * Paint the sun (or moon) out, with its aureole and the lens's star spikes: every texel within `R` degrees of the
 * brightest one is replaced, row by row, by a straight blend (along the azimuth, at the same elevation) between the texels
 * just outside the region on its left and right. The rows keep the sky's vertical gradient (the horizon band, the zenith)
 * and meet the untouched sky exactly at the region's edge; PineDayNight draws an analytic aureole around the clock's own sun.
 */
function paintOutSun(src, W, H, Rdeg) {
  let best = -1, bi = 0;
  for (let p = 0; p < W * H; p++) { const l = src[p * 3] + src[p * 3 + 1] + src[p * 3 + 2]; if (l > best) { best = l; bi = p; } }
  const peak = best / 3;
  if (Rdeg <= 0) return `left whole (brightest ${peak.toFixed(1)})`;
  const sx = bi % W, sy = Math.floor(bi / W);
  const d2r = Math.PI / 180;
  const phS = (0.5 - (sy + 0.5) / H) * Math.PI, R = Rdeg * d2r;
  let n = 0;
  for (let y = 0; y < H; y++) {
    const ph = (0.5 - (y + 0.5) / H) * Math.PI;
    // the region's half-width in azimuth on this row: cos(R) = sin φ sin φs + cos φ cos φs cos Δθ
    const c = (Math.cos(R) - Math.sin(ph) * Math.sin(phS)) / Math.max(1e-6, Math.cos(ph) * Math.cos(phS));
    if (c > 1) continue;
    const half = c < -1 ? Math.PI : Math.acos(c);
    const hw = Math.min(W / 2 - 2, Math.ceil((half / (2 * Math.PI)) * W));
    const x0 = sx - hw - 1, x1 = sx + hw + 1; // the texels just outside, left and right
    const at = (x, ch) => src[(y * W + ((x % W) + W) % W) * 3 + ch];
    const L = [at(x0, 0), at(x0, 1), at(x0, 2)], Rv = [at(x1, 0), at(x1, 1), at(x1, 2)];
    for (let x = x0 + 1; x < x1; x++) {
      const t = (x - x0) / (x1 - x0), i = (y * W + ((x % W) + W) % W) * 3;
      for (let ch = 0; ch < 3; ch++) src[i + ch] = L[ch] + (Rv[ch] - L[ch]) * t;
      n++;
    }
  }
  return `disc at ${(phS / d2r).toFixed(1)}° (peak ${peak.toFixed(0)}) painted out to ${Rdeg}°, ${n} texels`;
}

/** scripts/bake-sky.mjs `encodeSky` (see there), with the output paths as a parameter */
function encodeSky(width, height, px, out) {
  const GAIN_MAX = 16;
  const n = width * height;
  const rgb = Buffer.alloc(n * 3), gain = Buffer.alloc(n);
  const enc = (v) => { const c = Math.min(1, Math.max(0, v)); return Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)); };
  for (let p = 0; p < n; p++) {
    const r = px(p, 0), g = px(p, 1), b = px(p, 2);
    const m = Math.max(r, g, b);
    const gq = m > 1 ? Math.min(255, Math.ceil((Math.log2(m) / GAIN_MAX) * 255)) : 0;
    const k = 2 ** ((-gq * GAIN_MAX) / 255);
    rgb[p * 3] = enc(r * k); rgb[p * 3 + 1] = enc(g * k); rgb[p * 3 + 2] = enc(b * k);
    gain[p] = gq;
  }
  const size = `${width}x${height}`;
  execFileSync('magick', ['-size', size, '-depth', '8', 'rgb:-', '-quality', '95', '-sampling-factor', '1x1', '-strip', out.color], { input: rgb });
  execFileSync('magick', ['-size', size, '-depth', '8', 'gray:-', '-strip', '-define', 'png:compression-level=9', `PNG8:${out.gain}`], { input: gain });
}
