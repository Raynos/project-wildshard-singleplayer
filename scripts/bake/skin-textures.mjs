#!/usr/bin/env node
// SF9c playback half: the exported skins' external texture bindings and how each skin draws and loops.
// The ranger's atlas and normal map come out of today's phone hull (public/assets/pine-hollow/npcs/ranger.phone.glb, the
// file Pine Hollow's NpcModels loads), are encoded to mipmapped UASTC KTX2 (sRGB colour, linear normal) with the pinned
// basisu, and are written content-addressed next to the skins. bindings.json gives each skin of skins.json an SF10a
// material family entry (the same numbers today's client material uses) and the clips that loop.
//
//   node scripts/bake/skin-textures.mjs        (after node scripts/bake/skins.mjs)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '../..'), out = join(repo, 'public/assets/baked/skin-fixture');
const glb = readFileSync(join(repo, 'public/assets/pine-hollow/npcs/ranger.phone.glb'));
const jsonLength = glb.readUInt32LE(12), doc = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8')), bin = glb.subarray(28 + jsonLength);
const image = (name) => {
  const entry = doc.images.find((candidate) => candidate.name === name), view = doc.bufferViews[entry?.bufferView ?? -1];
  if (entry === undefined || view === undefined || entry.mimeType !== 'image/webp' || view.extensions !== undefined) throw new Error(`ranger image ${name}`);
  return bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
};
const scratch = mkdtempSync(join(tmpdir(), 'skin-textures-'));
const encode = (name, flags) => {
  const webp = join(scratch, `${name}.webp`), png = join(scratch, `${name}.png`), ktx2 = join(scratch, `${name}.ktx2`);
  writeFileSync(webp, image(name));
  execFileSync('dwebp', [webp, '-o', png], { stdio: 'pipe' });
  execFileSync('basisu', ['-ktx2', '-uastc', '-uastc_level', '2', ...flags, '-mipmap', '-mip_filter', 'box', '-max_threads', '4', '-ktx2_zstandard_level', '20', png, '-output_file', ktx2], { stdio: 'pipe', timeout: 120000 });
  const bytes = readFileSync(ktx2), file = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(join(out, file), bytes);
  return file;
};
try {
  const colour = encode('atlas', ['-srgb']), normal = encode('normal', ['-linear', '-normal_map']);
  const skins = JSON.parse(readFileSync(join(out, 'skins.json'), 'utf8'));
  const loops = (clips) => clips.filter((clip) => /^(idle|walk|run|swim|fly)(\.|$)/u.test(clip));
  // Today's creature surface (lowPolyMaterials().fur): faceted vertex colours, roughness 0.85, environment 0.7.
  // Today's people surface (NpcModels.rig): the atlas and its normal map, roughness 0.85, front faces.
  const material = (row) => row.family === 'pbr'
    ? { family: 'pbr', maps: { colour, normal, orm: null }, roughness: 0.85, metalness: 0, occlusion: 0 }
    : { family: 'pbr', roughness: 0.85, metalness: 0, occlusion: 0, envStrength: 0.7, vertexColours: true };
  const rows = skins.map((row) => ({ skin: row.id, material: material(row), loops: loops(row.rig.clips) }));
  writeFileSync(join(out, 'bindings.json'), `${JSON.stringify(rows)}\n`);
  console.log(JSON.stringify({ colour, normal, bindings: rows.length }));
} finally { rmSync(scratch, { recursive: true, force: true }); }
