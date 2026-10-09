import { Box3, DoubleSide, Float32BufferAttribute, Mesh, MeshStandardMaterial, Raycaster, Vector3, type BufferGeometry } from 'three';
import * as v from 'valibot';
import { isJsonData } from '@wildshard/game/shardfile/json';
import { FAMILY_IDS, FamilyMaterialSchema, PbrMaterialSchema } from '@wildshard/engine/render/families/params';
import { parseShardfile, type Shardfile } from '../shardfile';
import { normalizeWorldGlb, type NormalizedWorld, type WorldPrimitive } from './world';
import { parseWorldSource } from '../worldSource';
import { bakeWorldTexture } from './textureWasm';
import { StaticMaterialCatalogue } from './staticMaterials';
import { worldGeometry, mergeWorldGeometry } from './worldGeometry';
import { staticGlb, type GlbPrimitive } from './glb';
import { simplifyWorldPrimitive } from './worldLod';
import { bakeWorldCollision } from './worldCollision';
import { WorldBakeRows } from './worldRows';

/** In-memory authored-world result; the project loader reads source bytes and the build writes only the product. */
export interface AuthoredWorldProduct { shard: Shardfile; assets: Map<string, Uint8Array> }
function record(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input) || !isJsonData(input)) throw new Error('Authored world config needs plain JSON data');
  return input as Record<string, unknown>;
}

/** Sample the real authored ground boundary with Three's offline raycaster, never a synthetic flat edge.
 * Missing boundary ground refuses. ws_terrain selects the sampling surface when present; all collision stays WMC1. */
function edges(world: NormalizedWorld): Shardfile['edge'] {
  const material = new MeshStandardMaterial({ side: DoubleSide }), terrain = world.static.filter(row => row.terrain);
  const primitives = terrain.length === 0 ? world.collision : terrain, meshes = primitives.map(row => new Mesh(worldGeometry(row), material));
  meshes.forEach(mesh => mesh.updateMatrixWorld(true));
  const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0), 0, 501);
  try {
    const side = (name: 'north' | 'south' | 'east' | 'west'): Shardfile['edge']['north'] => {
      const heights: number[] = [], colours: [number, number, number][] = [];
      for (let at = 0; at < 257; at++) {
        const coordinate = -250 + at * 500 / 256;
        ray.ray.origin.set(name === 'east' ? 250 : name === 'west' ? -250 : coordinate, 250, name === 'north' ? 250 : name === 'south' ? -250 : coordinate);
        const hit = ray.intersectObjects(meshes, false)[0];
        if (hit === undefined) throw new Error(`World GLB ${name} boundary sample ${at} has no permanent ground`);
        const primitive = primitives.find((_row, index) => meshes[index] === hit.object), surface = primitive === undefined ? undefined : world.materials[primitive.material];
        heights.push(Math.fround(hit.point.y)); colours.push([surface?.colour[0] ?? 0.5, surface?.colour[1] ?? 0.5, surface?.colour[2] ?? 0.5]);
      }
      return { heights, colours, roadHeight: 0 };
    };
    return { north: side('north'), east: side('east'), south: side('south'), west: side('west') };
  } finally { meshes.forEach(mesh => mesh.geometry.dispose()); material.dispose(); }
}

/** Build a static authored GLB through the pinned texture/LOD tools and the normal render/collision row packers.
 * The default config is a compiled declaration plus `world`; this build-only key is removed before format parsing.
 * Existing compiled world sections refuse rather than being silently replaced. No repository bake script is needed. */
