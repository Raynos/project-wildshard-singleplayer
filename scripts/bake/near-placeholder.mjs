#!/usr/bin/env node
// G342: bake one shard's near placeholder (public/assets/baked/<slug>/near.glb + near.json). Its drawn static world is
// built in Node from the shard's own authored world through the bake world host, as the physics bakes build it (no
// browser, no game page), harvested as prototypes with their placed copies, reduced by the SDK producer
// (`@wildshard/sdk/bake/nearPlaceholder`) to a low-LOD budget, and merged over its terrain at L1 density (17 × 17 per
// 125 m region) in its own far look: one draw, regions in TEXCOORD_0.x, no colliders.
// node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/bake/near-placeholder.mjs <slug> [--report]
//
// G348: why this runner stays beside `wildshard build` (which bakes any shardfile's near row from its own terrain
// collider and its L1 tiles' meshes, `projectPlaceholders`): the first-party hybrids (Driftwood, Nalati, Pine) have no
// world in their shardfiles yet (no terrain, no tiles; `public/shardfiles/<slug>/shard.json`). Their props and forests
// exist only when their TypeScript builders run, so the SDK build has nothing to harvest, and no shardfile input can
// reproduce these bytes (the coarsest built LOD of every placement, Pine's per-tree placements, the colour maps' mean
// texels). Nothing here is per shard (each declares its ground and tree stand-ins in data/placeholder.ts); the grid
// prefers a shardfile's own `near` row and reads this runner's near.json only for a shard whose shardfile has none. It
// retires per shard as each one's world moves into its shardfile tiles.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { installBakeEnvironment } from './environment.mjs';
import { visitAuthoredWorld } from './worldHost.mjs';
import { placeholderGridBytes, placeholderOf } from './placeholderShards.mjs';

const slug = process.argv.slice(2).find(value => !value.startsWith('--'));
if (typeof slug !== 'string') throw new Error('usage: near-placeholder.mjs <slug> [--report] [--ground-error=<m>] [--resident=<bytes>]');
const report = process.argv.includes('--report');
const root = resolve(import.meta.dirname, '../..');
const at = path => import(pathToFileURL(resolve(root, path)).href);
const environment = installBakeEnvironment(root);
// G342: a colour map's mean colour, decoded from its encoded bytes (PNG / JPEG / WebP) by Pillow, so a textured prop keeps
// its own paint (Pine's cabins, Driftwood's huts) instead of a guessed wood tint; the bitmap is that one mean texel
const means = new Map();
const meanTexel = (bytes) => {
  const key = createHash('sha256').update(bytes).digest('hex');
  let rgb = means.get(key);
  if (rgb === undefined) {
    const out = spawnSync('python3', ['-I', '-c', 'import sys, io\nfrom PIL import Image\nim = Image.open(io.BytesIO(sys.stdin.buffer.read())).convert("RGBA").resize((1, 1), Image.Resampling.BOX)\nprint(*im.getpixel((0, 0)))'], { input: bytes });
    rgb = out.status === 0 ? String(out.stdout).trim().split(/\s+/u).map(Number) : null;
    if (rgb !== null && (rgb.length !== 4 || rgb.some(v => !Number.isFinite(v)))) rgb = null;
    means.set(key, rgb);
  }
  return rgb;
};
Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true, value: async (source) => {
  const bytes = source instanceof Blob ? Buffer.from(await source.arrayBuffer()) : null, rgb = bytes === null ? null : meanTexel(bytes);
  return rgb === null ? { width: 1, height: 1, close: () => undefined } : { width: 1, height: 1, data: Uint8ClampedArray.from(rgb), close: () => undefined };
} });
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
// G348: the shard's own data says where its ground comes from (its data/placeholder.ts row); no slug branch here
const source = await placeholderOf(root, slug);
const groundFrom = source.ground;
// a shardfile-terrain shard (no terrain.bin, no ground row) builds its world on its own collider grid
const nativeTerrain = groundFrom === undefined ? existsSync(terrainBin) ? readFileSync(terrainBin) : undefined : (await at(`src/shards/${slug}/${groundFrom.generator}`))[groundFrom.export]();
if (nativeTerrain !== undefined && !(nativeTerrain instanceof Uint8Array)) throw new Error(`${slug}: placeholder ground ${JSON.stringify(groundFrom)} returned no bytes`);

