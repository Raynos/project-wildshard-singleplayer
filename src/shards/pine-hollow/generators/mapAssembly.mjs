// G508: complete map rest assembly, exclusively from shipping source data.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BufferGeometry, Color, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from 'three';
import { MapAssembly, mapForest, readMapJson } from '../../../../scripts/map-assembly.mjs';
import { MapWorld, mapGround, mapPool } from '../../../../scripts/map-world.mjs';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { buildTerrainMetadata } from '@wildshard/engine/world/terrainField';
import { WORLD_SCENES, SCENE_BLOBS, SCENE_MODEL_BLOBS } from './worldScenes.ts';
import { SCENE_MODELS, SCENE_PLACEMENTS } from './sceneModelRows.ts';
import { mapLilies } from './mapLilies.mjs';
import { bakePineUndergrowth } from './undergrowth.ts';
import { inBeaverPool } from './geography.ts';

const base = resolve(import.meta.dirname, '..'), root = resolve(base, '../../..');
const read = file => readMapJson(resolve(base, file));
const palette = ['#847553', '#46603a', '#948a7c', '#504640'].map(value => new Color(value).toArray());
export async function pineMapAssembly() {
  const assembly = new MapAssembly(), world = new MapWorld(assembly, base, WORLD_SCENES, SCENE_MODELS, [...SCENE_MODEL_BLOBS, ...SCENE_BLOBS]);
  const layout = read('data/layout.generated.json'), native = readNativeTerrain(readFileSync(resolve(root, 'public/assets/baked/pine-hollow/terrain.bin')));
  const crags = read('data/cragScenes.generated.json'), cave = layout.BEAR_CAVE, c = Math.cos(cave.rot), s = Math.sin(cave.rot);
  const hole = points => {
    const local = points.map(([x, y, z]) => [(x - cave.x) * c - (z - cave.z) * s, y, (x - cave.x) * s + (z - cave.z) * c]);
    const lo = [0, 1, 2].map(i => Math.min(...local.map(p => p[i]))), hi = [0, 1, 2].map(i => Math.max(...local.map(p => p[i])));
    return crags.cave.meta.holes.some(h => !(hi[0] < h.lx - h.hw || lo[0] > h.lx + h.hw || hi[2] < h.lz - h.hd || lo[2] > h.lz + h.hd || hi[1] < h.y0 || lo[1] > h.y1));
  };
  assembly.add('terrain', mapGround(native, 256, 500, palette, hole));
  // Moving ride bodies have no static rest pose here; their parked canoe already has its hero placement.
  for (const step of WORLD_SCENES.steps) await world.recipe(step, new Matrix4(), ['spray', 'trolley', 'canoe']);
  for (const row of SCENE_PLACEMENTS) {
    if (row.tier === 'phone' || row.id === 'heroes.closed-arch') continue;
    await world.placement(row);
  }
  for (const row of WORLD_SCENES.batches.filter(batch => batch.tier !== 'phone')) await world.batch(row);
  const cabins = read('data/cabinScenes.generated.json'), live = read('data/cabinLivingScenes.generated.json');
  const shadows = read('data/plumbing.json').knobs.find(row => row.id === 'pine.cabinDetailShadows').desktop;
  const shared = read('data/plumbing.json').knobs.find(row => row.id === 'pine.sharedCabinLights')?.desktop ?? false;
  const living = live.profiles.find(row => row.tier === 'desktop' && row.shadow === shadows && row.shared === shared);
  await world.weld(living.graph);
  const shells = cabins.worlds.find(row => row.tier === 'desktop' && row.shadow === shadows);
  await world.weld(cabins.graphs.find(row => row.file === shells.file).graph);

  const timbers = read('data/timberWorld.generated.json'), underShapes = bakePineUndergrowth();
  const floor = read('data/floorLayout.generated.json');
  for (const [kind, rows] of Object.entries(floor.layout)) {
    const shape = underShapes[kind]; if (shape === undefined) throw new Error(`Missing map floor shape ${kind}`);
    const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(shape.position, 3)).setIndex(shape.index);
    assembly.add(`floor:${kind}`, geometry, rows.map(row => new Matrix4().fromArray(row.matrix)));
  }
  const pool = read('data/beaverPool.json').still;
  const poolGeometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(pool.position, 3)).setIndex(pool.index), positions = poolGeometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) { const h = timbers.poolGround[i], d = layout.BEAVER_POOL.full - h; positions.setY(i, d < 0 && d > -.45 ? h + .05 : layout.BEAVER_POOL.full); }
  assembly.add('beaver-pool', poolGeometry);
  // The pond complements the pool on the same 128-cell grid, including its wet
  // bank film. The drained trickle is initially hidden in the live world.
  const pond = layout.POND, half = pond.r + 15, n = 129, points = [], depths = [], indices = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = pond.x - half + i / 128 * half * 2, z = pond.z - half + j / 128 * half * 2, h = native.heightAt(x, z), d = pond.level - h;
    points.push(x, d < 0 && d > -.45 ? h + .05 : pond.level, z); depths.push(d);
  }
  for (let j = 0; j < 128; j++) for (let i = 0; i < 128; i++) {
    const a = j * n + i, b = a + 1, below = a + n, d = below + 1;
    if ([a, b, below, d].every(k => depths[k] < -.45) || inBeaverPool(pond.x - half + (i + .5) * half * 2 / 128, pond.z - half + (j + .5) * half * 2 / 128)) continue;
    indices.push(a, below, b, b, below, d);
  }
  assembly.add('pond', new BufferGeometry().setAttribute('position', new Float32BufferAttribute(points, 3)).setIndex(indices));

  const manifest = read('manifest.json'), geography = read('data/geography.generated.json'), candidates = new Map(geography.forest.map(row => [`${row.x},${row.z}`, row]));
  const at = (x, z) => { const row = candidates.get(`${x},${z}`); if (row === undefined) throw new Error('Map forest candidate differs'); return row; };
  const trails = [layout.S_ROAD, layout.N_ROAD, layout.W_ROAD, layout.E_ROAD, ...Object.values(layout.SPURS)];
  const field = { ...buildTerrainMetadata(manifest.seed, { trails, cabinSites: layout.CABIN_SITES, pond }, () => pond.level), ...native };
  const trees = mapForest({ slug: manifest.slug, label: 'map', seed: manifest.seed, treeCount: manifest.treeCount }, field,
    { ...manifest.forest, density: (x, z) => at(x, z).density, scale: (x, z) => at(x, z).scale, species: (x, z) => at(x, z).species },
    manifest.trees.setVariants.map(row => ({ trunkRadius: row.trunk, height: row.height, species: row.species, collider: row.collider })));
  const lilies = mapLilies(manifest.seed, pond, native.heightAt, manifest.pondLilyExclusions ?? []);
  if (lilies !== null) assembly.add('pond-lilies', lilies);
  const rest = read('data/treeRest.generated.json'), shapes = await mapPool(resolve(root, `public${rest.geometry}`));
  for (const [variant, row] of manifest.trees.setVariants.entries()) {
    const matrices = trees.filter(tree => tree.variant === variant).map(tree => new Matrix4().compose(new Vector3(tree.x, tree.y, tree.z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), tree.rot), new Vector3().setScalar(tree.scale)));
    for (const part of ['trunk', 'hi', 'twigs']) {
      const geometry = shapes.get(`${row.name}__${part}`); if (geometry === undefined) throw new Error(`Missing map tree ${row.name}/${part}`);
      assembly.add(`forest:${row.name}:${part}`, geometry, matrices);
    }
  }
  for (const [name, geometry] of shapes) if (!['trunk', 'hi', 'twigs'].some(part => name.endsWith(`__${part}`))) geometry.dispose(); world.dispose();
  for (const node of assembly.nodes) {
    const colour = node.name.startsWith('forest:') ? '#3f5530' : ['pond', 'beaver-pool', 'scene:streams:water'].includes(node.name) ? '#1c2022' : undefined;
    if (colour !== undefined) {
      const geometry = assembly.shapes.find(shape => shape.name === node.geometry).geometry, rgb = new Color(colour).toArray(), values = new Float32Array(geometry.getAttribute('position').count * 3);
      for (let i = 0; i < values.length; i += 3) values.set(rgb, i);
      geometry.setAttribute('color', new Float32BufferAttribute(values, 3));
    }
  }
  return { assembly, trees, floor, living, shells };
}
if (import.meta.main) { const { assembly } = await pineMapAssembly(); assembly.write(resolve(base, 'data/mapAssembly.generated')); }
