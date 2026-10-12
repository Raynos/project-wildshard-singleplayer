#!/usr/bin/env node
// G342: bake one shard's near placeholder (public/assets/baked/<slug>/near.glb + near.json). Its drawn static world is
// built in Node from the shard's own authored world through the bake world host, as the physics bakes build it (no
// browser, no game page), harvested as prototypes with their placed copies, reduced by the SDK producer
// (`@wildshard/sdk/bake/nearPlaceholder`) to a low-LOD budget, and merged over its terrain at L1 density (17 × 17 per
// 125 m region) in its own far look: one draw, regions in TEXCOORD_0.x, no colliders.
// node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/bake/near-placeholder.mjs <slug> [--report]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { installBakeEnvironment } from './environment.mjs';
import { visitAuthoredWorld } from './worldHost.mjs';

const [slug] = process.argv.slice(2);
if (slug === undefined) throw new Error('usage: near-placeholder.mjs <slug> [--report]');
const report = process.argv.includes('--report');
const root = resolve(import.meta.dirname, '../..');
const at = path => import(pathToFileURL(resolve(root, path)).href);
const environment = installBakeEnvironment(root);
const element = () => Object.assign(environment.element(), { prepend: () => undefined, replaceChildren: () => undefined, contains: () => false, blur: () => undefined });
Object.defineProperty(document, 'createElement', { value: element, configurable: true });
Object.defineProperty(document, 'createElementNS', { value: (_ns, tag) => element(tag), configurable: true });
const noop = () => undefined;
const THREE = await import('three');
const sky = new Proxy({ setupMaterial: noop, csm: { lights: [new THREE.DirectionalLight()], update: noop },
  hemi: new THREE.HemisphereLight(), sunDisc: new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshBasicMaterial()),
  planet: new THREE.Group(), clouds: null, dayNight: { dusk: 0, night: 0 }, viewCamera: new THREE.PerspectiveCamera(), sunDir: new THREE.Vector3(0, 1, 0) },
{ get: (target, key) => key in target ? target[key] : typeof key === 'string' && key.endsWith('Color')
  ? new THREE.Color(1, 1, 1) : typeof key === 'string' && key.endsWith('Dir') ? new THREE.Vector3(0, 1, 0) : undefined });
(await at('src/engine/core/tier.ts')).initializeTier('phone');
const { default: manifest } = await at(`src/shards/${slug}/manifest.ts`);
(await at('src/game/shard/list.ts')).installShards([manifest]);
(await at('src/game/shard/registry.ts')).setActiveChunk(manifest.slug);
const { Terrain, terrainChunkGeometry } = await at('src/engine/world/Terrain.ts');
const terrainBin = resolve(root, 'public/assets/baked', slug, 'terrain.bin');
const nativeTerrain = slug === 'driftwood-isle' ? (await at('src/shards/driftwood-isle/generators/groundRows.ts')).driftwoodGroundBytes() : readFileSync(terrainBin);

/** Weathered wood (linear RGB): the stand-in for a colour map or a texture-only material Node does not decode. */
const WOOD = new THREE.Color(0.3, 0.21, 0.13);
/** A drawn thing's colour: its material colour times the mean of its colour map when the host decoded one. */
const colourOf = (material) => {
  const m = Array.isArray(material) ? material[0] : material;
  const c = m?.color instanceof THREE.Color ? m.color.clone() : new THREE.Color(0.6, 0.6, 0.6);
  const img = m?.map?.image;
  if (img?.data !== undefined && img.width > 0) {
    let r = 0, g = 0, b = 0, n = 0; const d = img.data, stride = Math.max(4, Math.floor(d.length / 4 / 4096) * 4);
    for (let i = 0; i + 3 < d.length; i += stride) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    if (n > 0) c.multiply(new THREE.Color(r / n / 255, g / n / 255, b / n / 255).convertSRGBToLinear());
  } else if (m?.map !== null && m?.map !== undefined) c.multiply(WOOD); // a colour map Node did not decode: the weathered wood most props are
  return c;
};

