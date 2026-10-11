import { expect, it } from 'vitest';
import { Matrix4, type Object3D } from 'three';
import { BoxCollider } from '../src/sdk/physics';
import { readScene, type SceneDescription } from '../src/sdk/scene';
import { restoreSceneGraph } from '../src/sdk/sceneGraph';
import { contentHash } from '../src/sdk/project';
import { bakeProps, type PropsBakeSource } from '../src/sdk/bake/props';
import { templateProps } from '../src/shards/_template/generators/templatePropsSource';
import { pastelProps } from '../src/shards/pastel-plain/generators/props';

// Independent consumer of the JSON intermediate, not a clone of the input graph. The pilot's PBR geometry is
// deliberately reconstructed from emitted channels/matrices before the existing compiler sees any object.
function graph(rows: SceneDescription): Object3D {
  return restoreSceneGraph(rows);
}
function rebuilt(source: PropsBakeSource): PropsBakeSource {
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- The gate crosses JSON wire transport; structuredClone bypasses it.
  const copy = (object: Object3D): Object3D => graph(JSON.parse(JSON.stringify(readScene(object))) as SceneDescription);
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
  it(`${name}: the scene reader preserves every compiled prop row and GLB byte through persisted scene JSON`, () => {
    const authored = fixture(20);
    try {
      const before = bakeProps(authored.source), after = bakeProps(rebuilt(authored.source));
      expect(after.props).toStrictEqual(before.props); expect(after.files).toStrictEqual(before.files);
      expect(after.tiles).toStrictEqual(before.tiles); expect(after.far).toStrictEqual(before.far);
      expect([...after.assets.keys()]).toEqual([...before.assets.keys()]);
      for (const [hash, bytes] of before.assets) { const actual = after.assets.get(hash); if (actual === undefined) throw new Error(`Missing compiled asset ${hash}`); expect(contentHash(actual), hash).toBe(contentHash(bytes)); expect(actual.length, hash).toBe(bytes.length); expect(actual.every((byte, index) => byte === bytes[index]), hash).toBe(true); }
    } finally { authored.dispose(); }
  });
}
