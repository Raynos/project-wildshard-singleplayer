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
// 3. `.phone.webp` copies, picked by `tierUrl()` (src/boot/bytes.ts) on the phone tier — for fetchImage, and for
//    three's loaders through DefaultLoadingManager's URL modifier (glTF textures). The boot manifest declares
//    through the same function, so declared bytes = downloaded bytes. WebP q75 (-sharp_yuv) is ~20–25 % smaller
//    than the q82 JPEG it replaces AND measures lower error against the source (forest_ground_04: 0.024 vs 0.032); PNG alpha stays lossless (-exact keeps the RGB under transparent
//    texels, which bilinear filtering and the mips still read). Capped at 1024 px (the phone's maxTexture), AO /
//    roughness / metalness planes of the Poly Haven sets and props at 512 px. Encoded from the best source there
//    is (the original 2k map, not its q82 _1k copy). A copy that is not ≥ 15 % smaller is not kept.
// 4. `<id>_lod.phone.glb`: the LOD props with their embedded JPEGs as WebP (EXT_texture_webp, which three's
//    GLTFLoader reads), ARM planes at 512 px.
//    `--force` re-encodes every phone copy (after changing the settings above).
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
  const { json, views, size } = readGlb(path);
  let changed = false;
  for (const img of json.images ?? []) {
    if (img.mimeType !== 'image/jpeg' || img.bufferView === undefined) continue;
    const out = squeeze(views[img.bufferView], img.name ?? '');
    if (out && out.length < views[img.bufferView].length) { views[img.bufferView] = out; changed = true; }
  }
  if (!changed) return 0;
  return size - writeGlb(path, json, views);
}

