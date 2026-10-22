// Final native world batches: the original transport is decoded offline, never by the world loader.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MeshStandardMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { poseOf, placeCollider } from '@wildshard/engine/models/colliders';
import { decodePalmWorld, decodeHibiscusWorld, decodeReefWorld } from './foliageGeometry.ts';
import { DRIFT_SPECIMENS } from './driftLogs.ts';
import { palm, hibiscusBush, palmColliders } from './foliageModels.ts';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { installPortableMath } from '@wildshard/commons/bake/portableMath';

// Collider quaternions and placement matrices enter the exact map-world key.
const restoreMath = installPortableMath();

const project = new URL('../', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(`data/${name}.json`, project), 'utf8'));
const manifests = [read('dressingBlobs.generated'), read('reefBlobs.generated')];
const source = name => { const row = manifests.flatMap(m => m.blobs).find(candidate => candidate.name === name); if (row === undefined) throw new Error(`Missing native foliage: ${name}`); return new Uint8Array(readFileSync(new URL(row.source, project))); };
const foliage = read('foliagePlacements.generated'), reef = read('reefLayout.generated');
const logs = read('duneLogsBake'), wreckLogs = read('wreckBake').catalogue.logs, inventory = read('fixedGeometry');
const writer = byteWriter(process.argv.includes('--check'), 'foliage-scenes'), material = new MeshStandardMaterial();
const blobs = [], libraries = [], placements = {}, facts = {}, models = [];
const plain = rows => rows.map(row => ({ ...row, ...('points' in row ? { points: [...row.points] } : {}) }));
const matrix = pose => [...poseOf(pose).matrix.elements];
const specModels = [
  { key: 'palm', author: palm, name: 'Coconut palm', file: 'src/shards/driftwood-isle/generators/bake-foliage-scenes.mjs', material: 'palm', surface: 'wood', size: p => [p.h,p.h,p.h], colliders: palmColliders },
  { key: 'hibiscus', author: hibiscusBush, name: 'Hibiscus bush', file: 'src/shards/driftwood-isle/generators/bake-foliage-scenes.mjs', material: 'kit', size: p => [p.r*2,p.r*2,p.r*2], colliders: () => [] },
];
try {
  for (const spec of specModels) {
    const choices = spec.author.variants.map(variant => { const params = { ...spec.author.defaults, ...variant.params }; return { id: variant.id, params, size: spec.size(params), colliders: plain(spec.colliders(params)), draws: [{ id: 'plant', library: 'foliage', model: `${spec.key}-${variant.id}`, material: spec.material, castShadow: spec.key === 'palm' ? true : { phone: false, desktop: true }, receiveShadow: true }] }; });
    models.push({ key: spec.key, id: spec.author.id, name: spec.name, file: spec.file, category: 'nature', pipeline: 'code', ...(spec.surface === undefined ? {} : { surface: spec.surface }), defaults: spec.author.defaults, variants: spec.author.variants, assembly: 'parts', choices });
  }
  const modelRows = new Map();
  for (const tier of ['phone', 'desktop']) {
    placements[tier] = {}; facts[tier] = {};
    for (const [kind, decode, rows, name] of [
      ['palms', decodePalmWorld, foliage.tiers[tier].palms, `world/palms/${tier}.bin`],
      ['hibiscus', decodeHibiscusWorld, foliage.tiers[tier].bushes, `world/hibiscus/${tier}.bin`],
      ['reef', decodeReefWorld, { specs: reef.items, placements: [] }, 'world/reef.bin'],
    ]) {
      if (kind === 'reef' && tier === 'desktop') continue;
      const batch = decode(source(name), rows.specs.length), file = `models/foliage/${kind}-${tier}.glb`, output = `assets/foliage-scenes/${kind}-${tier}.glb`;
      writer.put(fileURLToPath(new URL(output, project)), staticGlb([{ geometry: batch.geometry, material, customAttributes: { _SWAY: 'aSway' }, compactIndex: true, nativeAttributes: true }]));
      blobs.push({ name: file, kind: 'glb', source: output, options: { meshopt: true } });
      const model = modelRows.get(kind) ?? { id: kind, file: {}, attributes: {} }; model.file[tier] = file; modelRows.set(kind, model);
      if (kind !== 'reef') {
        const palmBatch = kind === 'palms', id = palmBatch ? 'foliage.palms' : 'foliage.bushes';
        const colliders = palmBatch ? rows.placements.flatMap(pose => palmColliders(pose.params).map(shape => placeCollider(shape, poseOf(pose)))) : [];
        placements[tier][kind] = { id, model: palmBatch ? 'palm' : 'hibiscus', draw: 'merged', poses: rows.placements.map(pose => ({ x: pose.x, y: pose.y, z: pose.z, params: pose.params, matrix: matrix(pose) })), drawnInto: { part: `${kind}.mesh`, boxes: [...batch.boxes] }, colliders: plain(colliders), piece: { id: palmBatch ? 'palms' : 'bushes', ...(palmBatch ? { solidFloor: true } : {}) } };
        facts[tier][kind] = palmBatch ? rows.placements.map((pose, i) => { const p = rows.specs[i]; return { x: p.x, z: p.z, hw: 0.3, hd: 0.3, rot: 0, yTop: pose.y+p.h, yBottom: pose.y-1 }; }) : [];
      }
      batch.geometry.dispose();
    }
  }
  modelRows.get('reef').file.desktop = modelRows.get('reef').file.phone;
  for (const spec of specModels) for (const variant of spec.author.variants) {
    const family = spec.key === 'palm' ? 'palms' : 'hibiscus', file = {};
    for (const tier of ['phone','desktop']) file[tier] = `models/${family}/${tier}/${variant.id}.glb`;
    modelRows.set(`${spec.key}-${variant.id}`, { id: `${spec.key}-${variant.id}`, file, attributes: { _sway: 'aSway' } });
  }
  libraries.push({ id: 'foliage', kind: 'owned', models: [...modelRows.values()] });
  const logDefaults = DRIFT_SPECIMENS.long, logVariants = [
    { id: 'long', label: 'Long', params: {} }, { id: 'short', label: 'Short', params: DRIFT_SPECIMENS.short }, { id: 'pale', label: 'Pale', params: { tone: DRIFT_SPECIMENS.pale.tone } },
  ];
  models.push({ key: 'driftLog', id: 'driftwood-isle/drift-log', name: 'Drift log', category: 'nature', pipeline: 'code', surface: 'wood', file: 'src/shards/driftwood-isle/generators/bake-foliage-scenes.mjs', defaults: logDefaults, variants: logVariants, assembly: 'parts', choices: logVariants.map(variant => ({ id: variant.id, params: { ...logDefaults, ...variant.params }, size: [4, 1, 1], colliders: [], draws: [{ id: 'log', library: 'cascade', model: inventory.groups.driftLogs[variant.id], material: 'still', castShadow: true, receiveShadow: true }] })) });
  const logPlacement = { id: 'foliage.logs', model: 'driftLog', draw: 'merged', poses: logs.placements.map(pose => ({ x: pose.x, y: pose.y, z: pose.z, params: pose.params, matrix: matrix(pose) })), drawnInto: { part: 'logs.mesh', boxes: logs.boxes }, colliders: [], piece: { id: 'cover-drift-logs' } };
  const wreckLogPlacement = { ...logPlacement, id: 'wreck.logs', poses: wreckLogs.placements.map(pose => ({ x: pose.x, y: pose.y, z: pose.z, params: pose.params, matrix: matrix(pose) })), drawnInto: { part: 'wreck.root', boxes: wreckLogs.boxes }, piece: { id: 'wreck-drift-logs' } };
  writer.put(fileURLToPath(new URL('data/foliageScenes.generated.json', project)), jsonBytes({ blobs, libraries, models, placements, facts, logPlacement, wreckLogPlacement }));
  writer.finish();
} finally { material.dispose(); restoreMath(); }
