#!/usr/bin/env node
// creature-rig-bake.mjs — bakes a shard's skinned creature GLBs: each generated hull (a static image-to-3D mesh) skinned to
// its species' procedural skeleton by src/entities/creatureRigBake.ts, written as <hull>[.phone].rigged.glb — one mesh,
// the hull's own textures (base colour + normal map, the source's image bytes untouched), a glTF skin whose joints are
// the species' bones by name and in the species' order (JOINTS_0 = the AnimalFactory skeleton's indices), bound at the
// rest pose (inverse binds = −bone position). Shard-agnostic copy of Nalati's scripts/nalati-rig-bake.mjs (A1 step 5):
// the jobs, the source folder and the output folder come from the chunk's table below.
// Pine Hollow's are loaded by src/entities/pineCreatures.ts (PINE-HOLLOW-REMASTER PH-M1).
//
//   node scripts/creature-rig-bake.mjs --chunk=pine-hollow                 # every hull, desktop + phone
//   node scripts/creature-rig-bake.mjs --chunk=pine-hollow --only=boar     # one hull
//   --url=http://127.0.0.1:5176  (a vite dev server: the page imports /src/entities/creatureRigBake.ts; it runs with
//   ?creatures=proc so the factory hands out the procedural models)   --tiers=desktop
// One headless Chromium on Metal (--mute-audio), closed at the end.
import { realpathSync, statSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5176');
const CHUNK = flag('chunk', 'pine-hollow');
const only = flag('only', '').split(',').filter(Boolean);
const TIERS = flag('tiers', 'desktop,phone').split(',').filter(Boolean);

/**
 * Per chunk: `src` (the rig-ready hulls, <hull>[.phone].glb — never loaded by the game), `out` (the rigged GLBs the game
 * loads) and the jobs: every hull, the (kind, variant) whose skeleton it is bound to (every variant of a species shares
 * its bones by name — the game checks them before it uses a bake), the phone's triangle budget and the bake's hints
 * (RigBakeOptions). Tuned by watching scripts/creature-strip.mjs (a frame strip of every gait), not one pose.
 */
export const CHUNKS = {
  'pine-hollow': {
    src: 'art/pine-hollow/round-9-creature-refs',
    out: 'public/assets/pine-hollow/creatures',
    jobs: [
      // sources (art/pine-hollow/round-9-creature-refs/README.md): the hind is TRELLIS.2; the rest Hunyuan3D-2 full + paint
      // (TRELLIS's Mac port leaves the shaggy coats — manes, the boar's bristles, the bears — as open, holed shells)
      // phone budgets at or under the procedural animal's own (hind 2.8 k, stag 5.2 k, boar 2.9 k, cow 3.0 k, bull 5.6 k,
      // bear 5.7 k tris): the herds' phone triangles don't grow
      { hull: 'deer-hind', kind: 'deer', variant: 'hind', phoneTris: 3000, opts: {} },
      { hull: 'deer-stag', kind: 'deer', variant: 'stag', phoneTris: 4000, opts: {} },
      { hull: 'boar', kind: 'boar', variant: 'boar', phoneTris: 2800, opts: {} },
      { hull: 'elk-cow', kind: 'elk', variant: 'cow', phoneTris: 3000, opts: {} },
      { hull: 'elk-bull', kind: 'elk', variant: 'bull', phoneTris: 4500, opts: {} },
      // the bears stand square in their references: no stance to un-pose (the measured one turned the thick legs 40-70°);
      // the black bear's leg columns merge in the length fit, so one scale
      { hull: 'bear-black', kind: 'bear', variant: 'black', phoneTris: 4500, opts: { unpose: false, fit: 'uniform' } },
      { hull: 'bear-brown', kind: 'bear', variant: 'brown', phoneTris: 4500, opts: { unpose: false } },
      // PH-M3 the Antler King, the Bark Warden: his own hull on the elk's bones (the fight draws him ×2.6, antlerKing.ts);
      // bound to the bull's skeleton (the King's species is the elk re-registered, the same bones by name)
      { hull: 'antler-king', kind: 'elk', variant: 'bull', phoneTris: 14000, opts: {} },
    ],
  },
};
const CFG = CHUNKS[CHUNK];
if (!CFG) throw new Error(`creature-rig-bake: no table for chunk '${CHUNK}' (have ${Object.keys(CHUNKS).join(', ')})`);
const OUT = resolvePath(ROOT, CFG.out);
mkdirSync(OUT, { recursive: true });
// --opts='{"boar":{"seedR":0.06}}': override a hull's hints for a try (the table stays the source of truth)
const OVERRIDE = JSON.parse(flag('opts', '{}'));

// gltf-transform (core + functions are in this repo; the extensions + meshoptimizer ride along with the cli)
const cliAbs = realpathSync(resolvePath(ROOT, 'node_modules/@gltf-transform/cli'));
const req = createRequire(pathToFileURL(resolvePath(cliAbs, 'package.json')).href);
const { NodeIO, Document } = await import(pathToFileURL(req.resolve('@gltf-transform/core')).href);
const { ALL_EXTENSIONS, EXTMeshoptCompression } = await import(pathToFileURL(req.resolve('@gltf-transform/extensions')).href);
const { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } = await import(pathToFileURL(req.resolve('meshoptimizer')).href);
const { weld, simplify } = await import(pathToFileURL(req.resolve('@gltf-transform/functions')).href);
await MeshoptDecoder.ready; await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const b64 = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT); };
// --src=<dir>: take the hulls from elsewhere (a trial; the table's `src` is what ships)
const SRC = flag('src', '') === '' ? resolvePath(ROOT, CFG.src) : flag('src', '');
const sourceOf = (job, suffix) => resolvePath(SRC, `${job.hull}${suffix}.glb`);