function readGlb(path) {
  const b = readFileSync(path);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path}: not a GLB`);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  const bin = b.subarray(binStart, binStart + b.readUInt32LE(20 + jsonLen));
  const views = json.bufferViews.map((v) => bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
  return { json, views, size: b.length };
}

/** Write a GLB whose bufferViews are `views`, re-packed 4-byte aligned in order. Returns the file size. */
function writeGlb(path, json, views) {
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
  return total;
}

// ── 3. .phone.webp siblings ──
const force = process.argv.includes('--force');
const PHONE_MAX = 1024, ARM_MAX = 512;
/** AO / roughness / metalness planes: low-frequency, the phone gets them at half resolution */
const isArm = (p) => /(^|[_/-])(arm|rough|roughness|metal|metallic)([_.-]|$)/i.test(p.split('/').pop() ?? p);
/**
 * [file the other tiers download, best source to encode from, max px] for every image the phone fetches: baked planes (cards, fur, clouds, planet),
 * the twig atlas, every Poly Haven set (encoded from the ORIGINAL map, not the q82 _1k copy — one lossy pass, not
 * two) and the glTF props' textures (through the loaders' URL modifier, src/boot/bytes.ts).
 */
function phoneJobs() {
  const jobs = [];
  const walk = (dir) => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(png|jpg)$/.test(n) && !n.includes('.phone.')) jobs.push([p, p, PHONE_MAX]); } };
  walk('public/assets/baked');
  for (const id of readdirSync(ROOT)) {
    const d = join(ROOT, id);
    if (!statSync(d).isDirectory()) continue;
    for (const n of readdirSync(d)) if (/^twig_(rgba|nor_gl|arm)\.(png|jpg)$/.test(n)) jobs.push([join(d, n), join(d, n), PHONE_MAX]);
    for (const kind of ['diffuse', 'nor_gl', 'arm']) {
      const src = join(d, `${kind}.jpg`);
      if (!existsSync(src)) continue;
      const served = existsSync(join(d, `${kind}_1k.jpg`)) ? join(d, `${kind}_1k.jpg`) : src; // what texUrl() names
      jobs.push([served, src, kind === 'arm' ? ARM_MAX : PHONE_MAX]);
    }
  }
  for (const id of readdirSync(MODELS)) {
    const t = join(MODELS, id, 'textures');
    if (existsSync(t)) for (const n of readdirSync(t)) if (n.endsWith('.jpg') && !n.includes('.phone.')) jobs.push([join(t, n), join(t, n), isArm(n) ? ARM_MAX : PHONE_MAX]);
  }
  return jobs;
}
function phoneName(p) { return p.replace(/\.(png|jpg)$/, '.phone.webp'); }

/** WebP of `src` (a file or a JPEG buffer) capped at `max` px. PNG alpha stays lossless; RGB under it is kept (-exact). */
function webp(src, max, out) {
  const tmp = `${out}.tmp.png`;
  const input = Buffer.isBuffer(src) ? ['jpg:-'] : [src];
  const [w, h] = execFileSync('magick', ['identify', '-format', '%w %h', ...input], Buffer.isBuffer(src) ? { input: src } : {}).toString().trim().split(' ').map(Number);
  const resize = Math.max(w, h) > max ? ['-separate', '-resize', `${max}x${max}`, '-combine'] : []; // per channel: the default alpha-weighted resize blackens the RGB under transparent texels
  execFileSync('magick', [...input, ...resize, '-strip', tmp], Buffer.isBuffer(src) ? { input: src } : {});
  execFileSync('cwebp', ['-quiet', '-q', '75', '-sharp_yuv', '-alpha_q', '100', '-exact', '-m', '6', tmp, '-o', out]);
  rmSync(tmp);
}

let phoneMade = 0, phoneKept = 0, phoneSkipped = 0;
const want = new Set();
for (const [served, src, max] of phoneJobs()) {
  const out = phoneName(served);
  if (!force && fresh(out, src)) { phoneKept++; want.add(out); continue; }
  webp(src, max, out);
  // not worth a second file unless it is ≥ 15 % smaller than what the desktop tier downloads
  if (statSync(out).size > statSync(served).size * 0.85) { rmSync(out); phoneSkipped++; continue; }
  want.add(out); phoneMade++;
}

// ── 4. <id>_lod.phone.glb: the props' embedded JPEGs as WebP (EXT_texture_webp), ARM planes at half resolution ──
for (const id of readdirSync(MODELS)) {
  const glb = join(MODELS, id, `${id}_lod.glb`), out = join(MODELS, id, `${id}_lod.phone.glb`);
  if (!existsSync(glb)) continue;
  want.add(out);
  if (!force && fresh(out, glb)) { phoneKept++; continue; }
  const { json, views } = readGlb(glb);
  const tmp = `${out}.img.webp`;
  (json.images ?? []).forEach((img, i) => {
    if (img.mimeType !== 'image/jpeg' || img.bufferView === undefined) return;
    webp(views[img.bufferView], isArm(img.name ?? '') ? ARM_MAX : PHONE_MAX, tmp);
    views[img.bufferView] = readFileSync(tmp); rmSync(tmp);
    img.mimeType = 'image/webp';
    for (const t of json.textures ?? []) if (t.source === i) { t.extensions = { ...t.extensions, EXT_texture_webp: { source: i } }; delete t.source; }
  });
  for (const k of ['extensionsUsed', 'extensionsRequired']) json[k] = [...new Set([...(json[k] ?? []), 'EXT_texture_webp'])];
  writeGlb(out, json, views);
  phoneMade++;
}
// stale phone copies (a source that went away, or a sibling that stopped paying for itself)
const sweep = (dir) => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) sweep(p); else if (n.includes('.phone.') && !want.has(p)) { rmSync(p); phoneSkipped++; } } };
sweep('public/assets');
console.log(`tex-tiers: ${made} _1k written, ${kept} up to date · ${squeezed} model files squeezed (−${(saved / 1048576).toFixed(1)} MB) · ${phoneMade} phone copies written, ${phoneKept} up to date, ${phoneSkipped} dropped`);
