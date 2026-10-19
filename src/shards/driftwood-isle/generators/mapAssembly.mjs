// G508: rest copies come from the exact declared scene and placement data.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { MapAssembly, mapModel, readMapJson } from '../../../../scripts/map-assembly.mjs';
import { MapWorld, mapPool } from '../../../../scripts/map-world.mjs';
import { WORLD_SCENES, SCENE_MODEL_BLOBS } from './worldScenes.ts';
import { DRIFTWOOD_OUTPUT, DRIFTWOOD_FIXED_SOURCES } from './assets.ts';
import { siteCatalogue } from './siteCatalogue.ts';
import { WORLD_DROP } from './sea.ts';

const base = resolve(import.meta.dirname, '..'), root = resolve(base, '../../..');
const read = file => readMapJson(resolve(base, file));
const named = (name, value) => ({ file: { name }, bytes: new TextEncoder().encode(JSON.stringify(value)) });
const simple = (geometry, material = 'plant', name = geometry) => ({ scene: { version: 1, root: 'root', nodes: [{ id: 'root', kind: 'group', children: ['mesh'] }, { id: 'mesh', kind: 'mesh', geometry, material, name }], materials: [] }, imports: [] });

/** The native bridge's admitted segments are world poses. Its initial planks
 * and rope chords use those records without creating bodies or stepping time. */
async function bridgeRest(assembly, fixed) {
  const facts = read('data/bridgeBake.json')[0], origin = new Vector3(facts.origin.x, facts.origin.y, facts.origin.z);
  const holders = facts.segments.map(segment => new Matrix4().compose(new Vector3(segment.x, segment.y, segment.z).sub(origin), new Quaternion(segment.rot.x, segment.rot.y, segment.rot.z, segment.rot.w), new Vector3(1, 1, 1)));
  const world = new Matrix4().makeTranslation(origin.x, origin.y, origin.z), planks = facts.planks.map(plank => world.clone().multiply(holders[plank.seg]).multiply(new Matrix4().compose(new Vector3(0, .05 - .03, plank.z), new Quaternion(), new Vector3(plank.w, .06, .3))));
  const shape = slot => mapModel(fixed(slot));
  assembly.add('bridge:posts', await shape('bridgePosts'), [world]);
  assembly.add('bridge:planks', await shape('bridgePlankUnit'), planks);
  const n = holders.length, hw = facts.width / 2, ropes = [], up = new Vector3(0, 1, 0);
  const joint = (k, x, y) => { const i = Math.min(k, n - 1); return new Vector3(x, y, k < n ? -facts.segments[i].hz : facts.segments[i].hz).applyMatrix4(holders[i]); };
  const rope = (from, to, radius) => {
    const direction = to.clone().sub(from), length = direction.length();
    ropes.push(world.clone().multiply(new Matrix4().compose(from, new Quaternion().setFromUnitVectors(up, direction.divideScalar(length === 0 ? 1 : length)), new Vector3(radius, length, radius))));
  };
  for (const side of [-1, 1]) {
    for (let k = 0; k < n; k++) {
      rope(joint(k, side * (hw + .05), .05 - .07), joint(k + 1, side * (hw + .05), .05 - .07), .035);
      rope(joint(k, side * (hw + .12), .05 + .97), joint(k + 1, side * (hw + .12), .05 + .97), .035);
    }
    for (let j = 0; j < n >> 1; j++) { const k = 2 * j + 1; rope(joint(k, side * (hw + .1), .05 - .05), joint(k, side * (hw + .12), .05 + .97), .025); }
  }
  assembly.add('bridge:ropes', await shape('bridgeRopeUnit'), ropes);
  return facts;
}

async function coverRest(assembly, file, fixed) {
  const row = read('data/groundCover.json').GROUND_COVER, groups = read('data/fixedGeometry.json').groups.cover;
  const bytes = readFileSync(file), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), word = i => view.getUint32(i * 4, true);
  if (word(0) !== 0x43435357 || word(1) !== 1 || word(2) !== row.cell || word(7) !== row.kinds.length) throw new Error('Map cover cell header differs');
  const width = word(5), height = word(6), nk = word(7), matrices = row.kinds.map(() => []);
  let offset = (36 + width * height * nk * 2 + 3) & ~3;
  for (let z = 0; z < height; z++) for (let x = 0; x < width; x++) for (let kind = 0; kind < nk; kind++) {
    const cx = x + word(3) - 32768, cz = z + word(4) - 32768, range = row.kinds[kind].scale;
    const count = view.getUint16(36 + ((z * width + x) * nk + kind) * 2, true);
    for (let copy = 0; copy < count; copy++, offset += 22) {
      // The live cell decoder first stores these values in float32 lanes.
      const px = Math.fround(cx * row.cell - .5 + view.getUint16(offset, true) / 65535 * (row.cell + 1));
      const pz = Math.fround(cz * row.cell - .5 + view.getUint16(offset + 2, true) / 65535 * (row.cell + 1));
      const py = Math.fround(view.getUint16(offset + 4, true) / 65535 * 128 - 16), yaw = Math.fround(view.getUint16(offset + 6, true) / 65535 * (Math.PI * 2));
      const scale = Math.fround(range[0] + view.getUint8(offset + 8) / 255 * (range[1] - range[0])), c = Math.cos(yaw) * scale, s = Math.sin(yaw) * scale;
      matrices[kind].push(new Matrix4().fromArray([c, 0, -s, 0, 0, scale, 0, 0, s, 0, c, 0, px, py, pz, 1]));
    }
  }
  if (offset !== bytes.length) throw new Error('Map cover cell payload differs');
  for (const [i, kind] of row.kinds.entries()) assembly.add(`cover:${kind.name}`, await mapModel(fixed(groups[kind.geometry])), matrices[i]);
  return matrices.map(list => list.length);
}

