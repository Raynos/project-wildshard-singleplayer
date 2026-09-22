// Phone-tier image files (docs/plans/LOAD-PERF.md §P1, ask P5 "cold bytes"). Idempotent; needs ImageMagick + cwebp.
// Commit the outputs: Vercel's builder has neither tool, so nothing here runs at build time.
//
// 1. Poly Haven sets: for every public/assets/tex/<id>/{diffuse,nor_gl,arm}.jpg wider than 1024 px or heavier than
//    350 KB, write <kind>_1k.jpg beside it (≤ 1024², q82). The phone tier requests these (src/core/assets.ts texUrl)
//    instead of downloading a 2048² file it would shrink anyway.
// 2. Model textures: Poly Haven ships the glTF props' 1k JPEGs at q99 — three times the bytes of q85 for no
//    difference anyone can see at 1k. Re-encoded IN PLACE (both tiers) at q85, normal maps with 4:4:4 chroma (their
//    R and G are independent data, 4:2:0 would smear them). Same for the JPEGs embedded in the `<id>_lod.glb`
//    props (scripts/simplify-models.mjs copies them in at q99). A file already ≤ q90 is left alone.
// 3. `.phone.<ext>` siblings, picked by `tierUrl()` (src/boot/bytes.ts) on the phone tier for anything that goes
//    through fetchImage and is declared by the boot manifest (src/boot/manifest.ts maps its lists through the
//    same function, so declared bytes = downloaded bytes):
//      PNGs  → lossy WebP q90 with lossless alpha (`-exact` keeps the colour under transparent texels, which
//              bilinear filtering and the mip chain still read), capped at 1024 px — card-albedo, twig_rgba, fur normals
//      JPEGs over 1024 px or above q90 → ≤ 1024 px, q85 — branch-card normal / ARM planes, twig normal / ARM
//    A sibling that is not ≥ 15 % smaller than its source is not written (the phone takes the source).
import { readdirSync, existsSync, statSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = 'public/assets/tex';
let made = 0, kept = 0;
const identify = (fmt, file) => execFileSync('magick', ['identify', '-format', fmt, file]).toString().trim();
const fresh = (out, src) => existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs;

// ── 1. Poly Haven set _1k siblings ──
for (const id of readdirSync(ROOT)) {
  const dir = join(ROOT, id);
  if (!statSync(dir).isDirectory()) continue;
  for (const kind of ['diffuse', 'nor_gl', 'arm']) {
    const src = join(dir, `${kind}.jpg`), out = join(dir, `${kind}_1k.jpg`);
    if (!existsSync(src)) continue;
    const w = Number(identify('%w', src));
    if (w <= 1024 && statSync(src).size < 350 * 1024) continue; // small enough: the loader falls back to the base file
    if (fresh(out, src)) { kept++; continue; }
    execFileSync('magick', [src, '-resize', '1024x1024', '-quality', '82', '-strip', out]);
    made++;
  }
}

// ── 2. model textures, in place ──
const isNormal = (name) => /nor(_gl)?/i.test(name);
const jpegArgs = (name) => ['-quality', '85', ...(isNormal(name) ? ['-sampling-factor', '1x1'] : []), '-strip'];
/** q85 re-encode of a JPEG buffer, or null when it is already ≤ q90 (idempotence). */
function squeeze(buf, name) {
  const q = Number(execFileSync('magick', ['identify', '-format', '%Q', 'jpg:-'], { input: buf }).toString().trim());
  if (!(q > 90)) return null;
  return execFileSync('magick', ['jpg:-', ...jpegArgs(name), 'jpg:-'], { input: buf, maxBuffer: 64 << 20 });
}
let squeezed = 0, saved = 0;
const MODELS = 'public/assets/models';
for (const id of readdirSync(MODELS)) {
  const texDir = join(MODELS, id, 'textures');
  if (existsSync(texDir)) for (const f of readdirSync(texDir).filter((x) => x.endsWith('.jpg'))) {
    const p = join(texDir, f), buf = readFileSync(p);
    const out = squeeze(buf, f);
    if (out && out.length < buf.length) { writeFileSync(p, out); squeezed++; saved += buf.length - out.length; }
  }
  const glb = join(MODELS, id, `${id}_lod.glb`);
  if (existsSync(glb)) { const d = squeezeGlb(glb); if (d > 0) { squeezed++; saved += d; } }
}

/**
 * Re-encode a GLB's embedded JPEGs: rewrite the BIN chunk with each image's bufferView replaced and every
 * bufferView re-packed (4-byte aligned) in its original order. Returns bytes saved (0 = untouched).
 */
function squeezeGlb(path) {
  const b = readFileSync(path);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path}: not a GLB`);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  const bin = b.subarray(binStart, binStart + b.readUInt32LE(20 + jsonLen));
  const views = json.bufferViews.map((v) => bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
  let changed = false;
  for (const img of json.images ?? []) {
    if (img.mimeType !== 'image/jpeg' || img.bufferView === undefined) continue;
    const out = squeeze(views[img.bufferView], img.name ?? '');
    if (out && out.length < views[img.bufferView].length) { views[img.bufferView] = out; changed = true; }
  }
  if (!changed) return 0;
  const parts = []; let off = 0;
  json.bufferViews.forEach((v, i) => {
    v.byteOffset = off; v.byteLength = views[i].length;
    parts.push(views[i]); off += views[i].length;
    const pad = (4 - (off % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
  });
  json.buffers[0].byteLength = off;
  const newBin = Buffer.concat(parts);
  let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonBuf.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(newBin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  const total = 12 + 8 + jsonBuf.length + 8 + newBin.length; header.writeUInt32LE(total, 8);
  writeFileSync(path, Buffer.concat([header, jh, jsonBuf, bh, newBin]));
  return b.length - total;
}

// ── 3. .phone.<ext> siblings ──
const PHONE_MAX = 1024;
/** The files the phone fetches through fetchImage that are worth a phone copy. */
function phoneSources() {
  const out = [];
  const walk = (dir) => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p); else out.push(p); } };
  walk('public/assets/baked');
  for (const id of readdirSync(ROOT)) { const d = join(ROOT, id); if (statSync(d).isDirectory()) for (const n of readdirSync(d)) if (/^twig_(rgba|nor_gl|arm)\./.test(n)) out.push(join(d, n)); }
  return out.filter((p) => /\.(png|jpg)$/.test(p) && !p.includes('.phone.'));
}
let phoneMade = 0, phoneKept = 0, phoneSkipped = 0;
for (const src of phoneSources()) {
  const png = src.endsWith('.png');
  const out = src.replace(/\.(png|jpg)$/, png ? '.phone.webp' : '.phone.jpg');
  const [w, h, q] = identify('%w %h %Q', src).split(' ').map(Number);
  const big = Math.max(w, h) > PHONE_MAX;
  if (!png && !big && !(q > 90)) { if (existsSync(out)) rmSync(out); continue; }
  if (fresh(out, src)) { phoneKept++; continue; }
  const resize = big ? ['-resize', `${PHONE_MAX}x${PHONE_MAX}`] : [];
  if (png) {
    const tmp = `${out}.tmp.png`;
    // channels resized separately: magick's default alpha-weighted resize blackens the RGB under transparent texels
    execFileSync('magick', [src, ...(big ? ['-separate', ...resize, '-combine'] : []), '-strip', tmp]);
    execFileSync('cwebp', ['-quiet', '-q', '90', '-alpha_q', '100', '-exact', '-m', '6', tmp, '-o', out]);
    rmSync(tmp);
  } else {
    execFileSync('magick', [src, ...resize, ...jpegArgs(src), out]);
  }
  if (statSync(out).size > statSync(src).size * 0.85) { rmSync(out); phoneSkipped++; continue; }
  phoneMade++;
}
console.log(`tex-tiers: ${made} _1k written, ${kept} up to date · ${squeezed} model files squeezed (−${(saved / 1048576).toFixed(1)} MB) · ${phoneMade} .phone siblings written, ${phoneKept} up to date, ${phoneSkipped} not worth it`);
