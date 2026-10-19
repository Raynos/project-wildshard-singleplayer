// G508: interpret declared private-scene hierarchies offline. No shard runtime,
// model factory, browser, renderer, physics world or simulation is loaded.
import { inflateSync } from 'node:zlib';
import { Box3, Euler, Matrix4, Quaternion, Vector3 } from 'three';

const matches = (patterns, name) => patterns.some(pattern => pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern);
const matrixOf = row => row.matrix === undefined ? new Matrix4().compose(new Vector3(...row.position ?? [0, 0, 0]),
  row.quaternion === undefined ? new Quaternion().setFromEuler(new Euler(...row.rotation ?? [0, 0, 0], row.order ?? 'XYZ')) : new Quaternion(...row.quaternion),
  new Vector3(...row.scale ?? [1, 1, 1])) : new Matrix4().fromArray(row.matrix);

/** A path is a declared JSON address; * expands an existing array in its order. */
export function mapRows(value, path = []) {
  if (path.length === 0) return [value];
  const [key, ...tail] = path;
  if (key === '*') {
    if (!Array.isArray(value)) throw new Error('Map scene wildcard requires an array');
    return value.flatMap(row => mapRows(row, tail));
  }
  if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) throw new Error(`Missing map scene data ${path.join('/')}`);
  return mapRows(value[key], tail);
}

/** Sources index real local geometry; recipes retain their exact placement
 * doubles. Unknown geometry and imports refuse instead of silently losing it. */
