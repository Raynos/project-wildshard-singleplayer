// oxlint-disable-next-line import/no-nodejs-modules -- Inspect shipped immutable prop bytes, not a re-bake.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Box3, Group, InstancedMesh, Matrix4, Mesh, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as v from 'valibot';
import metadata from '../src/shards/_template/data/props.json' with { type: 'json' };
import { PropsSchema } from '../src/game/shardfile/props';
import { contentHash } from '../src/sdk/project';
import { templateProps } from '../scripts/bake/templatePropsSource';
import { bakeProps } from '../src/sdk/bake/props';

const pointKey = (point: Vector3): string => [point.x, point.y, point.z].map((n) => n.toFixed(4)).join(',');
function isMesh(object: Object3D): object is Mesh { return object instanceof Mesh; }
function vertices(root: Object3D): Set<string> {
  root.updateMatrixWorld(true);
  const found = new Set<string>();
  root.traverse((object) => {
    if (!isMesh(object)) return;
    const position = object.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) found.add(pointKey(new Vector3().fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld)));
  });
  return found;
}
function dispose(root: Object3D): void {
  root.traverse((object) => {
    if (!isMesh(object)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
  });
}
async function shipped(hash: string): Promise<Object3D> {
  const bytes = Uint8Array.from(readFileSync(`public/assets/baked/template-props/${hash}`));
  expect(contentHash(bytes)).toBe(hash);
  return (await new GLTFLoader().parseAsync(bytes.buffer, '')).scene;
}

it('ships the ten stair treads, slope, twenty cubes and three practice pads with their collision declarations', async () => {
  const props = v.parse(PropsSchema, metadata.props), fixture = templateProps(20), roots: Object3D[] = [];
  try {
    const ramp = fixture.source.static.children[1];
    if (ramp === undefined) throw new Error('Missing generator ramp');
    expect(ramp.children).toHaveLength(11);
    const rampTile = props.tiles.find((row) => row.lod === 0 && row.x === 4 && row.z === 3);
    if (rampTile === undefined) throw new Error('Missing shipped stair tile');
    const bakedRamp = await shipped(rampTile.file); roots.push(bakedRamp);
    const bakedVertices = vertices(bakedRamp);
    for (const point of vertices(ramp)) expect(bakedVertices.has(point), `Missing stair/slope vertex ${point}`).toBe(true);
    const collision = props.colliders.find((row) => row.id === 'template.ramp');
    expect(collision?.initialActive).toBe(true);
    expect(collision?.shapes).toEqual(fixture.source.colliders?.find((row) => row.id === 'template.ramp')?.shapes);

    const positions: string[] = [], mergedVertices = new Set<string>();
    for (const row of props.tiles.filter((tile) => tile.lod === 0)) {
      const root = await shipped(row.file); roots.push(root);
      for (const point of vertices(root)) mergedVertices.add(point);
      root.traverse((object) => {
        if (!(object instanceof InstancedMesh)) return;
        for (let i = 0; i < object.count; i++) {
          const matrix = new Matrix4(); object.getMatrixAt(i, matrix);
          positions.push(pointKey(new Vector3().setFromMatrixPosition(matrix)));
        }
      });
    }
    const scatter = fixture.source.scatter?.[0];
    if (scatter === undefined || !isMesh(scatter.model)) throw new Error('Missing generator cubes');
    expect(scatter.transforms).toHaveLength(20);
    // every instance is an authored cube or one of G220's lamp posts (the second scatter)
    const authored = (fixture.source.scatter ?? []).flatMap((batch) => batch.transforms.map((matrix) => pointKey(new Vector3().setFromMatrixPosition(matrix))));
    for (const point of positions) expect(authored).toContain(point);
    // A cube crossing a tile boundary is merged and clipped, rather than instanced in either tile.
    const cubeVertices = scatter.model.geometry.getAttribute('position');
    for (const matrix of scatter.transforms) {
      if (positions.includes(pointKey(new Vector3().setFromMatrixPosition(matrix)))) continue;
      for (let i = 0; i < cubeVertices.count; i++) {
        const point = pointKey(new Vector3().fromBufferAttribute(cubeVertices, i).applyMatrix4(matrix));
        expect(mergedVertices.has(point), `Missing boundary cube vertex ${point}`).toBe(true);
      }
    }

    const course = props.panels.find((row) => row.id === 'template.jump'), authoredCourse = fixture.source.panels?.find((row) => row.id === 'template.jump');
    if (course === undefined || authoredCourse === undefined) throw new Error('Missing practice course');
    expect(course.visible).toBe(false);
    const bakedCourse = await shipped(course.file); roots.push(bakedCourse);
    const padVertices = vertices(bakedCourse);
    for (const point of vertices(authoredCourse.model)) expect(padVertices.has(point), `Missing practice pad vertex ${point}`).toBe(true);
    const courseCollision = props.colliders.find((row) => row.id === 'template.jump');
    expect(courseCollision?.initialActive).toBe(false);
    expect(courseCollision?.shapes).toHaveLength(3);
    expect(courseCollision?.shapes).toEqual(fixture.source.colliders?.find((row) => row.id === 'template.jump')?.shapes);
  } finally { for (const root of roots) dispose(root); fixture.dispose(); }
});

it('keeps hidden practice pads in the library while automatic coarse and far bytes exclude them', async () => {
  const fixture = templateProps(20), roots: Object3D[] = [];
  try {
    const panels = fixture.source.panels?.filter((panel) => panel.visible !== false) ?? [];
    const baked = bakeProps(fixture.source), visibleOnly = bakeProps({ ...fixture.source, panels,
      colliders: fixture.source.colliders?.filter((row) => row.panel === null || panels.some((panel) => panel.id === row.panel)) ?? [],
    });
    expect(baked.props.tiles.filter((row) => row.lod === 1)).toEqual(visibleOnly.props.tiles.filter((row) => row.lod === 1));
    expect(baked.far).toEqual(visibleOnly.far);
    const course = baked.props.panels.find((row) => row.id === 'template.jump');
    expect(course?.visible).toBe(false); expect(baked.library).toContain(course?.file);
    expect(baked.props.colliders).toEqual(fixture.source.colliders);
    // Inspect the shipped bytes as well as a fresh bake: no proxy vertex can sit in the y=30 practice pads (G220's tall
    // towers stand elsewhere in the cell).
    const pads = new Box3().setFromObject(fixture.source.panels?.find((panel) => panel.id === 'template.jump')?.model ?? new Group()).expandByScalar(0.5);
    expect(pads.isEmpty()).toBe(false);
    for (const hash of [...metadata.props.tiles.filter((row) => row.lod === 1).map((row) => row.file), metadata.props.far]) {
      const root = await shipped(hash); roots.push(root);
      for (const point of vertices(root)) { const [x = 0, y = 0, z = 0] = point.split(',').map(Number); expect(pads.containsPoint(new Vector3(x, y, z)), `proxy vertex ${point} in the practice pads`).toBe(false); }
    }
    expect(metadata.props.panels.find((row) => row.id === 'template.jump')?.file).toBe(course?.file);
    expect(metadata.props.tiles.filter((row) => row.lod === 1)).toEqual(baked.props.tiles.filter((row) => row.lod === 1));
    expect(metadata.far).toEqual(baked.far);
  } finally { for (const root of roots) dispose(root); fixture.dispose(); }
});
