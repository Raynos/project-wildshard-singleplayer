import { expect, it } from 'vitest';
import { BufferGeometry, Color, Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { BoxCollider } from '../src/sdk/physics';
import { readScene, type SceneDescription } from '../src/sdk/scene';
import { contentHash } from '../src/sdk/project';
import { bakeProps, type PropsBakeSource } from '../src/sdk/bake/props';
import { templateProps } from '../src/shards/_template/generators/templatePropsSource';
import { pastelProps } from '../src/shards/pastel-plain/generators/props';

// Independent consumer of the JSON intermediate, not a clone of the input graph. The pilot's PBR geometry is
// deliberately reconstructed from emitted channels/matrices before the existing compiler sees any object.
function graph(rows: SceneDescription): Object3D {
  const geometries = rows.geometries.map(row => {
    const geometry = new BufferGeometry();
    for (const [name, attribute] of Object.entries(row.attributes)) {
      if (attribute.normalized || attribute.storage !== 'Float32Array') throw new Error('Unexpected pilot channel');
      geometry.setAttribute(name, new Float32BufferAttribute(attribute.array, attribute.itemSize));
    }
    geometry.setDrawRange(row.drawRange.start, row.drawRange.count ?? Infinity);
    if (row.index !== null) geometry.setIndex(row.index);
    for (const group of row.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
    return geometry;
  });
  const materials = rows.materials.map(row => new MeshStandardMaterial({
    name: row.name, color: new Color().fromArray(row.color), opacity: row.opacity, transparent: row.transparent,
    side: row.side, vertexColors: row.vertexColors, flatShading: row.parameters['flatShading'] === true,
    roughness: typeof row.parameters['roughness'] === 'number' ? row.parameters['roughness'] : 1,
    metalness: typeof row.parameters['metalness'] === 'number' ? row.parameters['metalness'] : 0,
  }));
  const objects = new Map<string, Object3D>();
  for (const row of rows.nodes) {
    let object: Object3D = new Group();
    if (row.geometry !== undefined) {
      const geometry = geometries[row.geometry], material = materials[row.materials?.[0] ?? -1];
      if (geometry === undefined || material === undefined || row.materials?.length !== 1) throw new Error('Missing pilot mesh');
      object = new Mesh(geometry, material);
    }
    object.name = row.name; object.visible = row.visible; object.castShadow = row.castShadow; object.receiveShadow = row.receiveShadow; object.matrixAutoUpdate = false; object.matrix.copy(new Matrix4().fromArray(row.matrix));
    objects.set(row.id, object);
    if (row.parent !== null) { const parent = objects.get(row.parent); if (parent === undefined) throw new Error('Missing graph parent'); parent.add(object); }
  }
  const root = rows.nodes[0], object = root === undefined ? undefined : objects.get(root.id);
  if (object === undefined) throw new Error('Missing graph root'); return object;
}
function rebuilt(source: PropsBakeSource): PropsBakeSource {
  const copy = (object: Object3D): Object3D => graph(readScene(object));
  const colliders = source.colliders?.map(row => ({ ...row, shapes: row.shapes.map((shape, index) => {
    if (shape.kind === 'treads') return { ...shape }; // Retained authored stair law; not a box approximation.
    const { yaw, rot, surface, ...box } = shape;
    const collider = BoxCollider.fromData({ ...box, ...(yaw === undefined ? {} : { yaw }), ...(rot === undefined ? {} : { rot }), ...(surface === undefined ? {} : { surface }) });
    collider.name = `${row.id}.${index}`;
    const emitted = readScene(collider).colliders[0]?.shape;
    if (emitted?.kind !== 'box') throw new Error('Missing authored box'); return emitted;
  }) }));
  return { ...source, ...(colliders === undefined ? {} : { colliders }), static: copy(source.static),
    ...(source.coarse === undefined ? {} : { coarse: copy(source.coarse) }), ...(source.far === undefined ? {} : { far: copy(source.far) }),
    ...(source.scatter === undefined ? {} : { scatter: source.scatter.map(row => ({ model: copy(row.model), transforms: row.transforms.map(matrix => new Matrix4().fromArray(matrix.elements)) })) }),
    ...(source.panels === undefined ? {} : { panels: source.panels.map(row => ({ ...row, model: copy(row.model) })) }),
    ...(source.models === undefined ? {} : { models: source.models.map(row => ({ ...row, model: copy(row.model) })) }),
  };
}
for (const [name, fixture] of [['Template 1', templateProps], ['Pastel Plain', pastelProps]] as const) {
  it(`${name}: the scene reader preserves every compiled prop row and GLB byte`, () => {
    const authored = fixture(20);
    try {
      const before = bakeProps(authored.source), after = bakeProps(rebuilt(authored.source));
      expect(after.props).toStrictEqual(before.props); expect(after.files).toStrictEqual(before.files);
      expect(after.tiles).toStrictEqual(before.tiles); expect(after.far).toStrictEqual(before.far);
      expect([...after.assets.keys()]).toEqual([...before.assets.keys()]);
      for (const [hash, bytes] of before.assets) { const actual = after.assets.get(hash); if (actual === undefined) throw new Error(`Missing compiled asset ${hash}`); expect(contentHash(actual), hash).toBe(contentHash(bytes)); }
    } finally { authored.dispose(); }
  });
}