export async function paintMapScenes(raster, config, settings, data) {
  const shapes = new Map(), bakes = new Map(), models = new Map(), materials = new Map(), records = [];
  for (const ref of config.materials ?? []) for (const [id, row] of Object.entries(mapRows(data.json(ref.file), ref.path)[0])) materials.set(id, row);
  for (const row of config.models ?? []) {
    const source = mapRows(data.json(row.file), row.path)[0];
    for (const [id, url] of Object.entries(source)) models.set(id, `../../../public${url}`);
  }
  for (const pool of config.pools ?? []) {
    const file = typeof pool === 'string' ? pool : pool.file;
    const names = typeof pool === 'string' || pool.names === undefined ? undefined : Array.isArray(pool.names) ? pool.names : mapRows(data.json(pool.names.file), pool.names.path);
    const path = data.input(file), doc = await raster.document(path);
    let index = 0;
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh(); if (mesh === null) continue;
      const id = names?.[index++] ?? (node.getName() === '' ? mesh.getName() : node.getName());
      if (id === '') throw new Error(`${file}: unnamed map pool geometry`);
      if (shapes.has(id)) throw new Error(`Ambiguous map geometry ${id}`);
      const bounds = new Box3();
      for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute('POSITION'); if (position === null) throw new Error('Map pool needs positions');
        bounds.union(new Box3(new Vector3(...position.getMin([])), new Vector3(...position.getMax([]))));
      }
      shapes.set(id, { bounds, draw: matrix => raster.glb(path, matrix, candidate => candidate === node, { local: true }) });
    }
  }
  for (const [id, source] of Object.entries(config.aliases ?? {})) {
    const shape = shapes.get(source); if (shape === undefined || shapes.has(id)) throw new Error(`Invalid map geometry alias ${id}`);
    shapes.set(id, shape);
  }
  for (const row of config.packs ?? []) {
    const { GeometryPack, packedRows } = await import('../src/sdk/kit/geometryPack.ts');
    const source = mapRows(data.json(row.rows.file), row.rows.path)[0], names = mapRows(source, row.names)[0];
    if (!Array.isArray(names) || names.length !== source.geometries.length) throw new Error('Map geometry pack names differ');
    const bytes = data.bytes(row.file);
    const pack = new GeometryPack(row.deflated === true ? inflateSync(bytes) : bytes, packedRows(source), 'map');
    for (const [index, id] of names.entries()) {
      if (typeof id !== 'string' || shapes.has(id)) throw new Error('Map pack needs unique names');
      const geometry = pack.geometry(index); geometry.computeBoundingBox();
      if (geometry.boundingBox === null) throw new Error('Map pack needs bounds');
      shapes.set(id, { bounds: geometry.boundingBox, draw: matrix => raster.geometry(geometry, matrix) });
    }
  }
  for (const row of config.bakes ?? []) {
    const source = mapRows(data.json(row.rows.file), row.rows.path)[0];
    for (const [id, piece] of Object.entries(source)) bakes.set(id, { file: `${row.directory}/${id}.glb`, kinds: piece.kinds });
  }
  for (const ref of config.recipes) for (const recipe of mapRows(data.json(ref.file), ref.path)) {
    const scene = recipe.scene ?? recipe, imports = new Map((recipe.imports ?? []).map(row => [row.id, row]));
    const lights = new Set(ref.lights === undefined ? [] : mapRows(data.json(ref.file), ref.lights).flat().map(row => row.id));
    const ghostMaterials = new Set((scene.materials ?? []).flatMap(row => {
      const surface = row.kind === 'port' ? materials.get(row.source.split(':')[0]) : undefined;
      const effect = surface?.graph?.effectState;
      return row.properties?.transparent === true && row.properties.depthWrite === false || effect?.blend === 'alpha' && effect.depthWrite === false ? [row.id] : [];
    }));
    const rest = ref.rest === undefined ? {} : data.json(ref.rest).nodes;
    const nodes = new Map(scene.nodes.map(node => [node.id, { ...node, ...rest[node.id] }])), visiting = new Set();
    const walk = (id, parent, names, visible, inheritedStanding = false) => {
      const node = nodes.get(id);
      if (node === undefined || visiting.has(id)) throw new Error(`Invalid map scene hierarchy ${id}`);
      visiting.add(id);
      const chain = [...names, node.name ?? node.id], kept = chain.some(name => matches(settings.keep ?? [], name));
      const hidden = !kept && matches([...(settings.hide ?? []), ...(settings.heightHide ?? [])], node.name ?? node.id);
      const standing = inheritedStanding || hidden && matches(settings.hideStanding ?? [], node.name ?? node.id);
      const matrix = new Matrix4().multiplyMatrices(parent, matrixOf(node));
      const live = visible && node.visible !== false && !hidden;
      if (node.kind === 'mesh' && ghostMaterials.has(node.material)) {
        // The browser height pass omits transparent, depth-off effects too.
      } else if (node.kind === 'mesh' || node.kind === 'object') {
        const source = node.kind === 'mesh' ? node.geometry : node.source, imported = imports.get(source);
        const shape = shapes.get(source);
        if (node.kind === 'object' && imported !== undefined) {
          if (imported.kind === 'model') {
            const file = models.get(imported.model); if (file === undefined) throw new Error(`Missing declared map model ${imported.model}`);
            if (live) records.push({ matrix, model: imported.fit, file });
            for (const child of node.children ?? []) walk(child, matrix, chain, live, standing);
            visiting.delete(id); return;
          }
          const baked = bakes.get(imported.piece); if (baked === undefined) throw new Error(`Missing map bake ${imported.piece}`);
          if (live) records.push({ matrix, draw: pose => raster.glb(data.input(baked.file), pose,
            (_node, index) => imported.only === undefined || Object.entries(imported.only).every(([key, value]) => baked.kinds[index]?.[key] === value)) });
        } else if (shape === undefined && node.kind === 'object' && lights.has(source)) {
          // A declared point light has no map footprint.
        } else {
          if (shape === undefined) throw new Error(`Missing declared map geometry ${source}`);
          const count = node.instances ?? 1;
          if (count > 1 && node.matrices === undefined) throw new Error(`Missing rest instance matrices ${node.id}`);
          if (node.matrices !== undefined && node.matrices.length !== count * 16) throw new Error('Map instance matrices differ');
          for (let i = 0; i < count; i++) {
            const pose = node.matrices === undefined ? matrix : new Matrix4().multiplyMatrices(matrix, new Matrix4().fromArray(node.matrices, i * 16));
            records.push({ matrix: pose, draw: shape.draw, bounds: shape.bounds, live, standing, instanced: node.instances !== undefined });
          }
        }
      } else if (!['group', 'anchor', 'light'].includes(node.kind)) throw new Error(`Unsupported map scene node ${node.kind}`);
      for (const child of node.children ?? []) walk(child, matrix, chain, live, standing);
      visiting.delete(id);
    };
    walk(scene.root, new Matrix4(), [], true);
  }
  // Preserve bake-maps' hideStanding rule: the same instanced vegetation rooted
  // on a decorative island is omitted with that island, using its actual box.
  const standing = records.filter(row => row.standing === true).map(row => {
    const box = row.bounds.clone().applyMatrix4(row.matrix), size = box.getSize(new Vector3());
    return { position: new Vector3().setFromMatrixPosition(row.matrix), radius: 0.4 * Math.min(size.x, size.z) };
  });
  for (const row of records) {
    if (row.live === false) continue;
    if (row.instanced === true) {
      const p = new Vector3().setFromMatrixPosition(row.matrix);
      if (standing.some(island => Math.hypot(p.x - island.position.x, p.z - island.position.z) <= island.radius && p.y >= island.position.y - 4 && p.y <= island.position.y + 6)) continue;
    }
    if (row.model !== undefined) {
      const file = data.input(row.file), doc = await raster.document(file), fit = row.model;
      const turn = new Matrix4().makeRotationY(fit.yaw ?? 0), bounds = new Box3();
      for (const node of doc.getRoot().listNodes()) for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
        const position = primitive.getAttribute('POSITION'); if (position === null) throw new Error('Map model needs positions');
        const box = new Box3(new Vector3(...position.getMin([])), new Vector3(...position.getMax([])));
        bounds.union(box.applyMatrix4(new Matrix4().multiplyMatrices(turn, new Matrix4().fromArray(node.getWorldMatrix()))));
      }
      const extent = bounds.getSize(new Vector3()), scale = fit.size / Math.max(1e-6, fit.by === 'height' ? extent.y : Math.max(extent.x, extent.z));
      const matrix = row.matrix.clone().multiply(new Matrix4().makeTranslation(0, fit.floor ?? 0, 0)).multiply(new Matrix4().makeScale(scale, scale, scale))
        .multiply(new Matrix4().makeTranslation(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2)).multiply(turn);
      await raster.glb(file, matrix);
    } else await row.draw(row.matrix);
  }
}