// a manifest ground declared by key (`createBakedTerrainField`, Signal's) is its shardfile's own terrain collider: the bake
// installs it into the declared field as the session's required-ground loader would (`installProductGround`)
if (nativeTerrain === undefined && manifest.ground?.terrain !== undefined) {
  const { bakedTerrainSource, installDeclaredBakedTerrain } = await at('src/engine/world/bakedTerrainField.ts');
  const declared = bakedTerrainSource(manifest.ground.terrain), collider = declared === null ? null : placeholderGridBytes(root, resolve(root, 'src/shards', slug), slug);
  if (collider?.kind === 'collider') {
    const { clientGround } = await at('src/game/shardfile/clientGround.ts');
    const ground = clientGround({ terrain: { collider: 'collider' }, meshCollision: null }, new Map([['collider', collider.bytes]]));
    installDeclaredBakedTerrain(manifest.ground.terrain, { seed: declared.seed, heightAt: ground.heightAt, normalAt: ground.normalAt, splatAt: ground.splatAt });
  }
}

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
let forestTrees = [];
/** One drawn mesh (model-space geometry, its material and its placed copies' matrices) as a producer prototype. */
const harvest = (label, geometry, materials, transforms, instanced) => {
  const position = geometry?.getAttribute('position');
  if (position === undefined || position.itemSize !== 3 || transforms.length === 0) return;
  const material = Array.isArray(materials) ? materials[0] : materials;
  if (material === undefined || material.transparent === true && material.opacity < 0.5 || material.visible === false) return;
  const index = geometry.index, tri = index === null ? position.count / 3 : index.count / 3;
  const colour = colourOf(materials), vc = geometry.getAttribute('color');
  const base = new Float32Array(position.count * 3), colours = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    base.set([position.getX(i), position.getY(i), position.getZ(i)], i * 3);
    const k = vc !== undefined && vc.itemSize >= 3 ? [vc.getX(i), vc.getY(i), vc.getZ(i)] : [1, 1, 1];
    colours.set([colour.r * k[0], colour.g * k[1], colour.b * k[2]], i * 3);
  }
  const idx = index === null ? Uint32Array.from({ length: position.count }, (_, i) => i) : Uint32Array.from(index.array);
  rows.push({ name: label, instanced, count: transforms.length, tri, total: tri * transforms.length, colour: colour.toArray().map(x => Number(x.toFixed(2))), map: material.map !== null && material.map !== undefined });
  parts.push({ name: label, positions: base, colours, index: idx, transforms });
};
// Placed models (E315: huts, piers, lookouts …) are harvested where they are built, every copy, whatever their culler
// shows from one bake camera: each placement call keeps its coarsest non-empty level. Scene meshes drawing those
// models' materials are then skipped, so no copy is taken twice.
const modelMaterials = new Set(), modelBuilds = [];
const poseMatrix = (pl) => {
  if (pl.matrix !== undefined) return pl.matrix.clone();
  const s = pl.scale ?? 1, r = new THREE.Matrix4(), out = new THREE.Matrix4().makeScale(s, s, s);
  if (pl.yaw !== undefined) out.premultiply(r.makeRotationY(pl.yaw));
  if (pl.leanX !== undefined) out.premultiply(r.makeRotationX(pl.leanX));
  if (pl.leanZ !== undefined) out.premultiply(r.makeRotationZ(pl.leanZ));
  return out.premultiply(r.makeTranslation(pl.x, pl.y, pl.z));
};
const visitPlacement = (call) => {
  if (call.drawnInto !== undefined || call.moving) return undefined;
  const levels = new Map();
  modelBuilds.push({ model: call.model, levels });
  return (build) => {
    const meshes = [];
    if (Array.isArray(build.built)) for (const part of build.built) meshes.push({ geometry: part.geometry, material: part.material, local: null });
    else if (build.built?.isObject3D === true) { build.built.updateMatrixWorld(true); build.built.traverse(n => { if (n.isMesh && !n.isSkinnedMesh) meshes.push({ geometry: n.geometry, material: n.material, local: n.matrixWorld.clone() }); }); }
    for (const mesh of meshes) for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) modelMaterials.add(mat);
    if (meshes.length === 0 || build.kind !== 'model') return;
    // copy now: a builder's geometry may be transformed or merged after this callback
    const copies = meshes.map(mesh => ({ geometry: mesh.geometry.clone(), material: mesh.material, local: mesh.local }));
    const byGroup = levels.get(build.placements) ?? new Map(); byGroup.set(build.level, copies); levels.set(build.placements, byGroup);
  };
};
/** Harvest the placed models (their coarsest non-empty level, every copy); returns each copy's world box. */
const harvestModels = () => {
  const boxes = [], b = new THREE.Box3();
  if (report) console.log(`  models: ${JSON.stringify(Object.entries(Object.groupBy(modelBuilds, x => x.model)).map(([k, v]) => `${k}:${v.length}/${v.reduce((n, x) => n + x.levels.size, 0)}`))}`);
  for (const { model, levels } of modelBuilds) for (const [placements, byLevel] of levels) {
    const level = Math.max(...[...byLevel.keys()].filter(l => (byLevel.get(l) ?? []).length > 0));
    const poses = placements.map(poseMatrix);
    for (const mesh of byLevel.get(level) ?? []) {
      const transforms = poses.map(pose => mesh.local === null ? pose.clone() : pose.clone().multiply(mesh.local));
      mesh.geometry.computeBoundingBox();
      for (const t of transforms) if (mesh.geometry.boundingBox !== null) boxes.push(b.copy(mesh.geometry.boundingBox).applyMatrix4(t).expandByScalar(0.5).clone());
      harvest(model, mesh.geometry, mesh.material, transforms.map(t => Array.from(t.elements)), false);
    }
  }
  return boxes;
};
// a pure shardfile project has no authored plugin to build: its near placeholder is its terrain alone
if (typeof manifest.load === 'function') await visitAuthoredWorld(manifest, { root, sky, element: environment.element, tier: 'phone', nativeTerrain, collectLate: true, visitPlacement,
  createTerrain: async () => {
    const field = await at('src/engine/world/Heightfield.ts');
    const terrain = new Terrain(); terrain.mesh = new THREE.Mesh(terrainChunkGeometry(field), new THREE.MeshBasicMaterial()); terrain.mesh.name = 'near-harvest-terrain';
    return terrain;
  },
  visit: ({ scene, camera, late, forest }) => {
    // a forest its shard's own tree model draws (Pine's, E315) has no meshes in Node: its placements are the trees
    if (forest.drawer !== 'self') forestTrees = forest.trees.map(t => ({ x: t.x, y: t.y, z: t.z, rot: t.rot, height: t.height, scale: t.scale,
      species: t.species ?? forest.factory.variants[t.variant]?.species ?? 'tree', tint: t.tint.getHSL({ h: 0, s: 0, l: 0 }).l }));
    // pose the view over the whole cell from a neighbour's distance, so view-dependent repacks keep their far copies
    camera.fov = 100; camera.near = 1; camera.far = 6000; camera.position.set(0, 650, 1); camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); scene.updateMatrixWorld(true);
    for (let pass = 0; pass < 3; pass++) for (const fn of late) fn(1 / 30);
    scene.updateMatrixWorld(true);
    const m = new THREE.Matrix4(), modelBoxes = harvestModels(), centre = new THREE.Vector3(), cb = new THREE.Box3();
    scene.traverse((node) => {
      if (!node.isMesh || node.isSkinnedMesh || node.name === 'near-harvest-terrain' || !node.visible) return;
      let hidden = false; for (let p = node.parent; p !== null; p = p.parent) if (!p.visible) hidden = true;
      if (hidden) return;
      // a copy drawing a placed model's material inside one of its harvested copies is that copy (taken above)
      const shared = (Array.isArray(node.material) ? node.material : [node.material]).some(mat => modelMaterials.has(mat)), transforms = [];
      if (shared) node.geometry.computeBoundingBox();
      for (let k = 0; k < (node.isInstancedMesh ? node.count : 1); k++) {
        if (node.isInstancedMesh) { node.getMatrixAt(k, m); m.premultiply(node.matrixWorld); } else m.copy(node.matrixWorld);
        if (shared && node.geometry.boundingBox !== null && modelBoxes.some(box => box.containsPoint(cb.copy(node.geometry.boundingBox).applyMatrix4(m).getCenter(centre)))) continue;
        transforms.push(Array.from(m.elements));
      }
      let label = node.name; for (let p = node.parent; label.length === 0 && p !== null; p = p.parent) label = p.name; // the nearest named ancestor
      harvest(label, node.geometry, node.material, transforms, node.isInstancedMesh === true);
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
  if (report && p.transforms.length > 0) console.log(`  ${skip === null ? "take" : "skip"} ${p.name} (${skip}) ${p.index.length / 3} tris x ${p.transforms.length} ${box(p)}`);
  return skip === null; // ground / sea / sky come from the lattice; an unlit white or an emissive glow is not paint
});
// the far look, the grid and the bake are the generic ones (`@wildshard/sdk/bake/placeholders`, as `wildshard build`)
const sdk = await at('src/sdk/bake/placeholders.ts');
if (source.far === undefined) throw new Error(`${slug}: no far row in its data/placeholder.ts`);
const exported = async (ref) => { const value = (await at(`src/shards/${slug}/${ref.module}`))[ref.export]; if (value === undefined) throw new Error(`${slug}: ${ref.module} has no export ${ref.export}`); return value; };
const look = await exported(source.far.look);
// a shard whose world lives in its shardfile tiles (Signal's sand and tower, a template's props) has nothing the authored
// host builds: its coarse (L1) tiles' meshes are its world, harvested as `wildshard build` harvests them (`shardfileWorld`)
if (prototypes.length === 0 && existsSync(resolve(root, 'src/shards', slug, 'shard.config.ts'))) {
  const { readProjectAssets } = await at('src/sdk/project.ts');
  const project = await readProjectAssets(resolve(root, 'src/shards', slug));
  prototypes.push(...await sdk.shardfileWorld(project.shard, project.assets));
  console.log(`${slug}: ${prototypes.length} shardfile L1 tile meshes`);
}
const ground = source.far.grid === undefined ? placeholderGridBytes(root, resolve(root, 'src/shards', slug), slug) : null;
const grid = ground === null ? (await exported(source.far.grid))() : ground.kind === 'baked' ? sdk.bakedTerrainGrid(ground.bytes) : sdk.colliderGrid(ground.bytes);
// round 3: the ground at the height field's own density, reduced by geometric error (--ground-error=<m> to measure)
const arg = (name) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const { bytes, manifest: row, reduced } = await sdk.bakeNearPlaceholder({ grid, look, prototypes, trees: forestTrees, stands: source.trees, floors: source.near?.floors,
  groundError: Number(arg('ground-error') ?? sdk.NEAR_BAKE.groundError), residentBytes: Number(arg('resident') ?? sdk.NEAR_BAKE.residentBytes), log: line => console.log(`${slug}: ${line}`) });
const { file } = row, resident = file.decoded + file.gpu;
if (report) { for (const k of reduced.kept) console.log(`  keep ${k.name}: ${k.copies} x ${k.triangles}/${k.source}`); for (const d of reduced.dropped) console.log(`  drop ${d.name}: ${d.why}`); }
const dir = resolve(root, 'public/assets/baked', slug);
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'near.glb'), bytes); writeFileSync(resolve(dir, 'near.json'), sdk.placeholderJson(row));
console.log(`${slug.padEnd(18)} near resident ${(resident / 1e6).toFixed(3)} MB  wire ${(file.compressed / 1e3).toFixed(0)} KB  ${file.triangles} tris (${reduced.triangles} content)  ${file.draws} draw`);
process.exit(0);
