#!/usr/bin/env node
// nalati-rig-bake.mjs — bakes the skinned creature GLBs (plan A1 step 5): each generated hull
// (public/assets/nalati/models/<hull>[.phone].glb, a static image-to-3D mesh) skinned to its species' procedural
// skeleton by src/entities/creatureRigBake.ts, written as <hull>[.phone].rigged.glb — one mesh, the hull's own atlas
// (the source's image bytes, untouched), a glTF skin whose joints are the species' bones by name and in the species'
// order (JOINTS_0 = the AnimalFactory skeleton's indices), bound at the rest pose (inverse binds = −bone position).
// The game loads them in src/entities/glbCreatures.ts (?creatures=glb).
//
//   node scripts/nalati-rig-bake.mjs                  # every hull, desktop + phone
//   node scripts/nalati-rig-bake.mjs --only=wolf      # one hull
//   --url=http://127.0.0.1:5192  (a vite on a clean export; the page runs with ?creatures=proc)
// One headless Chromium on Metal (--mute-audio), closed at the end.
import { realpathSync, statSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5192');
const only = flag('only', '').split(',').filter(Boolean);
const MODELS = resolvePath(ROOT, 'public/assets/nalati/models');

/**
 * Every hull, the (kind, variant) whose skeleton it is bound to (all the species' variants share its bones — the
 * game checks the joint names + rest positions before it uses a bake) and the bake's hints (RigBakeOptions).
 * Tuned by watching scripts/nalati-creature-strip.mjs --bake=1 (a frame strip of every gait), not one pose.
 */
export const RIG_BAKES = [
  { hull: 'horse-wild', kind: 'horse', variant: 'dun', opts: { tail: { x: 0.1, z: -0.8 }, legWeights: 'proc' } },
  { hull: 'horse-saddled', kind: 'horse', variant: 'camp-bay', opts: { tail: { x: 0.1, z: -0.8 }, legWeights: 'proc' } },
  { hull: 'wolf', kind: 'wolf', variant: 'grey', opts: {} },
];

// gltf-transform (core + functions are in this repo; the extensions + meshoptimizer ride along with the cli)
const cliAbs = realpathSync(resolvePath(ROOT, 'node_modules/@gltf-transform/cli'));
const req = createRequire(pathToFileURL(resolvePath(cliAbs, 'package.json')).href);
const { NodeIO, Document } = await import(pathToFileURL(req.resolve('@gltf-transform/core')).href);
const { ALL_EXTENSIONS, EXTMeshoptCompression } = await import(pathToFileURL(req.resolve('@gltf-transform/extensions')).href);
const { MeshoptDecoder, MeshoptEncoder } = await import(pathToFileURL(req.resolve('meshoptimizer')).href);
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const b64 = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT); };