export async function bakeAuthoredWorld(input: unknown, bytes: Uint8Array): Promise<AuthoredWorldProduct> {
  const source = record(input), { world: declaration, ...data } = source, authored = parseWorldSource(declaration);
  for (const key of ['terrain', 'meshCollision', 'props', 'far', 'runtime']) if (data[key] !== undefined && data[key] !== null) throw new Error(`Authored world cannot replace compiled ${key}`);
  if (Array.isArray(data['tiles']) && data['tiles'].length > 0) throw new Error('Authored world cannot replace compiled tiles');
  const look = record(data['look']), materials = v.parse(v.record(v.string(), FamilyMaterialSchema), look['materials'] ?? {});
  const world = await normalizeWorldGlb(bytes, authored, [...Object.keys(materials), ...FAMILY_IDS]);
  // Platform defaults are made explicit for the named transport catalogue.
  for (const row of world.materials) if (materials[row.id] === undefined) {
    if (row.id !== 'pbr') throw new Error(`World GLB material ${row.name} needs an explicit ${row.id} look entry`);
    materials[row.id] = v.parse(PbrMaterialSchema, { family: 'pbr' });
  }
  const encoded = new Map<string, Uint8Array>();
  for (const material of world.materials) for (const [slot, map] of Object.entries(material.maps)) {
    if (map === null) continue;
    const role = slot === 'colour' || slot === 'emissive' ? 'srgb' : 'linear', key = `${map.image}/${role}`;
    if (encoded.has(key)) continue;
    const image = world.images.find(row => row.hash === map.image); if (image === undefined) throw new Error('World GLB missing embedded texture');
    encoded.set(key, await bakeWorldTexture(image.bytes, role));
  }
  const catalogue = new StaticMaterialCatalogue(world.materials, materials, (map, role) => {
    const texture = encoded.get(`${map.image}/${role}`); if (texture === undefined) throw new Error('World GLB missing encoded texture'); return texture;
  });
  const pack = new WorldBakeRows(), geometry: BufferGeometry[] = [], library: string[] = [];
  try {
    const bindings = catalogue.snapshot();
    for (const texture of bindings.textures.values()) pack.asset(texture, 'ktx2');
    const coarse = await Promise.all(world.static.map(row => simplifyWorldPrimitive(row, 0.5, 0.25)));
    const emit = (rows: readonly WorldPrimitive[], bounds?: readonly [number, number, number, number], transform?: readonly number[], castShadow = true): { bytes: Uint8Array; dependencies: string[]; box: Box3 } => {
      const groups = new Map<string, BufferGeometry[]>(), box = new Box3(), transient: BufferGeometry[] = [];
      try {
      for (const row of rows) {
        const name = world.materials[row.material]?.name; if (name === undefined) throw new Error('World GLB missing material slot');
        const part = worldGeometry(row, bounds, transform); transient.push(part);
        if (part.getAttribute('position').count === 0) continue;
        part.computeBoundingBox(); if (part.boundingBox !== null) box.union(part.boundingBox);
        const list = groups.get(name) ?? []; list.push(part); groups.set(name, list);
      }
      const primitives: GlbPrimitive[] = [];
      for (const [name, parts] of groups) { const merged = mergeWorldGeometry(parts); transient.push(merged); primitives.push(catalogue.primitive(name, merged, { castShadow })); }
      return { bytes: primitives.length === 0 ? new Uint8Array() : staticGlb(primitives), dependencies: catalogue.dependencies([...groups.keys()]), box };
      } finally { transient.forEach(part => part.dispose()); }
    };
    for (const lod of [0, 1] as const) {
      const size = lod === 0 ? 62.5 : 125, count = 500 / size, rows = lod === 0 ? world.static : coarse.map(row => row.primitive);
      for (let z = 0; z < count; z++) for (let x = 0; x < count; x++) {
        const output = emit(rows, [-250 + x * size, -250 + (x + 1) * size, -250 + z * size, -250 + (z + 1) * size], undefined, lod === 0);
        if (output.bytes.length === 0) continue;
        pack.tile({ lod, x, z, bytes: output.bytes, dependencies: output.dependencies, bounds: { min: output.box.min.toArray(), max: output.box.max.toArray() }, geometricError: lod === 0 ? 0 : Math.max(...coarse.map(row => row.errorMetres)) });
      }
    }
    const panels = world.panels.map(panel => {
      const output = emit(panel.primitives, undefined, panel.transform), file = pack.asset(output.bytes, 'glb', output.dependencies);
      library.push(file.hash); return { id: panel.id, file: file.hash, visible: true };
    });
    // The far proxy is an independently measured vertex-colour approximation, one draw and no interactive panels.
    const farRows = await Promise.all(world.static.map(row => simplifyWorldPrimitive(row, 0.1, 2)));
    const farParts = farRows.map(row => {
      const part = worldGeometry(row.primitive), colour = world.materials[row.primitive.material]?.colour ?? [1, 1, 1];
      const n = part.getAttribute('position').count, values: number[] = [], original = part.hasAttribute('color') ? part.getAttribute('color') : null;
      for (let at = 0; at < n; at++) for (let c = 0; c < 3; c++) values.push((original?.getComponent(at, c) ?? 1) * (colour[c] ?? 1));
      part.setAttribute('color', new Float32BufferAttribute(values, 3)); part.deleteAttribute('uv'); part.deleteAttribute('tangent'); geometry.push(part); return part;
    });
    const farGeometry = mergeWorldGeometry(farParts); geometry.push(farGeometry); farGeometry.computeBoundingBox();
    const farBox = farGeometry.boundingBox; if (farBox === null) throw new Error('World GLB far proxy has no bounds');
    const farMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 1 }); farMaterial.name = 'ws.far';
    let farFile: Shardfile['files'][number];
    try { farFile = pack.asset(staticGlb([{ geometry: farGeometry, material: farMaterial, castShadow: false }]), 'glb'); }
    finally { farMaterial.dispose(); }
    materials['ws.far'] = v.parse(PbrMaterialSchema, { family: 'pbr', vertexColours: true });
    bindings.materials['ws.far'] = { id: 'ws.far', colour: null, normal: null, metallicRoughness: null, occlusion: null, emissive: null };
    const collision = bakeWorldCollision(world);
    for (const payload of collision.assets.values()) pack.asset(payload, 'binary', [], true);
    const baked = pack.finish(world.materials[0]?.id ?? 'pbr', { materials: bindings.materials });
    const panelCollision = collision.panels.map(row => ({ id: row.colliderId, panel: row.id, file: row.file, initialActive: true }));
    const oldFiles = v.parse(v.array(v.unknown()), data['files'] ?? []);
    const oldLibrary = v.parse(v.array(v.string()), data['library'] ?? []), oldCritical = v.parse(v.array(v.string()), data['critical'] ?? []);
    const budgets = record(data['budgets']), previous = record(budgets['library']), simBudget = record(budgets['sim']), closure = new Set<string>(), pending = [...library];
    let resident = 0, compressed = 0;
    while (pending.length > 0) {
      const hash = pending.pop(); if (hash === undefined || closure.has(hash)) continue;
      const file = baked.files.find(row => row.hash === hash); if (file === undefined) throw new Error('World panel dependency missing');
      closure.add(hash); pending.push(...file.dependencies); resident += file.decoded + file.gpu; compressed += file.compressed;
    }
    const shard = parseShardfile({ ...data, look: { ...look, materials }, files: [...oldFiles, ...baked.files], tiles: baked.tiles,
      budgets: { ...budgets, library: { resident: v.parse(v.number(), previous['resident']) + resident, compressed: v.parse(v.number(), previous['compressed']) + compressed },
        sim: { resident: v.parse(v.number(), simBudget['resident']) + baked.files.filter(row => row.critical).reduce((sum, row) => sum + row.decoded + row.gpu, 0),
          compressed: v.parse(v.number(), simBudget['compressed']) + baked.files.filter(row => row.critical).reduce((sum, row) => sum + row.compressed, 0) } },
      props: { ...baked.props, panels, far: farFile.hash }, library: [...new Set([...oldLibrary, ...library])], critical: [...new Set([...oldCritical, ...baked.critical])],
      meshCollision: { version: 1, tiles: collision.tiles.map(({ x, z, file }) => ({ x, z, file })), panels: panelCollision },
      far: { bounds: { min: farBox.min.toArray(), max: farBox.max.toArray() }, files: [farFile.hash], compressed: farFile.compressed, decoded: farFile.decoded, gpu: farFile.gpu, triangles: farFile.triangles, draws: farFile.draws }, edge: edges(world) });
    return { shard, assets: baked.assets };
  } finally { catalogue.dispose(); geometry.forEach(part => part.dispose()); }
}