/** the hull's bytes; on the phone a job's `phoneTris` simplifies it first (meshoptimizer, the uv seams kept) */
async function sourceBytes(job, file, tier) {
  if (tier !== 'phone' || !job.phoneTris) return readFileSync(file);
  const doc = await io.read(file);
  const prim = doc.getRoot().listMeshes()[0]?.listPrimitives()[0];
  const tris = prim ? (prim.getIndices()?.getCount() ?? 0) / 3 : 0;
  if (tris <= job.phoneTris) return readFileSync(file);
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: job.phoneTris / tris, error: 0.02 }));
  const after = (doc.getRoot().listMeshes()[0]?.listPrimitives()[0]?.getIndices()?.getCount() ?? 0) / 3;
  console.log(`  ${job.hull} phone: ${tris} -> ${after} tris`);
  return Buffer.from(await io.writeBinary(doc));
}

/** write <hull><suffix>.rigged.glb from the bake + the source GLB's textures */
async function writeRigged(job, suffix, bake) {
  const src = await io.read(sourceOf(job, suffix));
  const srcMat = src.getRoot().listMaterials()[0] ?? null;
  const srcBase = srcMat?.getBaseColorTexture() ?? src.getRoot().listTextures()[0] ?? null;
  const srcNormal = srcMat?.getNormalTexture() ?? null;
  const doc = new Document();
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  if ([srcBase, srcNormal].some((t) => t?.getMimeType() === 'image/webp')) doc.createExtension(ALL_EXTENSIONS.find((E) => E.EXTENSION_NAME === 'EXT_texture_webp')).setRequired(true);
  const buf = doc.createBuffer();
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
  const pos = b64(bake.position, Float32Array), nrm = b64(bake.normal, Float32Array);
  const ji = b64(bake.skinIndex, Uint16Array), wt = b64(bake.skinWeight, Float32Array);
  const n = pos.length / 3;
  const joints = new Uint8Array(n * 4);
  for (let i = 0; i < n * 4; i++) joints[i] = ji[i];
  const index = n > 65535 ? b64(bake.index, Uint32Array) : Uint16Array.from(b64(bake.index, Uint32Array));
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc('VEC3', pos)).setAttribute('NORMAL', acc('VEC3', nrm))
    .setAttribute('JOINTS_0', acc('VEC4', joints)).setAttribute('WEIGHTS_0', acc('VEC4', wt)).setIndices(acc('SCALAR', index));
  if (bake.uv) prim.setAttribute('TEXCOORD_0', acc('VEC2', b64(bake.uv, Float32Array)));
  const mat = doc.createMaterial(`${job.hull}-coat`).setMetallicFactor(0).setRoughnessFactor(srcMat?.getRoughnessFactor() ?? 0.85);
  const copyTex = (t) => doc.createTexture(t.getName()).setImage(t.getImage()).setMimeType(t.getMimeType());
  if (srcBase) mat.setBaseColorTexture(copyTex(srcBase));
  if (srcNormal) mat.setNormalTexture(copyTex(srcNormal));
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
  doc.getRoot().getAsset().generator = 'wildshard scripts/creature-rig-bake.mjs';
  doc.getRoot().getAsset().extras = { rigBake: { chunk: CHUNK, kind: job.kind, variant: job.variant, report: bake.report } };
  const out = resolvePath(OUT, `${job.hull}${suffix}.rigged.glb`);
  await io.write(out, doc);
  return { out, bytes: statSync(out).size, verts: n, tris: index.length / 3 };
}

