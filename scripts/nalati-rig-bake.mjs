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
import { realpathSync, statSync, readFileSync } from 'node:fs';
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
  // Aqbars: the first hull curled its tail round a hind paw and turned its head; this one was re-generated for the rig
  // (art/nalati-grasslands/round-9-rig-hulls/): legs planted apart, the tail trailing on the ground, the head straight
  {
    hull: 'snow-leopard', src: 'art/nalati-grasslands/round-9-rig-hulls/snow-leopard-rig', kind: 'leopard', variant: 'aqbars',
    opts: { fitZMin: -0.3, fit: 'uniform', retarget: true, headYaw: 0, tail: { x: 0.3, z: -0.5, y: 10 }, tailBones: ['tail', 'tail2'] },
  },
  // Qyran: the perched hull can't fly — a new one with the wings spread (art/nalati-grasslands/round-9-rig-hulls/);
  // fitted by its wingspan, each wing turned flat about its shoulder, no legs
  {
    hull: 'eagle', src: 'art/nalati-grasslands/round-9-rig-hulls/eagle-flight', kind: 'eagle', variant: 'qyran',
    opts: { fit: 'box', legs: [], seedR: 0.12, wings: [['wingL1', 'wingL2'], ['wingR1', 'wingR2']] },
  },
  // the camp flock: no species skeleton — the flock shader's parts (species/sheep.ts SHEEP_BONES, one bone per leg);
  // Flock.ts folds the skin back into its aRig
  { hull: 'sheep', kind: 'sheep', flock: true, opts: { legs: [['FL'], ['FR'], ['BL'], ['BR']] } },
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
/** the hull's source GLB: `src` (a repo path without the suffix — the rig-friendly regenerated hulls live with their
 *  references in art/, they are never loaded by the game) or public/assets/nalati/models/<hull> */
function sourceOf(job, suffix) { return job.src ? resolvePath(ROOT, `${job.src}${suffix}.glb`) : resolvePath(MODELS, `${job.hull}${suffix}.glb`); }

async function writeRigged(job, suffix, bake) {
  const srcPath = sourceOf(job, suffix);
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
      const suffix = tier === 'phone' ? '.phone' : '';
      const srcFile = sourceOf(job, suffix);
      const bake = await page.evaluate(async (j) => {
        const { bakeCreatureRig } = await import('/src/entities/creatureRigBake.ts');
        const { THREE, GLTFLoader, MeshoptDecoder: MD } = await import('/src/dev/threeKit.ts');
        // the hull, from the bytes handed in (the same float geometry glbPaint's loader makes)
        const bin = Uint8Array.from(atob(j.srcB64), (c) => c.codePointAt(0) ?? 0).buffer;
        const loader = new GLTFLoader(); loader.setMeshoptDecoder(MD);
        const gltf = await loader.parseAsync(bin, '');
        gltf.scene.updateMatrixWorld(true);
        const meshes = []; gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
        const src = meshes[0].geometry, hull = new THREE.BufferGeometry();
        for (const k of ['position', 'normal', 'uv']) {
          const a = src.getAttribute(k), out = new Float32Array(a.count * a.itemSize);
          for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c);
          hull.setAttribute(k, new THREE.BufferAttribute(out, a.itemSize));
        }
        if (src.getIndex()) hull.setIndex(Array.from(src.getIndex().array));
        hull.applyMatrix4(meshes[0].matrixWorld);
        // the skeleton + its procedural mesh: a species' (the AnimalFactory model), or the sheep flock's parts
        let procGeo, bones;
        if (j.flock) { const sh = await import('/src/entities/species/sheep.ts'); procGeo = sh.sheepSkinnedGeometry(); bones = sh.SHEEP_BONES; }
        else { const model = window.__world.animals.factory.model(j.kind, j.variant); procGeo = model.geometry; bones = model.bones; }
        const r = bakeCreatureRig(procGeo, hull, bones, j.opts);
        const g = r.geometry;
        const enc = (ta) => { const u = new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCodePoint(...u.subarray(i, i + 0x8000)); return btoa(s); };
        const f32 = (name) => Float32Array.from(g.getAttribute(name).array);
        const idx = g.getIndex();
        return {
          position: enc(f32('position')), normal: enc(f32('normal')), uv: enc(f32('uv')),
          skinIndex: enc(Uint16Array.from(g.getAttribute('skinIndex').array)), skinWeight: enc(f32('skinWeight')),
          index: enc(Uint32Array.from(idx ? idx.array : Array.from({ length: g.getAttribute('position').count }, (_, i) => i))),
          bones: r.bones, report: r.report,
        };
      }, { ...job, srcB64: readFileSync(srcFile).toString('base64') });
      const w = await writeRigged(job, suffix, bake);
      console.log(`${job.hull} ${tier}: ${w.verts} verts, ${(w.bytes / 1024).toFixed(0)} KB → ${w.out.slice(ROOT.length + 1)}  legs ${JSON.stringify(bake.report.legs)} head ${bake.report.headDeg}°`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