const parts = [], rows = [];
// a pure shardfile project has no authored plugin to build: its near placeholder is its terrain alone
if (typeof manifest.load === 'function') await visitAuthoredWorld(manifest, { root, sky, element: environment.element, tier: 'phone', nativeTerrain, collectLate: true,
  createTerrain: async () => {
    const field = await at('src/engine/world/Heightfield.ts');
    const terrain = new Terrain(); terrain.mesh = new THREE.Mesh(terrainChunkGeometry(field), new THREE.MeshBasicMaterial()); terrain.mesh.name = 'near-harvest-terrain';
    return terrain;
  },
  visit: ({ scene, camera, late }) => {
    // pose the view over the whole cell from a neighbour's distance, so view-dependent repacks keep their far copies
    camera.fov = 100; camera.near = 1; camera.far = 6000; camera.position.set(0, 650, 1); camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); scene.updateMatrixWorld(true);
    for (let pass = 0; pass < 3; pass++) for (const fn of late) fn(1 / 30);
    scene.updateMatrixWorld(true);
    const m = new THREE.Matrix4(), v = new THREE.Vector3();
    scene.traverse((node) => {
      if (!node.isMesh || node.isSkinnedMesh || node.name === 'near-harvest-terrain' || !node.visible) return;
      let hidden = false; for (let p = node.parent; p !== null; p = p.parent) if (!p.visible) hidden = true;
      if (hidden) return;
      const geometry = node.geometry, position = geometry?.getAttribute('position');
      if (position === undefined || position.itemSize !== 3) return;
      const material = Array.isArray(node.material) ? node.material[0] : node.material;
      if (material === undefined || material.transparent === true && material.opacity < 0.5 || material.visible === false) return;
      const count = node.isInstancedMesh ? node.count : 1, index = geometry.index;
      const tri = index === null ? position.count / 3 : index.count / 3;
      const colour = colourOf(node.material), vc = geometry.getAttribute('color');
      const base = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) base.set([position.getX(i), position.getY(i), position.getZ(i)], i * 3);
      const colours = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) {
        const k = vc !== undefined && vc.itemSize >= 3 ? [vc.getX(i), vc.getY(i), vc.getZ(i)] : [1, 1, 1];
        colours.set([colour.r * k[0], colour.g * k[1], colour.b * k[2]], i * 3);
      }
      const idx = index === null ? Uint32Array.from({ length: position.count }, (_, i) => i) : Uint32Array.from(index.array);
      const transforms = [];
      for (let k = 0; k < count; k++) {
        if (node.isInstancedMesh) { node.getMatrixAt(k, m); m.premultiply(node.matrixWorld); } else m.copy(node.matrixWorld);
        transforms.push(Array.from(m.elements));
      }
      v.setFromMatrixPosition(m);
      const label = node.name.length > 0 ? node.name : node.parent?.name ?? '?';
      rows.push({ name: label, instanced: node.isInstancedMesh === true, count, tri, total: tri * count, colour: colour.toArray().map(x => Number(x.toFixed(2))), map: material.map !== null && material.map !== undefined });
      parts.push({ name: label, positions: base, colours, index: idx, transforms });
    });
  },
});
rows.sort((a, b) => b.total - a.total);
if (report) for (const r of rows.slice(0, 40)) console.log(JSON.stringify(r));
console.log(`${slug}: harvested ${rows.length} meshes, ${rows.reduce((sum, r) => sum + r.total, 0)} triangles`);