const { chromium } = await import('playwright');
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const tier of TIERS) {
    const ctx = await browser.newContext({ viewport: { width: 480, height: 320 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('  pageerror', e.message.slice(0, 200)));
    const q = [`chunk=${CHUNK}`, 'mute=1', 'nolock=1', 'skipintro=1', 'perf=0', `tier=${tier}`, 'creatures=proc'].join('&');
    await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world?.animals), undefined, { timeout: 300000, polling: 1000 });
    for (const job0 of CFG.jobs.filter((j) => only.length === 0 || only.includes(j.hull))) {
      const job = { ...job0, opts: { ...job0.opts, ...OVERRIDE[job0.hull] } };
      const suffix = tier === 'phone' ? '.phone' : '';
      const bake = await page.evaluate(async (j) => {
        const { bakeCreatureRig } = await import('/src/entities/creatureRigBake.ts');
        const { THREE, GLTFLoader, MeshoptDecoder: MD } = await import('/src/dev/threeKit.ts');
        // the hull, from the bytes handed in (float geometry, the node transforms applied)
        const bin = Uint8Array.from(atob(j.srcB64), (c) => c.codePointAt(0) ?? 0).buffer;
        const loader = new GLTFLoader(); loader.setMeshoptDecoder(MD);
        const gltf = await loader.parseAsync(bin, '');
        gltf.scene.updateMatrixWorld(true);
        const meshes = []; gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
        const src = meshes[0].geometry, hull = new THREE.BufferGeometry();
        for (const k of ['position', 'normal', 'uv']) {
          if (!src.hasAttribute(k)) continue;
          const a = src.getAttribute(k), out = new Float32Array(a.count * a.itemSize);
          for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c);
          hull.setAttribute(k, new THREE.BufferAttribute(out, a.itemSize));
        }
        if (src.getIndex()) hull.setIndex(Array.from(src.getIndex().array));
        hull.applyMatrix4(meshes[0].matrixWorld);
        const model = window.__world.animals.factory.model(j.kind, j.variant);
        const r = bakeCreatureRig(model.geometry, hull, model.bones, j.opts);
        const g = r.geometry;
        const enc = (ta) => { const u = new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCodePoint(...u.subarray(i, i + 0x8000)); return btoa(s); };
        const f32 = (name) => Float32Array.from(g.getAttribute(name).array);
        const idx = g.getIndex();
        return {
          position: enc(f32('position')), normal: enc(f32('normal')), uv: g.hasAttribute('uv') ? enc(f32('uv')) : null,
          skinIndex: enc(Uint16Array.from(g.getAttribute('skinIndex').array)), skinWeight: enc(f32('skinWeight')),
          index: enc(Uint32Array.from(idx ? idx.array : Array.from({ length: g.getAttribute('position').count }, (_, i) => i))),
          bones: r.bones, report: r.report,
        };
      }, { ...job, srcB64: (await sourceBytes(job, sourceOf(job, suffix), tier)).toString('base64') });
      const w = await writeRigged(job, suffix, bake);
      console.log(`${job.hull} ${tier}: ${w.tris} tris, ${w.verts} verts, ${(w.bytes / 1024).toFixed(0)} KB → ${w.out.slice(ROOT.length + 1)}  legs ${JSON.stringify(bake.report.legs)} head ${bake.report.headDeg}° fit ${JSON.stringify(bake.report.fit)} unreached ${bake.report.unreached}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
