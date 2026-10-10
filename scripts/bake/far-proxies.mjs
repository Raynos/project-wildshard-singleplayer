#!/usr/bin/env node
// SHARD-PLATFORM SF23: deterministically regenerate every grid shard's far proxy (public/assets/baked/<slug>/far.glb +
// far.json) from its baked terrain and its look/far.ts; prints each proxy's resident MB, wire KB and triangles.
// SF49: a shard whose land is models (Sky Reach's floating islands) merges them in decimated; this runner hands it the
// model tools (a GLB reader that samples the base colour per vertex, and meshoptimizer's simplifier).
import { build } from 'vite';
import { mkdtempSync, rmSync, symlinkSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = resolve(import.meta.dirname, '../..'), scratch = mkdtempSync(join(tmpdir(), 'far-proxies-'));
// sharp comes with the glTF CLI (resolved through it, as scripts/nalati-models-color.mjs does)
const req = createRequire(realpathSync(join(repo, 'node_modules/@gltf-transform/cli/package.json')));
const { NodeIO } = req('@gltf-transform/core'), { ALL_EXTENSIONS } = req('@gltf-transform/extensions'), { MeshoptDecoder, MeshoptSimplifier } = req('meshoptimizer'), sharp = req('sharp');
await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** The base colour texture area-averaged down to SAMPLE² (a far vertex stands for metres of paint), sampled bilinearly. */
const SAMPLE = 96;
async function texture(material) {
  const tex = material?.getBaseColorTexture(), image = tex?.getImage();
  if (image === null || image === undefined) return null;
  const { data } = await sharp(Buffer.from(image)).resize(SAMPLE, SAMPLE, { fit: 'fill', kernel: 'cubic' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return (u, v) => {
    const x = Math.min(SAMPLE - 1.001, Math.max(0, (((u % 1) + 1) % 1) * SAMPLE - 0.5)), y = Math.min(SAMPLE - 1.001, Math.max(0, (((v % 1) + 1) % 1) * SAMPLE - 0.5));
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, at = (i, j, c) => data[((iy + j) * SAMPLE + ix + i) * 3 + c] / 255;
    return [0, 1, 2].map((c) => linear((at(0, 0, c) * (1 - fx) + at(1, 0, c) * fx) * (1 - fy) + (at(0, 1, c) * (1 - fx) + at(1, 1, c) * fx) * fy));
  };
}
/** Every primitive of a GLB in world space, welded by position (seams averaged), colour per vertex. */
async function model(path) {
  const doc = await io.read(join(repo, path)), pos = [], col = [], idx = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (mesh === null) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const p = prim.getAttribute('POSITION'), uv = prim.getAttribute('TEXCOORD_0'), index = prim.getIndices(), material = prim.getMaterial();
      const sample = uv === null ? null : await texture(material), factor = material?.getBaseColorFactor() ?? [1, 1, 1, 1], base = pos.length / 3, e = [0, 0, 0], t = [0, 0];
      for (let i = 0; i < p.getCount(); i++) {
        p.getElement(i, e);
        pos.push(m[0] * e[0] + m[4] * e[1] + m[8] * e[2] + m[12], m[1] * e[0] + m[5] * e[1] + m[9] * e[2] + m[13], m[2] * e[0] + m[6] * e[1] + m[10] * e[2] + m[14]);
        const c = sample === null ? [1, 1, 1] : (uv.getElement(i, t), sample(t[0], t[1]));
        col.push(c[0] * factor[0], c[1] * factor[1], c[2] * factor[2]);
      }
      const n = index === null ? p.getCount() : index.getCount();
      for (let k = 0; k < n; k++) idx.push(base + (index === null ? k : index.getScalar(k)));
    }
  }
  const positions = new Float32Array(pos), remap = MeshoptSimplifier.generatePositionRemap(positions, 3), first = new Map(), out = [], sum = [], count = [], slot = new Uint32Array(remap.length);
  for (let v = 0; v < remap.length; v++) {
    const r = remap[v]; let s = first.get(r);
    if (s === undefined) { s = out.length / 3; first.set(r, s); out.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); sum.push(0, 0, 0); count.push(0); }
    slot[v] = s; sum[s * 3] += col[v * 3]; sum[s * 3 + 1] += col[v * 3 + 1]; sum[s * 3 + 2] += col[v * 3 + 2]; count[s] += 1;
  }
  const index = new Uint32Array(idx.length); for (let k = 0; k < idx.length; k++) index[k] = slot[idx[k]];
  return { positions: new Float32Array(out), colours: new Float32Array(sum.map((c, i) => c / count[Math.floor(i / 3)])), index };
}
/** meshoptimizer's simplifier toward `triangles` (small loose bits pruned); the sloppy one when topology stops it short. */
function decimate(positions, index, triangles) {
  const target = triangles * 3, [kept] = MeshoptSimplifier.simplify(index, positions, 3, target, 1, ['Prune']);
  return kept.length <= target * 1.15 ? kept : MeshoptSimplifier.simplifySloppy(index, positions, 3, null, target, 1)[0];
}
try {
  symlinkSync(join(repo, 'node_modules'), join(scratch, 'node_modules'));
  // sharp (the bundle reaches it through the SDK's asset tools) stays outside the bundle as the runner's own copy: pnpm
  // does not hoist it to the repo root, so an inlined copy cannot find its platform binary, and one libvips per process
  const sharpUrl = pathToFileURL(req.resolve('sharp')).href;
  await build({ plugins: [{ name: 'external-sharp', enforce: 'pre', resolveId: (id) => (id === 'sharp' ? { id: sharpUrl, external: true } : null) }], configFile: false, logLevel: 'silent', build: { target: 'esnext', outDir: join(scratch, 'generator'), emptyOutDir: true, lib: { entry: join(repo, 'scripts/bake/farProxiesSource.ts'), formats: ['es'], fileName: 'build' }, rolldownOptions: { platform: 'node', external: [/^node:/u, 'vite'] } } });
  const generator = await import(pathToFileURL(join(scratch, 'generator/build.js')).href);
  const manifests = await generator.writeFarProxies(repo, { model, decimate });
  for (const [slug, { far }] of Object.entries(manifests)) console.log(`${slug.padEnd(18)} resident ${((far.decoded + far.gpu) / 1e6).toFixed(3)} MB  wire ${(far.compressed / 1e3).toFixed(0)} KB  ${far.triangles} tris  ${far.draws} draw`);
} finally { rmSync(scratch, { recursive: true, force: true }); }