// the terrain and its water come from the far look's lattice; harvested ground, sea and sky meshes stay out
const SKIP = /terrain|seabed|ocean|water|\bsea\b|sky|cloud|horizon|backdrop|shadow|decal|fog|haze|sun|moon|star|grass-blades|splat/iu;
const mean = (c) => { let r = 0, g = 0, b = 0; const n = c.length / 3; for (let i = 0; i < c.length; i += 3) { r += c[i]; g += c[i + 1]; b += c[i + 2]; } return [r / n, g / n, b / n]; };
const box = (p) => {
  const mm = new THREE.Matrix4().fromArray(p.transforms[0]), v = new THREE.Vector3(), b = new THREE.Box3();
  for (let i = 0; i < p.positions.length; i += 3) b.expandByPoint(v.set(p.positions[i], p.positions[i + 1], p.positions[i + 2]).applyMatrix4(mm));
  return `[${b.min.toArray().map(x => x.toFixed(0))}]..[${b.max.toArray().map(x => x.toFixed(0))}]`;
};
const prototypes = parts.filter((p) => {
  const [r, g, b] = mean(p.colours), white = r > 0.97 && g > 0.97 && b > 0.97;
  // a texture-only white mesh (Pine's cabins) is painted wood; a white sheet as wide as the world is a sea or sky plane
  const giant = white && p.positions.length > 0 && (() => { let lo = Infinity, hi = -Infinity; for (let i = 0; i < p.positions.length; i += 3) { lo = Math.min(lo, p.positions[i]); hi = Math.max(hi, p.positions[i]); } return hi - lo > 400; })();
  if (white && !giant) for (let i = 0; i < p.colours.length; i += 3) { p.colours[i] *= WOOD.r; p.colours[i + 1] *= WOOD.g; p.colours[i + 2] *= WOOD.b; }
  const skip = SKIP.test(p.name) ? 'name' : giant ? 'white' : (r > 2 || g > 2 || b > 2) ? 'glow' : null;
  if (skip !== null && report && p.transforms.length > 0) console.log(`  skip ${p.name} (${skip}) ${p.index.length / 3} tris x ${p.transforms.length} ${box(p)}`);
  return skip === null; // ground / sea / sky come from the lattice; an unlit white or an emissive glow is not paint
});
const { FAR_LOOKS, FAR_GRIDS, FAR_SHARDFILE_TERRAIN, farGrid, shardfileGrid } = await at('scripts/bake/farProxiesSource.ts');
const { NEAR_BAKE } = await at('src/game/grid/nearPlaceholderView.ts');
const { nearPlaceholderParts } = await at('src/sdk/bake/nearPlaceholder.ts');
const { buildFarProxy } = await at('src/game/grid/farProxy.ts');
const { farProxyGeometry } = await at('src/game/grid/farView.ts');
const { staticGlb } = await at('src/sdk/bake/glb.ts');
const { parseGlb } = await at('src/sdk/assets.ts');
const { canonicalJson, contentHash } = await at('src/sdk/project.ts');
const look = FAR_LOOKS[slug];
if (look === undefined) throw new Error(`${slug}: no far look`);
const grid = FAR_GRIDS[slug]?.() ?? (FAR_SHARDFILE_TERRAIN.includes(slug) ? shardfileGrid(root, slug) : farGrid(root, slug));
const nearLook = { ...look, quads: NEAR_BAKE.quads }; // its canopy lift still stands for the forest it cannot draw tree by tree
// the content budget steps down until the whole cell fits its resident ceiling (many single copies weld fewer vertices)
let budget = NEAR_BAKE.contentTriangles, baked;
for (;;) {
  const { parts: near, report: reduced } = await nearPlaceholderParts(prototypes, { triangles: budget, half: 250 });
  const geometry = farProxyGeometry(buildFarProxy(grid, nearLook, near, NEAR_BAKE.triangles));
  const bytes = staticGlb([{ geometry, material: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true }), castShadow: false }], 'near-placeholder');
  const file = { hash: contentHash(bytes), kind: 'glb', compressed: bytes.length, ...parseGlb(bytes), dependencies: [], critical: false };
  if (file.decoded + file.gpu <= NEAR_BAKE.residentBytes) { baked = { bytes, file, reduced }; break; }
  if (budget < 4000) throw new Error(`${slug}: near placeholder terrain alone exceeds ${NEAR_BAKE.residentBytes} B`);
  budget = Math.floor(budget * 0.9);
}
const { bytes, file, reduced } = baked, resident = file.decoded + file.gpu;
if (report) { for (const k of reduced.kept) console.log(`  keep ${k.name}: ${k.copies} x ${k.triangles}/${k.source}`); for (const d of reduced.dropped) console.log(`  drop ${d.name}: ${d.why}`); }
const row = { near: { files: [file.hash], compressed: file.compressed, decoded: file.decoded, gpu: file.gpu, triangles: file.triangles, draws: file.draws, content: reduced.triangles },
  file, look: { family: look.family, haze: look.haze, ...(look.grade === undefined ? {} : { grade: look.grade }) } };
const dir = resolve(root, 'public/assets/baked', slug);
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'near.glb'), bytes); writeFileSync(resolve(dir, 'near.json'), canonicalJson(row));
console.log(`${slug.padEnd(18)} near resident ${(resident / 1e6).toFixed(3)} MB  wire ${(file.compressed / 1e3).toFixed(0)} KB  ${file.triangles} tris (${reduced.triangles} content)  ${file.draws} draw`);
process.exit(0);