export async function driftwoodMapAssembly() {
  const assembly = new MapAssembly(), catalogue = siteCatalogue(), piers = read('data/pierScenes.generated.json'), foliage = read('data/foliageScenes.generated.json');
  const blobs = [...DRIFTWOOD_OUTPUT.blobs, ...SCENE_MODEL_BLOBS], recipes = [named('scenes/rocks.json', read('data/rockScenes.generated.json').scene), named('scenes/zipline.json', piers.zipScene),
    named('scenes/moorings.json', simple('lines', 'still')), ...['palms', 'hibiscus', 'reef', 'logs'].map(kind => named(`scenes/${kind}.json`, simple('plant'))),
    ...['cascade', 'cove', 'wreck', 'trail'].map(kind => named(`scenes/${kind}.json`, read(`data/${kind === 'trail' ? 'trail' : kind}Scene.json`)))];
  const world = new MapWorld(assembly, base, WORLD_SCENES, catalogue, [...blobs, ...recipes]), files = new Map(blobs.map(row => [row.name, resolve(base, row.source)]));
  const fixed = slot => { const file = files.get(DRIFTWOOD_FIXED_SOURCES[slot]); if (file === undefined) throw new Error(`Missing map fixed shape ${slot}`); return file; };
  for (const blob of read('data/groundBlobs.generated.json').blobs) for (const [name, geometry] of await mapPool(resolve(base, blob.source), true)) assembly.add(`ground:${name}`, geometry);
  for (const step of WORLD_SCENES.steps) await world.recipe(step, new Matrix4(), step.id === 'cascade' ? ['puffs'] : []);
  for (const row of piers.placements) if (row.id !== 'harbour.zipline') await world.placement(row);
  for (const row of [foliage.logPlacement, foliage.wreckLogPlacement, ...Object.values(foliage.placements.desktop)]) await world.placement(row);
  for (const key of ['hut', 'lookout', 'shrine']) {
    const model = catalogue.models.find(row => row.key === key), choice = model.choices.find(row => row.id === 'world');
    await world.placement({ id: `sites.${key}`, model: key, poses: [{ ...choice.site.origin, params: choice.params, yxz: { yaw: 0, scale: 1 } }] });
  }
  const entryDecks = read('data/entryDecks.generated.json').rows, groups = read('data/fixedGeometry.json').groups.entryDecks;
  for (const row of entryDecks) {
    const p = row.placement, slot = p.params.bed === -6 ? groups.deep : p.params.bed === -2.5 ? groups.shallow : groups.world;
    assembly.add(`entry:${row.edge}`, await mapModel(fixed(slot)), [new Matrix4().compose(new Vector3(p.x, p.y, p.z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), p.yaw), new Vector3(1, 1, 1))]);
  }
  const bridge = await bridgeRest(assembly, fixed);
  // Native Blender terrain retains its node's dequantisation matrix and datum.
  const islandBase = resolve(root, 'public/assets/models/driftwood-blender'), islandMeta = readMapJson(resolve(islandBase, 'island.json'));
  const terrain = await mapPool(resolve(islandBase, 'island.glb'), true), protoNames = new Set(islandMeta.protos.map(row => `proto_${row.name}`));
  for (const [name, geometry] of terrain) {
    if (protoNames.has(name) || name.startsWith('terrainlo')) { geometry.dispose(); continue; }
    assembly.add(`island:${name}`, geometry, [new Matrix4().makeTranslation(0, -WORLD_DROP, 0)]);
  }
  const planFiles = read('data/islandPlanFiles.json'), plan = readMapJson(resolve(root, `public${planFiles.desktop.url}`));
  const protoFile = files.get('world/island/protos.glb'); if (protoFile === undefined) throw new Error('Missing map island prototypes');
  const prototypes = await mapPool(protoFile), placements = new Float32Array(Uint8Array.from(readFileSync(resolve(islandBase, 'placements.bin'))).buffer);
  const byProto = new Map();
  for (const family of plan.families) for (const i of family.indices) {
    const o = i * 10, name = islandMeta.protos[placements[o]].name, scale = placements[o + 8];
    const matrix = new Matrix4().compose(new Vector3(placements[o + 1], placements[o + 2] - WORLD_DROP, placements[o + 3]), new Quaternion(placements[o + 4], placements[o + 5], placements[o + 6], placements[o + 7]), new Vector3(scale, scale, scale));
    const list = byProto.get(name) ?? []; list.push(matrix); byProto.set(name, list);
  }
  for (const [name, matrices] of byProto) { const geometry = prototypes.get(name); if (geometry === undefined) throw new Error(`Missing island map prototype ${name}`); assembly.add(`island-copy:${name}`, geometry, matrices); }
  for (const [name, geometry] of prototypes) if (!byProto.has(name)) geometry.dispose();
  const cellsFile = files.get('world/cover/cells/desktop.bin'); if (cellsFile === undefined) throw new Error('Missing map cover cells');
  const cover = await coverRest(assembly, cellsFile, fixed); world.dispose();
  return { assembly, bridge, plan, byProto, cover, entryDecks };
}
if (import.meta.main) { const { assembly } = await driftwoodMapAssembly(); assembly.write(resolve(base, 'data/mapAssembly.generated')); }
