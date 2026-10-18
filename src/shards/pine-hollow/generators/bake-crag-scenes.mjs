import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { Matrix4, MeshStandardMaterial, Vector3 } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { cragNodeGeometry, cragFixedRows } from './cragWorldScenes.ts';
import { CragSkin } from './cragCodec.ts';
import authored from '../data/timberWorld.generated.json' with { type: 'json' };
import sourceRows from '../data/crags.json' with { type: 'json' };
import layout from '../data/layout.generated.json' with { type: 'json' };

const project = new URL('../', import.meta.url), root = new URL('../../../../', import.meta.url);
const directory = 'public/assets/models/pine-hollow-crags/';
const read = path => readFileSync(new URL(path, root));

/** Native kit and skin streams, before the original BatchedMesh copies them. */
export async function bakeCragSceneSources() {
  const shapes = new Map();
  for (const file of ['crags.glb', 'crags-b.glb', 'cave.glb']) {
    const source = await readSourceModel(read(directory + file));
    for (const [id, geometry] of cragNodeGeometry(source.gltf.scene)) shapes.set(id, geometry);
  }
  for (const tier of ['phone', 'desktop']) {
    const packed = inflateSync(read(`public/assets/pine-hollow/baked/crags.${tier}.bin`));
    const raw = new Uint8Array(packed.length), words = packed.length / 4;
    for (let i = 0; i < words; i++) for (let j = 0; j < 4; j++) raw[i * 4 + j] = packed[j * words + i];
    const pairs = await new CragSkin(raw, sourceRows.skin[tier]).tiles(() => Promise.resolve());
    for (const [i, pair] of pairs.entries()) for (const [level, geometry] of pair.entries()) {
      geometry.setAttribute('aCdata', geometry.getAttribute('cdata')); geometry.deleteAttribute('cdata');
      geometry.setAttribute('aCtint', geometry.getAttribute('ctint')); geometry.deleteAttribute('ctint');
      shapes.set(`${tier}-skin-${i}-${level === 0 ? 'near' : 'far'}`, geometry);
    }
  }
  return shapes;
}

/** All declarations remain data; only the chosen profile's lazy batch allocates GPU buffers. */
export function cragWorldRows(shapes) {
  const draw = id => ({ id, library: 'crags', model: id, material: 'crag', castShadow: true, receiveShadow: true });
  const moduleModels = authored.cragAssembly.tiers.phone.kinds.map((kind, index) => {
    const desktop = authored.cragAssembly.tiers.desktop.kinds[index];
    const choices = kind.model.variants.map(variant => {
      const id = variant.id, geometry = shapes.get(id), hull = kind.model.hulls?.[id];
      if (geometry === undefined) throw new Error(`Crag scene omitted source ${id}`);
      const size = geometry.boundingBox.getSize(new Vector3());
      return { id, params: { ...kind.model.defaults, ...variant.params }, size: [size.x, size.y, size.z], draws: [draw(id)],
        lods: [{ from: { phone: kind.model.lods[0].from, desktop: desktop.model.lods[0].from }, draws: [draw(shapes.has(`${id}-lod1`) ? `${id}-lod1` : id)] }],
        colliders: hull === undefined ? [] : [{ kind: 'hull', x: 0, y: 0, z: 0, surface: 'rock', points: hull.points }] };
    });
    return { key: kind.model.id, id: kind.model.id, name: kind.model.name, file: kind.model.file, category: 'nature', pipeline: 'blender', surface: 'rock',
      assembly: 'parts', defaults: kind.model.defaults, variants: kind.model.variants, choices };
  });
  const batches = [], placements = [];
  for (const tier of ['phone', 'desktop']) {
    const fixed = cragFixedRows(tier), batch = `crags.${tier}`;
    batches.push({ id: batch, material: 'crag', name: 'pine-crags', ...fixed,
      sortObjects: false, perObjectFrustumCulled: true, castShadow: true, receiveShadow: true,
      cull: { frustum: false, radiusBias: 0.5, step: 1 } });
    for (const kind of authored.cragAssembly.tiers[tier].kinds) placements.push({ id: `${batch}.${kind.model.id.split('/').at(-1)}`, model: kind.model.id,
      batch, draw: 'batched', poses: kind.placements.map(pose => ({ x: pose.x, y: pose.y, z: pose.z, variant: pose.variant,
        yxz: { yaw: pose.yaw, scale: pose.scale, pitch: pose.pitch ?? 0, roll: pose.roll ?? 0 } })),
      cull: { frustum: false, radiusBias: 0.5, step: 1, bounds: 'sphere', far: kind.far },
      piece: { id: `pine-crags-${kind.model.id.split('/').at(-1)}`, name: kind.model.name, split: 90 } });
  }
  return { moduleModels, batches, placements };
}

/** Native cave collision transform, including subtraction before Float32 storage. */
export function caveShellRows(shapes) {
  const geometry = shapes.get('cave-col') ?? shapes.get('cave');
  if (geometry === undefined) throw new Error('Missing cave shell');
  const frame = new Matrix4().makeRotationY(layout.BEAR_CAVE.rot).setPosition(layout.BEAR_CAVE.x, 0, layout.BEAR_CAVE.z);
  const position = geometry.getAttribute('position'), vertex = new Vector3(), origin = new Vector3().setFromMatrixPosition(frame), vertices = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i).applyMatrix4(frame);
    vertices[i * 3] = vertex.x - origin.x; vertices[i * 3 + 1] = vertex.y - origin.y; vertices[i * 3 + 2] = vertex.z - origin.z;
  }
  const index = geometry.getIndex(), indices = index === null ? Array.from({ length: position.count }, (_, i) => i) : Array.from(index.array);
  return { kind: 'trimesh', x: origin.x, y: origin.y, z: origin.z, surface: 'rock', vertices: Array.from(vertices), indices };
}

if (import.meta.main) {
  const shapes = await bakeCragSceneSources(), material = new MeshStandardMaterial(), blobs = [], models = [], geometryHashes = {};
  const writer = byteWriter(process.argv.includes('--check'), 'pine-crag-scenes');
  try {
    for (const [id, geometry] of shapes) {
      const name = `models/crags/${id}.glb`, source = `assets/crag-scenes/${id}.glb`;
      const encoded = staticGlb([{ geometry, material, compactIndex: true, nativeAttributes: true, customAttributes: { _CDATA: 'aCdata', _CTINT: 'aCtint' } }]);
      writer.put(fileURLToPath(new URL(source, project)), encoded);
      geometryHashes[source] = createHash('sha256').update(encoded).digest('hex');
      blobs.push({ name, kind: 'glb', source }); models.push({ id, file: name, attributes: {} });
    }
    const cave = { meta: JSON.parse(read(`${directory}cave.json`).toString()), shell: caveShellRows(shapes) };
    writer.put(fileURLToPath(new URL('data/cragScenes.generated.json', project)), jsonBytes({ blobs, models, geometryHashes, ...cragWorldRows(shapes), cave }, 0));
    writer.finish();
  } finally { material.dispose(); for (const geometry of shapes.values()) geometry.dispose(); }
}
