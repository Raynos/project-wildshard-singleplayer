#!/usr/bin/env node
// nalati-faces-decode.mjs — a game GLB (meshopt, WebP) → a plain GLB Blender's importer reads (no meshopt, PNG textures).
// NALATI-FINISH B5 / E302: scripts/img2mesh/face_remaster.py works on the shipped camp-people files (the colour-matched
// ones), which are meshopt-compressed.
//
//   node scripts/nalati-faces-decode.mjs <in.glb> <out.glb>
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { resolve as resolvePath, join } from 'node:path';

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const req = createRequire(realpathSync(join(ROOT, 'node_modules/@gltf-transform/cli/package.json')));
const { NodeIO } = req('@gltf-transform/core');
const { ALL_EXTENSIONS } = req('@gltf-transform/extensions');
const { MeshoptDecoder } = req('meshoptimizer');
const sharp = req('sharp');

const [inp, out] = process.argv.slice(2);
if (!inp || !out) { console.error('usage: nalati-faces-decode.mjs <in.glb> <out.glb>'); process.exit(2); }
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(inp);
for (const ext of doc.getRoot().listExtensionsUsed()) {
  const n = ext.extensionName;
  if (n === 'EXT_meshopt_compression' || n === 'EXT_texture_webp') ext.dispose();
}
for (const tex of doc.getRoot().listTextures()) {
  const img = tex.getImage();
  if (!img) continue;
  if (tex.getMimeType() !== 'image/png') {
    tex.setImage(new Uint8Array(await sharp(Buffer.from(img)).png().toBuffer())).setMimeType('image/png');
  }
}
await io.write(out, doc);
console.log(`[decode] ${inp} -> ${out}`);