/** write <hull><suffix>.rigged.glb from the bake + the source GLB's texture */
async function writeRigged(job, suffix, bake) {
  const srcPath = resolvePath(MODELS, `${job.hull}${suffix}.glb`);
  const src = await io.read(srcPath);
  const srcTex = src.getRoot().listTextures()[0] ?? null;
  const doc = new Document();
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  if (srcTex?.getMimeType() === 'image/webp') doc.createExtension(ALL_EXTENSIONS.find((E) => E.EXTENSION_NAME === 'EXT_texture_webp')).setRequired(true);
  const buf = doc.createBuffer();
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
  const pos = b64(bake.position, Float32Array), nrm = b64(bake.normal, Float32Array), uv = b64(bake.uv, Float32Array);
  const ji = b64(bake.skinIndex, Uint16Array), wt = b64(bake.skinWeight, Float32Array);
  const n = pos.length / 3;
  const joints = new Uint8Array(n * 4);
  for (let i = 0; i < n * 4; i++) joints[i] = ji[i];
  const index = n > 65535 ? b64(bake.index, Uint32Array) : Uint16Array.from(b64(bake.index, Uint32Array));
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc('VEC3', pos)).setAttribute('NORMAL', acc('VEC3', nrm)).setAttribute('TEXCOORD_0', acc('VEC2', uv))
    .setAttribute('JOINTS_0', acc('VEC4', joints)).setAttribute('WEIGHTS_0', acc('VEC4', wt)).setIndices(acc('SCALAR', index));
  const mat = doc.createMaterial(`${job.hull}-coat`).setMetallicFactor(0).setRoughnessFactor(0.85).setDoubleSided(true);
  if (srcTex) {
    const tex = doc.createTexture(srcTex.getName()).setImage(srcTex.getImage()).setMimeType(srcTex.getMimeType());
    mat.setBaseColorTexture(tex);
  }
  prim.setMaterial(mat);
  const mesh = doc.createMesh(`${job.hull}.rigged`).addPrimitive(prim);
  // the skeleton: one node per bone, parented as the species' BoneDefs, translations relative to the parent
  const bones = bake.bones;
  const nodes = new Map();
  for (const bd of bones) {
    const p = bd.parent ? bones.find((x) => x.name === bd.parent) : null;
    const t = p ? [bd.pos[0] - p.pos[0], bd.pos[1] - p.pos[1], bd.pos[2] - p.pos[2]] : bd.pos;
    const node = doc.createNode(bd.name).setTranslation(t);
    nodes.set(bd.name, node);
    if (p) nodes.get(p.name).addChild(node);
  }
  const ibm = new Float32Array(bones.length * 16);
  bones.forEach((bd, i) => { const o = i * 16; ibm[o] = ibm[o + 5] = ibm[o + 10] = ibm[o + 15] = 1; ibm[o + 12] = -bd.pos[0]; ibm[o + 13] = -bd.pos[1]; ibm[o + 14] = -bd.pos[2]; });
  const skin = doc.createSkin(`${job.kind}`).setInverseBindMatrices(acc('MAT4', ibm)).setSkeleton(nodes.get(bones[0].name));
  for (const bd of bones) skin.addJoint(nodes.get(bd.name));
  const meshNode = doc.createNode(`${job.hull}.rigged`).setMesh(mesh).setSkin(skin);
  doc.createScene(job.hull).addChild(nodes.get(bones[0].name)).addChild(meshNode);
  doc.getRoot().getAsset().generator = 'wildshard scripts/nalati-rig-bake.mjs';
  doc.getRoot().getAsset().extras = { rigBake: { kind: job.kind, variant: job.variant, report: bake.report } };
  const out = resolvePath(MODELS, `${job.hull}${suffix}.rigged.glb`);
  await io.write(out, doc);
  return { out, bytes: statSync(out).size, verts: n };
}

const { chromium } = await import('playwright');
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const tier of ['desktop', 'phone']) {
    const ctx = await browser.newContext({ viewport: { width: 480, height: 320 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('  pageerror', e.message.slice(0, 200)));
    const q = ['chunk=nalati-grasslands', 'mute=1', 'nolock=1', 'skipintro=1', 'perf=0', `tier=${tier}`, 'creatures=proc'].join('&');
    await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world?.animals), undefined, { timeout: 300000, polling: 1000 });
    for (const job of RIG_BAKES.filter((j) => only.length === 0 || only.includes(j.hull))) {
      const bake = await page.evaluate(async (j) => {
        const { bakeCreatureRig } = await import('/src/entities/creatureRigBake.ts');
        const { loadModelRaw } = await import('/src/world/nalati/glbPaint.ts');
        const model = window.__world.animals.factory.model(j.kind, j.variant);
        const raw = await loadModelRaw(j.hull);
        const r = bakeCreatureRig(model.geometry, raw.geometry, model.bones, j.opts);
        const g = r.geometry;
        const enc = (ta) => { const u = new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCodePoint(...u.subarray(i, i + 0x8000)); return btoa(s); };
        const f32 = (name) => Float32Array.from(g.getAttribute(name).array);
        const idx = g.getIndex();
        return {
          position: enc(f32('position')), normal: enc(f32('normal')), uv: enc(f32('uv')),
          skinIndex: enc(Uint16Array.from(g.getAttribute('skinIndex').array)), skinWeight: enc(f32('skinWeight')),
          index: enc(Uint32Array.from(idx ? idx.array : Array.from({ length: g.getAttribute('position').count }, (_, i) => i))),
          bones: model.bones, report: r.report,
        };
      }, job);
      const w = await writeRigged(job, tier === 'phone' ? '.phone' : '', bake);
      console.log(`${job.hull} ${tier}: ${w.verts} verts, ${(w.bytes / 1024).toFixed(0)} KB → ${w.out.slice(ROOT.length + 1)}  legs ${JSON.stringify(bake.report.legs)} head ${bake.report.headDeg}°`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
